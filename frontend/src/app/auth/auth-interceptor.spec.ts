import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from './auth';
import { authInterceptor } from './auth-interceptor';
import { ErrorBanner, errorInterceptor } from '../errors';

describe('API JWT interceptor', () => {
  let auth: { token: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  let http: HttpClient;
  let backend: HttpTestingController;
  beforeEach(() => {
    auth = { token: vi.fn().mockResolvedValue('api-token'), clear: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());
  it('adds the bearer token to backend requests', async () => {
    http.get('/api/listings').subscribe();
    await Promise.resolve();
    const request = backend.expectOne('/api/listings');
    expect(request.request.headers.get('Authorization')).toBe('Bearer api-token');
    request.flush([]);
  });
  it('keeps tokens away from auth endpoints and external origins', () => {
    for (const url of ['/api/auth/get-session', 'https://external.example/api/listings']) {
      http.get(url).subscribe();
      const request = backend.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
    expect(auth.token).not.toHaveBeenCalled();
  });
  it('redirects backend 401s to login without showing the error banner', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.post('/api/listings', {}).subscribe({ error: () => undefined });
    await Promise.resolve();
    backend
      .expectOne('/api/listings')
      .flush({ detail: 'Please log in.' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.clear).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
    expect(TestBed.inject(ErrorBanner).message()).toBeNull();
  });
  it('still shows normal API errors', async () => {
    http.get('/api/listings/123').subscribe({ error: () => undefined });
    await Promise.resolve();
    backend
      .expectOne('/api/listings/123')
      .flush({ detail: 'Listing not found.' }, { status: 404, statusText: 'Not Found' });
    expect(TestBed.inject(ErrorBanner).message()).toBe('Inserat nicht gefunden.');
  });
});
