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
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile-layout').then((m) => m.ProfileLayout),
    children: [
      { path: '', loadComponent: () => import('./pages/profile').then((m) => m.Profile) },
      {
        path: 'trades',
        loadComponent: () => import('./pages/profile-trades').then((m) => m.ProfileTrades),
      },
    ],
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
  { path: 'about', loadComponent: () => import('./pages/about').then((m) => m.About) },
  { path: 'info', loadComponent: () => import('./pages/info').then((m) => m.Info) },
  { path: '**', redirectTo: '' },
];
