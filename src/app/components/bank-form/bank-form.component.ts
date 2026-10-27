import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BankService } from '../../services/bank.service';
import { Bank } from '../../models/bank.model';
import { NotifyService } from '../../shared/notify/notify.service';

/** Create or edit a bank account. Data is the bank to edit, or undefined to create. */
@Component({
  selector: 'app-bank-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ editMode ? 'Edit bank account' : 'Add bank account' }}</h2>

    <form (ngSubmit)="onSubmit()">
      <mat-dialog-content class="grid">
        <mat-form-field appearance="outline">
          <mat-label>Bank name</mat-label>
          <input matInput name="bankName" [(ngModel)]="bank.bankName" placeholder="e.g. Dutch Bangla Bank" required cdkFocusInitial>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Bank code</mat-label>
          <input matInput name="bankCode" [(ngModel)]="bank.bankCode" placeholder="e.g. DBBL" required>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Account name</mat-label>
          <input matInput name="accountName" [(ngModel)]="bank.accountName" placeholder="e.g. Chinmoy Sen" required>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Account number</mat-label>
          <input matInput name="accountNumber" [(ngModel)]="bank.accountNumber" required>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Account type</mat-label>
          <mat-select name="accountType" [(ngModel)]="bank.accountType" required>
            <mat-option value="Savings">Savings</mat-option>
            <mat-option value="Current">Current</mat-option>
            <mat-option value="Salary">Salary</mat-option>
            <mat-option value="Credit Card">Credit Card</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Opening balance</mat-label>
          <input matInput type="number" name="openingBalance" [(ngModel)]="bank.openingBalance" placeholder="0.00" required [disabled]="editMode">
          <mat-hint *ngIf="editMode">Locked after creation</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Home branch</mat-label>
          <input matInput name="homeBranch" [(ngModel)]="bank.homeBranch">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Branch zone</mat-label>
          <input matInput name="branchZone" [(ngModel)]="bank.branchZone">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Branch district</mat-label>
          <input matInput name="branchDistrict" [(ngModel)]="bank.branchDistrict">
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!isFormValid()">
          {{ editMode ? 'Update account' : 'Create account' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    mat-form-field { width: 100%; }
    @media (max-width: 599.98px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class BankFormComponent {
  editMode = false;
  bank: Partial<Bank> = this.getEmptyBank();

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) bankToEdit: Bank | undefined,
    public dialogRef: MatDialogRef<BankFormComponent>,
    private bankService: BankService,
    private notify: NotifyService
  ) {
    if (bankToEdit) {
      this.editMode = true;
      this.bank = { ...bankToEdit };
    }
  }

  private getEmptyBank(): Partial<Bank> {
    return {
      bankName: '',
      bankCode: '',
      accountName: '',
      accountNumber: '',
      accountType: 'Savings',
      homeBranch: '',
      branchZone: '',
      branchDistrict: '',
      openingBalance: 0
    };
  }

  isFormValid(): boolean {
    return !!(this.bank.bankName && this.bank.bankCode && this.bank.accountName && this.bank.accountNumber);
  }

  async onSubmit() {
    if (!this.isFormValid()) return;
    try {
      if (this.editMode) {
        await this.bankService.updateBank(this.bank as Bank);
      } else {
        await this.bankService.addBank(this.bank);
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.notify.error('Could not save the bank account. Please try again.');
    }
  }
}
