import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SheetsService } from '../../services/sheets.service';

/** Import expenses from other spreadsheets. Opened through AppActionsService. */
@Component({
  selector: 'app-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Import expenses</h2>

    <mat-dialog-content class="content">
      <ng-container *ngIf="!isComplete; else summaryView">
        <p class="lm-muted">Enter Google Spreadsheet IDs, one per line.</p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Spreadsheet IDs</mat-label>
          <textarea
            matInput
            [(ngModel)]="spreadsheetIds"
            placeholder="1aBcD_xYz123..."
            rows="5"
            [disabled]="isLoading"
            cdkFocusInitial></textarea>
        </mat-form-field>

        <div class="logs" #logsContainer *ngIf="logs.length > 0" aria-live="polite">
          <div *ngFor="let log of logs" class="log-entry">{{ log }}</div>
        </div>
      </ng-container>

      <ng-template #summaryView>
        <div class="summary">
          <mat-icon class="summary-icon" [class.ok]="summary.errors === 0" [class.warn]="summary.errors > 0">
            {{ summary.errors === 0 ? 'check_circle' : 'warning' }}
          </mat-icon>
          <h3>Import complete</h3>
          <div class="stats">
            <div class="stat"><span class="lm-muted">Imported</span><span class="value">{{ summary.imported }}</span></div>
            <div class="stat"><span class="lm-muted">Errors</span><span class="value error">{{ summary.errors }}</span></div>
          </div>
        </div>
      </ng-template>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <ng-container *ngIf="!isComplete; else doneAction">
        <button mat-button [disabled]="isLoading" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" (click)="startImport()" [disabled]="isLoading || !spreadsheetIds.trim()">
          <mat-spinner *ngIf="isLoading" diameter="18"></mat-spinner>
          <span>{{ isLoading ? 'Importing…' : 'Start import' }}</span>
        </button>
      </ng-container>
      <ng-template #doneAction>
        <button mat-flat-button color="primary" (click)="dialogRef.close()">Done</button>
      </ng-template>
    </mat-dialog-actions>
  `,
  styles: [`
    .content { display: flex; flex-direction: column; min-height: 120px; }
    .full { width: 100%; }
    .logs {
      max-height: 160px; overflow-y: auto; padding: 10px; border-radius: 10px;
      background: var(--surface-2); font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);
    }
    .log-entry { margin-bottom: 4px; }
    .summary { text-align: center; padding: 16px 0; }
    .summary-icon { font-size: 56px; width: 56px; height: 56px; }
    .summary-icon.ok { color: var(--accent-success); }
    .summary-icon.warn { color: #fbbf24; }
    .stats { display: flex; justify-content: center; gap: 32px; margin-top: 12px; }
    .stat { display: flex; flex-direction: column; }
    .value { font-size: 1.5rem; font-weight: 700; }
    .value.error { color: var(--accent-danger); }
    mat-dialog-actions button mat-spinner { display: inline-block; margin-right: 8px; }
  `]
})
export class ImportModalComponent {
  @ViewChild('logsContainer') logsContainer?: ElementRef<HTMLDivElement>;

  isLoading = false;
  isComplete = false;

  spreadsheetIds = '';
  logs: string[] = [];
  summary = { imported: 0, errors: 0 };

  constructor(
    public dialogRef: MatDialogRef<ImportModalComponent>,
    private sheetsService: SheetsService
  ) { }

  async startImport() {
    if (!this.spreadsheetIds.trim()) return;

    this.isLoading = true;
    this.logs = [];
    const ids = this.spreadsheetIds.split('\n').map(id => id.trim()).filter(id => id);

    try {
      const result = await this.sheetsService.importExpenses(ids, (msg) => {
        this.logs.push(msg);
        // Keep the newest log line visible
        setTimeout(() => {
          const el = this.logsContainer?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        }, 0);
      });

      this.summary = result;
      this.isComplete = true;
    } catch (error) {
      console.error('Import failed', error);
      this.logs.push('CRITICAL ERROR: Import failed.');
    } finally {
      this.isLoading = false;
    }
  }
}
