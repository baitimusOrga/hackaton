import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('Sell route guard', () => {
  const auth = { restore: vi.fn() };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
  });
  it('redirects an anonymous seller with a return URL', async () => {
    auth.restore.mockResolvedValue(null);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/sell' } as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fsell');
  });
  it('admits the authenticated seller', async () => {
    auth.restore.mockResolvedValue({ id: 'seller-1' });
    expect(
      await TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, { url: '/sell' } as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
});
