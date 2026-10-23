import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, AuthRequestError, safeReturnUrl } from '../auth/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <section
      class="mx-auto my-8 max-w-lg rounded-xl border border-slate-200 bg-white p-7"
      aria-labelledby="auth-heading"
    >
      <h1 id="auth-heading" class="mb-4 text-2xl font-semibold">
        {{ registering ? 'Create account' : 'Log in' }}
      </h1>
      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-red-50 p-3 text-red-800">{{ error() }}</p>
      }
      <form #form="ngForm" (ngSubmit)="submit(form)" class="grid gap-2">
        @if (registering) {
          <label for="name" class="font-semibold">Display name</label>
          <input
            id="name"
            name="name"
            [(ngModel)]="name"
            #nameField="ngModel"
            required
            maxlength="80"
            autocomplete="nickname"
            class="rounded-md border border-slate-400 p-3"
            aria-describedby="name-error"
          />
          <span id="name-error" class="text-sm text-red-800">
            @if (nameField.invalid && (nameField.touched || form.submitted)) {
              Enter a display name.
            }
          </span>
        }
        <label for="email" class="font-semibold">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          [(ngModel)]="email"
          #emailField="ngModel"
          required
          email
          maxlength="254"
          autocomplete="username"
          class="rounded-md border border-slate-400 p-3"
          aria-describedby="email-error"
        />
        <span id="email-error" class="text-sm text-red-800">
          @if (emailField.invalid && (emailField.touched || form.submitted)) {
            Enter a valid email address.
          }
        </span>
        <label for="password" class="font-semibold">Password</label>
        <input
          id="password"
          type="password"
          name="password"
          [(ngModel)]="password"
          #passwordField="ngModel"
          required
          [minlength]="registering ? 12 : 1"
          maxlength="128"
          [autocomplete]="registering ? 'new-password' : 'current-password'"
          class="rounded-md border border-slate-400 p-3"
          aria-describedby="password-hint password-error"
        />
        @if (registering) {
          <p id="password-hint" class="muted text-sm">Use 12–128 characters.</p>
        }
        <span id="password-error" class="text-sm text-red-800">
          @if (passwordField.invalid && (passwordField.touched || form.submitted)) {
            {{ registering ? 'Use at least 12 characters.' : 'Enter your password.' }}
          }
        </span>
        @if (registering) {
          <label for="confirmation" class="font-semibold">Confirm password</label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            [(ngModel)]="confirmation"
            required
            maxlength="128"
            autocomplete="new-password"
            class="rounded-md border border-slate-400 p-3"
          />
        }
        <button
          type="submit"
          [disabled]="busy()"
          class="mt-4 cursor-pointer rounded-md bg-teal-800 p-3 text-white disabled:opacity-50"
        >
          {{ busy() ? 'Please wait…' : registering ? 'Create account' : 'Log in' }}
        </button>
      </form>
      <p class="mt-6">
        <a
          [routerLink]="registering ? '/login' : '/register'"
          [queryParams]="{ returnUrl }"
          class="underline"
        >
          {{ registering ? 'Already registered? Log in' : 'Create an account' }}
        </a>
      </p>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
      this.error.set('Please check the fields below.');
      return;
    }
    if (this.registering && this.password !== this.confirmation) {
      this.error.set('The passwords do not match.');
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
          ? error.message
          : 'Cannot reach the authentication service. Please try again.',
      );
    } finally {
      this.password = '';
      this.confirmation = '';
      this.busy.set(false);
    }
  }
}
