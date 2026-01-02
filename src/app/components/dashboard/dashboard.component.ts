import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SummaryCardComponent } from '../summary-card/summary-card.component';
import { ChartComponent } from '../chart/chart.component';
import { TransactionListComponent } from '../transaction-list/transaction-list.component';
import { AddExpenseModalComponent } from '../add-expense-modal/add-expense-modal.component';
import { ImportModalComponent } from '../import-modal/import-modal.component';
import { CategoryManagerComponent } from '../category-manager/category-manager.component';
import { SearchFilterComponent } from '../search-filter/search-filter.component';
import { ExpenseService } from '../../services/expense.service';
import { AnalyticsService, AnalyticsResult } from '../../services/analytics.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SummaryCardComponent,
    ChartComponent,
    TransactionListComponent,
    AddExpenseModalComponent,
    ImportModalComponent,
    CategoryManagerComponent,
    SearchFilterComponent
  ],
  template: `
    <main>
        <!-- Search & Filters -->
        <app-search-filter></app-search-filter>

        <!-- Dashboard Cards -->
        <section class="dashboard-grid">
            <app-summary-card
                title="Total Spend"
                [amount]="totalSpend"
                icon="fa-solid fa-wallet"
                trend="Selected Period"
                className="total-balance"
            ></app-summary-card>

            <app-summary-card
                title="Daily Average"
                [amount]="dailyAverage"
                icon="fa-solid fa-chart-line"
                className="daily-spend"
                trend="Based on selection"
            ></app-summary-card>
        </section>

        <!-- Actions -->
        <div class="actions-bar" style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px;">
            <button (click)="showCategories = !showCategories" class="action-btn">
                <i class="fa-solid fa-tags"></i> Categories
            </button>
            <button (click)="openImportModal()" class="action-btn">
                <i class="fa-solid fa-file-import"></i> Import Sheets
            </button>
        </div>

        <!-- Category Manager (Collapsible) -->
        <div *ngIf="showCategories" class="mb-4" style="margin-bottom: 20px;">
            <app-category-manager></app-category-manager>
        </div>

        <!-- Chart -->
        <app-chart></app-chart>

        <!-- Recent Transactions -->
        <app-transaction-list (edit)="openModal($event)"></app-transaction-list>
    </main>

    <!-- Floating Action Button -->
    <button class="fab" (click)="openModal()">
        <i class="fa-solid fa-plus"></i>
    </button>

    <!-- Modals -->
    <app-add-expense-modal #modal></app-add-expense-modal>
    <app-import-modal #importModal (closeEvent)="onImportClosed()"></app-import-modal>
  `,
  styles: [`
    .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 10px;
    }
    .fab {
        position: fixed;
        bottom: 30px;
        right: 50%;
        transform: translateX(50%);
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--accent-primary);
        border: none;
        color: white;
        font-size: 1.5rem;
        box-shadow: 0 10px 30px rgba(247, 37, 133, 0.4);
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: 100;
    }
    .fab:hover { transform: translateX(50%) scale(1.1); }
    
    .action-btn {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: var(--text-secondary);
        padding: 8px 16px;
        border-radius: 10px;
        cursor: pointer;
        font-family: var(--font-main);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .action-btn:hover { background: rgba(255,255,255,0.2); color: white; }
  `]
})
export class DashboardComponent implements OnInit {
  @ViewChild('modal') modal!: AddExpenseModalComponent;
  @ViewChild('importModal') importModal!: ImportModalComponent;

  totalSpend: number = 0;
  dailyAverage: number = 0;
  showCategories = false;

  constructor(
    private expenseService: ExpenseService,
    private analyticsService: AnalyticsService
  ) { }

  ngOnInit() {
    this.analyticsService.result$.subscribe((result: AnalyticsResult) => {
      this.totalSpend = result.total;
      this.dailyAverage = result.total / 30; // Simplified
    });
  }

  openModal(expense?: any) {
    this.modal.open(expense);
  }

  openImportModal() {
    this.importModal.open();
  }

  onImportClosed() {
    window.location.reload();
  }
}
