import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyListing } from '../api/models';
import { MyListingsService } from '../api/services';
import { TranslatePipe } from '../i18n/i18n';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';

const STATUS = {
  AVAILABLE: { label: 'Aktiv', variant: 'green' },
  SOLD: { label: 'Verkauft', variant: 'inverse' },
  ENDED: { label: 'Beendet', variant: '' },
  WITHDRAWN: { label: 'Zurückgezogen', variant: '' },
} as const;

/** Every listing the user published, with its status; an active one can be taken back. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profile-listings',
  imports: [RouterLink, Badge, Button, ChfPipe, TranslatePipe],
  styles: `
    h1 {
      margin: 0 0 var(--space-8);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-3) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    li:last-child {
      border-bottom: 0;
    }
    .ph {
      width: 56px;
      height: 56px;
      background: var(--bg-100);
      object-fit: cover;
    }
    .t {
      margin: 0;
      font-weight: 600;
      color: var(--ink);
      text-decoration: none;
    }
    .t:hover {
      color: var(--blue-text);
      text-decoration: underline;
    }
    .m,
    .empty {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
      margin: var(--space-1) 0 0;
      font-size: 14px;
      line-height: 20px;
      color: var(--ink-muted);
    }
    .r {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
    }
    .price {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .confirm {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
    }
  `,
  template: `
    <div>
      <h1>{{ 'Meine Inserate' | t }}</h1>
      @if (listings(); as listings) {
        @if (listings.length) {
          <ul>
            @for (item of listings; track item.listing.id) {
              <li>
                @if (item.listing.imageUrl) {
                  <img class="ph" [src]="item.listing.imageUrl" alt="" />
                } @else {
                  <span class="ph"></span>
                }
                <div>
                  <a class="t" [routerLink]="['/listings', item.listing.id]">{{
                    item.listing.title
                  }}</a>
                  <p class="m">
                    <app-badge [variant]="STATUS[item.status].variant">{{
                      STATUS[item.status].label | t
                    }}</app-badge>
                    {{ (item.listing.saleMode === 'AUCTION' ? 'Auktion' : 'Festpreis') | t }} ·
                    {{ item.listing.postcode }} {{ item.listing.locality }}
                    @if (item.listing.bidCount) {
                      · {{ '{count} Gebote' | t: { count: item.listing.bidCount } }}
                    }
                  </p>
                </div>
                <div class="r">
                  <span class="price">{{ price(item) | chf }}</span>
                  @if (item.status === 'AVAILABLE' && item.listing.saleMode === 'FIXED') {
                    <button
                      appButton
                      size="sm"
                      type="button"
                      [disabled]="busy() === item.listing.id"
                      (click)="confirming.set(item.listing.id!)"
                    >
                      {{ 'Zurückziehen' | t }}
                    </button>
                  }
                </div>
                @if (confirming() === item.listing.id) {
                  <div class="confirm" role="group">
                    <span>{{
                      'Wirklich zurückziehen? Das lässt sich nicht rückgängig machen.' | t
                    }}</span>
                    <button
                      appButton
                      variant="primary"
                      size="sm"
                      type="button"
                      [disabled]="busy() === item.listing.id"
                      (click)="withdraw(item)"
                    >
                      {{ 'Ja, zurückziehen' | t }}
                    </button>
                    <button
                      appButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      (click)="confirming.set(null)"
                    >
                      {{ 'Abbrechen' | t }}
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="empty">
            {{ 'Noch keine Inserate.' | t }}
            <a class="zw-link" [routerLink]="[{ outlets: { modal: ['sell'] } }]">{{
              'Jetzt inserieren' | t
            }}</a>
          </p>
        }
      }
    </div>
  `,
})
export class ProfileListings {
  private readonly api = inject(MyListingsService);
  protected readonly STATUS = STATUS;
  protected readonly listings = signal<MyListing[] | undefined>(undefined);
  protected readonly confirming = signal<number | null>(null);
  protected readonly busy = signal<number | null>(null);

  constructor() {
    this.api.listMine().subscribe((listings) => this.listings.set(listings));
  }

  protected price(item: MyListing): number {
    return item.listing.currentBidChf ?? item.listing.priceChf ?? 0;
  }

  protected withdraw(item: MyListing): void {
    const id = item.listing.id!;
    if (this.busy() !== null) return;
    this.busy.set(id);
    this.api.withdraw({ id }).subscribe({
      next: () => {
        this.listings.update((all) =>
          all?.map((it) => (it.listing.id === id ? { ...it, status: 'WITHDRAWN' } : it)),
        );
        this.confirming.set(null);
        this.busy.set(null);
      },
      // the error banner shows the reason; the row stays as it was
      error: () => this.busy.set(null),
    });
  }
}
