import { HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';
import { APP_CONFIG } from '../config';

export const CANTONS = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
] as const;

export interface Profile {
  id: number;
  email: string;
  displayName: string;
  location: string;
  canton: string | null;
  contactPreference: 'IN_APP' | 'EMAIL';
}
export type ProfileUpdate = Pick<Profile, 'displayName' | 'location' | 'canton' | 'contactPreference'>;

/** Fetch a fresh, masked Spring CSRF token for every API mutation, including login/logout.
 * Authentication stays in the HttpOnly session cookie, never localStorage.
 */
export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(APP_CONFIG).apiUrl;
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !request.url.startsWith(`${base}/`)) {
    return next(request);
  }
  return inject(HttpClient).get<{ headerName: string; token: string }>(`${base}/auth/csrf`).pipe(
    switchMap((csrf) => next(request.clone({ setHeaders: { [csrf.headerName]: csrf.token } }))),
  );
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiUrl}/auth`;
  readonly user = signal<Profile | null>(null);

  async restore(): Promise<Profile | null> {
    try {
      const profile = await firstValueFrom(this.http.get<Profile>(`${this.base}/me`));
      this.user.set(profile);
      return profile;
    } catch (error) {
      this.user.set(null);
      if (error instanceof HttpErrorResponse && error.status === 401) return null;
      throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const body = new HttpParams().set('email', email).set('password', password);
    await firstValueFrom(this.http.post<void>(`${this.base}/login`, body));
    await this.restore();
  }

  register(email: string, password: string, displayName: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/register`, { email, password, displayName }));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.base}/logout`, {}));
    this.user.set(null);
  }

  async update(profile: ProfileUpdate): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.http.put<Profile>(`${this.base}/me`, profile)));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.user.set(null);
      throw error;
    }
  }

  forgotPassword(email: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/forgot-password`, { email }));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.base}/reset-password`, { token, password }));
    this.user.set(null);
  }
}

export function authError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the server. Please try again.';
    if (error.status === 401) return 'Please sign in again. Your session may have expired.';
    if (Array.isArray(error.error?.errors)) return error.error.errors.join(' ');
    if (typeof error.error?.detail === 'string') return error.error.detail;
  }
  return 'Something went wrong. Please try again.';
}

export const accountGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  try {
    return (await auth.restore()) ? true : router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login'], { queryParams: { unavailable: '1' } });
  }
};
