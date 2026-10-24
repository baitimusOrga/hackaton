import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../auth/auth';
import { Footer } from './footer';

function setup(user: object | null) {
  const logout = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: Auth, useValue: { user: signal(user), logout } }],
  });
  const fixture = TestBed.createComponent(Footer);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, logout };
}

describe('Footer', () => {
  it('offers Anmelden when signed out', () => {
    const { el } = setup(null);
    const link = el.querySelector<HTMLAnchorElement>('app-account a')!;
    expect(link.textContent!.trim()).toBe('Anmelden');
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('offers Abmelden when signed in and signs out on click', async () => {
    const { fixture, el, logout } = setup({ id: '1', email: 'a@b.ch' });
    const button = el.querySelector<HTMLButtonElement>('app-account button')!;
    expect(button.textContent!.trim()).toBe('Abmelden');
    button.click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalled();
  });
});
