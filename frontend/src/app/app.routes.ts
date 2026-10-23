import { Routes } from '@angular/router';
import { authGuard } from './auth';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/listing-list').then((m) => m.ListingList) },
  {
    path: 'listings/new',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/listing-new').then((m) => m.ListingNew),
  },
  { path: 'listings/:id', loadComponent: () => import('./pages/listing-detail').then((m) => m.ListingDetail) },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register').then((m) => m.Register) },
  { path: '**', redirectTo: '' },
];
