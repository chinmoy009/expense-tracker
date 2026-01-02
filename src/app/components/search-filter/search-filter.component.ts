import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../services/analytics.service';
import { CategoryService, CategoryNode } from '../../services/category.service';

@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-panel glass-panel">
      <div class="filter-header">
        <h3><i class="fa-solid fa-filter"></i> Filters</h3>
        <button (click)="resetFilters()" class="reset-btn">Reset</button>
      </div>

      <div class="filter-grid">
        <!-- Month/Year Selector -->
        <div class="filter-group">
            <label>Period</label>
            <div class="period-inputs">
                <select [(ngModel)]="selectedMonth" (change)="updateFilter()" class="glass-select">
                    <option [ngValue]="null">All Months</option>
                    <option *ngFor="let m of months; let i = index" [ngValue]="i">{{ m }}</option>
                </select>
                <select [(ngModel)]="selectedYear" (change)="updateFilter()" class="glass-select">
                    <option [ngValue]="null">All Years</option>
                    <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
                </select>
            </div>
        </div>

        <!-- Category Selector -->
        <div class="filter-group">
            <label>Category</label>
            <select [(ngModel)]="selectedCategoryId" (change)="updateFilter()" class="glass-select">
                <option [ngValue]="null">All Categories</option>
                <ng-container *ngTemplateOutlet="categoryOptions; context: { $implicit: categories$ | async, level: 0 }"></ng-container>
            </select>
        </div>

        <!-- Custom Date Range (Optional) -->
        <!-- <div class="filter-group">
            <label>Date Range</label>
            <div class="date-inputs">
                <input type="date" [(ngModel)]="startDate" (change)="updateFilter()" class="glass-input">
                <span class="separator">-</span>
                <input type="date" [(ngModel)]="endDate" (change)="updateFilter()" class="glass-input">
            </div>
        </div> -->
      </div>
    </div>

    <ng-template #categoryOptions let-nodes let-level="level">
        <ng-container *ngFor="let node of nodes">
            <option [value]="node.id" [style.padding-left.px]="level * 10">
                {{ getPrefix(level) }}{{ node.name }}
            </option>
            <ng-container *ngTemplateOutlet="categoryOptions; context: { $implicit: node.children, level: level + 1 }"></ng-container>
        </ng-container>
    </ng-template>
  `,
  styles: [`
    .glass-panel {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 20px;
        color: white;
        margin-bottom: 20px;
    }
    .filter-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 15px;
    }
    .filter-header h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
    
    .reset-btn {
        background: none; border: 1px solid var(--glass-border); color: var(--text-secondary);
        padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem;
        transition: all 0.2s;
    }
    .reset-btn:hover { background: rgba(255,255,255,0.1); color: white; }

    .filter-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;
    }
    .filter-group label {
        display: block; color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 5px;
    }
    
    .glass-select, .glass-input {
        width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border);
        color: white; padding: 8px; border-radius: 10px; outline: none;
        font-family: var(--font-main);
    }
    .glass-select option { background: #1a1a2e; color: white; }
    
    .period-inputs { display: flex; gap: 10px; }
    .date-inputs { display: flex; align-items: center; gap: 5px; }
    .separator { color: var(--text-secondary); }
  `]
})
export class SearchFilterComponent implements OnInit {
  categories$ = this.categoryService.categories$;

  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  years: number[] = [];

  selectedMonth: number | null = new Date().getMonth();
  selectedYear: number | null = new Date().getFullYear();
  selectedCategoryId: string | null = null;
  startDate: string | null = null;
  endDate: string | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private categoryService: CategoryService
  ) {
    // Generate years (current - 5 to current + 1)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      this.years.push(i);
    }
  }

  ngOnInit() {
    this.updateFilter();
  }

  updateFilter() {
    this.analyticsService.updateFilter({
      month: this.selectedMonth,
      year: this.selectedYear,
      categoryId: this.selectedCategoryId,
      startDate: this.startDate ? new Date(this.startDate) : null,
      endDate: this.endDate ? new Date(this.endDate) : null
    });
  }

  resetFilters() {
    this.selectedMonth = new Date().getMonth();
    this.selectedYear = new Date().getFullYear();
    this.selectedCategoryId = null;
    this.startDate = null;
    this.endDate = null;
    this.updateFilter();
  }

  getPrefix(level: number): string {
    return level > 0 ? '- '.repeat(level) : '';
  }
}
