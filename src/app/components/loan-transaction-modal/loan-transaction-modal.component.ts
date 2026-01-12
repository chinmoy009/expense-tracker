
import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoanService } from '../../services/loan.service';
import { BankService } from '../../services/bank.service';
import { LoanTransaction } from '../../models/loan.model';
import { Observable } from 'rxjs';
import { Bank } from '../../models/bank.model';

@Component({
    selector: 'app-loan-transaction-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="modal-overlay" [class.active]="isOpen" (click)="close($event)">
        <div class="glass-modal">
            <div class="modal-header">
                <h2>{{ editMode ? 'Edit Transaction' : 'Log Loan' }}</h2>
                <button class="close-modal" (click)="closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <form (ngSubmit)="onSubmit()">
                <!-- Name -->
                <div class="input-group">
                    <label>Person Name</label>
                    <input type="text" [(ngModel)]="name" name="name" class="text-input" placeholder="e.g. John Doe" required>
                </div>

                <!-- Transaction Type -->
                <div class="input-group type-selector">
                    <label>I am...</label>
                    <div class="toggle-switch">
                        <button type="button" [class.active]="type === 'GAVE'" (click)="type = 'GAVE'">Giving Money</button>
                        <button type="button" [class.active]="type === 'RECEIVED'" (click)="type = 'RECEIVED'">Receiving Money</button>
                    </div>
                </div>

                <!-- Amount -->
                <div class="input-group">
                    <label>Amount</label>
                    <div class="amount-wrapper">
                        <span class="currency">$</span>
                        <input type="number" [(ngModel)]="amount" name="amount" class="amount-input" placeholder="0.00" required>
                    </div>
                </div>

                <!-- Date -->
                <div class="input-group">
                    <label>Date</label>
                    <input type="date" [(ngModel)]="date" name="date" class="text-input" required>
                </div>

                <!-- Medium -->
                <div class="input-group">
                    <label>Medium (Bank / Cash)</label>
                    <div class="medium-input-wrapper">
                        <select [(ngModel)]="selectedMedium" name="mediumSelect" class="text-input" (change)="onMediumSelect()">
                            <option value="Cash">Cash</option>
                            <option *ngFor="let bank of banks$ | async" [value]="bank.id">
                                {{ bank.bankCode }} - {{ bank.accountNumber }}
                            </option>
                            <option *ngFor="let m of customMediums" [value]="m">{{ m }}</option>
                            <option value="custom">New Custom Medium...</option>
                        </select>
                        <input *ngIf="isCustomMedium" type="text" [(ngModel)]="customMedium" name="customMedium" class="text-input mt-2" placeholder="Enter medium name">
                    </div>
                </div>

                <button type="submit" class="save-btn" [disabled]="!amount || !name">
                    {{ editMode ? 'Update Transaction' : 'Save Transaction' }}
                </button>
            </form>
        </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        z-index: 2000; display: flex; align-items: flex-end; justify-content: center;
        opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    .modal-overlay.active { opacity: 1; pointer-events: all; }
    
    .glass-modal {
        width: 100%; max-width: 500px;
        background: #1a1a2e;
        border-radius: 30px 30px 0 0;
        padding: 30px;
        border-top: 1px solid var(--glass-border);
        transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
        max-height: 90vh; overflow-y: auto;
    }
    .modal-overlay.active .glass-modal { transform: translateY(0); }
    
    @media (min-width: 768px) {
        .modal-overlay { align-items: center; }
        .glass-modal { border-radius: 30px; transform: scale(0.9); opacity: 0; }
        .modal-overlay.active .glass-modal { transform: scale(1); opacity: 1; }
    }

    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }

    .input-group { margin-bottom: 20px; }
    .input-group label { display: block; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem; }
    .text-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 12px; border-radius: 12px; color: white; outline: none; }
    .mt-2 { margin-top: 10px; }

    .amount-wrapper { display: flex; align-items: center; border-bottom: 2px solid var(--glass-border); padding-bottom: 5px; }
    .currency { font-size: 1.5rem; color: var(--accent-primary); margin-right: 10px; }
    .amount-input { background: none; border: none; color: white; font-size: 2rem; font-weight: 600; width: 100%; outline: none; }

    .toggle-switch { display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px; }
    .toggle-switch button {
        flex: 1; padding: 10px; border: none; background: none; color: var(--text-secondary); cursor: pointer; border-radius: 8px; font-weight: 500; transition: all 0.2s;
    }
    .toggle-switch button.active { background: var(--accent-primary); color: white; }

    .save-btn {
        width: 100%; padding: 16px; background: var(--accent-secondary); border: none; border-radius: 15px; color: white; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 10px;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class LoanTransactionModalComponent implements OnInit {
    @Output() closeEvent = new EventEmitter<void>();

    isOpen = false;
    editMode = false;
    editingId: string | null = null;

    name: string = '';
    type: 'GAVE' | 'RECEIVED' = 'GAVE';
    amount: number | null = null;
    date: string = new Date().toISOString().split('T')[0];
    selectedMedium: string = 'Cash';
    customMedium: string = '';
    isCustomMedium = false;

    customMediums: string[] = [];

    banks$: Observable<Bank[]> = this.bankService.banks$;

    constructor(
        private loanService: LoanService,
        private bankService: BankService
    ) { }

    ngOnInit() {
        this.loanService.transactions$.subscribe(txs => {
            const unique = new Set<string>();
            txs.forEach(t => {
                if (t.medium !== 'Cash' && !t.medium.startsWith('B')) {
                    unique.add(t.medium);
                }
            });
            this.customMediums = Array.from(unique);
        });
    }

    open(tx?: LoanTransaction) {
        this.isOpen = true;
        if (tx) {
            this.editMode = true;
            this.editingId = tx.id;
            this.name = tx.name;
            this.date = tx.date;
            this.amount = tx.userGave > 0 ? tx.userGave : tx.userReceived;
            this.type = tx.userGave > 0 ? 'GAVE' : 'RECEIVED';

            // Check if medium is a bank or custom
            // Simply set it, logic to detect if it matches a bank is difficult strictly from here without bank list loaded, 
            // but usually the ID matches.
            this.selectedMedium = tx.medium;
            // If it doesn't match 'Cash' or a bank ID in the dropdown, we might want to handle custom, 
            // but simpler to just let it bind. If it's not in the list, we might need a better way. 
            // For now, let's assume if it's not "Cash" and not in banks, it's custom.
            // We will handle this cleaner in v2 if needed.
        } else {
            this.resetForm();
        }
    }

    closeModal() {
        this.isOpen = false;
        this.closeEvent.emit();
    }

    close(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.closeModal();
        }
    }

    resetForm() {
        this.editMode = false;
        this.editingId = null;
        this.name = '';
        this.type = 'GAVE';
        this.amount = null;
        this.date = new Date().toISOString().split('T')[0];
        this.selectedMedium = 'Cash';
        this.customMedium = '';
        this.isCustomMedium = false;
    }

    onMediumSelect() {
        this.isCustomMedium = this.selectedMedium === 'custom';
    }

    onSubmit() {
        const medium = this.isCustomMedium ? this.customMedium : this.selectedMedium;

        const txData: Partial<LoanTransaction> = {
            name: this.name,
            date: this.date,
            medium: medium,
            userGave: this.type === 'GAVE' ? this.amount! : 0,
            userReceived: this.type === 'RECEIVED' ? this.amount! : 0
        };

        if (this.editMode && this.editingId) {
            this.loanService.updateTransaction({
                ...txData,
                id: this.editingId
            } as LoanTransaction);
        } else {
            this.loanService.addTransaction(txData);
        }

        this.closeModal();
    }
}
