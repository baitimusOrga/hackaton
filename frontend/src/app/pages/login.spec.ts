import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { Auth, AuthRequestError } from '../auth/auth';
import { Login } from './login';

describe('Login and registration forms', () => {
  async function setup(registering: boolean) {
    const auth = {
      login: vi.fn().mockResolvedValue(undefined),
      register: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { registering }, queryParamMap: new Map([['returnUrl', '/sell']]) },
          },
        },
      ],
    }).compileComponents();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    return { fixture, auth, navigate, element: fixture.nativeElement as HTMLElement };
  }
  it('explains invalid registration fields when Konto erstellen is clicked', async () => {
    const { fixture, auth, element } = await setup(true);
    expect(element.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Gib eine gültige E-Mail-Adresse ein.');
    expect(element.textContent).toContain('Mindestens 12 Zeichen.');
    expect(auth.register).not.toHaveBeenCalled();
  });
  it('returns to the requested page after login', async () => {
    const { fixture, auth, navigate, element } = await setup(false);
    for (const [id, value] of [
      ['email', 'test@example.com'],
      ['password', 'LocalTest123!'],
    ]) {
      const input = element.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(auth.login).toHaveBeenCalledWith('test@example.com', 'LocalTest123!');
    expect(navigate).toHaveBeenCalledWith('/sell');
  });
  it('shows Better Auth errors beside the form', async () => {
    const { fixture, auth, element } = await setup(false);
    auth.login.mockRejectedValue(new AuthRequestError('Invalid email or password.', 401));
    for (const [id, value] of [
      ['email', 'test@example.com'],
      ['password', 'wrong'],
    ]) {
      const input = element.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password.',
    );
  });
});
