import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SummaryCardComponent } from '../summary-card/summary-card.component';
import { ChartComponent } from '../chart/chart.component';
import { ExpenseGridComponent } from '../expense-grid/expense-grid.component';
import { SearchFilterComponent } from '../search-filter/search-filter.component';
import { ExpenseService, Expense } from '../../services/expense.service';
import { AnalyticsService } from '../../services/analytics.service';
import { NotifyService } from '../../shared/notify/notify.service';
import { AppActionsService } from '../../shared/app-actions.service';

/** Expenses page: filter bar, KPI row, data grid, and the spending chart beside it. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SearchFilterComponent, SummaryCardComponent, ChartComponent, ExpenseGridComponent],
  template: `
    <app-search-filter></app-search-filter>

    <section class="kpis" aria-label="Summary">
      <app-summary-card
        label="Total spend"
        [amount]="totalSpend"
        icon="account_balance_wallet"
        hint="Selected period">
      </app-summary-card>
      <app-summary-card
        label="Daily average"
        [amount]="dailyAverage"
        icon="show_chart"
        [hint]="'Across ' + dayCount + (dayCount === 1 ? ' day' : ' days')">
      </app-summary-card>
      <app-summary-card
        label="Transactions"
        [amount]="count"
        icon="receipt_long"
        hint="Matching filters"
        [isCount]="true">
      </app-summary-card>
    </section>

    <div class="workspace">
      <section class="grid-panel lm-card">
        <app-expense-grid
          [expenses]="expenses"
          [total]="totalSpend"
          (edit)="actions.editExpense($event)"
          (delete)="confirmDelete($event)">
        </app-expense-grid>
      </section>

      <aside class="side-panel lm-card">
        <app-chart></app-chart>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 16px 0; }
    .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
    .grid-panel { min-width: 0; }
    .side-panel { position: sticky; top: 0; }

    @media (max-width: 1099.98px) {
      .workspace { grid-template-columns: minmax(0, 1fr); }
      .side-panel { position: static; }
    }
    @media (max-width: 767.98px) {
      .kpis { grid-template-columns: minmax(0, 1fr); gap: 10px; margin: 12px 0; }
      .workspace { gap: 12px; }
      .side-panel { order: -1; } /* chart sits between KPIs and the list on phones */
      .lm-card { padding: 16px; }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  totalSpend = 0;
  dailyAverage = 0;
  dayCount = 1;
  count = 0;
  expenses: Expense[] = [];

  private sub?: Subscription;

  constructor(
    private expenseService: ExpenseService,
    private analyticsService: AnalyticsService,
    private notify: NotifyService,
    public actions: AppActionsService
  ) { }

  ngOnInit() {
    this.sub = this.analyticsService.result$.subscribe(result => {
      this.totalSpend = result.total;
      this.dayCount = result.dayCount;
      this.dailyAverage = result.dayCount > 0 ? result.total / result.dayCount : 0;
      this.expenses = result.filteredExpenses;
      this.count = result.filteredExpenses.length;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  confirmDelete(expense: Expense) {
    this.notify.confirm({
      title: 'Delete expense',
      message: 'Are you sure you want to delete this expense?',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        this.expenseService.deleteExpense(expense.id);
      }
    });
  }
}
