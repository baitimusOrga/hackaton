import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';

export interface Problem {
  status?: number;
  title?: string;
  detail?: string;
  errors?: Record<string, string>;
}

export const HANDLES_ERRORS = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class ErrorBanner {
  readonly message = signal<string | null>(null);

  show(message: string): void {
    this.message.set(message);
  }

  dismiss(): void {
    this.message.set(null);
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const banner = inject(ErrorBanner);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(HANDLES_ERRORS)) {
        banner.show(messageOf(err));
      }
      return throwError(() => err);
    }),
  );
};

// TODO: translate backend Problem Details too once i18n (DE/FR/IT/EN) exists.
const UNREACHABLE = 'Der Server ist gerade nicht erreichbar. Versuch es in einem Moment nochmals.';

/** The user-facing text for a failed request; never the raw "Http failure response …" message. */
export function messageOf(err: HttpErrorResponse): string {
  // 0: no connection; 502–504: the proxy is up but the backend is not.
  if (err.status === 0 || (err.status >= 502 && err.status <= 504)) return UNREACHABLE;
  const problem = typeof err.error === 'object' && err.error ? (err.error as Problem) : {};
  if (problem.detail) return problem.detail;
  if (err.status === 404) return 'Das haben wir nicht gefunden.';
  return 'Etwas ist schiefgelaufen. Versuch es nochmals.';
}
