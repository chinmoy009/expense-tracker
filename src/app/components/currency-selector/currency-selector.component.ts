import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService, Currency } from '../../services/settings.service';

@Component({
  selector: 'app-currency-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './currency-selector.component.html',
  styleUrls: ['./currency-selector.component.css']
})
export class CurrencySelectorComponent {
  currentCurrency: Currency = 'USD';

  constructor(private settingsService: SettingsService) {
    this.settingsService.currency$.subscribe(c => this.currentCurrency = c);
  }

  toggleCurrency() {
    const newCurrency = this.currentCurrency === 'USD' ? 'BDT' : 'USD';
    this.settingsService.setCurrency(newCurrency);
  }
}
