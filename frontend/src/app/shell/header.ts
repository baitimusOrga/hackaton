import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { ErrorBanner } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { HeroSearch } from './hero-search';

/** Sticky page header. The search docks into it whenever no hero search is on screen. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, Icon, TranslatePipe],
  selector: 'app-header',
  host: { class: 'zw-header', '[class.zw-header--docked]': 'docked()' },
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  protected readonly hero = inject(HeroSearch);
  private readonly errors = inject(ErrorBanner);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  protected readonly docked = computed(() => !this.hero.visible());
  protected readonly query = this.hero.query;
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
