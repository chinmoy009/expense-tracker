import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Currency = 'USD' | 'BDT';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private currencySubject = new BehaviorSubject<Currency>('USD');
  currency$ = this.currencySubject.asObservable();

  constructor() {
    const saved = localStorage.getItem('currency') as Currency;
    if (saved && (saved === 'USD' || saved === 'BDT')) {
      this.currencySubject.next(saved);
    }
  }

  setCurrency(currency: Currency) {
    this.currencySubject.next(currency);
    localStorage.setItem('currency', currency);
  }

  getCurrencySymbol(currency: Currency): string {
    return currency === 'USD' ? '$' : '৳';
  }
}
