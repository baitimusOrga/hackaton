import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth, AuthRequestError } from '../auth/auth';
import { Profile } from './profile';

describe('Profile settings', () => {
  async function setup() {
    const auth = {
      user: signal({
        id: 'u1',
        name: 'Nora K.',
        email: 'nora@example.ch',
        emailVerified: true,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date(),
      }),
      updateName: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [{ provide: Auth, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Profile);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const click = async (text: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!.click();
      await fixture.whenStable();
    };
    return { fixture, auth, element, type, click };
  }

  it('shows the stored account data', async () => {
    const { element } = await setup();
    expect(element.textContent).toContain('nora@example.ch');
    expect(element.textContent).toContain('bestätigt');
    expect(element.textContent).toContain('dabei seit');
  });

  it('saves a trimmed new name', async () => {
    const { fixture, auth, element, type, click } = await setup();
    await click('Ändern');
    type('name', '  Nora Keller ');
    await fixture.whenStable();
    await click('Speichern');
    expect(auth.updateName).toHaveBeenCalledWith('Nora Keller');
    expect(element.textContent).toContain('Name gespeichert.');
  });

  it('refuses a mismatched new password and shows a wrong current password', async () => {
    const { fixture, auth, element, type, click } = await setup();
    [...element.querySelectorAll('button')]
      .filter((b) => b.textContent!.trim() === 'Ändern')[1]!
      .click();
    await fixture.whenStable();
    type('current', 'old-password');
    type('new-password', 'a-new-password-1');
    type('confirmation', 'a-new-password-2');
    await fixture.whenStable();
    await click('Passwort ändern');
    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Die Passwörter stimmen nicht überein.');

    auth.changePassword.mockRejectedValue(new AuthRequestError('Invalid password', 400));
    type('confirmation', 'a-new-password-1');
    await fixture.whenStable();
    await click('Passwort ändern');
    expect(auth.changePassword).toHaveBeenCalledWith('old-password', 'a-new-password-1');
    expect(element.textContent).toContain('Das aktuelle Passwort ist falsch.');
  });
});
