import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { LoanService } from '../../services/loan.service';
import { BankService } from '../../services/bank.service';
import { SettingsService } from '../../services/settings.service';
import { LoanTransaction, LoanSummary } from '../../models/loan.model';
import { Bank } from '../../models/bank.model';
import { LoanTransactionModalComponent } from '../loan-transaction-modal/loan-transaction-modal.component';
import { NotifyService } from '../../shared/notify/notify.service';

/** Loans page: receivable and payable totals, every transaction, and per-person balances. */
@Component({
  selector: 'app-loan-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTableModule, MatTabsModule, MatTooltipModule],
  template: `
    <section class="head">
      <h2>Loans</h2>
      <button mat-flat-button color="primary" (click)="openModal()">
        <mat-icon>add</mat-icon> Log loan
      </button>
    </section>

    <section class="metrics" aria-label="Loan totals">
      <div class="metric lm-card receivable">
        <div class="metric-icon"><mat-icon>trending_up</mat-icon></div>
        <div>
          <div class="lm-muted">Total receivable</div>
          <div class="metric-value lm-amount">{{ totalReceivable | currency:((currency$ | async) || 'USD') }}</div>
        </div>
      </div>
      <div class="metric lm-card payable">
        <div class="metric-icon"><mat-icon>trending_down</mat-icon></div>
        <div>
          <div class="lm-muted">Total payable</div>
          <div class="metric-value lm-amount">{{ totalPayable | currency:((currency$ | async) || 'USD') }}</div>
        </div>
      </div>
    </section>

    <mat-tab-group animationDuration="0ms" class="tabs">
      <!-- All transactions -->
      <mat-tab label="Transactions">
        <div class="tab-body">
          <div class="table-wrap">
            <table mat-table [dataSource]="(transactions$ | async) || []" class="data-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let tx">{{ tx.date | date:'mediumDate' }}</td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let tx">{{ tx.name }}</td>
              </ng-container>
              <ng-container matColumnDef="medium">
                <th mat-header-cell *matHeaderCellDef>Medium</th>
                <td mat-cell *matCellDef="let tx" class="lm-muted">{{ mediumLabel(tx.medium) }}</td>
              </ng-container>
              <ng-container matColumnDef="direction">
                <th mat-header-cell *matHeaderCellDef>Direction</th>
                <td mat-cell *matCellDef="let tx">
                  <span class="dir-badge" [class.gave]="tx.userGave > 0" [class.received]="tx.userGave <= 0">
                    {{ tx.userGave > 0 ? 'Gave' : 'Received' }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="num">Amount</th>
                <td mat-cell *matCellDef="let tx" class="num lm-amount">
                  {{ (tx.userGave > 0 ? tx.userGave : tx.userReceived) | currency:((currency$ | async) || 'USD') }}
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
                <td mat-cell *matCellDef="let tx" class="actions-col">
                  <button mat-icon-button (click)="openModal(tx)" aria-label="Edit transaction" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="deleteTx(tx.id)" aria-label="Delete transaction" matTooltip="Delete"><mat-icon>delete_outline</mat-icon></button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="txColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: txColumns"></tr>
            </table>
          </div>
          <div class="lm-empty" *ngIf="totalTransactions === 0">No transactions found.</div>
        </div>
      </mat-tab>

      <!-- Receivable -->
      <mat-tab label="Receivable">
        <div class="tab-body">
          <ul class="people">
            <li class="person lm-card" *ngFor="let item of receivables">
              <div class="avatar receivable-avatar"><mat-icon>person</mat-icon></div>
              <div class="who">
                <div class="name">{{ item.name }}</div>
                <div class="lm-muted">Owes you money</div>
              </div>
              <div class="amount lm-amount lm-negative-strong">{{ item.balance | currency:((currency$ | async) || 'USD') }}</div>
            </li>
          </ul>
          <div class="lm-empty" *ngIf="receivables.length === 0">No one owes you money!</div>
        </div>
      </mat-tab>

      <!-- Payable -->
      <mat-tab label="Payable">
        <div class="tab-body">
          <ul class="people">
            <li class="person lm-card" *ngFor="let item of payables">
              <div class="avatar payable-avatar"><mat-icon>schedule</mat-icon></div>
              <div class="who">
                <div class="name">{{ item.name }}</div>
                <div class="lm-muted">You owe them</div>
              </div>
              <div class="amount lm-amount lm-positive-strong">{{ item.balance | currency:((currency$ | async) || 'USD') }}</div>
            </li>
          </ul>
          <div class="lm-empty" *ngIf="payables.length === 0">You are debt free!</div>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
    .head h2 { margin: 0; font-size: 1.3rem; font-weight: 600; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .metric { display: flex; align-items: center; gap: 16px; }
    .metric-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .receivable .metric-icon { background: color-mix(in srgb, var(--accent-secondary) 15%, transparent); color: var(--accent-secondary); }
    .payable .metric-icon { background: color-mix(in srgb, var(--accent-primary) 15%, transparent); color: var(--accent-primary); }
    .metric-value { font-size: 1.35rem; font-weight: 700; }

    .tabs { background: transparent; }
    .tab-body { padding: 16px 0 24px; }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
    .data-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.85rem; }
    .num { text-align: right !important; }
    .actions-col { width: 96px; text-align: right; }
    .dir-badge { font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    .dir-badge.gave { background: color-mix(in srgb, var(--accent-secondary) 16%, transparent); color: var(--accent-secondary); }
    .dir-badge.received { background: color-mix(in srgb, var(--accent-primary) 16%, transparent); color: var(--accent-primary); }

    .people { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .person { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .receivable-avatar { background: color-mix(in srgb, var(--accent-secondary) 15%, transparent); color: var(--accent-secondary); }
    .payable-avatar { background: color-mix(in srgb, var(--accent-primary) 15%, transparent); color: var(--accent-primary); }
    .who { flex: 1; min-width: 0; }
    .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amount { font-weight: 700; }
    .lm-negative-strong { color: var(--accent-secondary); }
    .lm-positive-strong { color: var(--accent-primary); }

    @media (max-width: 767.98px) {
      .metrics { grid-template-columns: 1fr; }
    }
  `]
})
export class LoanDashboardComponent implements OnInit, OnDestroy {
  readonly txColumns = ['date', 'name', 'medium', 'direction', 'amount', 'actions'];

  transactions$: Observable<LoanTransaction[]> = this.loanService.transactions$;
  receivables$: Observable<LoanSummary[]> = this.loanService.getReceivables();
  payables$: Observable<LoanSummary[]> = this.loanService.getPayables();

  currency$ = this.settingsService.currency$;

  receivables: LoanSummary[] = [];
  payables: LoanSummary[] = [];
  totalReceivable = 0;
  totalPayable = 0;
  totalTransactions = 0;

  private banks: Bank[] = [];
  private sub?: Subscription;

  constructor(
    private loanService: LoanService,
    private bankService: BankService,
    private settingsService: SettingsService,
    private dialog: MatDialog,
    private notify: NotifyService
  ) { }

  ngOnInit() {
    this.sub = combineLatest([
      this.receivables$,
      this.payables$,
      this.transactions$,
      this.bankService.banks$
    ]).subscribe(([receivables, payables, txs, banks]) => {
      this.receivables = receivables;
      this.payables = payables;
      this.totalReceivable = receivables.reduce((sum, item) => sum + item.balance, 0);
      this.totalPayable = payables.reduce((sum, item) => sum + item.balance, 0);
      this.totalTransactions = txs.length;
      this.banks = banks;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  openModal(tx?: LoanTransaction) {
    this.dialog.open(LoanTransactionModalComponent, { data: tx, width: 'min(520px, 94vw)', maxHeight: '92vh' });
  }

  /** Shows bank code and account for bank IDs; custom mediums are shown as typed. */
  mediumLabel(medium: string): string {
    if (medium === 'Cash') return 'Cash';
    const bank = this.banks.find(b => b.id === medium);
    return bank ? `${bank.bankCode} - ${bank.accountNumber}` : medium;
  }

  deleteTx(id: string) {
    this.notify.confirm({
      title: 'Delete transaction',
      message: 'Are you sure you want to delete this transaction?',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) this.loanService.deleteTransaction(id);
    });
  }
}
