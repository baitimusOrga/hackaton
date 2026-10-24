import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../auth/auth';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

/** Phone navigation, fixed at the bottom; hidden from 720px, where the header carries the nav. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, TranslatePipe],
  selector: 'app-tab-bar',
  host: { class: 'zw-tabs' },
  template: `<nav class="zw-tabs__bar" [attr.aria-label]="'Hauptnavigation' | t">
    <div class="zw-tabs__group">
      <a
        routerLink="/"
        routerLinkActive="zw-tabs__item--active"
        [routerLinkActiveOptions]="{ exact: true }"
        ariaCurrentWhenActive="page"
        class="zw-tabs__item"
      >
        <app-icon name="home" [size]="24" />
        <span>{{ 'Start' | t }}</span>
      </a>
      <a
        routerLink="/find"
        routerLinkActive="zw-tabs__item--active"
        ariaCurrentWhenActive="page"
        class="zw-tabs__item"
      >
        <app-icon name="search" [size]="24" />
        <span>{{ 'Suchen' | t }}</span>
      </a>
    </div>
    <a
      [routerLink]="[{ outlets: { modal: ['sell'] } }]"
      class="zw-tabs__item zw-tabs__sell"
      [attr.aria-label]="'Verkaufen, neues Inserat' | t"
    >
      <span class="zw-tabs__plus"><app-icon name="plus" [size]="28" /></span>
      <span>{{ 'Verkaufen' | t }}</span>
    </a>
    <div class="zw-tabs__group">
      <a
        [routerLink]="auth.user() ? '/profile' : '/login'"
        routerLinkActive="zw-tabs__item--active"
        ariaCurrentWhenActive="page"
        class="zw-tabs__item"
      >
        <app-icon name="user" [size]="24" />
        <span>{{ 'Konto' | t }}</span>
      </a>
    </div>
  </nav>`,
})
export class TabBar {
  protected readonly auth = inject(Auth);
}
