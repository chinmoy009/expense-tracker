import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService, Expense } from './expense.service';
import { CategoryService, CategoryNode } from './category.service';
import { parseLocalISODate } from '../utils/date.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface FilterState {
  month: number | null; // 0-11
  year: number | null;
  categoryId: string | null;
  specificDate: string | null;
  searchText: string;
}

export interface AnalyticsResult {
  total: number;
  filteredExpenses: Expense[];
  categoryDistribution: { [category: string]: number };
  dailyTrend: { [date: string]: number };
  dayCount: number; // Days in the selected period, used for daily average
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private filterSubject = new BehaviorSubject<FilterState>({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    categoryId: null,
    specificDate: null,
    searchText: ''
  });

  filter$ = this.filterSubject.asObservable();

  result$ = combineLatest([
    this.expenseService.expenses$,
    this.categoryService.categories$,
    this.filter$
  ]).pipe(
    map(([expenses, categories, filter]) => this.processData(expenses, categories, filter))
  );

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) { }

  /** Current filter state, synchronously. */
  currentFilter(): FilterState {
    return this.filterSubject.value;
  }

  updateFilter(filter: Partial<FilterState>) {
    this.filterSubject.next({ ...this.filterSubject.value, ...filter });
  }

  private processData(expenses: Expense[], categories: CategoryNode[], filter: FilterState): AnalyticsResult {
    // 1. Filter Expenses
    const filtered = expenses.filter(e => {
      const date = parseLocalISODate(e.date);

      // Text Search (Description/Note)
      if (filter.searchText) {
        const search = filter.searchText.toLowerCase();
        if (!e.note || !e.note.toLowerCase().includes(search)) return false;
      }

      // Specific Date Priority
      if (filter.specificDate) {
        if (e.date.split('T')[0] !== filter.specificDate) return false;
      } else {
        // Month/Year (if no specific range or date)
        if (filter.year !== null && date.getFullYear() !== filter.year) return false;
        if (filter.month !== null && date.getMonth() !== filter.month) return false;
      }

      // Category (Recursive)
      if (filter.categoryId) {
        const allowedCategories = this.getAllChildCategories(filter.categoryId, categories);
        if (!allowedCategories.has(e.category)) return false;
      }

      return true;
    });

    // 2. Aggregations
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);

    const categoryDistribution: { [key: string]: number } = {};
    const dailyTrend: { [key: string]: number } = {};

    filtered.forEach(e => {
      // Distribution
      categoryDistribution[e.category] = (categoryDistribution[e.category] || 0) + e.amount;

      // Trend (YYYY-MM-DD)
      const dayKey = e.date.split('T')[0];
      dailyTrend[dayKey] = (dailyTrend[dayKey] || 0) + e.amount;
    });

    return {
      total,
      filteredExpenses: filtered,
      categoryDistribution,
      dailyTrend,
      dayCount: this.countPeriodDays(filter, filtered)
    };
  }

  // Days covered by the active filter. Current month/year count only elapsed days.
  private countPeriodDays(filter: FilterState, filtered: Expense[]): number {
    if (filter.specificDate) return 1;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (filter.month !== null && filter.year !== null) {
      const isCurrentMonth = filter.year === today.getFullYear() && filter.month === today.getMonth();
      if (isCurrentMonth) return today.getDate();
      return new Date(filter.year, filter.month + 1, 0).getDate();
    }

    if (filter.year !== null) {
      const yearStart = new Date(filter.year, 0, 1);
      const yearEnd = filter.year === today.getFullYear() ? todayStart : new Date(filter.year, 11, 31);
      return Math.round((yearEnd.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1;
    }

    // All months and years: span from first to last filtered expense
    if (filtered.length === 0) return 1;
    const times = filtered.map(e => parseLocalISODate(e.date).getTime());
    const span = Math.round((Math.max(...times) - Math.min(...times)) / MS_PER_DAY) + 1;
    return Math.max(1, span);
  }

  private getAllChildCategories(rootId: string, tree: CategoryNode[]): Set<string> {
    const result = new Set<string>();

    // Find root node
    const findNode = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const node of nodes) {
        if (node.id === rootId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };

    const root = findNode(tree);
    if (!root) return result;

    // Collect all names recursively
    const collect = (node: CategoryNode) => {
      result.add(node.name);
      node.children.forEach(collect);
    };

    collect(root);
    return result;
  }
}
