
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoanService } from '../../services/loan.service';
import { LoanTransactionModalComponent } from '../loan-transaction-modal/loan-transaction-modal.component';
import { Observable } from 'rxjs';
import { LoanTransaction, LoanSummary } from '../../models/loan.model';

@Component({
    selector: 'app-loan-dashboard',
    standalone: true,
    imports: [CommonModule, LoanTransactionModalComponent],
    template: `
    <div class="dashboard-container">
        <!-- Header -->
        <div class="header-section">
            <h2>Loan Management</h2>
            <button class="add-btn" (click)="openModal()">
                <i class="fa-solid fa-plus"></i> Log Loan
            </button>
        </div>

        <!-- Metric Cards (Overview) -->
        <div class="metrics-grid">
            <div class="metric-card receivable-card">
                <div class="metric-icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                <div class="metric-info">
                    <span>Total Receivable</span>
                    <h3>{{ (receivables$ | async) | json | currency }}</h3> <!-- Simple sum placeholder, logic in pipe better -->
                    <!-- Simpler: Just calculated sum in template or component for now -->
                    <h3>{{ totalReceivable | currency }}</h3>
                </div>
            </div>
            <div class="metric-card payable-card">
                <div class="metric-icon"><i class="fa-solid fa-hand-holding-hand"></i></div>
                <div class="metric-info">
                    <span>Total Payable</span>
                    <h3>{{ totalPayable | currency }}</h3>
                </div>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs">
            <button [class.active]="activeTab === 'transactions'" (click)="activeTab = 'transactions'">Transactions</button>
            <button [class.active]="activeTab === 'receivable'" (click)="activeTab = 'receivable'">Receivable</button>
            <button [class.active]="activeTab === 'payable'" (click)="activeTab = 'payable'">Payable</button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
            
            <!-- Transactions View -->
            <div *ngIf="activeTab === 'transactions'" class="list-view">
                <div class="list-item" *ngFor="let tx of transactions$ | async">
                    <div class="item-icon" [ngClass]="tx.userGave > 0 ? 'given' : 'received'">
                        <i class="fa-solid" [ngClass]="tx.userGave > 0 ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
                    </div>
                    <div class="item-details">
                        <h4>{{ tx.name }}</h4>
                        <span class="sub-text">{{ tx.date | date }} • {{ tx.medium }}</span>
                    </div>
                    <div class="item-amount" [ngClass]="tx.userGave > 0 ? 'positive' : 'negative'">
                        {{ (tx.userGave > 0 ? tx.userGave : tx.userReceived) | currency }}
                        <span class="label">{{ tx.userGave > 0 ? 'Gave' : 'Received' }}</span>
                    </div>
                    <div class="item-actions">
                        <button (click)="editTx(tx)"><i class="fa-solid fa-pen"></i></button>
                        <button (click)="deleteTx(tx.id)" class="delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div *ngIf="(transactions$ | async)?.length === 0" class="empty-state">
                    No transactions found.
                </div>
            </div>

            <!-- Receivable View -->
            <div *ngIf="activeTab === 'receivable'" class="list-view">
                 <div class="list-item" *ngFor="let item of receivables$ | async">
                    <div class="item-icon given"><i class="fa-solid fa-user"></i></div>
                    <div class="item-details">
                        <h4>{{ item.name }}</h4>
                        <span class="sub-text">Owes you money</span>
                    </div>
                    <div class="item-amount positive">
                        {{ item.balance | currency }}
                    </div>
                 </div>
                 <div *ngIf="(receivables$ | async)?.length === 0" class="empty-state">
                    No one owes you money!
                 </div>
            </div>

            <!-- Payable View -->
            <div *ngIf="activeTab === 'payable'" class="list-view">
                 <div class="list-item" *ngFor="let item of payables$ | async">
                    <div class="item-icon received"><i class="fa-solid fa-user-clock"></i></div>
                    <div class="item-details">
                        <h4>{{ item.name }}</h4>
                        <span class="sub-text">You owe them</span>
                    </div>
                    <div class="item-amount negative">
                        {{ item.balance | currency }}
                    </div>
                 </div>
                 <div *ngIf="(payables$ | async)?.length === 0" class="empty-state">
                    You are debt free!
                 </div>
            </div>

        </div>
    </div>

    <app-loan-transaction-modal #modal (closeEvent)="refresh()"></app-loan-transaction-modal>
  `,
    styles: [`
    .dashboard-container { padding: 20px; max-width: 800px; margin: 0 auto; color: white; }
    
    .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .header-section h2 { margin: 0; background: linear-gradient(to right, #4cc9f0, #4361ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    
    .add-btn {
        background: var(--accent-secondary); color: white; border: none; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 15px rgba(76, 201, 240, 0.3); display: flex; gap: 8px; align-items: center;
    }

    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
    .metric-card {
        background: rgba(255,255,255,0.05); padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 15px; border: 1px solid var(--glass-border);
    }
    .metric-icon { 
        width: 50px; height: 50px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
    }
    .receivable-card .metric-icon { background: rgba(76, 201, 240, 0.1); color: #4cc9f0; }
    .payable-card .metric-icon { background: rgba(247, 37, 133, 0.1); color: #f72585; }
    .metric-info span { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }
    .metric-info h3 { margin: 5px 0 0; font-size: 1.4rem; }

    /* Tabs */
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 15px;     width: fit-content; }
    .tabs button {
        background: none; border: none; padding: 10px 20px; color: var(--text-secondary); cursor: pointer; border-radius: 10px; font-weight: 500; transition: all 0.2s;
    }
    .tabs button.active { background: rgba(255,255,255,0.1); color: white; }

    /* List View */
    .list-item {
        background: rgba(255,255,255,0.02); padding: 15px; border-radius: 15px; display: flex; align-items: center; margin-bottom: 10px; transition: transform 0.2s; border: 1px solid transparent;
    }
    .list-item:hover { transform: translateX(5px); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
    
    .item-icon {
        width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;
    }
    .item-icon.given { background: rgba(76, 201, 240, 0.1); color: #4cc9f0; }
    .item-icon.received { background: rgba(247, 37, 133, 0.1); color: #f72585; }

    .item-details { flex: 1; }
    .item-details h4 { margin: 0; font-size: 1rem; }
    .sub-text { font-size: 0.8rem; color: var(--text-secondary); }

    .item-amount { text-align: right; margin-right: 15px; }
    .item-amount.positive { color: #4cc9f0; }
    .item-amount.negative { color: #f72585; }
    .item-amount .label { display: block; font-size: 0.7rem; color: var(--text-secondary); }

    .item-actions { display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s; }
    .list-item:hover .item-actions { opacity: 1; }
    .item-actions button { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 5px; border-radius: 5px; }
    .item-actions button:hover { background: rgba(255,255,255,0.1); color: white; }
    .item-actions button.delete:hover { color: #f72585; }

    .empty-state { text-align: center; padding: 40px; color: var(--text-secondary); font-style: italic; }
  `]
})
export class LoanDashboardComponent implements OnInit {
    @ViewChild('modal') modal!: LoanTransactionModalComponent;

    activeTab: 'transactions' | 'receivable' | 'payable' = 'transactions';

    transactions$: Observable<LoanTransaction[]> = this.loanService.transactions$;
    receivables$: Observable<LoanSummary[]> = this.loanService.getReceivables();
    payables$: Observable<LoanSummary[]> = this.loanService.getPayables();

    totalReceivable = 0;
    totalPayable = 0;

    constructor(private loanService: LoanService) { }

    ngOnInit() {
        // Calculate totals
        this.receivables$.subscribe(list => {
            this.totalReceivable = list.reduce((sum, item) => sum + item.balance, 0);
        });
        this.payables$.subscribe(list => {
            this.totalPayable = list.reduce((sum, item) => sum + item.balance, 0);
        });
    }

    openModal() {
        this.modal.open();
    }

    editTx(tx: LoanTransaction) {
        this.modal.open(tx);
    }

    deleteTx(id: string) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.loanService.deleteTransaction(id);
        }
    }

    refresh() {
        // State is managed by service, but we can trigger forced reloads if needed. 
        // Since observables are used, it should auto-update.
    }
}
