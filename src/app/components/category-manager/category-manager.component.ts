import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { NotifyService } from '../../shared/notify/notify.service';

/** Category tree side panel. Opened through AppActionsService. */
@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <div class="panel-head">
      <h2 mat-dialog-title>Categories</h2>
      <div class="head-actions">
        <button
          mat-icon-button
          (click)="importFromExpenses()"
          [disabled]="isImporting"
          matTooltip="Import categories from Spending"
          aria-label="Import categories from Spending">
          <mat-icon>cloud_download</mat-icon>
        </button>
        <button mat-stroked-button (click)="startAdd('root')" *ngIf="!addingTo">
          <mat-icon>add</mat-icon> New
        </button>
        <button mat-icon-button mat-dialog-close aria-label="Close categories">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>

    <div class="add-form" *ngIf="addingTo">
      <div class="prefix" *ngIf="addingTo !== 'root'">Sub-category of {{ getParentName(addingTo) }}</div>
      <mat-form-field appearance="outline" class="name-field" subscriptSizing="dynamic">
        <mat-label>Category name</mat-label>
        <input matInput [(ngModel)]="newCategoryName" (keyup.enter)="addCategory()" (keyup.escape)="cancelAdd()" cdkFocusInitial>
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="addCategory()" [disabled]="!newCategoryName.trim()">Add</button>
      <button mat-button (click)="cancelAdd()">Cancel</button>
    </div>

    <div class="tree" *ngIf="categories$ | async as categories">
      <div class="empty" *ngIf="categories.length === 0">No categories yet. Add one to get started.</div>
      <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: categories }"></ng-container>
    </div>

    <ng-template #nodeTemplate let-nodes>
      <div *ngFor="let node of nodes" class="node">
        <div class="node-row">
          <span class="name">{{ node.name }}</span>
          <span class="node-actions">
            <button mat-icon-button (click)="startAdd(node.id)" matTooltip="Add sub-category" [attr.aria-label]="'Add sub-category to ' + node.name">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-icon-button (click)="onEdit(node)" matTooltip="Rename" [attr.aria-label]="'Rename ' + node.name">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button (click)="onDelete(node)" matTooltip="Delete" [attr.aria-label]="'Delete ' + node.name">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </span>
        </div>
        <div class="children" *ngIf="node.children.length > 0">
          <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node.children }"></ng-container>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; padding: 16px 20px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .panel-head h2 { padding: 0; margin: 0; }
    .head-actions { display: flex; align-items: center; gap: 8px; }
    .add-form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; padding: 12px; border-radius: 12px; background: var(--surface-2); }
    .prefix { width: 100%; font-size: 0.8rem; color: var(--text-secondary); }
    .name-field { flex: 1; min-width: 160px; }
    .tree { flex: 1; overflow-y: auto; margin-top: 8px; }
    .empty { color: var(--text-muted); font-style: italic; padding: 24px 0; text-align: center; }
    .node { margin-bottom: 4px; }
    .node-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 4px 8px 4px 12px; border-radius: 10px; background: var(--surface-2);
    }
    .node-row:hover { filter: brightness(1.05); }
    .node-actions { display: flex; opacity: 0.6; transition: opacity 0.15s; }
    .node-row:hover .node-actions, .node-row:focus-within .node-actions { opacity: 1; }
    .children { margin-left: 16px; border-left: 1px solid var(--glass-border); padding-left: 10px; margin-top: 4px; }
  `]
})
export class CategoryManagerComponent {
  categories$ = this.categoryService.categories$;

  addingTo: string | null = null;
  newCategoryName = '';
  isImporting = false;

  constructor(
    public dialogRef: MatDialogRef<CategoryManagerComponent>,
    private categoryService: CategoryService,
    private notify: NotifyService
  ) { }

  startAdd(parentId: string) {
    this.addingTo = parentId;
    this.newCategoryName = '';
  }

  cancelAdd() {
    this.addingTo = null;
    this.newCategoryName = '';
  }

  getParentName(id: string): string {
    return this.findName(this.categoryService.snapshot(), id) ?? '';
  }

  async addCategory() {
    if (!this.newCategoryName.trim()) return;

    const parentId = this.addingTo === 'root' ? null : this.addingTo;
    await this.categoryService.addCategory(this.newCategoryName, parentId);
    this.cancelAdd();
  }

  async onEdit(node: CategoryNode) {
    const newName = await firstValueFrom(this.notify.prompt({
      title: 'Rename category',
      label: 'Category name',
      value: node.name
    }));
    if (newName && newName.trim() && newName !== node.name) {
      await this.categoryService.updateCategory(node.id, newName.trim());
    }
  }

  async onDelete(node: CategoryNode) {
    const confirmed = await firstValueFrom(this.notify.confirm({
      title: 'Delete category',
      message: `Are you sure you want to delete category "${node.name}"?`,
      confirmText: 'Delete',
      danger: true
    }));
    if (confirmed) {
      // The service reports blocked deletes (used by expenses, has sub-categories) itself
      await this.categoryService.deleteCategory(node.id);
    }
  }

  async importFromExpenses() {
    this.isImporting = true;
    try {
      const count = await this.categoryService.importFromExpenses();
      if (count > 0) {
        this.notify.info(`Successfully imported ${count} new categories!`);
      } else {
        this.notify.info('No new categories found to import.');
      }
    } catch (error) {
      this.notify.error('Failed to import categories.');
    } finally {
      this.isImporting = false;
    }
  }

  private findName(nodes: CategoryNode[], id: string): string | null {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      const found = this.findName(node.children, id);
      if (found) return found;
    }
    return null;
  }
}
