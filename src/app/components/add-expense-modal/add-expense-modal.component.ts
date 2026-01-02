import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-add-expense-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" [class.active]="isOpen" (click)="close($event)">
        <div class="glass-modal">
            <div class="modal-header">
                <h2>{{ editMode ? 'Edit Expense' : 'Add Expense' }}</h2>
                <button class="close-modal" (click)="closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form (ngSubmit)="onSubmit()">
                <div class="input-group">
                    <label>Amount</label>
                    <div class="amount-input-wrapper">
                        <span class="currency">{{ currencySymbol }}</span>
                        <input type="number" [(ngModel)]="amount" name="amount" placeholder="0.00" class="amount-input" required autoFocus>
                    </div>
                </div>

                <div class="input-group">
                    <label>Date</label>
                    <input type="date" [(ngModel)]="date" name="date" class="text-input" required>
                </div>
                
                <div class="input-group">
                    <label>Category</label>
                    
                    <!-- Breadcrumbs -->
                    <div class="breadcrumbs" *ngIf="breadcrumbs.length > 0">
                        <span (click)="resetCategory()" class="crumb root"><i class="fa-solid fa-house"></i></span>
                        <span *ngFor="let crumb of breadcrumbs; let i = index" class="crumb" (click)="goToLevel(i)">
                            / {{ crumb.name }}
                        </span>
                    </div>

                    <!-- Category Grid -->
                    <div class="category-grid">
                        <button 
                            type="button" 
                            *ngFor="let node of currentNodes"
                            class="cat-btn" 
                            [class.active]="selectedCategory === node.name" 
                            (click)="selectNode(node)"
                        >
                            <i class="fa-solid fa-tag"></i> {{ node.name }}
                            <i class="fa-solid fa-chevron-right small-icon" *ngIf="node.children.length > 0"></i>
                        </button>
                    </div>
                    
                    <div *ngIf="currentNodes.length === 0" class="no-cats">
                        No categories found. Use the Category Manager to add some.
                    </div>
                </div>

                <div class="input-group">
                    <label>Note</label>
                    <input type="text" [(ngModel)]="note" name="note" placeholder="What was it for?" class="text-input">
                </div>

                <button type="submit" class="save-btn" [disabled]="!amount || !selectedCategory || !date">
                    {{ editMode ? 'Update Expense' : 'Save Expense' }}
                </button>
            </form>
        </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        backdrop-filter: blur(5px);
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    .modal-overlay.active { opacity: 1; pointer-events: all; }
    .glass-modal {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background: #1a1a2e;
        border-radius: 30px 30px 0 0;
        padding: 30px;
        border-top: 1px solid var(--glass-border);
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
    }
    .modal-overlay.active .glass-modal { transform: translateY(0); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .close-modal { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }
    .input-group { margin-bottom: 25px; }
    .input-group label { display: block; color: var(--text-secondary); margin-bottom: 10px; font-size: 0.9rem; }
    .amount-input-wrapper { display: flex; align-items: center; border-bottom: 2px solid var(--glass-border); padding-bottom: 10px; }
    .currency { font-size: 2rem; color: var(--accent-primary); margin-right: 10px; }
    .amount-input { background: none; border: none; color: white; font-size: 2.5rem; font-weight: 700; width: 100%; outline: none; font-family: var(--font-main); }
    .text-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 15px; border-radius: 15px; color: white; font-family: var(--font-main); outline: none; }
    .save-btn { width: 100%; padding: 18px; background: var(--accent-primary); border: none; border-radius: 15px; color: white; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 10px; box-shadow: 0 5px 20px rgba(247, 37, 133, 0.3); }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Category Specific */
    .breadcrumbs { margin-bottom: 10px; color: var(--text-secondary); font-size: 0.9rem; }
    .crumb { cursor: pointer; transition: color 0.2s; }
    .crumb:hover { color: white; }
    .crumb.root { color: var(--accent-primary); }
    
    .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .cat-btn {
        background: rgba(255,255,255,0.05); border: 1px solid transparent; color: var(--text-secondary);
        padding: 12px 8px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 5px; 
        cursor: pointer; transition: all 0.2s; position: relative; text-align: center; font-size: 0.9rem;
    }
    .cat-btn:hover { background: rgba(255,255,255,0.1); }
    .cat-btn.active { background: rgba(76, 201, 240, 0.1); border-color: var(--accent-secondary); color: var(--accent-secondary); }
    .small-icon { font-size: 0.7rem; position: absolute; right: 5px; bottom: 5px; opacity: 0.5; }
    .no-cats { color: var(--text-secondary); font-style: italic; text-align: center; padding: 10px; }
  `]
})
export class AddExpenseModalComponent implements OnInit {
  @Output() closeEvent = new EventEmitter<void>();
  isOpen = false;

  amount: number | null = null;
  note: string = '';
  date: string = new Date().toISOString().split('T')[0];
  currencySymbol: string = '$';

  // Category Logic
  rootCategories: CategoryNode[] = [];
  currentNodes: CategoryNode[] = [];
  breadcrumbs: CategoryNode[] = [];
  selectedCategory: string | null = null;

  // Edit Mode
  editMode = false;
  editingId: number | null = null;

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.categoryService.categories$.subscribe(cats => {
      this.rootCategories = cats;
      // Don't reset category here if we are in edit mode and just opened
    });

    this.settingsService.currency$.subscribe(c => {
      this.currencySymbol = this.settingsService.getCurrencySymbol(c);
    });
  }

  open(expenseToEdit?: any) {
    this.isOpen = true;
    if (expenseToEdit) {
      this.editMode = true;
      this.editingId = expenseToEdit.id;
      this.amount = expenseToEdit.amount;
      this.note = expenseToEdit.note;
      this.date = expenseToEdit.date;
      this.selectedCategory = expenseToEdit.category;
      // We need to set breadcrumbs/currentNodes to match the selected category
      // For simplicity, we'll just show the root and let them re-select if they want to change
      // Or we could try to find the path.
      this.currentNodes = this.rootCategories;
    } else {
      this.resetForm();
    }
  }

  closeModal() {
    this.isOpen = false;
    this.closeEvent.emit();
    this.resetForm();
  }

  close(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  resetForm() {
    this.editMode = false;
    this.editingId = null;
    this.amount = null;
    this.note = '';
    this.date = new Date().toISOString().split('T')[0];
    this.resetCategory();
  }

  // Navigation
  resetCategory() {
    this.currentNodes = this.rootCategories;
    this.breadcrumbs = [];
    this.selectedCategory = null;
  }

  selectNode(node: CategoryNode) {
    if (node.children.length > 0) {
      // Drill down
      this.breadcrumbs.push(node);
      this.currentNodes = node.children;
    } else {
      // Select leaf
      this.selectedCategory = node.name;
    }
  }

  goToLevel(index: number) {
    // Go back to a specific parent
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    const parent = this.breadcrumbs[this.breadcrumbs.length - 1];
    this.currentNodes = parent.children;
    this.selectedCategory = null;
  }

  onSubmit() {
    if (this.amount && this.selectedCategory && this.date) {
      if (this.editMode && this.editingId) {
        this.expenseService.updateExpense({
          id: this.editingId,
          amount: this.amount,
          category: this.selectedCategory,
          note: this.note,
          date: this.date
        });
      } else {
        this.expenseService.addExpense(this.amount, this.selectedCategory, this.note, this.date);
      }
      this.closeModal();
    }
  }
}
