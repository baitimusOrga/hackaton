import { HttpContext, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';
import { AccountsService } from '../api/services/accounts.service';
import { Profile } from '../api/models/profile';
import { ProfileUpdate } from '../api/models/profile-update';
import { HANDLES_ERRORS, Problem } from '../errors';

export type { Profile, ProfileUpdate };

export const CANTONS = [
  'AG',
  'AI',
  'AR',
  'BE',
  'BL',
  'BS',
  'FR',
  'GE',
  'GL',
  'GR',
  'JU',
  'LU',
  'NE',
  'NW',
  'OW',
  'SG',
  'SH',
  'SO',
  'SZ',
  'TG',
  'TI',
  'UR',
  'VD',
  'VS',
  'ZG',
  'ZH',
] as const;

/** Fetch a fresh masked CSRF token after session changes; credentials stay in HttpOnly cookies. */
export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !request.url.startsWith('/api/')) {
    return next(request);
  }
  return inject(AccountsService)
    .csrf(undefined, request.context)
    .pipe(
      switchMap((csrf) => next(request.clone({ setHeaders: { [csrf.headerName]: csrf.token } }))),
    );
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly client = inject(AccountsService);
  private readonly context = new HttpContext().set(HANDLES_ERRORS, true);
  readonly user = signal<Profile | null>(null);

  async restore(): Promise<Profile | null> {
    try {
      const profile = await firstValueFrom(this.client.me(undefined, this.context));
      this.user.set(profile);
      return profile;
    } catch (error) {
      this.user.set(null);
      if (error instanceof HttpErrorResponse && error.status === 401) return null;
      throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await firstValueFrom(this.client.login({ body: { email, password } }, this.context));
    await this.restore();
  }

  register(email: string, password: string, displayName: string): Promise<void> {
    return firstValueFrom(
      this.client.register({ body: { email, password, displayName } }, this.context),
    );
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.client.logout(undefined, this.context));
    this.user.set(null);
  }

  async update(profile: ProfileUpdate): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.client.update({ body: profile }, this.context)));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.user.set(null);
      throw error;
    }
  }

  forgotPassword(email: string): Promise<void> {
    return firstValueFrom(this.client.forgotPassword({ body: { email } }, this.context));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(this.client.resetPassword({ body: { token, password } }, this.context));
    this.user.set(null);
  }
}

export function authError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the server. Please try again.';
    if (error.status === 401) return 'Please sign in again. Your session may have expired.';
    const problem = (error.error ?? {}) as Problem;
    if (problem.errors)
      return Object.entries(problem.errors)
        .map(([field, message]) => `${field}: ${message}`)
        .join(' ');
    if (problem.detail) return problem.detail;
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
