import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

/** Phone navigation, fixed at the bottom; hidden from 720px, where the header carries the nav. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, TranslatePipe],
  selector: 'app-tab-bar',
  host: { class: 'zw-tabs' },
  template: `<nav class="zw-tabs__bar" [attr.aria-label]="'Hauptnavigation' | t">
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
    <a
      [routerLink]="[{ outlets: { modal: ['sell'] } }]"
      class="zw-tabs__item zw-tabs__sell"
      [attr.aria-label]="'Verkaufen, neues Inserat' | t"
    >
      <span class="zw-tabs__plus"><app-icon name="plus" [size]="28" /></span>
      <span>{{ 'Verkaufen' | t }}</span>
    </a>
    <a
      routerLink="/messages"
      routerLinkActive="zw-tabs__item--active"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="message" [size]="24" />
      <span>{{ 'Nachrichten' | t }}</span>
    </a>
    <a
      routerLink="/saved"
      routerLinkActive="zw-tabs__item--active"
      ariaCurrentWhenActive="page"
      class="zw-tabs__item"
    >
      <app-icon name="bookmark" [size]="24" />
      <span>{{ 'Meine Suchen' | t }}</span>
    </a>
  </nav>`,
})
export class TabBar {}
