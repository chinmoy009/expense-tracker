import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GoogleApiService } from './services/google-api.service';
import { CurrencySelectorComponent } from './components/currency-selector/currency-selector.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterModule, CurrencySelectorComponent],
    template: `
    <div class="background-glow"></div>
    
    <!-- Sidebar Menu -->
    <div class="sidebar-overlay" [class.active]="isMenuOpen" (click)="toggleMenu()"></div>
    <nav class="sidebar" [class.active]="isMenuOpen">
      <div class="sidebar-header">
        <div class="logo">
          <i class="fa-solid fa-star-half-stroke"></i>
          <span>Lumina</span>
        </div>
        <button class="close-menu" (click)="toggleMenu()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="sidebar-user" *ngIf="user$ | async as user">
        <img [src]="user.getBasicProfile().getImageUrl()" [alt]="user.getBasicProfile().getName()" class="user-avatar">
        <div class="user-info">
          <p class="user-name">{{ user.getBasicProfile().getName() }}</p>
          <p class="user-email">{{ user.getBasicProfile().getEmail() }}</p>
        </div>
      </div>

      <div class="sidebar-links">
        <a routerLink="/expenses" routerLinkActive="active" (click)="toggleMenu()" class="nav-link">
          <i class="fa-solid fa-receipt"></i>
          <span>Expenses</span>
        </a>
        <a routerLink="/banks" routerLinkActive="active" (click)="toggleMenu()" class="nav-link">
          <i class="fa-solid fa-building-columns"></i>
          <span>Banks</span>
        </a>
        <!-- Placeholder for future modules -->
        <a class="nav-link disabled" title="Coming Soon">
          <i class="fa-solid fa-chart-pie"></i>
          <span>Reports</span>
        </a>
        <a class="nav-link disabled" title="Coming Soon">
          <i class="fa-solid fa-gear"></i>
          <span>Settings</span>
        </a>
      </div>

      <div class="sidebar-footer">
        <button *ngIf="user$ | async" (click)="signOut()" class="logout-link">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>Sign Out</span>
        </button>
      </div>
    </nav>

    <div class="app-container">
      <header>
        <div class="header-left">
          <button class="hamburger-btn" (click)="toggleMenu()">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="user-welcome">
            <h1 class="username" *ngIf="user$ | async as user; else guest">
              <span class="greeting">Hello,</span> {{ user.getBasicProfile().getGivenName() }}
            </h1>
            <ng-template #guest>
              <h1 class="username">
                <span class="greeting">Hello,</span> Guest
              </h1>
            </ng-template>
          </div>
        </div>
        
        <div class="header-actions">
          <app-currency-selector></app-currency-selector>
          <div class="date-display">
            <span id="current-date">{{ currentDate | date:'MMM d' }}</span>
          </div>
          
          <button *ngIf="!(user$ | async)" (click)="signIn()" class="auth-btn">
            <i class="fa-brands fa-google"></i>
          </button>
        </div>
      </header>

      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
    styles: [`
    .header-left { display: flex; align-items: center; gap: 15px; }
    .hamburger-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 5px;
      display: flex;
      align-items: center;
      transition: opacity 0.2s;
    }
    .hamburger-btn:hover { opacity: 0.7; }

    /* Sidebar Styles */
    .sidebar-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .sidebar-overlay.active { opacity: 1; pointer-events: auto; }

    .sidebar {
      position: fixed;
      top: 0; left: -280px; width: 280px; height: 100%;
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(20px);
      border-right: 1px solid var(--glass-border);
      z-index: 1001;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      padding: 20px;
    }
    .sidebar.active { transform: translateX(280px); }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .close-menu {
      background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer;
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15px;
      margin-bottom: 30px;
    }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--accent-secondary); }
    .user-name { margin: 0; font-weight: 600; font-size: 0.9rem; }
    .user-email { margin: 0; font-size: 0.7rem; opacity: 0.6; }

    .sidebar-links { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 15px;
      border-radius: 12px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.2s;
    }
    .nav-link:hover { background: rgba(255, 255, 255, 0.1); color: white; }
    .nav-link.active {
      background: rgba(247, 37, 133, 0.15);
      color: var(--accent-primary);
      font-weight: 600;
    }
    .nav-link.active i { color: var(--accent-primary); }
    .nav-link.disabled { opacity: 0.4; cursor: not-allowed; }

    .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
    .logout-link {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 15px;
      border-radius: 12px;
      background: none; border: none;
      color: var(--accent-danger);
      cursor: pointer;
      transition: background 0.2s;
    }
    .logout-link:hover { background: rgba(247, 37, 133, 0.1); }

    .username .greeting { font-weight: 300; font-size: 0.8em; opacity: 0.8; }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    
    .auth-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      width: 38px; height: 38px;
      border-radius: 10px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .auth-btn:hover { background: rgba(255, 255, 255, 0.2); }

    main { padding-bottom: 20px; }
  `]
})
export class AppComponent {
    currentDate = new Date();
    user$ = this.googleApi.user$;
    isMenuOpen = false;

    constructor(private googleApi: GoogleApiService) { }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
    }

    signIn() {
        this.googleApi.signIn();
    }

    signOut() {
        this.googleApi.signOut();
        this.isMenuOpen = false;
    }
}
