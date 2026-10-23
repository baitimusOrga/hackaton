import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Api, AuthResponse, User } from './api';
import { APP_CONFIG } from './config';

const STORAGE_KEY = 'hackaton.auth';

/** Holds the JWT from login/register. Kept in localStorage so a reload stays logged in. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(Api);
  private readonly state = signal<AuthResponse | null>(read());

  readonly user = computed<User | null>(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.login(email, password).pipe(tap((r) => this.set(r)));
  }

  register(email: string, password: string, displayName: string): Observable<AuthResponse> {
    return this.api.register(email, password, displayName).pipe(tap((r) => this.set(r)));
  }

  logout(): void {
    this.set(null);
  }

  private set(value: AuthResponse | null): void {
    this.state.set(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked: stay logged in for this tab only */
    }
  }
}

function read(): AuthResponse | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Adds the bearer token to API calls; a 401 means the token expired, so log out. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const apiUrl = inject(APP_CONFIG).apiUrl;
  const token = auth.token();
  if (!token || !req.url.startsWith(apiUrl)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    tap({ error: (err) => err?.status === 401 && auth.logout() }),
  );
};

export const authGuard: CanActivateFn = (_route, state) =>
  inject(Auth).user() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
