import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../api';
import { Auth } from '../auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>Log in</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        E-mail
        <input formControlName="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Password
        <input formControlName="password" type="password" autocomplete="current-password" required />
      </label>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <p><button type="submit" [disabled]="form.invalid || busy()">Log in</button></p>
      <p class="muted">No account? <a routerLink="/register">Register</a></p>
    </form>
  `,
})
export class Login {
  /** ?next=<url> from the auth guard: where to go after login. */
  readonly next = input<string>();

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  submit(): void {
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.next() || '/'),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
