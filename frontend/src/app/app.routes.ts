import { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: 'register',
    data: { registering: true },
    loadComponent: () => import('./pages/login').then((m) => m.Login),
  },
  {
    path: 'sell',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/sell').then((m) => m.Sell),
  },
  { path: '**', redirectTo: '' },
];
