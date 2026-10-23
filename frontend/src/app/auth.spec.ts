import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth, authInterceptor } from './auth';
import { APP_CONFIG } from './config';

describe('Auth', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiUrl: '/api', env: 'dev', release: 'dev' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('stores the token after login and sends it to the API', () => {
    const auth = TestBed.inject(Auth);
    auth.login('a@b.ch', 'secret123').subscribe();
    http.expectOne('/api/auth/login').flush({ token: 'jwt-1', user: { id: 1, email: 'a@b.ch', displayName: 'A' } });
    expect(auth.user()?.displayName).toBe('A');

    TestBed.inject(HttpClient).get('/api/auth/me').subscribe();
    expect(http.expectOne('/api/auth/me').request.headers.get('Authorization')).toBe('Bearer jwt-1');

    TestBed.inject(HttpClient).get('https://example.com/x').subscribe();
    expect(http.expectOne('https://example.com/x').request.headers.has('Authorization')).toBe(false);
  });

  it('logs out when the API answers 401', () => {
    const auth = TestBed.inject(Auth);
    auth.login('a@b.ch', 'secret123').subscribe();
    http.expectOne('/api/auth/login').flush({ token: 'jwt-1', user: { id: 1, email: 'a@b.ch', displayName: 'A' } });

    TestBed.inject(HttpClient).get('/api/auth/me').subscribe({ error: () => undefined });
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.user()).toBeNull();
  });
});
