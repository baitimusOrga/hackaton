import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ErrorBanner, HANDLES_ERRORS, errorInterceptor, translateError } from './errors';
import { I18n } from './i18n/i18n';

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

  it('says the server is unreachable instead of the raw gateway error', () => {
    http.get('/api/listings').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/listings')
      .flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });
    expect(banner.message()).toContain('nicht erreichbar');
  });

  it('falls back to a plain message for a 404 without problem details', () => {
    http.get('/api/nope').subscribe({ error: () => undefined });
    backend.expectOne('/api/nope').flush('Not Found', { status: 404, statusText: 'Not Found' });
    expect(banner.message()).toBe('Das haben wir nicht gefunden.');
  });

  it('stays quiet when the caller handles the error itself', () => {
    http
      .get('/api/teams', { context: new HttpContext().set(HANDLES_ERRORS, true) })
      .subscribe({ error: () => undefined });
    backend.expectOne('/api/teams').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(banner.message()).toBeNull();
  });
});

describe('translateError', () => {
  it('translates known backend texts and keeps unknown ones', () => {
    const i18n = TestBed.inject(I18n);
    i18n.lang.set('fr');
    expect(translateError('Postcode 9999 not found.', i18n)).toBe('Code postal 9999 introuvable.');
    expect(translateError('Something else', i18n)).toBe('Something else');
    i18n.lang.set('de');
    expect(translateError('Listing not found.', i18n)).toBe('Inserat nicht gefunden.');
  });
});
