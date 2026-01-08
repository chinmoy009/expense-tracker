import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExpenseService, Expense } from './expense.service';
import { CategoryService, CategoryNode } from './category.service';

export interface FilterState {
  startDate: Date | null;
  endDate: Date | null;
  month: number | null; // 0-11
  year: number | null;
  categoryId: string | null;
  specificDate: string | null;
}

export interface AnalyticsResult {
  total: number;
  filteredExpenses: Expense[];
  categoryDistribution: { [category: string]: number };
  dailyTrend: { [date: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private filterSubject = new BehaviorSubject<FilterState>({
    startDate: null,
    endDate: null,
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    categoryId: null,
    specificDate: null
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

  updateFilter(filter: Partial<FilterState>) {
    this.filterSubject.next({ ...this.filterSubject.value, ...filter });
  }

  private processData(expenses: Expense[], categories: CategoryNode[], filter: FilterState): AnalyticsResult {
    // 1. Filter Expenses
    const filtered = expenses.filter(e => {
      const date = new Date(e.date);

      // Date Range
      if (filter.startDate && date < filter.startDate) return false;
      if (filter.endDate && date > filter.endDate) return false;

      // Specific Date Priority
      if (filter.specificDate) {
        if (e.date.split('T')[0] !== filter.specificDate) return false;
      } else if (!filter.startDate && !filter.endDate) {
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
      dailyTrend
    };
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
