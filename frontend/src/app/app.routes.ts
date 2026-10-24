import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'search', loadComponent: () => import('./pages/search').then((m) => m.Search) },
  { path: 'find', loadComponent: () => import('./pages/find').then((m) => m.Find) },
  {
    path: 'listings/:id',
    loadComponent: () => import('./pages/listing').then((m) => m.ListingPage),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/messages').then((m) => m.Messages),
  },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: 'register',
    data: { registering: true },
    loadComponent: () => import('./pages/login').then((m) => m.Login),
  },
  // Selling is a dialog over the page it was opened from (URL `/<page>(modal:sell)`).
  {
    path: 'sell',
    outlet: 'modal',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/sell').then((m) => m.Sell),
  },
  { path: 'sell', redirectTo: () => inject(Router).parseUrl('/(modal:sell)') },
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
