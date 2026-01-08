import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BankDashboardComponent } from './components/bank-dashboard/bank-dashboard.component';

export const routes: Routes = [
    { path: 'expenses', component: DashboardComponent },
    { path: 'banks', component: BankDashboardComponent },
    { path: '', redirectTo: '/expenses', pathMatch: 'full' },
    { path: '**', redirectTo: '/expenses' }
];
