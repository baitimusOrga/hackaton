import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideApiConfiguration } from '../api/api-configuration';
import { Auth, csrfInterceptor, Profile } from './auth';
import { ErrorBanner, errorInterceptor } from '../errors';

const profile: Profile = {
  id: 1,
  email: 'baitimus@example.com',
  displayName: 'Baitimus',
  location: '',
  canton: null,
  contactPreference: 'IN_APP',
};

describe('Account sessions and CSRF', () => {
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, csrfInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('fetches CSRF before login and refreshes the user after session rotation', async () => {
    const result = auth.login(profile.email, 'correct horse battery staple');
    http.expectOne('/api/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'masked-token' });
    const login = http.expectOne('/api/auth/login');
    expect(login.request.headers.get('X-CSRF-TOKEN')).toBe('masked-token');
    const credentials = new URLSearchParams(login.request.serializeBody() as string);
    expect(credentials.get('email')).toBe(profile.email);
    expect(credentials.get('password')).toBe('correct horse battery staple');
    expect(login.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    login.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    http.expectOne('/api/auth/me').flush(profile);
    await result;
    expect(auth.user()).toEqual(profile);
  });

  it('uses a fresh CSRF token for logout and clears the displayed identity', async () => {
    auth.user.set(profile);
    const result = auth.logout();
    http.expectOne('/api/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'new-token' });
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.method).toBe('POST');
    expect(logout.request.headers.get('X-CSRF-TOKEN')).toBe('new-token');
    logout.flush(null);
    await result;
    expect(auth.user()).toBeNull();
    expect(TestBed.inject(ErrorBanner).message()).toBeNull();
  });

  it('treats an expired session as signed out', async () => {
    auth.user.set(profile);
    const result = auth.restore();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it('does not mistake a network failure for a valid anonymous response', async () => {
    const result = auth.restore();
    const rejected = expect(result).rejects.toBeDefined();
    http.expectOne('/api/auth/me').error(new ProgressEvent('network-error'));
    await rejected;
  });

  it('clears a stale profile when a save discovers session expiry', async () => {
    auth.user.set(profile);
    const result = auth.update(profile);
    const rejected = expect(result).rejects.toBeDefined();
    http.expectOne('/api/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await rejected;
    expect(auth.user()).toBeNull();
  });
});
