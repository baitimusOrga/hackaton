import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { SessionLocation } from '../device-location';
import { ErrorBanner } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Account } from './account';
import { HeroSearch } from './hero-search';

/** Sticky page header. The search docks into it whenever no hero search is on screen. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Account, Button, Icon, TranslatePipe],
  selector: 'app-header',
  host: { class: 'zw-header', '[class.zw-header--docked]': 'docked()' },
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  protected readonly hero = inject(HeroSearch);
  private readonly errors = inject(ErrorBanner);
  private readonly i18n = inject(I18n);
  protected readonly location = inject(SessionLocation);
  protected readonly locationLabel = computed(() =>
    this.i18n.t(
      this.location.position() ? 'Standort nicht mehr verwenden' : 'Suche in meiner Nähe (25 km)',
    ),
  );
  protected readonly docked = computed(() => !this.hero.visible());
  protected readonly query = this.hero.query;

  /** The location chip: shares the position for this session (searches use it) or stops using it. */
  protected async toggleLocation(): Promise<void> {
    if (this.location.position()) return this.location.forget();
    if (!(await this.location.locate()))
      this.errors.show(this.i18n.t('Standort nicht verfügbar. Erlaube den Standortzugriff.'));
  }
}
