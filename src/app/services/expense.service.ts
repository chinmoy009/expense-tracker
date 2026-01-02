import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GoogleApiService } from './google-api.service';
import { SheetsService } from './sheets.service';

export interface Expense {
  id: number;
  amount: number;
  category: string;
  note: string;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private expensesSubject = new BehaviorSubject<Expense[]>([]);
  expenses$ = this.expensesSubject.asObservable();

  private isGoogleAuthenticated = false;

  constructor(
    private googleApi: GoogleApiService,
    private sheetsService: SheetsService
  ) {
    this.init();
  }

  private init() {
    // Load from LocalStorage initially
    this.loadFromLocalStorage();

    // Subscribe to Auth changes
    this.googleApi.user$.subscribe(user => {
      this.isGoogleAuthenticated = !!user;
      if (this.isGoogleAuthenticated) {
        this.loadFromSheets();
      } else {
        this.loadFromLocalStorage();
      }
    });
  }

  private loadFromLocalStorage() {
    const data = localStorage.getItem('lumina_expenses');
    if (data) {
      this.expensesSubject.next(JSON.parse(data));
    } else {
      this.expensesSubject.next([]);
    }
  }

  private async loadFromSheets() {
    const expenses = await this.sheetsService.getExpenses();
    // Sort by date desc (assuming sheet appends to bottom)
    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.expensesSubject.next(expenses);
  }

  async addExpense(amount: number, category: string, note: string, date: string) {
    const expense: Expense = {
      id: Date.now(),
      amount: amount,
      category: category,
      note: note,
      date: date
    };

    // Optimistic update
    const currentExpenses = this.expensesSubject.value;
    const updatedExpenses = [expense, ...currentExpenses];
    this.expensesSubject.next(updatedExpenses);

    if (this.isGoogleAuthenticated) {
      try {
        await this.sheetsService.addExpense(expense);
      } catch (error) {
        console.error('Failed to save to Sheets, reverting', error);
        // Revert on failure (simple version)
        this.expensesSubject.next(currentExpenses);
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
