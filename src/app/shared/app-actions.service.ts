import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddExpenseModalComponent } from '../components/add-expense-modal/add-expense-modal.component';
import { CategoryManagerComponent } from '../components/category-manager/category-manager.component';
import { ImportModalComponent } from '../components/import-modal/import-modal.component';
import { Expense } from '../services/expense.service';

/**
 * Global actions triggered from the shell (top bar, rail, bottom tabs) and from pages.
 * Owns opening of dialogs so every entry point behaves the same way.
 */
@Injectable({
  providedIn: 'root'
})
export class AppActionsService {
  constructor(private dialog: MatDialog) { }

  addExpense() {
    this.editExpense();
  }

  editExpense(expense?: Expense) {
    this.dialog.open(AddExpenseModalComponent, {
      data: expense,
      width: 'min(480px, 94vw)',
      maxHeight: '92vh',
      autoFocus: false
    });
  }

  openCategories() {
    this.dialog.open(CategoryManagerComponent, {
      position: { top: '0', right: '0' },
      height: '100vh',
      width: 'min(440px, 100vw)',
      maxWidth: '100vw',
      panelClass: 'lm-side-panel',
      autoFocus: false
    });
  }

  openImport() {
    this.dialog
      .open(ImportModalComponent, {
        width: 'min(520px, 94vw)',
        disableClose: true
      })
      .afterClosed()
      .subscribe(() => {
        // Existing behavior: closing the import dialog reloads the app to refresh all data
        window.location.reload();
      });
  }
}
