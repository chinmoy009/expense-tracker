import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'lumina_theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private modeSubject = new BehaviorSubject<ThemeMode>(this.readInitialMode());
  mode$ = this.modeSubject.asObservable();

  constructor() {
    this.apply(this.modeSubject.value);
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  toggle() {
    this.setMode(this.mode === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode) {
    this.modeSubject.next(mode);
    this.apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode): theme still applies for this session
    }
  }

  private apply(mode: ThemeMode) {
    document.documentElement.setAttribute('data-theme', mode);
  }

  private readInitialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Fall through to system preference
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
