import { Routes } from '@angular/router';
import { accountGuard } from './auth/auth';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  ...(['login', 'register', 'forgot-password', 'reset-password'] as const).map((path) => ({
    path,
    data: { mode: path === 'forgot-password' ? 'forgot' : path === 'reset-password' ? 'reset' : path },
    loadComponent: () => import('./auth/auth-page').then((m) => m.AuthPage),
  })),
  { path: 'account', canActivate: [accountGuard], loadComponent: () => import('./auth/profile-page').then((m) => m.ProfilePage) },
  { path: '**', redirectTo: '' },
];
