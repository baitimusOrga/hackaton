import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';
import { Auth } from './auth/auth';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly errors = inject(ErrorBanner);
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly signingOut = signal(false);

  constructor() {
    void this.auth
      .restore()
      .catch(() => this.errors.show('Cannot check your session. Please try again.'));
  }

  async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch {
      this.errors.show('Could not log out. Please try again.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
