import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ErrorBanner, HANDLES_ERRORS, errorInterceptor } from './errors';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let banner: ErrorBanner;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    banner = TestBed.inject(ErrorBanner);
  });

  it('shows the detail of a problem response and passes the error on', () => {
    let failed = false;
    http.get('/api/teams/7').subscribe({ error: () => (failed = true) });
    backend
      .expectOne('/api/teams/7')
      .flush(
        { status: 404, title: 'Not Found', detail: 'Team 7 not found' },
        { status: 404, statusText: 'Not Found' },
      );
    expect(banner.message()).toBe('Team 7 not found');
    expect(failed).toBe(true);
  });

  it('stays quiet when the caller handles the error itself', () => {
    http
      .get('/api/teams', { context: new HttpContext().set(HANDLES_ERRORS, true) })
      .subscribe({ error: () => undefined });
    backend.expectOne('/api/teams').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(banner.message()).toBeNull();
  });
});
