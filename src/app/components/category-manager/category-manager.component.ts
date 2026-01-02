import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService, CategoryNode } from '../../services/category.service';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="category-manager glass-panel">
      <div class="header">
        <h3><i class="fa-solid fa-tags"></i> Categories</h3>
        <div class="actions">
            <button (click)="importFromExpenses()" class="icon-btn-header" title="Import from Spendings" [disabled]="isImporting">
                <i class="fa-solid fa-cloud-arrow-down" [class.fa-bounce]="isImporting"></i>
            </button>
            <button (click)="startAdd('root')" class="add-btn" *ngIf="!addingTo">
                <i class="fa-solid fa-plus"></i> New
            </button>
        </div>
      </div>

      <!-- Add Form -->
      <div class="add-form" *ngIf="addingTo">
        <div class="input-group">
            <span class="prefix" *ngIf="addingTo !== 'root'">Sub-category of {{ getParentName(addingTo) }}</span>
            <input 
                [(ngModel)]="newCategoryName" 
                placeholder="Category Name" 
                (keyup.enter)="addCategory()"
                class="glass-input"
                autoFocus
            >
        </div>
        <div class="form-actions">
            <button (click)="addCategory()" class="save-btn" [disabled]="!newCategoryName.trim()">
                <i class="fa-solid fa-check"></i>
            </button>
            <button (click)="cancelAdd()" class="cancel-btn">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
      </div>

      <!-- Tree View -->
      <div class="tree-container">
        <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: categories$ | async }"></ng-container>
      </div>

      <ng-template #nodeTemplate let-nodes>
        <div *ngFor="let node of nodes" class="node">
          <div class="node-content">
            <span class="name">{{ node.name }}</span>
            <div class="node-actions">
                <button class="icon-btn" (click)="startAdd(node.id)" title="Add Sub-category">
                <i class="fa-solid fa-plus"></i>
                </button>
                <button class="icon-btn edit-btn" (click)="onEdit(node)" title="Rename">
                <i class="fa-solid fa-pen"></i>
                </button>
                <button class="icon-btn delete-btn" (click)="onDelete(node)" title="Delete">
                <i class="fa-solid fa-trash"></i>
                </button>
            </div>
          </div>
          
          <div class="children" *ngIf="node.children.length > 0">
            <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node.children }"></ng-container>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .glass-panel {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 20px;
        color: white;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 20px;
    }
    .header h3 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    .actions { display: flex; gap: 10px; align-items: center; }
    
    .add-btn {
        background: var(--accent-primary); color: white; border: none;
        padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem;
    }
    .icon-btn-header {
        background: rgba(255,255,255,0.1); border: none; color: var(--text-secondary);
        width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .icon-btn-header:hover { background: rgba(255,255,255,0.2); color: white; }
    .icon-btn-header:disabled { opacity: 0.5; cursor: wait; }

    .tree-container { overflow-y: auto; flex: 1; }
    
    .node { margin-bottom: 5px; }
    .node-content {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; background: rgba(255,255,255,0.03);
        border-radius: 8px; transition: background 0.2s;
    }
    .node-content:hover { background: rgba(255,255,255,0.08); }
    
    .node-actions { display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s; }
    .node-content:hover .node-actions { opacity: 1; }

    .icon-btn {
        background: none; border: none; color: var(--text-secondary);
        cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;
    }
    .icon-btn:hover { color: var(--accent-secondary); background: rgba(255,255,255,0.1); }
    .delete-btn:hover { color: var(--accent-danger); }

    .children { margin-left: 20px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 10px; margin-top: 5px; }

    .add-form {
        background: rgba(0,0,0,0.2); padding: 10px; border-radius: 10px; margin-bottom: 15px;
        display: flex; gap: 10px; align-items: center;
    }
    .input-group { flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .prefix { font-size: 0.7rem; color: var(--text-secondary); }
    .glass-input {
        background: transparent; border: none; color: white;
        border-bottom: 1px solid var(--glass-border); padding: 5px; outline: none; width: 100%;
    }
    .form-actions { display: flex; gap: 5px; }
    .save-btn, .cancel-btn {
        width: 30px; height: 30px; border-radius: 50%; border: none;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .save-btn { background: #4ade80; color: #1a1a2e; }
    .cancel-btn { background: #ef4444; color: white; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class CategoryManagerComponent implements OnInit {
  categories$ = this.categoryService.categories$;

  addingTo: string | null = null;
  newCategoryName = '';
  isImporting = false;

  constructor(private categoryService: CategoryService) { }

  ngOnInit() { }

  startAdd(parentId: string) {
    this.addingTo = parentId;
    this.newCategoryName = '';
  }

  cancelAdd() {
    this.addingTo = null;
    this.newCategoryName = '';
  }

  getParentName(id: string): string {
    return "Parent";
  }

  async addCategory() {
    if (!this.newCategoryName.trim()) return;

    const parentId = this.addingTo === 'root' ? null : this.addingTo;
    await this.categoryService.addCategory(this.newCategoryName, parentId);
    this.cancelAdd();
  }

  async onEdit(node: CategoryNode) {
    const newName = prompt('Enter new category name:', node.name);
    if (newName && newName.trim() && newName !== node.name) {
      await this.categoryService.updateCategory(node.id, newName.trim());
    }
  }

  async onDelete(node: CategoryNode) {
    if (confirm(`Are you sure you want to delete category "${node.name}"?`)) {
      const success = await this.categoryService.deleteCategory(node.id);
      if (!success) {
        // Alert handled in service
      }
    }
  }

  async importFromExpenses() {
    this.isImporting = true;
    try {
      const count = await this.categoryService.importFromExpenses();
      if (count > 0) {
        alert(`Successfully imported ${count} new categories!`);
      } else {
        alert('No new categories found to import.');
      }
    } catch (error) {
      alert('Failed to import categories.');
    } finally {
      this.isImporting = false;
    }
  }
}
