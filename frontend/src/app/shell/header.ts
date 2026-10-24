import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { TranslatePipe } from '../i18n/i18n';
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
  protected readonly docked = computed(() => !this.hero.visible());
  protected readonly query = this.hero.query;
}
