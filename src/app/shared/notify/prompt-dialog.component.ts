import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface PromptDialogData {
  title: string;
  label: string;
  value: string;
  confirmText?: string;
}

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput name="value" [(ngModel)]="value" cdkFocusInitial required>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="!value.trim()">
          {{ data.confirmText || 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .full-width { width: 100%; }
  `]
})
export class PromptDialogComponent {
  value: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PromptDialogData,
    private dialogRef: MatDialogRef<PromptDialogComponent, string>
  ) {
    this.value = data.value;
  }

  submit() {
    if (this.value.trim()) {
      this.dialogRef.close(this.value.trim());
    }
  }
}
