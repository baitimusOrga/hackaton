import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, AuthRequestError, safeReturnUrl } from '../auth/auth';
import { translateError } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';

// Native inputs with the zw-field classes instead of <app-input>: the form needs name, autocomplete,
// required and length validation through ngModel, which app-input does not expose.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Button, TranslatePipe],
  styles: `
    section {
      max-width: 440px;
      margin: 0 auto;
      padding: var(--space-12) 0 var(--space-16);
    }
    h1 {
      margin-bottom: var(--space-6);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .switch {
      margin-top: var(--space-6);
    }
  `,
  template: `
    <section aria-labelledby="auth-heading">
      <h1 id="auth-heading">{{ (registering ? 'Registrieren' : 'Anmelden') | t }}</h1>
      @if (error()) {
        <p role="alert" class="zw-error">{{ error() }}</p>
      }
      <form #form="ngForm" (ngSubmit)="submit(form)">
        @if (registering) {
          <div class="zw-field">
            <label for="name" class="zw-label">{{ 'Anzeigename' | t }}</label>
            <input
              id="name"
              name="name"
              class="zw-input"
              [(ngModel)]="name"
              #nameField="ngModel"
              required
              maxlength="80"
              autocomplete="nickname"
              [attr.aria-invalid]="nameField.invalid && (nameField.touched || form.submitted)"
              aria-describedby="name-error"
            />
            <p id="name-error" class="zw-help zw-help--error">
              @if (nameField.invalid && (nameField.touched || form.submitted)) {
                {{ 'Gib einen Anzeigenamen ein.' | t }}
              }
            </p>
          </div>
        }
        <div class="zw-field">
          <label for="email" class="zw-label">{{ 'E-Mail' | t }}</label>
          <input
            id="email"
            type="email"
            name="email"
            class="zw-input"
            [(ngModel)]="email"
            #emailField="ngModel"
            required
            email
            maxlength="254"
            autocomplete="username"
            [attr.aria-invalid]="emailField.invalid && (emailField.touched || form.submitted)"
            aria-describedby="email-error"
          />
          <p id="email-error" class="zw-help zw-help--error">
            @if (emailField.invalid && (emailField.touched || form.submitted)) {
              {{ 'Gib eine gültige E-Mail-Adresse ein.' | t }}
            }
          </p>
        </div>
        <div class="zw-field">
          <label for="password" class="zw-label">{{ 'Passwort' | t }}</label>
          <input
            id="password"
            type="password"
            name="password"
            class="zw-input"
            [(ngModel)]="password"
            #passwordField="ngModel"
            required
            [minlength]="registering ? 12 : 1"
            maxlength="128"
            [autocomplete]="registering ? 'new-password' : 'current-password'"
            [attr.aria-invalid]="passwordField.invalid && (passwordField.touched || form.submitted)"
            aria-describedby="password-hint password-error"
          />
          @if (registering) {
            <p id="password-hint" class="zw-help">{{ '12 bis 128 Zeichen.' | t }}</p>
          }
          <p id="password-error" class="zw-help zw-help--error">
            @if (passwordField.invalid && (passwordField.touched || form.submitted)) {
              {{ (registering ? 'Mindestens 12 Zeichen.' : 'Gib dein Passwort ein.') | t }}
            }
          </p>
        </div>
        @if (registering) {
          <div class="zw-field">
            <label for="confirmation" class="zw-label">{{ 'Passwort wiederholen' | t }}</label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              class="zw-input"
              [(ngModel)]="confirmation"
              required
              maxlength="128"
              autocomplete="new-password"
            />
          </div>
        }
        <button appButton variant="primary" [block]="true" type="submit" [disabled]="busy()">
          {{ (busy() ? 'Einen Moment…' : registering ? 'Konto erstellen' : 'Anmelden') | t }}
        </button>
      </form>
      <p class="switch">
        {{ (registering ? 'Schon ein Konto?' : 'Neu bei Zweit?') | t }}
        <a
          class="zw-link"
          [routerLink]="registering ? '/login' : '/register'"
          [queryParams]="{ returnUrl }"
        >
          {{ (registering ? 'Anmelden' : 'Registrieren') | t }}
        </a>
      </p>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  readonly registering = this.route.snapshot.data['registering'] === true;
  readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  readonly busy = signal(false);
  readonly error = signal('');
  name = '';
  email = '';
  password = '';
  confirmation = '';

  async submit(form: NgForm): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.error.set(this.i18n.t('Bitte prüf die markierten Felder.'));
      return;
    }
    if (this.registering && this.password !== this.confirmation) {
      this.error.set(this.i18n.t('Die Passwörter stimmen nicht überein.'));
      return;
    }
    this.busy.set(true);
    try {
      if (this.registering) await this.auth.register(this.name.trim(), this.email, this.password);
      else await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.error.set(
        error instanceof AuthRequestError
          ? translateError(error.message, this.i18n)
          : this.i18n.t('Die Anmeldung ist gerade nicht erreichbar. Versuch es nochmals.'),
      );
    } finally {
      this.password = '';
      this.confirmation = '';
      this.busy.set(false);
    }
  }
}
