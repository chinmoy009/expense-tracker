import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Expense } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { parseLocalISODate } from '../../utils/date.util';

const CATEGORY_COLORS = ['#ff9f1c', '#4cc9f0', '#f72585', '#7209b7', '#4ade80', '#fbbf24'];

/**
 * Expenses data grid. Sorting and pagination are client-side over the already-loaded,
 * already-filtered list. Desktop shows a table; mobile shows cards.
 */
@Component({
  selector: 'app-expense-grid',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule, MatMenuModule, MatSelectModule, MatFormFieldModule],
  template: `
    <!-- Mobile sort control -->
    <div class="mobile-sort" *ngIf="isMobile">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Sort by</mat-label>
        <mat-select [value]="mobileSort" (selectionChange)="applyMobileSort($event.value)">
          <mat-option value="date-desc">Newest first</mat-option>
          <mat-option value="date-asc">Oldest first</mat-option>
          <mat-option value="amount-desc">Amount, high to low</mat-option>
          <mat-option value="amount-asc">Amount, low to high</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <!-- Desktop table -->
    <div class="table-wrap" [hidden]="isMobile">
      <table mat-table [dataSource]="dataSource" matSort matSortActive="date" matSortDirection="desc" matSortDisableClear class="grid-table">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
          <td mat-cell *matCellDef="let e">{{ toDate(e.date) | date:'mediumDate' }}</td>
          <td mat-footer-cell *matFooterCellDef>Total</td>
        </ng-container>

        <ng-container matColumnDef="note">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Note</th>
          <td mat-cell *matCellDef="let e" class="note-cell">{{ e.note || '—' }}</td>
          <td mat-footer-cell *matFooterCellDef></td>
        </ng-container>

        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
          <td mat-cell *matCellDef="let e">
            <span class="badge" [style.color]="colorFor(e.category)" [style.background]="colorFor(e.category) + '22'">{{ e.category }}</span>
          </td>
          <td mat-footer-cell *matFooterCellDef></td>
        </ng-container>

        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="num">Amount</th>
          <td mat-cell *matCellDef="let e" class="num lm-amount lm-negative">-{{ e.amount | currency:((currency$ | async) || 'USD') }}</td>
          <td mat-footer-cell *matFooterCellDef class="num lm-amount"><strong>{{ total | currency:((currency$ | async) || 'USD') }}</strong></td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef class="actions-col"><span class="sr-only">Actions</span></th>
          <td mat-cell *matCellDef="let e" class="actions-col">
            <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{ expense: e }" [attr.aria-label]="'Actions for expense on ' + e.date">
              <mat-icon>more_vert</mat-icon>
            </button>
          </td>
          <td mat-footer-cell *matFooterCellDef></td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
        <tr mat-footer-row *matFooterRowDef="columns; sticky: true"></tr>
      </table>
    </div>

    <!-- Mobile cards -->
    <div class="cards" *ngIf="isMobile">
      <article class="card-row" *ngFor="let e of pageRows">
        <div class="card-main">
          <div class="card-title">{{ e.note || e.category }}</div>
          <div class="card-meta">
            <span>{{ toDate(e.date) | date:'mediumDate' }}</span>
            <span class="badge" [style.color]="colorFor(e.category)" [style.background]="colorFor(e.category) + '22'">{{ e.category }}</span>
          </div>
        </div>
        <div class="card-amount lm-amount lm-negative">-{{ e.amount | currency:((currency$ | async) || 'USD') }}</div>
        <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{ expense: e }" [attr.aria-label]="'Actions for ' + (e.note || e.category)">
          <mat-icon>more_vert</mat-icon>
        </button>
      </article>
    </div>

    <div class="lm-empty" *ngIf="expenses.length === 0">No expenses found for this period.</div>

    <mat-paginator
      [hidden]="expenses.length === 0"
      [pageSizeOptions]="[10, 25, 50]"
      [pageSize]="10"
      showFirstLastButtons
      aria-label="Select page of expenses">
    </mat-paginator>

    <mat-menu #rowMenu="matMenu">
      <ng-template matMenuContent let-expense="expense">
        <button mat-menu-item (click)="edit.emit(expense)">
          <mat-icon>edit</mat-icon>
          <span>Edit</span>
        </button>
        <button mat-menu-item (click)="delete.emit(expense)">
          <mat-icon>delete_outline</mat-icon>
          <span>Delete</span>
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    :host { display: block; }
    .mobile-sort { margin-bottom: 12px; }
    .table-wrap { overflow-x: auto; }
    .grid-table { width: 100%; background: transparent; }
    .grid-table th.mat-mdc-header-cell { color: var(--text-secondary); font-weight: 600; }
    .grid-table .mat-mdc-cell, .grid-table .mat-mdc-footer-cell { color: var(--text-primary); }
    .grid-table td, .grid-table th { white-space: nowrap; }
    .note-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    .num { text-align: right; }
    .actions-col { width: 56px; text-align: right; }
    .badge { display: inline-block; font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

    .cards { display: flex; flex-direction: column; gap: 8px; }
    .card-row {
      display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px;
      padding: 12px; border-radius: 14px; background: var(--surface-2);
    }
    .card-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
    .card-amount { font-weight: 700; }
  `]
})
export class ExpenseGridComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input() expenses: Expense[] = [];
  @Input() total = 0;

  @Output() edit = new EventEmitter<Expense>();
  @Output() delete = new EventEmitter<Expense>();

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  readonly columns = ['date', 'note', 'category', 'amount', 'actions'];
  readonly dataSource = new MatTableDataSource<Expense>([]);

  pageRows: Expense[] = [];
  isMobile = false;
  mobileSort = 'date-desc';
  currency$ = this.settingsService.currency$;

  private rowsSub?: Subscription;
  private breakpointSub?: Subscription;

  constructor(
    private settingsService: SettingsService,
    private breakpoints: BreakpointObserver,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.breakpointSub = this.breakpoints.observe('(max-width: 767.98px)').subscribe(state => {
      this.isMobile = state.matches;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['expenses']) {
      this.dataSource.data = this.expenses;
      if (this.paginator) this.paginator.firstPage();
    }
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;

    // pageRows drives the mobile cards; it follows the same sort and page as the table
    this.rowsSub = this.dataSource.connect().subscribe(rows => this.pageRows = rows);

    // Initial emissions happen after the view was checked; re-check once so bindings settle
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.rowsSub?.unsubscribe();
    this.breakpointSub?.unsubscribe();
    this.dataSource.disconnect();
  }

  applyMobileSort(value: string) {
    this.mobileSort = value;
    const [id, start] = value.split('-') as [string, 'asc' | 'desc'];
    this.sort.sort({ id, start, disableClear: true });
  }

  toDate(iso: string): Date {
    return parseLocalISODate(iso);
  }

  colorFor(category: string): string {
    let hash = 0;
    for (const ch of category) {
      hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
  }
}
