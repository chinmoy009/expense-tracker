import { Component, ElementRef, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { AnalyticsService, AnalyticsResult } from '../../services/analytics.service';
import { SettingsService } from '../../services/settings.service';
import { ThemeService } from '../../services/theme.service';

const PALETTE = ['#ff9f1c', '#4cc9f0', '#f72585', '#7209b7', '#4ade80', '#fbbf24', '#ef4444', '#a855f7'];

interface LegendItem {
  name: string;
  amount: number;
  percent: number;
  color: string;
}

/** Doughnut of spending by category, with an accessible legend. Rendered in the expenses side panel. */
@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-head">
      <h2>Spending by category</h2>
      <span class="lm-muted">{{ total | currency:((currency$ | async) || 'USD') }}</span>
    </div>

    <div class="chart-wrap" [hidden]="legend.length === 0">
      <canvas #chartCanvas role="img" aria-label="Doughnut chart of spending by category"></canvas>
    </div>

    <ul class="legend" *ngIf="legend.length > 0; else noData">
      <li *ngFor="let item of legend">
        <span class="swatch" [style.background]="item.color" aria-hidden="true"></span>
        <span class="name">{{ item.name }}</span>
        <span class="pct lm-muted">{{ item.percent | number:'1.0-0' }}%</span>
        <span class="lm-amount">{{ item.amount | currency:((currency$ | async) || 'USD') }}</span>
      </li>
    </ul>

    <ng-template #noData>
      <div class="lm-empty">No spending to show for these filters.</div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 12px; }
    .chart-head h2 { font-size: 1.05rem; font-weight: 600; margin: 0; }
    .chart-wrap { position: relative; height: 240px; margin-bottom: 12px; }
    .legend { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
    .legend li { display: grid; grid-template-columns: 12px 1fr auto auto; align-items: center; gap: 8px; font-size: 0.875rem; }
    .swatch { width: 12px; height: 12px; border-radius: 3px; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `]
})
export class ChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  legend: LegendItem[] = [];
  total = 0;
  currency$ = this.settingsService.currency$;

  private chart: Chart | null = null;
  private viewReady = false;
  private latest: AnalyticsResult | null = null;
  private sub?: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
    private settingsService: SettingsService,
    private themeService: ThemeService
  ) { }

  ngOnInit() {
    // Data for the template is computed here, before the view is checked
    this.sub = combineLatest([this.analyticsService.result$, this.themeService.mode$]).subscribe(([result]) => {
      this.latest = result;
      this.total = result.total;
      this.legend = this.buildLegend(result);
      if (this.viewReady) this.draw();
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.draw();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.chart?.destroy();
  }

  private buildLegend(result: AnalyticsResult): LegendItem[] {
    return Object.keys(result.categoryDistribution).map((name, i) => {
      const amount = result.categoryDistribution[name];
      return {
        name,
        amount,
        percent: result.total > 0 ? (amount / result.total) * 100 : 0,
        color: PALETTE[i % PALETTE.length]
      };
    });
  }

  private draw() {
    this.chart?.destroy();
    this.chart = null;
    if (!this.latest || this.legend.length === 0) return;

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: this.legend.map(item => item.name),
        datasets: [{
          data: this.legend.map(item => item.amount),
          backgroundColor: this.legend.map(item => item.color),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${Number(ctx.parsed).toFixed(2)}`
            }
          }
        }
      }
    });
  }
}
