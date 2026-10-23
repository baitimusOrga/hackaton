import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, safeReturnUrl } from './auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  try {
    if (await auth.restore()) return true;
  } catch {
    // The login form can report a temporary auth-service failure.
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: safeReturnUrl(state.url) } });
};
