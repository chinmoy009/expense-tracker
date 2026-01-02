import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { GoogleApiService } from './services/google-api.service';
import { CurrencySelectorComponent } from './components/currency-selector/currency-selector.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, CurrencySelectorComponent],
  template: `
    <div class="background-glow"></div>
    
    <div class="app-container">
        <header>
            <div class="user-welcome">
                <span class="greeting">Good Evening,</span>
                <h1 class="username" *ngIf="user$ | async as user; else guest">
                    {{ user.getBasicProfile().getGivenName() }}
                </h1>
                <ng-template #guest>
                    <h1 class="username">Guest</h1>
                </ng-template>
            </div>
            
            <div class="header-actions" style="display: flex; gap: 10px; align-items: center;">
                <app-currency-selector></app-currency-selector>
                <div class="date-display">
                    <span id="current-date">{{ currentDate | date:'MMM d' }}</span>
                </div>
                
                <button *ngIf="!(user$ | async)" (click)="signIn()" class="auth-btn">
                    <i class="fa-brands fa-google"></i> Sign In
                </button>
                <button *ngIf="user$ | async" (click)="signOut()" class="auth-btn logout">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        </header>

        <app-dashboard></app-dashboard>
    </div>
  `,
  styles: [`
    .auth-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 8px 12px;
        border-radius: 12px;
        cursor: pointer;
        font-family: var(--font-main);
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .auth-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    .logout {
        color: var(--accent-danger);
        border-color: rgba(247, 37, 133, 0.3);
    }
  `]
})
export class AppComponent {
  currentDate = new Date();
  user$ = this.googleApi.user$;

  constructor(private googleApi: GoogleApiService) { }

  signIn() {
    this.googleApi.signIn();
  }

  signOut() {
    this.googleApi.signOut();
  }
}
