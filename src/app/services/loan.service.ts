import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { SheetsService } from './sheets.service';
import { GoogleApiService } from './google-api.service';
import { LoanTransaction, LoanSummary } from '../models/loan.model';

@Injectable({
    providedIn: 'root'
})
export class LoanService {
    private transactionsSubject = new BehaviorSubject<LoanTransaction[]>([]);
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
        await this.sheetsService.ensureLoanTransactionsTab();
        await this.loadData();
        this.isInitialized = true;
    }

    private async loadData() {
        this.loadingSubject.next(true);
        try {
            const transactions = await this.sheetsService.getLoanTransactions();
            this.transactionsSubject.next(transactions);
        } catch (error) {
            console.error('Error loading loan data:', error);
        } finally {
            this.loadingSubject.next(false);
        }
    }

    // --- CRUD ---

    async addTransaction(txData: Partial<LoanTransaction>) {
        if (!txData.name) throw new Error('Name is required');
        if (txData.userReceived === undefined && txData.userGave === undefined) {
            throw new Error('Amount is required');
        }

        // Auto-generate ID: LTX-Timestamp-Random
        const id = `LTX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        const newTx: LoanTransaction = {
            id,
            name: txData.name,
            userReceived: txData.userReceived || 0,
            userGave: txData.userGave || 0,
            date: txData.date || new Date().toISOString().split('T')[0],
            medium: txData.medium || 'Cash',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.sheetsService.addLoanTransaction(newTx);
        const current = this.transactionsSubject.value;
        this.transactionsSubject.next([...current, newTx]);
    }

    async updateTransaction(tx: LoanTransaction) {
        const updatedTx = { ...tx, updatedAt: new Date().toISOString() };
        await this.sheetsService.updateLoanTransaction(updatedTx);

        const current = this.transactionsSubject.value;
        const index = current.findIndex(t => t.id === tx.id);
        if (index !== -1) {
            current[index] = updatedTx;
            this.transactionsSubject.next([...current]);
        }
    }

    async deleteTransaction(id: string) {
        await this.sheetsService.deleteLoanTransaction(id);
        const current = this.transactionsSubject.value;
        this.transactionsSubject.next(current.filter(t => t.id !== id));
    }

    // --- Derived State ---

    getReceivables(): Observable<LoanSummary[]> {
        return this.transactions$.pipe(
            map(txs => {
                const map = new Map<string, LoanSummary>();

                txs.forEach(tx => {
                    if (!map.has(tx.name)) {
                        map.set(tx.name, { name: tx.name, totalReceived: 0, totalGave: 0, balance: 0 });
                    }
                    const summary = map.get(tx.name)!;
                    summary.totalReceived += tx.userReceived;
                    summary.totalGave += tx.userGave;
                    summary.balance = summary.totalGave - summary.totalReceived;
                });

                // Return only positive balances (Receivable: User Gave > User Received)
                return Array.from(map.values())
                    .filter(s => s.balance > 0)
                    .sort((a, b) => b.balance - a.balance);
            })
        );
    }

    getPayables(): Observable<LoanSummary[]> {
        return this.transactions$.pipe(
            map(txs => {
                const map = new Map<string, LoanSummary>();

                txs.forEach(tx => {
                    if (!map.has(tx.name)) {
                        map.set(tx.name, { name: tx.name, totalReceived: 0, totalGave: 0, balance: 0 });
                    }
                    const summary = map.get(tx.name)!;
                    summary.totalReceived += tx.userReceived;
                    summary.totalGave += tx.userGave;
                    // Payable: User Received - User Gave
                    summary.balance = summary.totalReceived - summary.totalGave;
                });

                // Return only positive balances (Payable: User Received > User Gave)
                return Array.from(map.values())
                    .filter(s => s.balance > 0)
                    .sort((a, b) => b.balance - a.balance);
            })
        );
    }
}
