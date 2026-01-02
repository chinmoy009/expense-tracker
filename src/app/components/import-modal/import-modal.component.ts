import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetsService } from '../../services/sheets.service';

@Component({
  selector: 'app-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" [class.active]="isOpen" (click)="close($event)">
        <div class="glass-modal">
            <div class="modal-header">
                <h2>Import Expenses</h2>
                <button class="close-modal" (click)="closeModal()" [disabled]="isLoading"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="modal-body">
                <div *ngIf="!isComplete; else summaryView">
                    <p class="instruction">Enter Google Spreadsheet IDs (one per line):</p>
                    <textarea 
                        [(ngModel)]="spreadsheetIds" 
                        placeholder="1aBcD_xYz123..." 
                        rows="5" 
                        class="text-input area-input"
                        [disabled]="isLoading"
                    ></textarea>

                    <div class="logs-container" *ngIf="logs.length > 0">
                        <div *ngFor="let log of logs" class="log-entry">{{ log }}</div>
                    </div>

                    <button (click)="startImport()" class="save-btn" [disabled]="isLoading || !spreadsheetIds.trim()">
                        <span *ngIf="!isLoading">Start Import</span>
                        <span *ngIf="isLoading"><i class="fa-solid fa-spinner fa-spin"></i> Importing...</span>
                    </button>
                </div>

                <ng-template #summaryView>
                    <div class="summary-container">
                        <div class="summary-icon success" *ngIf="summary.errors === 0"><i class="fa-solid fa-check-circle"></i></div>
                        <div class="summary-icon warning" *ngIf="summary.errors > 0"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        
                        <h3>Import Complete</h3>
                        <div class="stats">
                            <div class="stat-item">
                                <span class="label">Imported</span>
                                <span class="value">{{ summary.imported }}</span>
                            </div>
                            <div class="stat-item">
                                <span class="label">Errors</span>
                                <span class="value error">{{ summary.errors }}</span>
                            </div>
                        </div>
                        
                        <button (click)="closeModal()" class="save-btn">Done</button>
                    </div>
                </ng-template>
            </div>
        </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        z-index: 1000; display: flex; align-items: center; justify-content: center;
        opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    .modal-overlay.active { opacity: 1; pointer-events: all; }
    .glass-modal {
        width: 90%; max-width: 500px; background: #1a1a2e;
        border-radius: 24px; padding: 30px; border: 1px solid var(--glass-border);
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }
    .instruction { color: var(--text-secondary); margin-bottom: 10px; font-size: 0.9rem; }
    .text-input {
        width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);
        padding: 15px; border-radius: 15px; color: white; font-family: var(--font-main); outline: none;
        resize: vertical;
    }
    .logs-container {
        margin-top: 15px; max-height: 150px; overflow-y: auto;
        background: rgba(0,0,0,0.3); padding: 10px; border-radius: 10px;
        font-family: monospace; font-size: 0.8rem; color: #ccc;
    }
    .log-entry { margin-bottom: 4px; }
    .save-btn {
        width: 100%; padding: 15px; background: var(--accent-primary); border: none;
        border-radius: 15px; color: white; font-size: 1rem; font-weight: 600;
        cursor: pointer; margin-top: 20px; transition: opacity 0.2s;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .summary-container { text-align: center; padding: 20px 0; }
    .summary-icon { font-size: 4rem; margin-bottom: 20px; }
    .summary-icon.success { color: #4ade80; }
    .summary-icon.warning { color: #fbbf24; }
    .stats { display: flex; justify-content: center; gap: 30px; margin: 20px 0; }
    .stat-item { display: flex; flex-direction: column; }
    .label { font-size: 0.8rem; color: var(--text-secondary); }
    .value { font-size: 1.5rem; font-weight: 700; }
    .value.error { color: var(--accent-danger); }
  `]
})
export class ImportModalComponent {
  @Output() closeEvent = new EventEmitter<void>();
  isOpen = false;
  isLoading = false;
  isComplete = false;

  spreadsheetIds = '';
  logs: string[] = [];
  summary = { imported: 0, errors: 0 };

  constructor(private sheetsService: SheetsService) { }

  open() {
    this.isOpen = true;
    this.reset();
  }

  closeModal() {
    if (this.isLoading) return;
    this.isOpen = false;
    this.closeEvent.emit();
  }

  close(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  reset() {
    this.spreadsheetIds = '';
    this.logs = [];
    this.isLoading = false;
    this.isComplete = false;
    this.summary = { imported: 0, errors: 0 };
  }

  async startImport() {
    if (!this.spreadsheetIds.trim()) return;

    this.isLoading = true;
    this.logs = [];
    const ids = this.spreadsheetIds.split('\n').map(id => id.trim()).filter(id => id);

    try {
      const result = await this.sheetsService.importExpenses(ids, (msg) => {
        this.logs.push(msg);
        // Auto-scroll to bottom (simple implementation)
        setTimeout(() => {
          const container = document.querySelector('.logs-container');
          if (container) container.scrollTop = container.scrollHeight;
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
