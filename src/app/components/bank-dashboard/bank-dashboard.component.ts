import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { BankService } from '../../services/bank.service';
import { SettingsService } from '../../services/settings.service';
import { Bank, BankTransaction } from '../../models/bank.model';
import { BankFormComponent } from '../bank-form/bank-form.component';
import { BankTransactionFormComponent } from '../bank-transaction-form/bank-transaction-form.component';
import { NotifyService } from '../../shared/notify/notify.service';
import { todayLocalISODate, toLocalISODate } from '../../utils/date.util';

interface AccountRow {
  bank: Bank;
  balance: number;
}

interface StatementData {
  openingBalance: number;
  closingBalance: number;
  transactions: (BankTransaction & { runningBalance: number })[];
}

/** Banks page: account cards, all transactions, and account statements. */
@Component({
  selector: 'app-bank-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, MatTabsModule, MatTooltipModule],
  template: `
    <mat-progress-bar *ngIf="loading$ | async" mode="indeterminate" class="loading" aria-label="Loading bank data"></mat-progress-bar>

    <mat-tab-group animationDuration="0ms" class="tabs" [(selectedIndex)]="tabIndex">

      <!-- Accounts -->
      <mat-tab label="Accounts">
        <div class="tab-body">
          <div class="section-head">
            <h2>Bank accounts</h2>
            <button mat-flat-button color="primary" (click)="openBankForm()">
              <mat-icon>add</mat-icon> Add bank
            </button>
          </div>

          <div class="account-grid">
            <article class="account lm-card" *ngFor="let row of accountRows" [class.closed]="row.bank.isClosed">
              <div class="acc-head">
                <span class="acc-type">{{ row.bank.accountType }}</span>
                <span class="closed-tag" *ngIf="row.bank.isClosed">Closed</span>
              </div>
              <h3>{{ row.bank.bankName }} ({{ row.bank.bankCode }})</h3>
              <div class="acc-num">{{ row.bank.accountNumber }}</div>
              <div class="lm-muted">{{ row.bank.accountName }}</div>

              <div class="acc-foot">
                <div>
                  <div class="lm-muted">Current balance</div>
                  <div class="balance lm-amount">{{ row.balance | currency:((currency$ | async) || 'USD') }}</div>
                </div>
                <div class="acc-actions">
                  <button mat-icon-button (click)="openBankForm(row.bank)" matTooltip="Edit" [attr.aria-label]="'Edit ' + row.bank.bankName">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="copyDetails(row.bank)" matTooltip="Copy details" [attr.aria-label]="'Copy details of ' + row.bank.bankName">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                  <button mat-icon-button *ngIf="!row.bank.isClosed" (click)="closeBank(row.bank.id)" matTooltip="Close account" [attr.aria-label]="'Close ' + row.bank.bankName">
                    <mat-icon>block</mat-icon>
                  </button>
                </div>
              </div>
            </article>
          </div>
          <div class="lm-empty" *ngIf="accountRows.length === 0">No bank accounts yet.</div>
        </div>
      </mat-tab>

      <!-- Transactions -->
      <mat-tab label="Transactions">
        <div class="tab-body">
          <div class="section-head">
            <h2>Recent transactions</h2>
            <button mat-flat-button color="primary" (click)="openTxForm()">
              <mat-icon>add</mat-icon> Log transaction
            </button>
          </div>

          <div class="table-wrap">
            <table mat-table [dataSource]="transactions" class="data-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let tx">{{ tx.date | date:'mediumDate' }}</td>
              </ng-container>
              <ng-container matColumnDef="details">
                <th mat-header-cell *matHeaderCellDef>Details</th>
                <td mat-cell *matCellDef="let tx" class="wrap">{{ tx.details || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="account">
                <th mat-header-cell *matHeaderCellDef>Account</th>
                <td mat-cell *matCellDef="let tx">{{ getBankInfo(tx.bankId) }}</td>
              </ng-container>
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let tx">
                  <span class="type-badge" [class.credit]="tx.type === 'CREDIT'">{{ tx.type }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="num">Amount</th>
                <td mat-cell *matCellDef="let tx" class="num lm-amount" [class.lm-positive]="tx.type === 'CREDIT'" [class.lm-negative]="tx.type === 'DEBIT'">
                  {{ tx.type === 'DEBIT' ? '-' : '+' }}{{ tx.amount | currency:((currency$ | async) || 'USD') }}
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
                <td mat-cell *matCellDef="let tx" class="actions-col">
                  <button mat-icon-button (click)="openTxForm(tx)" aria-label="Edit transaction"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="deleteTransaction(tx.id)" aria-label="Delete transaction"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="txColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: txColumns"></tr>
            </table>
          </div>
          <div class="lm-empty" *ngIf="transactions.length === 0">No transactions yet.</div>
        </div>
      </mat-tab>

      <!-- Statement -->
      <mat-tab label="Statement">
        <div class="tab-body">
          <div class="section-head"><h2>Account statement</h2></div>

          <form class="filters lm-card" (ngSubmit)="generateStatement()">
            <mat-form-field appearance="outline">
              <mat-label>Account</mat-label>
              <mat-select name="bankId" [(ngModel)]="statementFilter.bankId">
                <mat-option value="">Choose account</mat-option>
                <mat-option *ngFor="let bank of banks" [value]="bank.id">{{ bank.bankCode }} - {{ bank.accountNumber }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Start date</mat-label>
              <input matInput type="date" name="startDate" [(ngModel)]="statementFilter.startDate">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>End date</mat-label>
              <input matInput type="date" name="endDate" [(ngModel)]="statementFilter.endDate">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select name="type" [(ngModel)]="statementFilter.type">
                <mat-option value="">All types</mat-option>
                <mat-option value="DEBIT">DEBIT</mat-option>
                <mat-option value="CREDIT">CREDIT</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Search details</mat-label>
              <input matInput name="details" [(ngModel)]="statementFilter.details" placeholder="Search…">
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="!statementFilter.bankId" class="generate">
              Generate statement
            </button>
          </form>

          <ng-container *ngIf="statementData">
            <div class="summary-strip">
              <div class="lm-card"><div class="lm-muted">Opening balance</div><div class="value lm-amount">{{ statementData.openingBalance | currency:((currency$ | async) || 'USD') }}</div></div>
              <div class="lm-card"><div class="lm-muted">Closing balance</div><div class="value lm-amount highlight">{{ statementData.closingBalance | currency:((currency$ | async) || 'USD') }}</div></div>
            </div>

            <div class="table-wrap">
              <table class="data-table statement">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Details</th>
                    <th class="num">Debit</th>
                    <th class="num">Credit</th>
                    <th class="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of statementData.transactions">
                    <td>{{ row.date | date:'mediumDate' }}</td>
                    <td class="wrap">{{ row.details || '—' }}</td>
                    <td class="num lm-amount lm-negative">{{ row.type === 'DEBIT' ? (row.amount | currency:((currency$ | async) || 'USD')) : '' }}</td>
                    <td class="num lm-amount lm-positive">{{ row.type === 'CREDIT' ? (row.amount | currency:((currency$ | async) || 'USD')) : '' }}</td>
                    <td class="num lm-amount">{{ row.runningBalance | currency:((currency$ | async) || 'USD') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="lm-empty" *ngIf="statementData.transactions.length === 0">No transactions in this range.</div>
          </ng-container>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    :host { display: block; }
    .loading { margin-bottom: 8px; }
    .tabs { background: transparent; }
    .tab-body { padding: 16px 0 24px; display: flex; flex-direction: column; gap: 16px; }
    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .section-head h2 { margin: 0; font-size: 1.1rem; font-weight: 600; }

    .account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .account { display: flex; flex-direction: column; gap: 4px; }
    .account.closed { opacity: 0.55; filter: grayscale(0.8); }
    .acc-head { display: flex; gap: 8px; align-items: center; }
    .acc-type { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; padding: 2px 8px; border-radius: 6px; background: var(--surface-2); color: var(--text-secondary); }
    .closed-tag { font-size: 0.7rem; color: var(--accent-danger); }
    .account h3 { margin: 4px 0 0; font-size: 1rem; color: var(--accent-secondary); }
    .acc-num { font-family: monospace; color: var(--text-secondary); }
    .acc-foot { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-soft); display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; }
    .balance { font-size: 1.25rem; font-weight: 700; color: var(--accent-success); }
    .acc-actions { display: flex; gap: 2px; }

    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; background: transparent; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
    .data-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.85rem; }
    .data-table .wrap { white-space: normal; max-width: 280px; }
    .num { text-align: right !important; }
    .actions-col { width: 96px; text-align: right; }
    .type-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: color-mix(in srgb, var(--accent-primary) 18%, transparent); color: var(--accent-primary); }
    .type-badge.credit { background: color-mix(in srgb, var(--accent-success) 18%, transparent); color: var(--accent-success); }
    td.lm-positive, td.lm-negative { font-weight: 600; }

    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0 12px; align-items: start; }
    .filters mat-form-field { width: 100%; }
    .generate { height: 56px; }
    .summary-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .summary-strip .value { font-size: 1.2rem; font-weight: 700; }
    .summary-strip .highlight { color: var(--accent-secondary); }

    @media (max-width: 767.98px) {
      .summary-strip { grid-template-columns: 1fr; }
      .generate { width: 100%; }
    }
  `]
})
export class BankDashboardComponent implements OnInit, OnDestroy {
  readonly txColumns = ['date', 'details', 'account', 'type', 'amount', 'actions'];

  tabIndex = 0;
  loading$ = this.bankService.loading$;
  currency$ = this.settingsService.currency$;

  banks: Bank[] = [];
  accountRows: AccountRow[] = [];
  transactions: BankTransaction[] = [];

  statementFilter = {
    bankId: '',
    startDate: toLocalISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    endDate: todayLocalISODate(),
    type: '',
    details: ''
  };

  statementData: StatementData | null = null;

  private sub?: Subscription;

  constructor(
    private bankService: BankService,
    private settingsService: SettingsService,
    private dialog: MatDialog,
    private notify: NotifyService
  ) { }

  ngOnInit() {
    this.sub = combineLatest([this.bankService.banks$, this.bankService.transactions$]).subscribe(([banks, txs]) => {
      this.banks = banks;
      this.accountRows = banks.map(bank => ({
        bank,
        balance: this.bankService.computeBalance(bank, txs)
      }));
      this.transactions = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  openBankForm(bank?: Bank) {
    this.dialog.open(BankFormComponent, { data: bank, width: 'min(560px, 94vw)', maxHeight: '92vh' });
  }

  openTxForm(tx?: BankTransaction) {
    this.dialog.open(BankTransactionFormComponent, { data: tx, width: 'min(520px, 94vw)', maxHeight: '92vh' });
  }

  getBankInfo(bankId: string): string {
    const bank = this.banks.find(b => b.id === bankId);
    return bank ? `${bank.bankCode} - ${bank.accountNumber}` : 'Unknown Bank';
  }

  closeBank(id: string) {
    this.notify.confirm({
      title: 'Close account',
      message: 'Are you sure you want to close this account? It will no longer appear in transaction dropdowns.',
      confirmText: 'Close account',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) this.bankService.closeBank(id);
    });
  }

  deleteTransaction(id: string) {
    this.notify.confirm({
      title: 'Delete transaction',
      message: 'Are you sure you want to delete this transaction?',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) this.bankService.deleteTransaction(id);
    });
  }

  generateStatement() {
    const f = this.statementFilter;
    this.bankService.getStatement(f.bankId, f.startDate, f.endDate, f.type, f.details)
      .pipe(take(1))
      .subscribe(data => this.statementData = data);
  }

  copyDetails(bank: Bank) {
    const details = `Account Name: ${bank.accountName}\nAccount Number: ${bank.accountNumber}\nBank Name: ${bank.bankName}\nHome Branch: ${bank.homeBranch}\nBank Zone: ${bank.branchZone}\nBank District: ${bank.branchDistrict}`;
    navigator.clipboard.writeText(details).then(
      () => this.notify.info('Bank details copied to clipboard!'),
      () => this.notify.error('Could not copy bank details.')
    );
  }
}
