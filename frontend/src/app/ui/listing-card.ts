import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../i18n/i18n';
import { AuctionTimer } from './auction-timer';
import { Badge } from './badge';
import { chf } from './chf';

const MODE_LABELS = { auction: 'Auktion', fixed: 'Festpreis', offer: 'Preisvorschlag' } as const;

/** Browse unit: square photo, badge row, title, price, meta. No border or shadow; the grid gap separates. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Badge, AuctionTimer, TranslatePipe],
  selector: 'app-listing-card',
  styles: ':host { display: block; }',
  template: `<a class="zw-card" [routerLink]="link()">
    <div class="zw-card__media">
      @if (image()) {
        <img [src]="image()" alt="" />
      }
    </div>
    <div class="zw-card__badges">
      <app-badge [variant]="mode() === 'auction' ? 'inverse' : ''">{{ modeLabel() | t }}</app-badge>
      @if (greenPick()) {
        <app-badge variant="green">{{ 'Grüne Wahl' | t }}</app-badge>
      }
      @if (mode() === 'auction' && endsAt() !== null) {
        <app-auction-timer [endsAt]="endsAt()!" />
      }
    </div>
    <h3 class="zw-card__title">{{ title() }}</h3>
    <p class="zw-card__price" [class.zw-card__price--bid]="mode() === 'auction'">
      {{ priceText() }}
      @if (mode() === 'auction') {
        <small>{{ bids() ? ('{count} Gebote' | t: { count: bids() }) : ('Gebot' | t) }}</small>
      } @else if (originalPrice() !== null) {
        <small>{{ 'neu {price}' | t: { price: originalText() } }}</small>
      }
    </p>
    <p class="zw-card__meta">{{ meta() }}</p>
    @if (co2Saved() !== null) {
      <p class="zw-card__green">{{ 'spart ca. {kg} kg CO₂' | t: { kg: co2Saved()! } }}</p>
    }
  </a>`,
})
export class ListingCard {
  readonly title = input.required<string>();
  /** Fixed price, offer price, or the current bid for auctions (CHF). */
  readonly price = input.required<number>();
  readonly link = input.required<string | unknown[]>();
  readonly mode = input<'auction' | 'fixed' | 'offer'>('fixed');
  readonly image = input('');
  readonly meta = input('');
  readonly originalPrice = input<number | null>(null);
  readonly greenPick = input(false);
  readonly co2Saved = input<number | null>(null);
  readonly endsAt = input<Date | number | null>(null);
  readonly bids = input(0);
  protected readonly modeLabel = computed(() => MODE_LABELS[this.mode()]);
  protected readonly priceText = computed(() => chf(this.price()));
  protected readonly originalText = computed(() => chf(this.originalPrice() ?? 0));
}
