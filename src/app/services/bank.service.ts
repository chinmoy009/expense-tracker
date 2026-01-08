import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { SheetsService } from './sheets.service';
import { GoogleApiService } from './google-api.service';
import { Bank, BankTransaction } from '../models/bank.model';

@Injectable({
    providedIn: 'root'
})
export class BankService {
    private banksSubject = new BehaviorSubject<Bank[]>([]);
    banks$ = this.banksSubject.asObservable();

    private transactionsSubject = new BehaviorSubject<BankTransaction[]>([]);
    transactions$ = this.transactionsSubject.asObservable();

    private loadingSubject = new BehaviorSubject<boolean>(false);
    loading$ = this.loadingSubject.asObservable();

    private isInitialized = false;

    constructor(
        private sheetsService: SheetsService,
        private googleApiService: GoogleApiService
    ) {
        this.googleApiService.user$.pipe(
            filter(user => !!user)
        ).subscribe(() => {
            this.init();
        });
    }

    async init() {
        if (this.isInitialized) return;
        await this.sheetsService.ensureBanksTab();
        await this.sheetsService.ensureBankTransactionsTab();
        await this.loadData();
        this.isInitialized = true;
    }

    private async loadData() {
        this.loadingSubject.next(true);
        try {
            const [banks, transactions] = await Promise.all([
                this.sheetsService.getBanks(),
                this.sheetsService.getBankTransactions()
            ]);
            this.banksSubject.next(banks);
            this.transactionsSubject.next(transactions);
        } catch (error) {
            console.error('Error loading bank data:', error);
            alert('Failed to load bank data. Please check your connection.');
        } finally {
            this.loadingSubject.next(false);
        }
    }

    // --- Bank Management ---

    async addBank(bankData: Partial<Bank>) {
        const banks = this.banksSubject.value;
        const nextId = this.generateBankId(banks);

        const newBank: Bank = {
            id: nextId,
            bankName: bankData.bankName || '',
            bankCode: bankData.bankCode || '',
            accountName: bankData.accountName || '',
            accountNumber: bankData.accountNumber || '',
            accountType: bankData.accountType || '',
            homeBranch: bankData.homeBranch || '',
            branchZone: bankData.branchZone || '',
            branchDistrict: bankData.branchDistrict || '',
            openingBalance: bankData.openingBalance || 0,
            isClosed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await this.sheetsService.addBank(newBank);
        this.banksSubject.next([...banks, newBank]);
    }

    async updateBank(bank: Bank) {
        const updatedBank = { ...bank, updatedAt: new Date().toISOString() };
        await this.sheetsService.updateBank(updatedBank);

        const banks = this.banksSubject.value;
        const index = banks.findIndex(b => b.id === bank.id);
        if (index !== -1) {
            banks[index] = updatedBank;
            this.banksSubject.next([...banks]);
        }
    }

    async closeBank(id: string) {
        const banks = this.banksSubject.value;
        const bank = banks.find(b => b.id === id);
        if (bank) {
            await this.updateBank({ ...bank, isClosed: true });
        }
    }

    private generateBankId(banks: Bank[]): string {
        if (banks.length === 0) return 'B001';
        const ids = banks.map(b => parseInt(b.id.substring(1))).sort((a, b) => b - a);
        const nextNum = ids[0] + 1;
        return `B${nextNum.toString().padStart(3, '0')}`;
    }

    // --- Transaction Management ---

    async addTransaction(txData: Partial<BankTransaction>) {
        if (!txData.amount || txData.amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }

        const banks = this.banksSubject.value;
        const bank = banks.find(b => b.id === txData.bankId);
        if (!bank || bank.isClosed) {
            throw new Error('Bank must exist and be active');
        }

        const id = 'TX' + Date.now().toString(36).toUpperCase();
        const newTx: BankTransaction = {
            id,
            bankId: txData.bankId || '',
            type: txData.type || 'DEBIT',
            amount: txData.amount || 0,
            date: txData.date || new Date().toISOString().split('T')[0],
            details: txData.details || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await this.sheetsService.addBankTransaction(newTx);
        const txs = this.transactionsSubject.value;
        this.transactionsSubject.next([...txs, newTx]);
    }

    async updateTransaction(tx: BankTransaction) {
        const updatedTx = { ...tx, updatedAt: new Date().toISOString() };
        await this.sheetsService.updateBankTransaction(updatedTx);

        const txs = this.transactionsSubject.value;
        const index = txs.findIndex(t => t.id === tx.id);
        if (index !== -1) {
            txs[index] = updatedTx;
            this.transactionsSubject.next([...txs]);
        }
    }

    async deleteTransaction(id: string) {
        await this.sheetsService.deleteBankTransaction(id);
        const txs = this.transactionsSubject.value;
        this.transactionsSubject.next(txs.filter(t => t.id !== id));
    }

    // --- Calculations ---

    getBankBalance(bankId: string): Observable<number> {
        return combineLatest([this.banks$, this.transactions$]).pipe(
            map(([banks, transactions]) => {
                const bank = banks.find(b => b.id === bankId);
                if (!bank) return 0;

                const txs = transactions.filter(t => t.bankId === bankId);
                const totalCredit = txs.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
                const totalDebit = txs.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);

                return bank.openingBalance + totalCredit - totalDebit;
            })
        );
    }

    getStatement(bankId: string, startDate: string, endDate: string, type?: string, details?: string): Observable<{
        openingBalance: number,
        transactions: BankTransaction[],
        closingBalance: number
    }> {
        return combineLatest([this.banks$, this.transactions$]).pipe(
            map(([banks, transactions]) => {
                const bank = banks.find(b => b.id === bankId);
                if (!bank) return { openingBalance: 0, transactions: [], closingBalance: 0 };

                const allTxs = transactions.filter(t => t.bankId === bankId).sort((a, b) => a.date.localeCompare(b.date));

                // Calculate opening balance at startDate
                const beforeTxs = allTxs.filter(t => t.date < startDate);
                const beforeCredit = beforeTxs.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
                const beforeDebit = beforeTxs.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);
                const openingBalanceAtStart = bank.openingBalance + beforeCredit - beforeDebit;

                // Filter transactions in range
                let rangeTxs = allTxs.filter(t => t.date >= startDate && t.date <= endDate);

                // Apply additional filters
                if (type) {
                    rangeTxs = rangeTxs.filter(t => t.type === type);
                }
                if (details) {
                    const search = details.toLowerCase();
                    rangeTxs = rangeTxs.filter(t => t.details.toLowerCase().includes(search));
                }

                // Calculate running balances for statement
                let currentBalance = openingBalanceAtStart;
                const statementTransactions = rangeTxs.map(t => {
                    if (t.type === 'CREDIT') {
                        currentBalance += t.amount;
                    } else {
                        currentBalance -= t.amount;
                    }
                    return { ...t, runningBalance: currentBalance };
                });

                return {
                    openingBalance: openingBalanceAtStart,
                    transactions: statementTransactions,
                    closingBalance: currentBalance
                };
            })
        );
    }
}
