import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Home } from './pages/home';
import { APP_CONFIG } from './config';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiUrl: '/api', env: 'staging', release: 'v0.0.0' } },
      ],
    }).compileComponents();
  });

  it('shows the running release from /api/info', async () => {
    const fixture = TestBed.createComponent(Home);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/info')
      .flush({ env: 'staging', release: 'v0.3.0', revision: 'abc123' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('v0.3.0');
  });
});
