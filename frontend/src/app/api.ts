import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from './config';

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  priceCents: number | null;
  imageUrl: string | null;
  ownerId: number;
  ownerName: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface Info {
  env: string;
  release: string;
  revision: string;
  llm: boolean;
}

/** All calls to the backend. Paths are relative to apiUrl from config.json (normally "/api"). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).apiUrl;

  register(email: string, password: string, displayName: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, { email, password, displayName });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password });
  }

  listings(page = 0, size = 20): Observable<Page<Listing>> {
    return this.http.get<Page<Listing>>(`${this.base}/listings`, { params: { page, size } });
  }

  listing(id: number | string): Observable<Listing> {
    return this.http.get<Listing>(`${this.base}/listings/${id}`);
  }

  createListing(data: FormData): Observable<Listing> {
    return this.http.post<Listing>(`${this.base}/listings`, data);
  }

  deleteListing(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/listings/${id}`);
  }

  describe(title: string, notes: string): Observable<{ text: string; model: string }> {
    return this.http.post<{ text: string; model: string }>(`${this.base}/ai/describe`, { title, notes });
  }

  info(): Observable<Info> {
    return this.http.get<Info>(`${this.base}/info`);
  }
}

/** The backend's error message (server.error.include-message=always), or a generic one. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return err.error?.message || err.error?.detail || `Request failed (${err.status})`;
  }
  return 'Something went wrong';
}
