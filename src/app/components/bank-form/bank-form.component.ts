import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankService } from '../../services/bank.service';
import { Bank } from '../../models/bank.model';

@Component({
    selector: 'app-bank-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="modal-overlay" [class.active]="isOpen" (click)="close($event)">
        <div class="glass-modal">
            <div class="modal-header">
                <h2>{{ editMode ? 'Edit Bank Account' : 'Add Bank Account' }}</h2>
                <button class="close-modal" (click)="closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form (ngSubmit)="onSubmit()">
                <div class="form-grid">
                    <div class="input-group">
                        <label>Bank Name</label>
                        <input type="text" [(ngModel)]="bank.bankName" name="bankName" placeholder="e.g. Dutch Bangla Bank" class="text-input" required>
                    </div>
                    <div class="input-group">
                        <label>Bank Code</label>
                        <input type="text" [(ngModel)]="bank.bankCode" name="bankCode" placeholder="e.g. DBBL" class="text-input" required>
                    </div>
                    <div class="input-group">
                        <label>Account Name</label>
                        <input type="text" [(ngModel)]="bank.accountName" name="accountName" placeholder="e.g. Chinmoy Sen" class="text-input" required>
                    </div>
                    <div class="input-group">
                        <label>Account Number</label>
                        <input type="text" [(ngModel)]="bank.accountNumber" name="accountNumber" placeholder="Account Number" class="text-input" required>
                    </div>
                    <div class="input-group">
                        <label>Account Type</label>
                        <select [(ngModel)]="bank.accountType" name="accountType" class="text-input" required>
                            <option value="Savings">Savings</option>
                            <option value="Current">Current</option>
                            <option value="Salary">Salary</option>
                            <option value="Credit Card">Credit Card</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Opening Balance</label>
                        <input type="number" [(ngModel)]="bank.openingBalance" name="openingBalance" placeholder="0.00" class="text-input" required [disabled]="editMode">
                    </div>
                    <div class="input-group">
                        <label>Home Branch</label>
                        <input type="text" [(ngModel)]="bank.homeBranch" name="homeBranch" class="text-input">
                    </div>
                    <div class="input-group">
                        <label>Branch Zone</label>
                        <input type="text" [(ngModel)]="bank.branchZone" name="branchZone" class="text-input">
                    </div>
                    <div class="input-group">
                        <label>Branch District</label>
                        <input type="text" [(ngModel)]="bank.branchDistrict" name="branchDistrict" class="text-input">
                    </div>
                </div>

                <button type="submit" class="save-btn" [disabled]="!isFormValid()">
                    {{ editMode ? 'Update Account' : 'Create Account' }}
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
        max-height: 90vh; overflow-y: auto;
    }
    .modal-overlay.active .glass-modal { transform: translateY(0); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }
    
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .input-group { margin-bottom: 15px; }
    .input-group.full { grid-column: span 2; }
    .input-group label { display: block; color: var(--text-secondary); margin-bottom: 5px; font-size: 0.8rem; }
    .text-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 12px; border-radius: 12px; color: white; outline: none; }
    
    .save-btn { width: 100%; padding: 15px; background: var(--accent-secondary); border: none; border-radius: 12px; color: white; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 20px; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class BankFormComponent {
    @Output() saved = new EventEmitter<void>();
    isOpen = false;
    editMode = false;

    bank: Partial<Bank> = this.getEmptyBank();

    constructor(private bankService: BankService) { }

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

    open(bankToEdit?: Bank) {
        this.isOpen = true;
        if (bankToEdit) {
            this.editMode = true;
            this.bank = { ...bankToEdit };
        } else {
            this.editMode = false;
            this.bank = this.getEmptyBank();
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
        return !!(this.bank.bankName && this.bank.bankCode && this.bank.accountName && this.bank.accountNumber);
    }

    async onSubmit() {
        if (this.isFormValid()) {
            if (this.editMode) {
                await this.bankService.updateBank(this.bank as Bank);
            } else {
                await this.bankService.addBank(this.bank);
            }
            this.saved.emit();
            this.closeModal();
        }
    }
}
