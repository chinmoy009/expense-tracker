import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankService } from '../../services/bank.service';
import { Bank, BankTransaction } from '../../models/bank.model';
import { map } from 'rxjs/operators';

@Component({
    selector: 'app-bank-transaction-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="modal-overlay" [class.active]="isOpen" (click)="close($event)">
        <div class="glass-modal">
            <div class="modal-header">
                <h2>{{ editMode ? 'Edit Transaction' : 'Log Transaction' }}</h2>
                <button class="close-modal" (click)="closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form (ngSubmit)="onSubmit()">
                <div class="input-group">
                    <label>Bank Account</label>
                    <select [(ngModel)]="tx.bankId" name="bankId" class="text-input" required [disabled]="editMode">
                        <option value="" disabled>Select Bank</option>
                        <option *ngFor="let bank of activeBanks$ | async" [value]="bank.id">
                            {{ bank.bankCode }} - {{ bank.accountNumber }}
                        </option>
                    </select>
                </div>

                <div class="form-grid">
                    <div class="input-group">
                        <label>Type</label>
                        <select [(ngModel)]="tx.type" name="type" class="text-input" required>
                            <option value="DEBIT">DEBIT (Out)</option>
                            <option value="CREDIT">CREDIT (In)</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Amount</label>
                        <input type="number" [(ngModel)]="tx.amount" name="amount" placeholder="0.00" class="text-input" required min="0.01">
                    </div>
                </div>

                <div class="input-group">
                    <label>Date</label>
                    <input type="date" [(ngModel)]="tx.date" name="date" class="text-input" required>
                </div>

                <div class="input-group">
                    <label>Details</label>
                    <textarea [(ngModel)]="tx.details" name="details" placeholder="Transaction details..." class="text-input" rows="3"></textarea>
                </div>

                <button type="submit" class="save-btn" [disabled]="!isFormValid()">
                    {{ editMode ? 'Update Transaction' : 'Log Transaction' }}
                </button>
            </form>
        </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        z-index: 1000; display: flex; align-items: flex-end;
        opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    .modal-overlay.active { opacity: 1; pointer-events: all; }
    .glass-modal {
        width: 100%; max-width: 480px; margin: 0 auto;
        background: #1a1a2e; border-radius: 30px 30px 0 0;
        padding: 30px; border-top: 1px solid var(--glass-border);
        transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
    }
    .modal-overlay.active .glass-modal { transform: translateY(0); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }
    
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .input-group { margin-bottom: 15px; }
    .input-group label { display: block; color: var(--text-secondary); margin-bottom: 5px; font-size: 0.8rem; }
    .text-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 12px; border-radius: 12px; color: white; outline: none; font-family: inherit; }
    select.text-input { appearance: none; }
    textarea.text-input { resize: none; }
    
    .save-btn { width: 100%; padding: 15px; background: var(--accent-secondary); border: none; border-radius: 12px; color: white; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 20px; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class BankTransactionFormComponent {
    @Output() saved = new EventEmitter<void>();
    isOpen = false;
    editMode = false;

    tx: Partial<BankTransaction> = this.getEmptyTx();
    activeBanks$ = this.bankService.banks$.pipe(
        map(banks => banks.filter(b => !b.isClosed))
    );

    constructor(private bankService: BankService) { }

    private getEmptyTx(): Partial<BankTransaction> {
        return {
            bankId: '',
            type: 'DEBIT',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            details: ''
        };
    }

    open(txToEdit?: BankTransaction) {
        this.isOpen = true;
        if (txToEdit) {
            this.editMode = true;
            this.tx = { ...txToEdit };
        } else {
            this.editMode = false;
            this.tx = this.getEmptyTx();
        }
    }

    closeModal() {
        this.isOpen = false;
    }

    close(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.closeModal();
        }
    }

    isFormValid(): boolean {
        return !!(this.tx.bankId && this.tx.type && this.tx.amount && this.tx.amount > 0 && this.tx.date);
    }

    async onSubmit() {
        if (this.isFormValid()) {
            if (this.editMode) {
                await this.bankService.updateTransaction(this.tx as BankTransaction);
            } else {
                await this.bankService.addTransaction(this.tx);
            }
            this.saved.emit();
            this.closeModal();
        }
    }
}
