import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { map } from 'rxjs/operators';
import { BankService } from '../../services/bank.service';
import { Bank, BankTransaction } from '../../models/bank.model';
import { NotifyService } from '../../shared/notify/notify.service';
import { todayLocalISODate } from '../../utils/date.util';

/** Log or edit a bank transaction. Data is the transaction to edit, or undefined to create. */
@Component({
  selector: 'app-bank-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ editMode ? 'Edit transaction' : 'Log transaction' }}</h2>

    <form (ngSubmit)="onSubmit()">
      <mat-dialog-content class="grid">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Bank account</mat-label>
          <mat-select name="bankId" [(ngModel)]="tx.bankId" required [disabled]="editMode">
            <mat-option *ngFor="let bank of activeBanks$ | async" [value]="bank.id">
              {{ bank.bankCode }} - {{ bank.accountNumber }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select name="type" [(ngModel)]="tx.type" required>
            <mat-option value="DEBIT">DEBIT (out)</mat-option>
            <mat-option value="CREDIT">CREDIT (in)</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Amount</mat-label>
          <input matInput type="number" name="amount" [(ngModel)]="tx.amount" placeholder="0.00" min="0.01" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Date</mat-label>
          <input matInput type="date" name="date" [(ngModel)]="tx.date" required>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Details</mat-label>
          <textarea matInput name="details" [(ngModel)]="tx.details" rows="3" placeholder="Transaction details…"></textarea>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!isFormValid()">
          {{ editMode ? 'Update transaction' : 'Log transaction' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .full { grid-column: 1 / -1; }
    mat-form-field { width: 100%; }
    @media (max-width: 599.98px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class BankTransactionFormComponent {
  editMode = false;
  tx: Partial<BankTransaction> = this.getEmptyTx();
  activeBanks$ = this.bankService.banks$.pipe(
    map((banks: Bank[]) => banks.filter(b => !b.isClosed))
  );

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) txToEdit: BankTransaction | undefined,
    public dialogRef: MatDialogRef<BankTransactionFormComponent>,
    private bankService: BankService,
    private notify: NotifyService
  ) {
    if (txToEdit) {
      this.editMode = true;
      this.tx = { ...txToEdit };
    }
  }

  private getEmptyTx(): Partial<BankTransaction> {
    return {
      bankId: '',
      type: 'DEBIT',
      amount: 0,
      date: todayLocalISODate(),
      details: ''
    };
  }

  isFormValid(): boolean {
    return !!(this.tx.bankId && this.tx.type && this.tx.amount && this.tx.amount > 0 && this.tx.date);
  }

  async onSubmit() {
    if (!this.isFormValid()) return;
    try {
      if (this.editMode) {
        await this.bankService.updateTransaction(this.tx as BankTransaction);
      } else {
        await this.bankService.addTransaction(this.tx);
      }
      this.dialogRef.close(true);
    } catch (error) {
      // Service rejects invalid amounts and closed accounts; show the reason instead of failing silently
      const message = error instanceof Error ? error.message : 'Could not save the transaction.';
      this.notify.error(message);
    }
  }
}
