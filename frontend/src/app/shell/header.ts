import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { SessionLocation } from '../device-location';
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
  protected readonly location = inject(SessionLocation);
  protected readonly locationLabel = computed(() =>
    this.i18n.t(
      this.location.position() ? 'Standort nicht mehr verwenden' : 'Suche in meiner Nähe (25 km)',
    ),
  );
  protected readonly docked = computed(() => !this.hero.visible());
  protected readonly query = signal('');
  protected readonly signingOut = signal(false);

  /** The location chip: shares the position for this session (searches use it) or stops using it. */
  protected async toggleLocation(): Promise<void> {
    if (this.location.position()) return this.location.forget();
    if (!(await this.location.locate()))
      this.errors.show(this.i18n.t('Standort nicht verfügbar. Erlaube den Standortzugriff.'));
  }

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
