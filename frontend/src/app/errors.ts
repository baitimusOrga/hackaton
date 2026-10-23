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
      if (
        err instanceof HttpErrorResponse &&
        !req.context.get(HANDLES_ERRORS) &&
        !(err.status === 401 && req.url.startsWith('/api/') && !req.url.startsWith('/api/auth/'))
      ) {
        banner.show(messageOf(err));
      }
      return throwError(() => err);
    }),
  );
};

export function messageOf(err: HttpErrorResponse): string {
  if (err.status === 0) {
    return 'The server is not reachable.';
  }
  const problem = (err.error ?? {}) as Problem;
  return problem.detail ?? problem.title ?? err.message;
}
