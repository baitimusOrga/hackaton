import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { I18n } from '../i18n/i18n';
import { ErrorBanner, translateError } from '../errors';
import { Auth, AuthRequestError, safeReturnUrl } from './auth';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || request.url.startsWith('/api/auth/'))
    return next(request);
  const auth = inject(Auth);
  const router = inject(Router);
  const banner = inject(ErrorBanner);
  const i18n = inject(I18n);
  return from(auth.token()).pipe(
    switchMap((token) =>
      next(token ? request.clone({ setHeaders: { Authorization: 'Bearer ' + token } }) : request),
    ),
    catchError((error: unknown) => {
      if (
        (error instanceof HttpErrorResponse || error instanceof AuthRequestError) &&
        error.status === 401
      ) {
        auth.clear();
        banner.dismiss();
        void router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl(router.url) } });
      } else if (!(error instanceof HttpErrorResponse)) {
        banner.show(
          translateError(
            error instanceof Error ? error.message : 'Authentication is temporarily unavailable.',
            i18n,
          ),
        );
      }
      return throwError(() => error);
    }),
  );
};
