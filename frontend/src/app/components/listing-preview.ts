import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingDetail } from '../api/models';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';
import { ListingView } from './listing-view';

/**
 * Full-screen preview of a listing before it goes online: the page buyers will see, with a bar
 * for going back, editing and the projected publish button.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing-preview',
  imports: [Icon, ListingView, RouterLink, TranslatePipe],
  template: `
    <header class="head">
      <div class="in">
        <a routerLink="/" class="zw-wordmark"><span class="zw-wordmark__name">Zweit.</span></a>
        <h1 id="sell-preview" class="strong">{{ 'Vorschau' | t }}</h1>
        <button type="button" class="zw-link push back" (click)="back.emit()">
          <app-icon name="chevron" />
          {{ 'Zurück' | t }}
        </button>
      </div>
    </header>
    <p class="note">
      <span class="in">{{ 'So sehen andere Mitglieder dein Inserat.' | t }}</span>
    </p>
    <div class="in" role="region" aria-labelledby="sell-preview">
      <app-listing-view [listing]="listing()" />
    </div>
    <div class="bar">
      <div class="in">
        <span class="zw-muted zw-small">{{ 'Inserieren ist gratis. Keine Provision.' | t }}</span>
        <button type="button" class="zw-link push" (click)="edit.emit()">
          {{ 'Bearbeiten' | t }}
        </button>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
    }
    .in {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6);
    }
    .in[role='region'] {
      display: block;
    }
    .head {
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .head .in {
      min-height: 72px;
    }
    h1 {
      font-size: 20px;
      line-height: 28px;
    }
    @media (max-width: 480px) {
      .head .zw-wordmark,
      .bar .zw-small {
        display: none;
      }
    }
    .push {
      margin-left: auto;
    }
    .back app-icon {
      transform: rotate(180deg);
    }
    .note {
      margin: 0;
      padding: var(--space-3) 0;
      background: var(--bg-100);
      font-size: 14px;
      line-height: 20px;
    }
    .bar {
      position: sticky;
      bottom: 0;
      padding: var(--space-4) 0;
      background: var(--bg-000);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .bar .in {
      flex-wrap: wrap;
      gap: var(--space-4);
    }
  `,
})
export class ListingPreview {
  readonly listing = input<ListingDetail>();
  readonly back = output();
  readonly edit = output();
}
