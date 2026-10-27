import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ExpenseService, Expense } from '../../services/expense.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { SettingsService } from '../../services/settings.service';
import { parseLocalISODate, toLocalISODate } from '../../utils/date.util';
import { Subscription } from 'rxjs';

/** Add or edit an expense. Opened through AppActionsService; data is the expense to edit, or undefined. */
@Component({
  selector: 'app-add-expense-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ editMode ? 'Edit expense' : 'Add expense' }}</h2>

    <form (ngSubmit)="onSubmit()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Amount</mat-label>
          <span matTextPrefix>{{ currencySymbol }}&nbsp;</span>
          <input matInput name="amount" [(ngModel)]="amountInput" placeholder="0.00" autocomplete="off" required cdkFocusInitial>
          <mat-hint>Formulas allowed, e.g. =12+8*2</mat-hint>
        </mat-form-field>
        <div *ngIf="formulaError" class="error-text" role="alert">{{ formulaError }}</div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="datePicker" name="date" [(ngModel)]="dateValue" placeholder="Choose a date" required>
          <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
          <mat-datepicker #datePicker></mat-datepicker>
        </mat-form-field>

        <div class="field-label">Category</div>
        <nav class="crumbs" *ngIf="breadcrumbs.length > 0" aria-label="Category path">
          <button type="button" class="crumb" (click)="resetCategory()" aria-label="Top level categories">
            <mat-icon>home</mat-icon>
          </button>
          <ng-container *ngFor="let crumb of breadcrumbs; let i = index">
            <span class="sep">/</span>
            <button type="button" class="crumb" (click)="goToLevel(i)">{{ crumb.name }}</button>
          </ng-container>
        </nav>

        <div class="cat-grid" *ngIf="currentNodes.length > 0">
          <button
            type="button"
            *ngFor="let node of currentNodes"
            class="cat-btn"
            [class.active]="selectedCategory === node.name"
            [attr.aria-pressed]="selectedCategory === node.name"
            (click)="selectNode(node)">
            <mat-icon>{{ node.children.length > 0 ? 'folder' : 'label' }}</mat-icon>
            <span>{{ node.name }}</span>
          </button>
        </div>
        <div *ngIf="currentNodes.length === 0" class="lm-muted">
          No categories found. Use the Categories panel to add some.
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Note</mat-label>
          <input matInput name="note" [(ngModel)]="note" placeholder="What was it for?">
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!amountInput || !selectedCategory || !dateValue">
          {{ editMode ? 'Update expense' : 'Save expense' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; gap: 4px; }
    .full { width: 100%; }
    .error-text { color: var(--accent-danger); font-size: 0.85rem; margin: -8px 0 8px; }
    .field-label { font-size: 0.875rem; color: var(--text-secondary); margin: 8px 0; }
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 8px; }
    .crumb { background: none; border: none; color: var(--accent-secondary); cursor: pointer; padding: 2px 4px; border-radius: 6px; font: inherit; }
    .crumb:hover { background: var(--surface-2); }
    .sep { color: var(--text-muted); }
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 12px; padding: 2px; }
    .cat-btn {
      display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: 12px; cursor: pointer;
      background: var(--surface-2); border: 1px solid transparent; color: var(--text-secondary); font: inherit; text-align: left;
    }
    .cat-btn:hover { color: var(--text-primary); }
    .cat-btn.active { border-color: var(--accent-secondary); color: var(--accent-secondary); background: color-mix(in srgb, var(--accent-secondary) 12%, transparent); }
    .cat-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `]
})
export class AddExpenseModalComponent implements OnInit, OnDestroy {
  private subs: Subscription[] = [];

  amountInput: string = '';
  formulaError: string | null = null;
  note: string = '';
  dateValue: Date | null = new Date();
  currencySymbol: string = '$';

  // Category Logic
  rootCategories: CategoryNode[] = [];
  currentNodes: CategoryNode[] = [];
  breadcrumbs: CategoryNode[] = [];
  selectedCategory: string | null = null;

  // Edit Mode
  editMode = false;
  editingId: number | null = null;

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) private expenseToEdit: Expense | undefined,
    public dialogRef: MatDialogRef<AddExpenseModalComponent>,
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.subs.push(this.categoryService.categories$.subscribe(cats => {
      this.rootCategories = cats;
      if (this.breadcrumbs.length === 0) {
        this.currentNodes = cats;
      }
    }));

    this.subs.push(this.settingsService.currency$.subscribe(c => {
      this.currencySymbol = this.settingsService.getCurrencySymbol(c);
    }));

    if (this.expenseToEdit) {
      this.editMode = true;
      this.editingId = this.expenseToEdit.id;
      this.amountInput = this.expenseToEdit.amount.toString();
      this.note = this.expenseToEdit.note;
      this.dateValue = parseLocalISODate(this.expenseToEdit.date);
      this.selectedCategory = this.expenseToEdit.category;
      // Breadcrumb path is not restored; the user re-selects if they want to change category
      this.currentNodes = this.rootCategories;
    }
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  // Navigation
  resetCategory() {
    this.currentNodes = this.rootCategories;
    this.breadcrumbs = [];
    this.selectedCategory = null;
  }

  selectNode(node: CategoryNode) {
    if (node.children.length > 0) {
      // Drill down
      this.breadcrumbs.push(node);
      this.currentNodes = node.children;
    } else {
      // Select leaf
      this.selectedCategory = node.name;
    }
  }

  goToLevel(index: number) {
    // Go back to a specific parent
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    const parent = this.breadcrumbs[this.breadcrumbs.length - 1];
    this.currentNodes = parent.children;
    this.selectedCategory = null;
  }

  evaluateFormula(input: string): number | null {
    if (!input.startsWith('=')) {
      const num = Number(input);
      return isNaN(num) ? null : num;
    }

    const formula = input.substring(1).replace(/\s+/g, '');
    try {
      // Basic expression parser using a safe approach
      // Supports +, -, *, /, ()
      return this.parseExpression(formula);
    } catch (e) {
      return null;
    }
  }

  private parseExpression(str: string): number {
    let pos = 0;

    const parsePrimary = (): number => {
      if (str[pos] === '(') {
        pos++; // Skip (
        const val = parseAddSub();
        if (str[pos] !== ')') throw new Error('Unbalanced parentheses');
        pos++; // Skip )
        return val;
      }

      const start = pos;
      if (str[pos] === '-') pos++;
      while (pos < str.length && /[0-9.]/.test(str[pos])) pos++;
      const numStr = str.substring(start, pos);
      const val = parseFloat(numStr);
      if (isNaN(val)) throw new Error('Invalid number');
      return val;
    };

    const parseMulDiv = (): number => {
      let val = parsePrimary();
      while (pos < str.length && (str[pos] === '*' || str[pos] === '/')) {
        const op = str[pos++];
        const next = parsePrimary();
        if (op === '*') val *= next;
        else {
          if (next === 0) throw new Error('Division by zero');
          val /= next;
        }
      }
      return val;
    };

    const parseAddSub = (): number => {
      let val = parseMulDiv();
      while (pos < str.length && (str[pos] === '+' || str[pos] === '-')) {
        const op = str[pos++];
        const next = parseMulDiv();
        if (op === '+') val += next;
        else val -= next;
      }
      return val;
    };

    const result = parseAddSub();
    if (pos < str.length) throw new Error('Incomplete expression');
    return result;
  }

  onSubmit() {
    this.formulaError = null;
    const evaluatedAmount = this.evaluateFormula(this.amountInput);

    if (evaluatedAmount === null) {
      this.formulaError = 'Invalid amount or formula';
      return;
    }

    if (evaluatedAmount <= 0) {
      this.formulaError = 'Amount must be greater than 0';
      return;
    }

    if (this.selectedCategory && this.dateValue) {
      const date = toLocalISODate(this.dateValue);
      if (this.editMode && this.editingId) {
        this.expenseService.updateExpense({
          id: this.editingId,
          amount: evaluatedAmount,
          category: this.selectedCategory,
          note: this.note,
          date
        });
      } else {
        this.expenseService.addExpense({
          amount: evaluatedAmount,
          category: this.selectedCategory,
          note: this.note,
          date
        });
      }
      this.dialogRef.close();
    }
  }
}
