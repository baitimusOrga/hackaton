import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ListingSummary } from '../api/models';
import { TradesService } from '../api/services';
import { TranslatePipe } from '../i18n/i18n';
import { ChfPipe } from '../ui/chf';

// There is no pickup or payment flow stored yet, so each row links to the listing.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profile-trades',
  imports: [DatePipe, RouterLink, ChfPipe, TranslatePipe],
  styles: `
    h1 {
      margin: 0 0 var(--space-8);
    }
    section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-12);
    }
    h2 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    li:last-child {
      border-bottom: 0;
    }
    a {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-3) 0;
      color: var(--ink);
      text-decoration: none;
    }
    a:hover .t {
      color: var(--blue-text);
      text-decoration: underline;
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
    }
    .m,
    .empty {
      margin: 0;
      font-size: 14px;
      line-height: 20px;
      color: var(--ink-muted);
    }
    .r {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div>
      <h1>{{ 'Käufe und Verkäufe' | t }}</h1>
      @if (trades(); as trades) {
        @for (
          group of [
            {
              id: 'bought',
              title: 'Gekauft',
              items: trades.bought ?? [],
              empty: 'Noch nichts gekauft. Gewonnene Auktionen erscheinen hier.',
            },
            {
              id: 'sold',
              title: 'Verkauft',
              items: trades.sold ?? [],
              empty: 'Noch nichts verkauft.',
            },
          ];
          track group.id
        ) {
          <section [attr.aria-labelledby]="group.id + '-heading'">
            <h2 [id]="group.id + '-heading'">{{ group.title | t }} · {{ group.items.length }}</h2>
            @if (group.items.length) {
              <ul>
                @for (item of group.items; track item.id) {
                  <li>
                    <a [routerLink]="['/listings', item.id]">
                      @if (item.imageUrl) {
                        <img class="ph" [src]="item.imageUrl" alt="" />
                      } @else {
                        <span class="ph"></span>
                      }
                      <div>
                        <p class="t">{{ item.title }}</p>
                        <p class="m">
                          {{ (item.saleMode === 'AUCTION' ? 'Auktion' : 'Festpreis') | t }} ·
                          {{ item.postcode }} {{ item.locality }}
                          @if (item.endsAt) {
                            · {{ item.endsAt | date: 'dd.MM.yyyy' }}
                          }
                        </p>
                      </div>
                      <span class="r">{{ price(item) | chf }}</span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="empty">{{ group.empty | t }}</p>
            }
          </section>
        }
      }
    </div>
  `,
})
export class ProfileTrades {
  protected readonly trades = toSignal(inject(TradesService).trades());

  protected price(item: ListingSummary): number {
    return item.currentBidChf ?? item.priceChf ?? 0;
  }
}
