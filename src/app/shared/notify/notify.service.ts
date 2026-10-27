import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { PromptDialogComponent, PromptDialogData } from './prompt-dialog.component';

/**
 * In-app replacement for native alert(), confirm() and prompt().
 * Services and components use this so every message matches the app theme.
 */
@Injectable({
  providedIn: 'root'
})
export class NotifyService {
  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  info(message: string) {
    this.snackBar.open(message, 'Dismiss', { duration: 4000 });
  }

  error(message: string) {
    this.snackBar.open(message, 'Dismiss', { duration: 7000, panelClass: ['lm-snack-error'] });
  }

  /** Emits true only when the user confirms. */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data,
        width: 'min(420px, 92vw)',
        autoFocus: 'first-tabbable'
      })
      .afterClosed()
      .pipe(map(result => result === true));
  }

  /** Emits the entered text, or undefined when cancelled. */
  prompt(data: PromptDialogData): Observable<string | undefined> {
    return this.dialog
      .open<PromptDialogComponent, PromptDialogData, string>(PromptDialogComponent, {
        data,
        width: 'min(420px, 92vw)'
      })
      .afterClosed();
  }
}
