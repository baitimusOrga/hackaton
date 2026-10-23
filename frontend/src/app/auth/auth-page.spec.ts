import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideApiConfiguration } from '../api/api-configuration';
import { AuthPage } from './auth-page';
import { csrfInterceptor } from './auth';

describe('Account forms', () => {
  async function setup(mode: string, fragment = '') {
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              fragment,
              queryParamMap: new Map(),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuthPage);
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('rejects mismatched passwords before sending a registration request', async () => {
    const { component, http } = await setup('register');
    component.password = 'a long secure password';
    component.confirmPassword = 'another long secure password';
    await component.submit();
    expect(component.error()).toBe('The passwords do not match.');
    http.expectNone('/api/auth/register');
    http.expectNone('/api/auth/csrf');
    http.verify();
  });

  it('allows clicking Create account and explains invalid fields instead of disabling it', async () => {
    const { fixture, http } = await setup('register');
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button')!;
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Enter a display name.');
    expect(element.textContent).toContain('Enter a valid email address.');
    expect(element.textContent).toContain('Use a password of at least 12 characters.');
    expect(element.textContent).toContain('Enter the same password again.');
    http.expectNone('/api/auth/csrf');
    http.expectNone('/api/auth/register');
    http.verify();
  });

  it('submits valid registration fields when Create account is clicked', async () => {
    const { fixture, component, http } = await setup('register');
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['display-name', 'Test user'],
      ['email', 'test@example.com'],
      ['password', 'a long testing passphrase'],
      ['confirm-password', 'a long testing passphrase'],
    ]) {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne('/api/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    const registration = http.expectOne('/api/auth/register');
    expect(registration.request.body.displayName).toBe('Test user');
    // Keep this test on the form to check the pending state and failed-request recovery.
    expect(component.busy()).toBe(true);
    registration.error(new ProgressEvent('network-error'));
    await fixture.whenStable();
    expect(component.busy()).toBe(false);
    expect(element.textContent).toContain('Cannot reach the server. Please try again.');
    expect(element.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    http.verify();
  });

  it('renders recovery confirmation without revealing account existence', async () => {
    const { fixture, component, http } = await setup('forgot');
    component.email = 'missing@example.com';
    const result = component.submit();
    http.expectOne('/api/auth/csrf').flush({ headerName: 'X-CSRF-TOKEN', token: 'token' });
    http
      .expectOne('/api/auth/forgot-password')
      .flush(null, { status: 202, statusText: 'Accepted' });
    await result;
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('If an account exists');
    expect(component.done()).toBe(true);
    http.verify();
  });

  it('disables reset without a recovery token', async () => {
    const { fixture, component } = await setup('reset');
    expect(component.error()).toContain('missing its token');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')?.disabled).toBe(true);
  });

  it('keeps the recovery token in memory and removes it from the URL', async () => {
    window.history.replaceState(null, '', '/reset-password#token=sensitive-reset-token');
    const { component } = await setup('reset', 'token=sensitive-reset-token');
    expect(component.resetToken).toBe('sensitive-reset-token');
    expect(window.location.hash).toBe('');
    window.history.replaceState(null, '', '/');
  });
});
