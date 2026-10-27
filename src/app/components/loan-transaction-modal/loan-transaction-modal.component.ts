import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { LoanService } from '../../services/loan.service';
import { BankService } from '../../services/bank.service';
import { SettingsService } from '../../services/settings.service';
import { LoanTransaction } from '../../models/loan.model';
import { Bank } from '../../models/bank.model';
import { NotifyService } from '../../shared/notify/notify.service';
import { todayLocalISODate } from '../../utils/date.util';

/** Log or edit a loan transaction. Data is the transaction to edit, or undefined to create. */
@Component({
  selector: 'app-loan-transaction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ editMode ? 'Edit transaction' : 'Log loan' }}</h2>

    <form (ngSubmit)="onSubmit()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Person name</mat-label>
          <input matInput name="name" [(ngModel)]="name" placeholder="e.g. John Doe" required cdkFocusInitial>
        </mat-form-field>

        <div class="field-label">I am…</div>
        <mat-button-toggle-group name="type" [(ngModel)]="type" aria-label="Direction" class="toggle full">
          <mat-button-toggle value="GAVE">Giving money</mat-button-toggle>
          <mat-button-toggle value="RECEIVED">Receiving money</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Amount</mat-label>
          <span matTextPrefix>{{ currencySymbol }}&nbsp;</span>
          <input matInput type="number" name="amount" [(ngModel)]="amount" min="0.01" placeholder="0.00" required>
          <mat-hint *ngIf="amount !== null && amount <= 0" class="error-hint">Amount must be greater than 0</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Date</mat-label>
          <input matInput type="date" name="date" [(ngModel)]="date" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Medium (bank or cash)</mat-label>
          <mat-select name="mediumSelect" [(ngModel)]="selectedMedium" (selectionChange)="onMediumSelect()">
            <mat-option value="Cash">Cash</mat-option>
            <mat-option *ngFor="let bank of banks$ | async" [value]="bank.id">{{ bank.bankCode }} - {{ bank.accountNumber }}</mat-option>
            <mat-option *ngFor="let m of customMediums" [value]="m">{{ m }}</mat-option>
            <mat-option value="custom">New custom medium…</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full" *ngIf="isCustomMedium">
          <mat-label>Custom medium name</mat-label>
          <input matInput name="customMedium" [(ngModel)]="customMedium" placeholder="e.g. bKash">
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!isValid()">
          {{ editMode ? 'Update transaction' : 'Save transaction' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; gap: 4px; }
    .full { width: 100%; }
    .field-label { font-size: 0.875rem; color: var(--text-secondary); margin: 4px 0 8px; }
    .toggle { margin-bottom: 16px; }
    .error-hint { color: var(--accent-danger); }
  `]
})
export class LoanTransactionModalComponent implements OnInit, OnDestroy {
  private subs: Subscription[] = [];

  editMode = false;
  editingId: string | null = null;

  name = '';
  type: 'GAVE' | 'RECEIVED' = 'GAVE';
  amount: number | null = null;
  date: string = todayLocalISODate();
  selectedMedium = 'Cash';
  customMedium = '';
  isCustomMedium = false;

  customMediums: string[] = [];

  banks$: Observable<Bank[]> = this.bankService.banks$;
  currencySymbol = '$';

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) private txToEdit: LoanTransaction | undefined,
    public dialogRef: MatDialogRef<LoanTransactionModalComponent>,
    private loanService: LoanService,
    private bankService: BankService,
    private settingsService: SettingsService,
    private notify: NotifyService
  ) { }

  ngOnInit() {
    this.subs.push(this.settingsService.currency$.subscribe(c => this.currencySymbol = c === 'BDT' ? '৳' : '$'));

    // Custom mediums are any medium that is neither Cash nor a known bank ID
    this.subs.push(combineLatest([this.loanService.transactions$, this.bankService.banks$]).subscribe(([txs, banks]) => {
      const bankIds = new Set(banks.map(b => b.id));
      const unique = new Set<string>();
      txs.forEach(t => {
        if (t.medium && t.medium !== 'Cash' && !bankIds.has(t.medium)) {
          unique.add(t.medium);
        }
      });
      this.customMediums = Array.from(unique);
    }));

    if (this.txToEdit) {
      const tx = this.txToEdit;
      this.editMode = true;
      this.editingId = tx.id;
      this.name = tx.name;
      this.date = tx.date;
      this.amount = tx.userGave > 0 ? tx.userGave : tx.userReceived;
      this.type = tx.userGave > 0 ? 'GAVE' : 'RECEIVED';
      this.selectedMedium = tx.medium;
    }
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  isValid(): boolean {
    return !!this.name.trim() && this.amount !== null && this.amount > 0 && !!this.date;
  }

  onMediumSelect() {
    this.isCustomMedium = this.selectedMedium === 'custom';
  }

  async onSubmit() {
    if (!this.isValid()) return;

    const medium = this.isCustomMedium ? this.customMedium : this.selectedMedium;
    const txData: Partial<LoanTransaction> = {
      name: this.name.trim(),
      date: this.date,
      medium,
      userGave: this.type === 'GAVE' ? this.amount! : 0,
      userReceived: this.type === 'RECEIVED' ? this.amount! : 0
    };

    try {
      if (this.editMode && this.editingId) {
        await this.loanService.updateTransaction({ ...txData, id: this.editingId } as LoanTransaction);
      } else {
        await this.loanService.addTransaction(txData);
      }
      this.dialogRef.close(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the loan transaction.';
      this.notify.error(message);
    }
  }
}
