import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankService } from '../../services/bank.service';
import { SettingsService } from '../../services/settings.service';
import { Bank, BankTransaction } from '../../models/bank.model';
import { Observable, map } from 'rxjs';
import { BankFormComponent } from '../bank-form/bank-form.component';
import { BankTransactionFormComponent } from '../bank-transaction-form/bank-transaction-form.component';

@Component({
  selector: 'app-bank-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BankFormComponent, BankTransactionFormComponent],
  template: `
    <div class="bank-dashboard">
      <div *ngIf="loading$ | async" class="loading-overlay">
        <div class="spinner"></div>
      </div>

      <div class="tabs">
        <button [class.active]="activeTab === 'accounts'" (click)="activeTab = 'accounts'">
          <i class="fa-solid fa-building-columns"></i> Accounts
        </button>
        <button [class.active]="activeTab === 'transactions'" (click)="activeTab = 'transactions'">
          <i class="fa-solid fa-list-ul"></i> Transactions
        </button>
        <button [class.active]="activeTab === 'statement'" (click)="activeTab = 'statement'">
          <i class="fa-solid fa-file-invoice-dollar"></i> Statement
        </button>
      </div>

      <!-- Accounts Tab -->
      <div *ngIf="activeTab === 'accounts'" class="tab-content">
        <div class="header">
          <h2>Bank Accounts</h2>
          <button class="add-btn" (click)="bankForm.open()">
            <i class="fa-solid fa-plus"></i> Add Bank
          </button>
        </div>

        <div class="bank-list">
          <div *ngFor="let bank of banks$ | async" class="bank-card" [class.closed]="bank.isClosed">
            <div class="bank-info">
              <div class="acc-type">{{ bank.accountType }}</div>
              <h3>{{ bank.bankName }} ({{ bank.bankCode }})</h3>
              <p class="acc-num">{{ bank.accountNumber }}</p>
              <p class="acc-name">{{ bank.accountName }}</p>
            </div>
            <div class="bank-balance">
              <p class="label">Current Balance</p>
              <h2 class="amount">{{ (getBalance(bank.id) | async) | currency: (currency$ | async) || 'USD' }}</h2>
              <div class="bank-actions">
                <button (click)="bankForm.open(bank)" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button (click)="copyDetails(bank)" title="Copy Details"><i class="fa-solid fa-copy"></i></button>
                <button *ngIf="!bank.isClosed" (click)="closeBank(bank.id)" title="Close Account" class="delete-btn"><i class="fa-solid fa-ban"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Transactions Tab -->
      <div *ngIf="activeTab === 'transactions'" class="tab-content">
        <div class="header">
          <h2>Recent Transactions</h2>
          <button class="add-btn" (click)="txForm.open()">
            <i class="fa-solid fa-plus"></i> Log Transaction
          </button>
        </div>

        <div class="transaction-list">
          <div *ngFor="let tx of transactions$ | async" class="tx-card">
            <div class="tx-info">
              <div class="tx-header">
                <span class="tx-type" [class.credit]="tx.type === 'CREDIT'">{{ tx.type }}</span>
                <span class="tx-date">{{ tx.date | date:'mediumDate' }}</span>
              </div>
              <p class="tx-details">{{ tx.details }}</p>
              <p class="tx-bank">{{ getBankInfo(tx.bankId) }}</p>
            </div>
            <div class="tx-amount-actions">
              <h3 class="tx-amount" [class.credit]="tx.type === 'CREDIT'">
                {{ tx.type === 'DEBIT' ? '-' : '+' }}{{ tx.amount | currency: (currency$ | async) || 'USD' }}
              </h3>
              <div class="tx-actions">
                <button (click)="txForm.open(tx)" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button (click)="deleteTransaction(tx.id)" title="Delete" class="delete-btn"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statement Tab -->
      <div *ngIf="activeTab === 'statement'" class="tab-content">
        <div class="header">
          <h2>Account Statement</h2>
        </div>

        <div class="statement-filters">
          <div class="filter-row">
            <div class="filter-group">
              <label>Select Bank</label>
              <select [(ngModel)]="statementFilter.bankId" class="text-input">
                <option value="">Choose Account</option>
                <option *ngFor="let bank of banks$ | async" [value]="bank.id">
                  {{ bank.bankCode }} - {{ bank.accountNumber }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label>Start Date</label>
              <input type="date" [(ngModel)]="statementFilter.startDate" class="text-input">
            </div>
            <div class="filter-group">
              <label>End Date</label>
              <input type="date" [(ngModel)]="statementFilter.endDate" class="text-input">
            </div>
            <div class="filter-group">
              <label>Type</label>
              <select [(ngModel)]="statementFilter.type" class="text-input">
                <option value="">All Types</option>
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Search Details</label>
              <input type="text" [(ngModel)]="statementFilter.details" placeholder="Search..." class="text-input">
            </div>
          </div>
          <button class="generate-btn" (click)="generateStatement()" [disabled]="!statementFilter.bankId">
            Generate Statement
          </button>
        </div>

        <div *ngIf="statementData" class="statement-results">
          <div class="statement-summary">
            <div class="summary-item">
              <span class="label">Opening Balance</span>
              <span class="value">{{ statementData.openingBalance | currency: (currency$ | async) || 'USD' }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Closing Balance</span>
              <span class="value highlight">{{ statementData.closingBalance | currency: (currency$ | async) || 'USD' }}</span>
            </div>
          </div>

          <div class="statement-table-wrapper">
            <table class="statement-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of statementData.transactions">
                  <td>{{ row.date | date:'shortDate' }}</td>
                  <td>{{ row.details }}</td>
                  <td class="debit">{{ row.type === 'DEBIT' ? (row.amount | currency: (currency$ | async) || 'USD') : '' }}</td>
                  <td class="credit">{{ row.type === 'CREDIT' ? (row.amount | currency: (currency$ | async) || 'USD') : '' }}</td>
                  <td>{{ row.runningBalance | currency: (currency$ | async) || 'USD' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <app-bank-form #bankForm></app-bank-form>
    <app-bank-transaction-form #txForm></app-bank-transaction-form>
  `,
  styles: [`
    .bank-dashboard { color: white; padding-bottom: 20px; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; }
    .tabs button { background: none; border: none; color: var(--text-secondary); padding: 10px 20px; cursor: pointer; font-size: 1rem; border-radius: 10px; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
    .tabs button.active { background: var(--accent-primary); color: white; }
    
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .add-btn { background: var(--accent-secondary); color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    
    .bank-list, .transaction-list { display: grid; gap: 15px; }
    .bank-card, .tx-card { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: 20px; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .bank-card.closed { opacity: 0.5; filter: grayscale(1); }
    
    .bank-info h3 { margin: 0; color: var(--accent-secondary); }
    .acc-num { font-family: monospace; color: var(--text-secondary); margin: 5px 0; }
    .acc-name { font-size: 0.9rem; opacity: 0.8; margin: 0; }
    .acc-type { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 5px; }
    
    .bank-balance { text-align: right; }
    .bank-balance .label { font-size: 0.8rem; color: var(--text-secondary); margin: 0; }
    .bank-balance .amount { margin: 5px 0; color: #4ade80; }
    
    .bank-actions, .tx-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
    .bank-actions button, .tx-actions button { background: rgba(255, 255, 255, 0.1); border: none; color: white; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .bank-actions button:hover, .tx-actions button:hover { background: rgba(255, 255, 255, 0.2); }
    .delete-btn:hover { color: var(--accent-danger); }

    /* Transaction Specific */
    .tx-header { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
    .tx-type { font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(247, 37, 133, 0.2); color: var(--accent-primary); }
    .tx-type.credit { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
    .tx-date { font-size: 0.8rem; color: var(--text-secondary); }
    .tx-details { margin: 5px 0; font-size: 0.95rem; }
    .tx-bank { font-size: 0.75rem; color: var(--accent-secondary); opacity: 0.8; margin: 0; }
    .tx-amount { margin: 0; color: var(--accent-primary); font-size: 1.2rem; }
    .tx-amount.credit { color: #4ade80; }
    .tx-amount-actions { text-align: right; }

    /* Statement Specific */
    .statement-filters { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: 20px; padding: 20px; margin-bottom: 20px; }
    .filter-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .filter-group label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px; }
    .text-input { width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); padding: 10px; border-radius: 10px; color: white; outline: none; }
    .generate-btn { width: 100%; padding: 12px; background: var(--accent-primary); border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
    .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .statement-summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .summary-item { flex: 1; background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 15px; display: flex; flex-direction: column; gap: 5px; }
    .summary-item .label { font-size: 0.8rem; color: var(--text-secondary); }
    .summary-item .value { font-size: 1.2rem; font-weight: 600; }
    .summary-item .value.highlight { color: var(--accent-secondary); }

    .statement-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 20px; }
    .statement-table th { text-align: left; padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-secondary); }
    .statement-table td { padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .debit { color: var(--accent-primary); }
    .credit { color: #4ade80; }

    .loading-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(26, 26, 46, 0.7); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      z-index: 10; border-radius: 20px;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-left-color: var(--accent-secondary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .filter-row { grid-template-columns: 1fr; }
        .tabs { overflow-x: auto; white-space: nowrap; padding-bottom: 5px; }
        .tabs button { font-size: 0.9rem; padding: 8px 12px; }
        
        .bank-card { flex-direction: column; align-items: flex-start; gap: 15px; }
        .bank-balance { text-align: left; width: 100%; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .bank-balance .label { display: none; }
        .bank-actions { margin-top: 0; }
        
        .tx-card { flex-direction: column; align-items: flex-start; gap: 10px; }
        .tx-amount-actions { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-top: 5px; }
        .tx-actions { margin-top: 0; }

        .statement-summary { flex-direction: column; gap: 10px; }
        .statement-table-wrapper { overflow-x: auto; }
        .statement-table { min-width: 600px; }
    }
  `]
})
export class BankDashboardComponent implements OnInit {
  @ViewChild('bankForm') bankForm!: BankFormComponent;
  @ViewChild('txForm') txForm!: BankTransactionFormComponent;

  activeTab: 'accounts' | 'transactions' | 'statement' = 'accounts';
  banks$ = this.bankService.banks$;
  loading$ = this.bankService.loading$;
  transactions$ = this.bankService.transactions$.pipe(
    map(txs => [...txs].sort((a, b) => b.date.localeCompare(a.date)))
  );

  currency$ = this.settingsService.currency$;

  statementFilter = {
    bankId: '',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: '',
    details: ''
  };

  statementData: any = null;
  private banks: Bank[] = [];

  constructor(
    private bankService: BankService,
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.banks$.subscribe(banks => this.banks = banks);
  }

  getBalance(bankId: string): Observable<number> {
    return this.bankService.getBankBalance(bankId);
  }

  getBankInfo(bankId: string): string {
    const bank = this.banks.find(b => b.id === bankId);
    return bank ? `${bank.bankCode} - ${bank.accountNumber}` : 'Unknown Bank';
  }

  closeBank(id: string) {
    if (confirm('Are you sure you want to close this account? It will no longer appear in transaction dropdowns.')) {
      this.bankService.closeBank(id);
    }
  }

  deleteTransaction(id: string) {
    if (confirm('Are you sure you want to delete this transaction?')) {
      this.bankService.deleteTransaction(id);
    }
  }

  generateStatement() {
    this.bankService.getStatement(
      this.statementFilter.bankId,
      this.statementFilter.startDate,
      this.statementFilter.endDate,
      this.statementFilter.type,
      this.statementFilter.details
    ).subscribe(data => {
      this.statementData = data;
    });
  }

  copyDetails(bank: Bank) {
    const details = `Account Name: ${bank.accountName}\nAccount Number: ${bank.accountNumber}\nBank Name: ${bank.bankName}\nHome Branch: ${bank.homeBranch}\nBank Zone: ${bank.branchZone}\nBank District: ${bank.branchDistrict}`;
    navigator.clipboard.writeText(details).then(() => {
      alert('Bank details copied to clipboard!');
    });
  }
}

