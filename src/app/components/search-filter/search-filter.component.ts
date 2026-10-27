import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, map, take } from 'rxjs/operators';
import { AnalyticsService, FilterState } from '../../services/analytics.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { parseLocalISODate, toLocalISODate } from '../../utils/date.util';

interface CategoryOption {
  id: string;
  name: string;
  level: number;
}

interface FilterChip {
  label: string;
  clear: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Search and filter bar for the expenses grid.
 * State lives in AnalyticsService; this component mirrors it to the URL query string
 * so filtered views survive refresh and can be linked.
 */
@Component({
  selector: 'app-search-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatChipsModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <section class="filters lm-card" aria-label="Search and filters">
      <div class="row">
        <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
          <mat-icon matPrefix aria-hidden="true">search</mat-icon>
          <mat-label>Search notes</mat-label>
          <input
            matInput
            type="search"
            [ngModel]="state.searchText"
            (ngModelChange)="onSearchInput($event)"
            placeholder="e.g. Pizza"
            aria-label="Search notes">
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period">
          <mat-label>Month</mat-label>
          <mat-select [value]="state.month" (selectionChange)="setMonth($event.value)" [disabled]="!!state.specificDate">
            <mat-option [value]="null">All months</mat-option>
            <mat-option *ngFor="let m of months; let i = index" [value]="i">{{ m }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period">
          <mat-label>Year</mat-label>
          <mat-select [value]="state.year" (selectionChange)="setYear($event.value)" [disabled]="!!state.specificDate">
            <mat-option [value]="null">All years</mat-option>
            <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date">
          <mat-label>Specific date</mat-label>
          <input matInput [matDatepicker]="datePicker" [value]="specificDate" (dateChange)="setDate($event.value)" placeholder="Any date" aria-label="Specific date (overrides month and year)">
          <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
          <mat-datepicker #datePicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="category">
          <mat-label>Category</mat-label>
          <mat-select [value]="state.categoryId" (selectionChange)="setCategory($event.value)">
            <mat-option [value]="null">All categories</mat-option>
            <mat-option *ngFor="let c of categoryOptions$ | async" [value]="c.id">
              <span [style.padding-left.px]="c.level * 12">{{ c.name }}</span>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-stroked-button type="button" class="reset" (click)="reset()">
          <mat-icon>restart_alt</mat-icon>
          Reset
        </button>
      </div>

      <mat-chip-set *ngIf="chips.length > 0" aria-label="Active filters">
        <mat-chip-row *ngFor="let chip of chips" (removed)="chip.clear()">
          {{ chip.label }}
          <button matChipRemove [attr.aria-label]="'Remove filter ' + chip.label">
            <mat-icon>cancel</mat-icon>
          </button>
        </mat-chip-row>
      </mat-chip-set>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .filters { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .search { flex: 2 1 240px; }
    .period { flex: 1 1 130px; }
    .date { flex: 1 1 150px; }
    .category { flex: 1.4 1 180px; }
    .reset { height: 40px; }
    @media (max-width: 767.98px) {
      .search, .period, .date, .category { flex: 1 1 100%; }
      .reset { width: 100%; justify-content: center; }
    }
  `]
})
export class SearchFilterComponent implements OnInit, OnDestroy {
  readonly months = MONTHS;
  readonly years: number[] = [];
  readonly categoryOptions$: Observable<CategoryOption[]>;

  state: FilterState = this.analyticsService.currentFilter();
  specificDate: Date | null = null;
  chips: FilterChip[] = [];

  private searchInput$ = new Subject<string>();
  private subs: Subscription[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      this.years.push(i);
    }

    this.categoryOptions$ = this.categoryService.categories$.pipe(
      map(tree => this.flatten(tree, 0))
    );
  }

  ngOnInit() {
    // URL to state: apply query params on load and when they change
    this.subs.push(
      this.route.queryParamMap.subscribe(params => {
        const next = this.stateFromQuery(params);
        if (next) this.analyticsService.updateFilter(next);
      })
    );

    // State to URL, plus local chip list
    this.subs.push(
      this.analyticsService.filter$.subscribe(filter => {
        this.state = filter;
        this.specificDate = filter.specificDate ? parseLocalISODate(filter.specificDate) : null;
        this.chips = this.buildChips(filter);
        this.syncUrl(filter);
      })
    );

    this.subs.push(
      this.searchInput$.pipe(debounceTime(250)).subscribe(text => {
        this.analyticsService.updateFilter({ searchText: text });
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  onSearchInput(text: string) {
    this.searchInput$.next(text);
  }

  setMonth(month: number | null) {
    this.analyticsService.updateFilter({ month });
  }

  setYear(year: number | null) {
    this.analyticsService.updateFilter({ year });
  }

  setDate(date: Date | null) {
    this.analyticsService.updateFilter({ specificDate: date ? toLocalISODate(date) : null });
  }

  setCategory(categoryId: string | null) {
    this.analyticsService.updateFilter({ categoryId });
  }

  reset() {
    const now = new Date();
    this.searchInput$.next('');
    this.analyticsService.updateFilter({
      month: now.getMonth(),
      year: now.getFullYear(),
      categoryId: null,
      specificDate: null,
      searchText: ''
    });
  }

  private buildChips(filter: FilterState): FilterChip[] {
    const now = new Date();
    const chips: FilterChip[] = [];

    if (filter.searchText) {
      chips.push({
        label: `Note: ${filter.searchText}`,
        clear: () => {
          this.searchInput$.next('');
          this.analyticsService.updateFilter({ searchText: '' });
        }
      });
    }

    if (filter.specificDate) {
      chips.push({
        label: `Date: ${filter.specificDate}`,
        clear: () => this.analyticsService.updateFilter({ specificDate: null })
      });
    } else {
      const isDefaultPeriod = filter.month === now.getMonth() && filter.year === now.getFullYear();
      if (!isDefaultPeriod) {
        const monthLabel = filter.month === null ? 'All months' : MONTHS[filter.month];
        const yearLabel = filter.year === null ? 'All years' : String(filter.year);
        chips.push({
          label: `${monthLabel} ${yearLabel}`,
          clear: () => this.analyticsService.updateFilter({ month: now.getMonth(), year: now.getFullYear() })
        });
      }
    }

    if (filter.categoryId) {
      const name = this.findCategoryName(this.categoryService.snapshot(), filter.categoryId) ?? 'Category';
      chips.push({
        label: `Category: ${name}`,
        clear: () => this.analyticsService.updateFilter({ categoryId: null })
      });
    }

    return chips;
  }

  private stateFromQuery(params: ParamMap): Partial<FilterState> | null {
    const now = new Date();
    const partial: Partial<FilterState> = {};

    if (params.has('q')) partial.searchText = params.get('q') ?? '';
    if (params.has('d')) partial.specificDate = params.get('d') || null;
    if (params.has('c')) partial.categoryId = params.get('c') || null;

    if (params.has('m')) {
      const m = params.get('m');
      partial.month = m === 'all' ? null : this.toIntOr(m, now.getMonth());
    }
    if (params.has('y')) {
      const y = params.get('y');
      partial.year = y === 'all' ? null : this.toIntOr(y, now.getFullYear());
    }

    return Object.keys(partial).length > 0 ? partial : null;
  }

  private syncUrl(filter: FilterState) {
    const target = {
      q: filter.searchText || null,
      m: filter.month === null ? 'all' : String(filter.month),
      y: filter.year === null ? 'all' : String(filter.year),
      d: filter.specificDate,
      c: filter.categoryId
    };

    const current = this.route.snapshot.queryParamMap;
    const same = (Object.keys(target) as (keyof typeof target)[]).every(key => (current.get(key) ?? null) === target[key]);
    if (!same) {
      this.router.navigate([], { relativeTo: this.route, queryParams: target, replaceUrl: true });
    }
  }

  private toIntOr(value: string | null, fallback: number): number {
    const n = Number(value);
    return Number.isInteger(n) ? n : fallback;
  }

  private flatten(nodes: CategoryNode[], level: number): CategoryOption[] {
    return nodes.flatMap(node => [
      { id: node.id, name: node.name, level },
      ...this.flatten(node.children, level + 1)
    ]);
  }

  private findCategoryName(nodes: CategoryNode[], id: string): string | null {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      const found = this.findCategoryName(node.children, id);
      if (found) return found;
    }
    return null;
  }
}
