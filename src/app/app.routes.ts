import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BankDashboardComponent } from './components/bank-dashboard/bank-dashboard.component';

export const routes: Routes = [
    { path: 'expenses', component: DashboardComponent },
    { path: 'banks', component: BankDashboardComponent },
    { path: 'loans', loadComponent: () => import('./components/loan-dashboard/loan-dashboard.component').then(m => m.LoanDashboardComponent) },
    { path: '', redirectTo: '/expenses', pathMatch: 'full' },
    { path: '**', redirectTo: '/expenses' }
];
