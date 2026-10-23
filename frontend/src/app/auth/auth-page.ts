import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, authError } from './auth';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section
      class="mx-auto my-8 max-w-lg rounded-xl border border-slate-200 bg-white p-7"
      aria-labelledby="auth-heading"
    >
      <h1 id="auth-heading">{{ titles[mode()] }}</h1>
      @if (mode() === 'register') {
        <p>Create an account to sell, bid and contact sellers.</p>
      }
      @if (mode() === 'forgot') {
        <p>Enter your account email to request a recovery link.</p>
      }
      @if (mode() === 'reset') {
        <p>Choose a new password. Afterwards, sign in again on all your devices.</p>
      }
      @if (notice()) {
        <p role="status" class="rounded-md bg-emerald-50 p-3 text-emerald-900">{{ notice() }}</p>
      }
      @if (error()) {
        <p role="alert" class="rounded-md bg-red-50 p-3 text-red-800">{{ error() }}</p>
      }
      @if (!done()) {
        <form class="grid gap-2" #form="ngForm" (ngSubmit)="submit(form)">
          @if (mode() === 'register') {
            <label class="mt-2 font-semibold" for="display-name">Display name</label>
            <input
              class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              id="display-name"
              name="displayName"
              [(ngModel)]="displayName"
              #nameField="ngModel"
              required
              maxlength="80"
              autocomplete="nickname"
              aria-describedby="name-error"
              [attr.aria-invalid]="
                nameField.invalid && (nameField.touched || form.submitted) ? 'true' : null
              "
            />
            <span id="name-error" class="text-sm text-red-800 empty:hidden">
              @if (nameField.invalid && (nameField.touched || form.submitted)) {
                Enter a display name.
              }
            </span>
          }
          @if (mode() !== 'reset') {
            <label class="mt-2 font-semibold" for="email">Email</label>
            <input
              class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              id="email"
              name="email"
              type="email"
              [(ngModel)]="email"
              #emailField="ngModel"
              required
              email
              maxlength="254"
              autocomplete="username"
              aria-describedby="email-error"
              [attr.aria-invalid]="
                emailField.invalid && (emailField.touched || form.submitted) ? 'true' : null
              "
            />
            <span id="email-error" class="text-sm text-red-800 empty:hidden">
              @if (emailField.invalid && (emailField.touched || form.submitted)) {
                Enter a valid email address.
              }
            </span>
          }
          @if (mode() !== 'forgot') {
            <label class="mt-2 font-semibold" for="password">Password</label>
            <input
              class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              id="password"
              name="password"
              type="password"
              [(ngModel)]="password"
              #passwordField="ngModel"
              required
              [minlength]="mode() === 'login' ? 1 : 12"
              maxlength="128"
              [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
              aria-describedby="password-hint password-error"
              [attr.aria-invalid]="
                passwordField.invalid && (passwordField.touched || form.submitted) ? 'true' : null
              "
            />
            <p id="password-hint" class="muted">
              {{
                mode() === 'login'
                  ? 'Your account password.'
                  : 'Use 12–128 characters. A long, unique passphrase works well.'
              }}
            </p>
            <span id="password-error" class="text-sm text-red-800 empty:hidden">
              @if (passwordField.invalid && (passwordField.touched || form.submitted)) {
                {{
                  mode() === 'login'
                    ? 'Enter your password.'
                    : 'Use a password of at least 12 characters.'
                }}
              }
            </span>
          }
          @if (mode() === 'register' || mode() === 'reset') {
            <label class="mt-2 font-semibold" for="confirm-password">Confirm password</label>
            <input
              class="min-w-0 w-full rounded-md border border-slate-400 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              id="confirm-password"
              name="confirmPassword"
              type="password"
              [(ngModel)]="confirmPassword"
              #confirmationField="ngModel"
              required
              maxlength="128"
              autocomplete="new-password"
              aria-describedby="confirmation-error"
              [attr.aria-invalid]="
                (confirmationField.touched || form.submitted) &&
                (!confirmPassword || password !== confirmPassword)
                  ? 'true'
                  : null
              "
            />
            <span id="confirmation-error" class="text-sm text-red-800 empty:hidden">
              @if (
                (confirmationField.touched || form.submitted) &&
                (!confirmPassword || password !== confirmPassword)
              ) {
                Enter the same password again.
              }
            </span>
          }
          <button
            class="mt-4 cursor-pointer rounded-md bg-teal-800 px-4 py-3 text-white disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            type="submit"
            [disabled]="busy() || (mode() === 'reset' && !resetToken)"
          >
            {{ busy() ? 'Please wait…' : buttons[mode()] }}
          </button>
        </form>
      }
      <nav class="mt-6 flex flex-wrap items-center gap-4 text-sm" aria-label="Account options">
        @if (mode() !== 'login') {
          <a routerLink="/login">Sign in</a>
        }
        @if (mode() !== 'register') {
          <a routerLink="/register">Create account</a>
        }
        @if (mode() !== 'forgot') {
          <a routerLink="/forgot-password">Forgot password?</a>
        }
      </nav>
    </section>
  `,
})
export class AuthPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly mode = signal(this.route.snapshot.data['mode'] as Mode);
  readonly titles = {
    login: 'Sign in',
    register: 'Create account',
    forgot: 'Recover your account',
    reset: 'Reset password',
  };
  readonly buttons = {
    login: 'Sign in',
    register: 'Create account',
    forgot: 'Send recovery link',
    reset: 'Save new password',
  };
  readonly error = signal('');
  readonly notice = signal('');
  readonly done = signal(false);
  readonly busy = signal(false);
  email = '';
  password = '';
  confirmPassword = '';
  displayName = '';
  readonly resetToken = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token') ?? '';

  constructor() {
    if (this.mode() === 'reset') {
      // Remove the secret from browser history while retaining it in memory for this form.
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (!this.resetToken)
        this.error.set('This reset link is missing its token. Request a new recovery link.');
    }
    if (this.route.snapshot.queryParamMap.has('registered'))
      this.notice.set('Account created. You can now sign in.');
    if (this.route.snapshot.queryParamMap.has('unavailable'))
      this.error.set('Cannot check your session. Please try again.');
  }

  async submit(form?: NgForm): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (form?.invalid) {
      form.control.markAllAsTouched();
      this.error.set('Please check the fields below.');
      return;
    }
    if (
      (this.mode() === 'register' || this.mode() === 'reset') &&
      this.password !== this.confirmPassword
    ) {
      this.error.set('The passwords do not match.');
      return;
    }
    this.busy.set(true);
    try {
      switch (this.mode()) {
        case 'login':
          await this.auth.login(this.email, this.password);
          await this.router.navigateByUrl('/account');
          break;
        case 'register':
          await this.auth.register(this.email, this.password, this.displayName);
          await this.router.navigate(['/login'], { queryParams: { registered: '1' } });
          break;
        case 'forgot':
          await this.auth.forgotPassword(this.email);
          this.notice.set(
            'If an account exists for this email, a recovery link will be sent. Check your inbox and spam folder.',
          );
          this.done.set(true);
          break;
        case 'reset':
          await this.auth.resetPassword(this.resetToken, this.password);
          this.notice.set('Password changed. Sign in with your new password.');
          this.done.set(true);
          break;
      }
    } catch (error) {
      this.error.set(
        this.mode() === 'login' && (error as { status?: number }).status === 401
          ? 'Invalid email or password.'
          : authError(error),
      );
    } finally {
      this.password = '';
      this.confirmPassword = '';
      this.busy.set(false);
    }
  }
}
