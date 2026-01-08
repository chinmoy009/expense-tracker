import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SheetsService } from './sheets.service';
import { GoogleApiService } from './google-api.service';

export interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  note: string;
  bankId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private expensesSubject = new BehaviorSubject<Expense[]>([]);
  expenses$ = this.expensesSubject.asObservable();
  private isGoogleAuthenticated = false;

  constructor(
    private sheetsService: SheetsService,
    private googleApi: GoogleApiService
  ) {
    this.googleApi.user$.subscribe(user => {
      this.isGoogleAuthenticated = !!user;
      this.loadExpenses();
    });
  }

  async loadExpenses() {
    if (this.isGoogleAuthenticated) {
      const expenses = await this.sheetsService.getExpenses();
      this.expensesSubject.next(expenses);
    } else {
      const saved = localStorage.getItem('lumina_expenses');
      if (saved) {
        this.expensesSubject.next(JSON.parse(saved));
      }
    }
  }

  async addExpense(expenseData: Omit<Expense, 'id'>) {
    const currentExpenses = this.expensesSubject.value;
    const newId = currentExpenses.length > 0 ? Math.max(...currentExpenses.map(e => e.id)) + 1 : 1;
    const newExpense: Expense = { ...expenseData, id: newId };

    // Optimistic update
    const updatedExpenses = [...currentExpenses, newExpense];
    this.expensesSubject.next(updatedExpenses);

    if (this.isGoogleAuthenticated) {
      try {
        await this.sheetsService.addExpense(newExpense);
      } catch (error) {
        console.error('Failed to save to Sheets', error);
        this.expensesSubject.next(currentExpenses); // Revert
        alert('Failed to save to Google Sheets');
      }
    } else {
      this.saveToLocalStorage(updatedExpenses);
    }
  }

  async updateExpense(expense: Expense) {
    // Optimistic update
    const currentExpenses = this.expensesSubject.value;
    const index = currentExpenses.findIndex(e => e.id === expense.id);
    if (index !== -1) {
      const updatedExpenses = [...currentExpenses];
      updatedExpenses[index] = expense;
      this.expensesSubject.next(updatedExpenses);

      if (this.isGoogleAuthenticated) {
        try {
          await this.sheetsService.updateExpense(expense);
        } catch (error) {
          console.error('Failed to update in Sheets', error);
          this.expensesSubject.next(currentExpenses); // Revert
          alert('Failed to update in Google Sheets');
        }
      } else {
        this.saveToLocalStorage(updatedExpenses);
      }
    }
  }

  async deleteExpense(id: number) {
    const currentExpenses = this.expensesSubject.value;
    const updatedExpenses = currentExpenses.filter(e => e.id !== id);
    this.expensesSubject.next(updatedExpenses);

    if (this.isGoogleAuthenticated) {
      try {
        await this.sheetsService.deleteExpense(id);
      } catch (error) {
        console.error('Failed to delete from Sheets', error);
        this.expensesSubject.next(currentExpenses); // Revert
        alert('Failed to delete from Google Sheets');
      }
    } else {
      this.saveToLocalStorage(updatedExpenses);
    }
  }

  private saveToLocalStorage(expenses: Expense[]) {
    localStorage.setItem('lumina_expenses', JSON.stringify(expenses));
  }

  getDailyTotal(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.expensesSubject.value
      .filter(e => e.date.startsWith(today))
      .reduce((sum, e) => sum + e.amount, 0);
  }

  getMonthlyTotal(): number {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return this.expensesSubject.value
      .filter(e => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);
  }

  getCategoryTotals(): { [key: string]: number } {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const totals: { [key: string]: number } = {};

    this.expensesSubject.value
      .filter(e => e.date.startsWith(currentMonth))
      .forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
      });

    return totals;
  }
}
