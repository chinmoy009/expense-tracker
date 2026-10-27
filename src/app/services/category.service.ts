import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { SheetsService } from './sheets.service';
import { ExpenseService } from './expense.service';
import { GoogleApiService } from './google-api.service';
import { NotifyService } from '../shared/notify/notify.service';

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryNode[];
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private categoriesSubject = new BehaviorSubject<CategoryNode[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  /** Current category tree, synchronously. */
  snapshot(): CategoryNode[] {
    return this.categoriesSubject.value;
  }

  private flatCategories: any[] = [];
  private isInitialized = false;
  private signedIn = false;
  private readonly storageKey = 'lumina_categories';

  constructor(
    private sheetsService: SheetsService,
    private expenseService: ExpenseService,
    private googleApiService: GoogleApiService,
    private notify: NotifyService
  ) {
    this.googleApiService.user$.subscribe(user => {
      this.signedIn = !!user;
      if (user) {
        this.init();
      } else {
        this.loadLocal();
      }
    });
  }

  async init() {
    if (this.isInitialized) return;

    await this.sheetsService.ensureCategoriesTab();
    await this.loadCategories();
    this.syncWithExpenses();

    this.isInitialized = true;
  }

  private async loadCategories() {
    this.flatCategories = await this.sheetsService.getCategories();
    this.buildTree();
  }

  // Signed-out mode: categories live in localStorage so expenses can still be added
  private loadLocal() {
    this.isInitialized = false;
    const saved = localStorage.getItem(this.storageKey);
    this.flatCategories = saved ? JSON.parse(saved) : [];
    this.buildTree();
  }

  private saveLocal() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.flatCategories));
  }

  private buildTree() {
    const nodes: { [id: string]: CategoryNode } = {};
    const tree: CategoryNode[] = [];

    // Create nodes
    this.flatCategories.forEach(cat => {
      nodes[cat.id] = { ...cat, children: [] };
    });

    // Build hierarchy
    this.flatCategories.forEach(cat => {
      if (cat.parentId && nodes[cat.parentId]) {
        nodes[cat.parentId].children.push(nodes[cat.id]);
      } else {
        tree.push(nodes[cat.id]);
      }
    });

    this.categoriesSubject.next(tree);
  }

  private syncWithExpenses() {
    this.expenseService.expenses$.pipe(
      filter(expenses => expenses.length > 0),
      take(1)
    ).subscribe(async (expenses) => {
      const existingNames = new Set(this.flatCategories.map(c => c.name.toLowerCase()));
      const newCategories = new Set<string>();

      expenses.forEach(e => {
        if (!existingNames.has(e.category.toLowerCase())) {
          newCategories.add(e.category);
        }
      });

      for (const name of newCategories) {
        // Add as top-level category
        await this.addCategory(name, null);
      }
    });
  }

  async addCategory(name: string, parentId: string | null) {
    // Duplicate check (under same parent)
    const exists = this.flatCategories.some(c =>
      c.name.toLowerCase() === name.toLowerCase() && c.parentId === parentId
    );
    if (exists) return;

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    if (this.signedIn) {
      await this.sheetsService.addCategory(id, name, parentId);
    }

    // Refresh local state
    this.flatCategories.push({ id, name, parentId });
    if (!this.signedIn) this.saveLocal();
    this.buildTree();
  }

  async updateCategory(id: string, newName: string) {
    const category = this.flatCategories.find(c => c.id === id);
    if (!category) return;

    const oldName = category.name;
    if (this.signedIn) {
      await this.sheetsService.updateCategory(id, newName);
    }

    // Update local state
    category.name = newName;
    if (!this.signedIn) this.saveLocal();
    this.buildTree();

    // Update expenses that use this category
    // We need to subscribe to expenses to get the current list, but we can just use the current value if it's a BehaviorSubject
    // ExpenseService.expenses$ is an Observable.
    // Let's just trigger a one-off check.
    this.expenseService.expenses$.pipe(take(1)).subscribe(async (expenses) => {
      const expensesToUpdate = expenses.filter(e => e.category === oldName);
      for (const expense of expensesToUpdate) {
        const updatedExpense = { ...expense, category: newName };
        await this.expenseService.updateExpense(updatedExpense);
      }
    });
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = this.flatCategories.find(c => c.id === id);
    if (!category) return false;

    // Check if used in expenses
    let isUsed = false;
    this.expenseService.expenses$.pipe(take(1)).subscribe(expenses => {
      isUsed = expenses.some(e => e.category === category.name);
    });

    if (isUsed) {
      this.notify.error(`Cannot delete category "${category.name}" because it is used in expenses.`);
      return false;
    }

    // Check if has children
    const hasChildren = this.flatCategories.some(c => c.parentId === id);
    if (hasChildren) {
      this.notify.error(`Cannot delete category "${category.name}" because it has sub-categories.`);
      return false;
    }

    if (this.signedIn) {
      await this.sheetsService.deleteCategory(id);
    }

    // Update local state
    this.flatCategories = this.flatCategories.filter(c => c.id !== id);
    if (!this.signedIn) this.saveLocal();
    this.buildTree();
    return true;
  }

  async importFromExpenses(): Promise<number> {
    const count = await this.sheetsService.importCategoriesFromExpenses();
    if (count > 0) {
      await this.loadCategories(); // Reload full tree
    }
    return count;
  }
}
