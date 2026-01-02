import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../services/analytics.service';
import { Expense, ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="transactions-section">
        <div class="section-header">
            <h2>Activity</h2>
            <span class="count">{{ expenses.length }} transactions</span>
        </div>
        
        <div class="transaction-list">
            <div class="transaction-item" *ngFor="let expense of expenses">
                <div class="t-icon" [ngClass]="getCategoryClass(expense.category)">
                    <i [class]="getIconClass(expense.category)"></i>
                </div>
                <div class="t-details">
                    <h4>{{ expense.note || expense.category }}</h4>
                    <span class="t-date">{{ expense.date | date:'short' }}</span>
                    <span class="t-cat-badge">{{ expense.category }}</span>
                </div>
                <div class="t-actions">
                    <div class="t-amount negative">-{{ expense.amount | currency:currencyCode }}</div>
                    <div class="action-buttons">
                        <button class="icon-btn edit-btn" (click)="onEdit(expense)" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="icon-btn delete-btn" (click)="onDelete(expense.id)" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div *ngIf="expenses.length === 0" style="text-align:center; padding: 20px; color: rgba(255,255,255,0.5);">
                No expenses found for this period.
            </div>
        </div>
    </section>
  `,
  styles: [`
    .transactions-section { margin-top: 20px; }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .section-header h2 { font-size: 1.2rem; font-weight: 600; }
    .count { color: var(--text-secondary); font-size: 0.9rem; }
    
    .transaction-item {
        display: flex;
        align-items: center;
        padding: 15px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .t-icon {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        background: rgba(255,255,255,0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        font-size: 1.1rem;
    }
    .category-food { color: #ff9f1c; background: rgba(255, 159, 28, 0.1); }
    .category-transport { color: #4cc9f0; background: rgba(76, 201, 240, 0.1); }
    .category-shopping { color: #f72585; background: rgba(247, 37, 133, 0.1); }
    
    .t-details { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .t-details h4 { font-size: 1rem; font-weight: 500; margin: 0; }
    .t-date { font-size: 0.8rem; color: var(--text-secondary); }
    .t-cat-badge { font-size: 0.7rem; color: var(--accent-secondary); background: rgba(76, 201, 240, 0.1); padding: 2px 6px; border-radius: 4px; align-self: flex-start; margin-top: 2px; }
    
    .t-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
    .t-amount { font-weight: 600; }
    
    .action-buttons { display: flex; gap: 8px; opacity: 0; transition: opacity 0.2s; }
    .transaction-item:hover .action-buttons { opacity: 1; }
    
    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
    }
    .edit-btn { color: var(--text-secondary); }
    .edit-btn:hover { color: var(--accent-secondary); background: rgba(76, 201, 240, 0.1); }
    .delete-btn { color: var(--text-secondary); }
    .delete-btn:hover { color: var(--accent-danger); background: rgba(247, 37, 133, 0.1); }
  `]
})
export class TransactionListComponent implements OnInit {
  @Output() edit = new EventEmitter<Expense>();
  expenses: Expense[] = [];
  currencyCode: string = 'USD';

  constructor(
    private analyticsService: AnalyticsService,
    private settingsService: SettingsService,
    private expenseService: ExpenseService
  ) {
    this.settingsService.currency$.subscribe(c => this.currencyCode = c);
  }

  ngOnInit() {
    this.analyticsService.result$.subscribe(result => {
      // Show all filtered expenses, sorted by date desc
      this.expenses = result.filteredExpenses.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });
  }

  getCategoryClass(category: string): string {
    if (category.toLowerCase().includes('food')) return 'category-food';
    if (category.toLowerCase().includes('transport')) return 'category-transport';
    if (category.toLowerCase().includes('shopping')) return 'category-shopping';
    return 'category-shopping';
  }

  getIconClass(category: string): string {
    if (category.toLowerCase().includes('food')) return 'fa-solid fa-utensils';
    if (category.toLowerCase().includes('transport')) return 'fa-solid fa-taxi';
    if (category.toLowerCase().includes('shopping')) return 'fa-solid fa-bag-shopping';
    return 'fa-solid fa-bag-shopping';
  }

  onEdit(expense: Expense) {
    this.edit.emit(expense);
  }

  onDelete(id: number) {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.expenseService.deleteExpense(id);
    }
  }
}
