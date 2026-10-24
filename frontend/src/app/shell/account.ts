import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { ErrorBanner } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';

/** "Anmelden" link or "Abmelden" button; the header shows it, and on phones the footer. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  selector: 'app-account',
  host: { class: 'zw-account' },
  template: `@if (auth.user()) {
      <button type="button" class="zw-link" [disabled]="signingOut()" (click)="logout()">
        {{ 'Abmelden' | t }}
      </button>
    } @else {
      <a routerLink="/login">{{ 'Anmelden' | t }}</a>
    }`,
})
export class Account {
  protected readonly auth = inject(Auth);
  private readonly errors = inject(ErrorBanner);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  protected readonly signingOut = signal(false);

  protected async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch {
      this.errors.show(this.i18n.t('Abmelden hat nicht geklappt. Versuch es nochmals.'));
    } finally {
      this.signingOut.set(false);
    }
  }
}
