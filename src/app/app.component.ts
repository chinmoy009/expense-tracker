import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map, shareReplay } from 'rxjs/operators';
import { GoogleApiService } from './services/google-api.service';
import { ThemeService } from './services/theme.service';
import { CurrencySelectorComponent } from './components/currency-selector/currency-selector.component';
import { AppActionsService } from './shared/app-actions.service';

const RAIL_COLLAPSED_KEY = 'lumina_nav_collapsed';

interface NavItem {
  label: string;
  icon: string;
  route: string | null; // null = placeholder, not yet available
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    CurrencySelectorComponent
  ],
  template: `
    <div class="shell">
      <mat-toolbar class="topbar">
        <button
          mat-icon-button
          class="rail-toggle"
          *ngIf="!(isMobile$ | async)"
          (click)="toggleRail()"
          [attr.aria-label]="railCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          [attr.aria-expanded]="!railCollapsed">
          <mat-icon>menu</mat-icon>
        </button>

        <div class="brand">
          <mat-icon class="brand-icon" aria-hidden="true">auto_awesome</mat-icon>
          <span class="brand-name">Lumina</span>
        </div>

        <span class="page-title" aria-live="polite">{{ pageTitle }}</span>
        <span class="spacer"></span>

        <app-currency-selector></app-currency-selector>

        <button
          mat-icon-button
          class="theme-toggle"
          (click)="themeService.toggle()"
          [attr.aria-label]="(themeService.mode$ | async) === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
          <mat-icon>{{ (themeService.mode$ | async) === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <button
          mat-icon-button
          class="more-btn"
          *ngIf="!(isMobile$ | async)"
          [matMenuTriggerFor]="moreMenu"
          aria-label="More options">
          <mat-icon>more_vert</mat-icon>
        </button>

        <button mat-flat-button color="primary" class="add-btn" (click)="actions.addExpense()" aria-label="Add expense">
          <mat-icon>add</mat-icon>
          <span class="hide-mobile">Add expense</span>
        </button>

        <ng-container *ngIf="user$ | async as user; else signedOut">
          <button mat-icon-button [matMenuTriggerFor]="accountMenu" aria-label="Account menu" class="account-btn">
            <img class="avatar" [src]="user.getBasicProfile().getImageUrl()" alt="" referrerpolicy="no-referrer">
          </button>
          <mat-menu #accountMenu="matMenu" xPosition="before">
            <div class="account-head" (click)="$event.stopPropagation()">
              <div class="account-name">{{ user.getBasicProfile().getName() }}</div>
              <div class="account-email">{{ user.getBasicProfile().getEmail() }}</div>
            </div>
            <button mat-menu-item (click)="signOut()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </ng-container>

        <ng-template #signedOut>
          <button class="google-btn" (click)="signIn()" aria-label="Sign in with Google">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span class="hide-mobile">Sign in with Google</span>
          </button>
        </ng-template>
      </mat-toolbar>

      <mat-sidenav-container class="body">
        <mat-sidenav
          class="rail"
          mode="side"
          [opened]="!(isMobile$ | async)"
          [class.collapsed]="railCollapsed">
          <nav class="rail-nav" aria-label="Main navigation">
            <ng-container *ngFor="let item of navItems">
              <a
                *ngIf="item.route; else disabledItem"
                class="rail-link"
                [routerLink]="item.route"
                routerLinkActive="active"
                [matTooltip]="railCollapsed ? item.label : ''"
                matTooltipPosition="right">
                <mat-icon>{{ item.icon }}</mat-icon>
                <span class="label">{{ item.label }}</span>
              </a>
              <ng-template #disabledItem>
                <span
                  class="rail-link disabled"
                  aria-disabled="true"
                  [matTooltip]="railCollapsed ? item.label + ' (coming soon)' : 'Coming soon'"
                  matTooltipPosition="right">
                  <mat-icon>{{ item.icon }}</mat-icon>
                  <span class="label">{{ item.label }}</span>
                </span>
              </ng-template>
            </ng-container>
          </nav>
        </mat-sidenav>

        <mat-sidenav-content class="content">
          <main class="page">
            <router-outlet></router-outlet>
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>

      <nav class="bottom-nav" *ngIf="isMobile$ | async" aria-label="Main navigation">
        <a *ngFor="let item of tabItems" class="tab" [routerLink]="item.route" routerLinkActive="active">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span>{{ item.label }}</span>
        </a>
        <button class="tab" [matMenuTriggerFor]="moreMenu" aria-label="More options">
          <mat-icon>more_horiz</mat-icon>
          <span>More</span>
        </button>
      </nav>

      <mat-menu #moreMenu="matMenu" yPosition="above">
        <button mat-menu-item (click)="actions.openCategories()">
          <mat-icon>sell</mat-icon>
          <span>Categories</span>
        </button>
        <button mat-menu-item (click)="actions.openImport()">
          <mat-icon>file_upload</mat-icon>
          <span>Import from Sheets</span>
        </button>
        <button mat-menu-item (click)="themeService.toggle()">
          <mat-icon>brightness_6</mat-icon>
          <span>Toggle theme</span>
        </button>
      </mat-menu>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* Top bar */
    .topbar.mat-toolbar {
      flex-shrink: 0;
      height: 64px;
      gap: 8px;
      padding: 0 16px;
      background: var(--surface);
      color: var(--text-primary);
      border-bottom: 1px solid var(--glass-border);
      font-family: var(--font-main);
    }
    .brand { display: flex; align-items: center; gap: 8px; margin-left: 4px; }
    .brand-icon { color: var(--accent-primary); }
    .brand-name {
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .page-title { margin-left: 16px; font-size: 0.95rem; color: var(--text-secondary); }
    .spacer { flex: 1 1 auto; }
    .add-btn { border-radius: 12px; }
    .add-btn mat-icon { margin-right: 4px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; display: block; }
    .account-head { padding: 12px 16px; min-width: 220px; }
    .account-name { font-weight: 600; }
    .account-email { font-size: 0.8rem; color: var(--text-secondary); }

    .google-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid #dadce0;
      border-radius: 18px;
      background: #ffffff;
      color: #1f1f1f;
      font: 500 14px 'Roboto', Arial, sans-serif;
      cursor: pointer;
      white-space: nowrap;
    }
    .google-btn:hover { background: #f8f9fa; }

    /* Body and rail */
    .body { flex: 1 1 auto; min-height: 0; background: transparent; }
    .rail {
      width: 240px;
      background: var(--surface);
      border-right: 1px solid var(--glass-border);
      padding: 12px 8px;
      transition: width 0.2s ease;
      overflow-x: hidden;
    }
    .rail.collapsed { width: 72px; }
    .rail-nav { display: flex; flex-direction: column; gap: 4px; }
    .rail-link {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      padding: 0 12px;
      border-radius: 12px;
      color: var(--text-secondary);
      text-decoration: none;
      white-space: nowrap;
    }
    .rail-link:hover { background: var(--surface-2); color: var(--text-primary); }
    .rail-link.active { background: color-mix(in srgb, var(--accent-primary) 14%, transparent); color: var(--accent-primary); font-weight: 600; }
    .rail-link.disabled { opacity: 0.45; cursor: not-allowed; }
    .rail-link.disabled:hover { background: transparent; color: var(--text-secondary); }
    .rail.collapsed .label { display: none; }
    .rail.collapsed .rail-link { justify-content: center; padding: 0; }

    .content { background: transparent; }
    .page { padding: 24px; min-height: 100%; }

    /* Bottom tab bar (mobile) */
    .bottom-nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      height: 64px;
      display: flex;
      background: var(--surface);
      border-top: 1px solid var(--glass-border);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      background: none;
      border: none;
      color: var(--text-muted);
      font: 500 12px var(--font-main);
      text-decoration: none;
      cursor: pointer;
    }
    .tab.active { color: var(--accent-primary); }

    @media (max-width: 767.98px) {
      .topbar.mat-toolbar { padding: 0 8px; gap: 4px; }
      .brand-name, .page-title { display: none; }
      .hide-mobile { display: none; }
      .page { padding: 16px 16px 88px; }
    }
  `]
})
export class AppComponent {
  user$ = this.googleApi.user$;
  isMobile$ = this.breakpoints.observe('(max-width: 767.98px)').pipe(
    map(state => state.matches),
    shareReplay(1)
  );

  railCollapsed = this.readRailState();
  pageTitle = '';

  readonly navItems: NavItem[] = [
    { label: 'Expenses', icon: 'receipt_long', route: '/expenses' },
    { label: 'Banks', icon: 'account_balance', route: '/banks' },
    { label: 'Loans', icon: 'handshake', route: '/loans' },
    { label: 'Reports', icon: 'pie_chart', route: null },
    { label: 'Settings', icon: 'settings', route: null }
  ];

  readonly tabItems: NavItem[] = this.navItems.filter(item => item.route !== null);

  private readonly titles: Record<string, string> = {
    expenses: 'Expenses',
    banks: 'Banks',
    loans: 'Loans'
  };

  constructor(
    private googleApi: GoogleApiService,
    public themeService: ThemeService,
    public actions: AppActionsService,
    private breakpoints: BreakpointObserver,
    private router: Router
  ) {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        const page = event.urlAfterRedirects.replace(/^\//, '').split(/[?#]/)[0];
        this.pageTitle = this.titles[page] || '';
      });
  }

  toggleRail() {
    this.railCollapsed = !this.railCollapsed;
    try {
      localStorage.setItem(RAIL_COLLAPSED_KEY, String(this.railCollapsed));
    } catch {
      // Storage unavailable: state applies for this session only
    }
  }

  signIn() {
    this.googleApi.signIn();
  }

  signOut() {
    this.googleApi.signOut();
  }

  private readRailState(): boolean {
    try {
      return localStorage.getItem(RAIL_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
