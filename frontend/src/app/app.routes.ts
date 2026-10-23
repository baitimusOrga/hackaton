import { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'find', loadComponent: () => import('./pages/find').then((m) => m.Find) },
  {
    path: 'listings/:id',
    loadComponent: () => import('./pages/listing').then((m) => m.ListingPage),
  },
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
  {
    path: 'business',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/business').then((m) => m.Business),
  },
  {
    path: 'business/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/business-project').then((m) => m.BusinessProject),
  },
  { path: '**', redirectTo: '' },
];
