import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../api';
import { Auth } from '../auth';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1>Register</h1>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Name
        <input formControlName="displayName" autocomplete="name" maxlength="80" required />
      </label>
      <label>
        E-mail
        <input formControlName="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Password (at least 8 characters)
        <input formControlName="password" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <p><button type="submit" [disabled]="form.invalid || busy()">Create account</button></p>
      <p class="muted">Already registered? <a routerLink="/login">Log in</a></p>
    </form>
  `,
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  submit(): void {
    const { email, password, displayName } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.register(email, password, displayName).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
