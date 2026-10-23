import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Auth, authError } from './auth/auth';
import { ErrorBanner } from './errors';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly errors = inject(ErrorBanner);
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly busy = signal(false);

  constructor() {
    void this.auth.restore().catch(() => this.errors.show('Cannot check your session. Please try signing in.'));
  }

  async logout(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errors.dismiss();
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.errors.show(authError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
