import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SettingsService } from '../../services/settings.service';
import { Observable } from 'rxjs';

/** KPI tile. Shows a currency amount, or a plain count when isCount is set. */
@Component({
  selector: 'app-summary-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="kpi lm-card">
      <div class="kpi-icon" aria-hidden="true"><mat-icon>{{ icon }}</mat-icon></div>
      <div class="kpi-body">
        <div class="kpi-label">{{ label }}</div>
        <div class="kpi-value lm-amount">
          <ng-container *ngIf="isCount; else money">{{ amount | number:'1.0-0' }}</ng-container>
          <ng-template #money>{{ amount | currency:((currency$ | async) || 'USD') }}</ng-template>
        </div>
        <div class="kpi-hint lm-muted" *ngIf="hint">{{ hint }}</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .kpi { display: flex; align-items: center; gap: 16px; height: 100%; }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent-secondary) 14%, transparent);
      color: var(--accent-secondary);
    }
    .kpi-label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 2px; }
    .kpi-hint { margin-top: 2px; font-size: 0.8rem; }
  `]
})
export class SummaryCardComponent {
  @Input() label = '';
  @Input() amount = 0;
  @Input() icon = 'insights';
  @Input() hint = '';
  @Input() isCount = false;

  currency$: Observable<string>;

  constructor(private settingsService: SettingsService) {
    this.currency$ = this.settingsService.currency$;
  }
}
