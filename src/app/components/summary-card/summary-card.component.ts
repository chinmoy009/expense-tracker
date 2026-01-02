import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService, Currency } from '../../services/settings.service';

@Component({
    selector: 'app-summary-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="glass-card" [ngClass]="className">
        <div class="card-icon"><i [class]="icon"></i></div>
        <h3>{{ title }}</h3>
        <p class="amount">{{ amount | currency:currencyCode }}</p>
        <div class="trend positive" *ngIf="trend">{{ trend }}</div>
        <div class="progress-bar-container" *ngIf="showProgress">
            <div class="progress-bar" [style.width]="progress + '%'"></div>
        </div>
    </div>
  `,
    styles: [`
    .glass-card {
        background: var(--glass-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        border-radius: 24px;
        padding: 20px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        height: 100%;
    }
    .card-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
        font-size: 1.2rem;
    }
    .total-balance .card-icon { color: var(--accent-secondary); }
    .daily-spend .card-icon { color: var(--accent-primary); }
    h3 {
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-weight: 400;
        margin-bottom: 5px;
    }
    .amount {
        font-size: 1.4rem;
        font-weight: 700;
        margin-bottom: 10px;
    }
    .trend {
        font-size: 0.75rem;
        color: #4ade80;
    }
    .progress-bar-container {
        width: 100%;
        height: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        overflow: hidden;
    }
    .progress-bar {
        height: 100%;
        background: var(--accent-primary);
        border-radius: 3px;
    }
  `]
})
export class SummaryCardComponent {
    @Input() title: string = '';
    @Input() amount: number = 0;
    @Input() icon: string = '';
    @Input() trend: string = '';
    @Input() className: string = '';
    @Input() showProgress: boolean = false;
    @Input() progress: number = 0;

    currencyCode: string = 'USD';

    constructor(private settingsService: SettingsService) {
        this.settingsService.currency$.subscribe(c => this.currencyCode = c);
    }
}
