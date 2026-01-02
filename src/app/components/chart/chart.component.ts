import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService, AnalyticsResult } from '../../services/analytics.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="glass-card chart-section">
        <div class="section-header">
            <h2>Spending Breakdown</h2>
        </div>
        <div class="chart-container" style="position: relative; height: 200px;">
            <canvas #chartCanvas></canvas>
        </div>
    </section>
  `,
  styles: [`
    .glass-card {
        background: var(--glass-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        border-radius: 24px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .section-header h2 { font-size: 1.2rem; font-weight: 600; }
  `]
})
export class ChartComponent implements AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef;
  chart: any;

  constructor(private analyticsService: AnalyticsService) { }

  ngAfterViewInit() {
    this.analyticsService.result$.subscribe((result) => {
      this.renderChart(result.categoryDistribution);
    });
  }

  renderChart(distribution: { [key: string]: number }) {
    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    const labels = Object.keys(distribution);
    const data = Object.values(distribution);

    // Dynamic colors (could be improved with a palette generator)
    const colors = [
      '#ff9f1c', '#4cc9f0', '#f72585', '#7209b7', '#4ade80', '#fbbf24', '#ef4444', '#a855f7'
    ];
    const bgColors = labels.map((_, i) => colors[i % colors.length]);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: { family: "'Outfit', sans-serif" }
            }
          }
        }
      }
    });
  }
}
