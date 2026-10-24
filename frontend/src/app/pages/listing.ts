import { DatePipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import { AuctionState, ListingDetail } from '../api/models';
import { AuctionsService, ListingsService } from '../api/services';
import { Auth } from '../auth/auth';
import { conditionLabel, metaLine } from '../conditions';
import { ErrorBanner, HANDLES_ERRORS, messageOf } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { AuctionTimer } from '../ui/auction-timer';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { chf, ChfPipe } from '../ui/chf';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

/** Listing detail, fixed price or auction: photo left, buying column right, facts and description below. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [
    DatePipe,
    KeyValuePipe,
    NgTemplateOutlet,
    AuctionTimer,
    Badge,
    Button,
    ChfPipe,
    Icon,
    SectionHeading,
    SummaryCard,
    TranslatePipe,
  ],
  templateUrl: './listing.html',
  styles: `
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      gap: var(--space-16);
      padding: 40px 0 var(--space-16);
    }
    @media (max-width: 900px) {
      .cols {
        grid-template-columns: 1fr;
        gap: var(--space-8);
      }
    }
    .photo {
      aspect-ratio: 4 / 3;
      background: var(--bg-100);
    }
    .photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }
    .group {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .tight {
      gap: var(--space-1);
    }
    .badges {
      display: flex;
      gap: var(--space-1);
    }
    /* The design sets the listing title one step smaller (h2 size) and the detail sections at h3 size. */
    h1 {
      font-size: 24px;
      line-height: 28px;
    }
    h2 {
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    .meta {
      line-height: 24px;
      color: var(--ink-muted);
    }
    .links {
      display: flex;
      gap: var(--space-6);
    }
    .seller {
      display: flex;
      gap: var(--space-4);
      align-items: center;
      padding-top: var(--space-6);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .avatar {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--bg-100);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
    .seller-name {
      font-weight: 600;
    }
    .details {
      grid-column: 1;
      display: flex;
      flex-direction: column;
      gap: 40px;
      max-width: 640px;
    }
    @media (max-width: 900px) {
      .details {
        grid-column: auto;
      }
    }
    .facts {
      margin: 0;
    }
    .fact {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: var(--space-4);
      padding: 10px 0;
      border-bottom: var(--border-1) solid var(--line-soft);
      line-height: 24px;
    }
    .fact:last-child {
      border-bottom: 0;
    }
    .fact dt {
      color: var(--ink-muted);
      font-size: 14px;
    }
    .fact dd {
      margin: 0;
    }
    .text {
      white-space: pre-line;
    }
    .similar {
      padding-bottom: var(--space-16);
    }
    .badges {
      align-items: center;
    }
    .bid {
      color: var(--blue-text);
    }
    .danger {
      color: var(--danger);
      font-weight: 500;
    }
    .bids {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .bids li {
      display: grid;
      grid-template-columns: 110px 1fr auto;
      gap: var(--space-4);
      padding: 10px 0;
      border-bottom: var(--border-1) solid var(--line-soft);
      font-variant-numeric: tabular-nums;
      line-height: 24px;
    }
    .bids li:last-child {
      border-bottom: 0;
    }
    .bids .mine {
      font-weight: 600;
    }
    .bids .lead {
      color: var(--blue-text);
    }
    .bids .outbid {
      color: var(--danger);
    }
    .bids time {
      color: var(--ink-muted);
    }
    dialog {
      width: min(100% - 32px, 520px);
      padding: var(--space-8) var(--space-6);
      border: var(--border-1) solid var(--line-soft);
      border-radius: var(--radius-1);
      background: var(--bg-000);
      color: var(--ink);
    }
    dialog::backdrop {
      background: var(--overlay);
    }
    .dlg-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
  private readonly auctions = inject(AuctionsService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly banner = inject(ErrorBanner);
  private readonly i18n = inject(I18n);
  protected readonly chf = chf;
  private readonly listing$ = inject(ActivatedRoute).paramMap.pipe(
    map((params) => Number(params.get('id'))),
    filter((id) => Number.isSafeInteger(id) && id > 0),
    distinctUntilChanged(),
    switchMap((id) => this.api.get({ id })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  protected readonly listing = toSignal(this.listing$);
  // Same category near the listing's postcode; the current listing itself is left out.
  protected readonly similar = toSignal(
    this.listing$.pipe(
      switchMap((item) =>
        this.api.list({ category: item.category, postcode: item.postcode, radiusKm: 25 }).pipe(
          map((items) => items.filter((other) => other.id !== item.id).slice(0, 4)),
          catchError(() => of([])),
        ),
      ),
    ),
    { initialValue: [] },
  );
  // Auctions poll every 5 s until they end; toSignal unsubscribes when the page is left.
  private readonly polled = toSignal(
    this.listing$.pipe(
      filter((item) => item.saleMode === 'AUCTION'),
      switchMap((item) =>
        timer(0, 5000).pipe(
          switchMap(() =>
            this.auctions
              .getAuction({ id: item.id! }, new HttpContext().set(HANDLES_ERRORS, true))
              .pipe(catchError(() => EMPTY)),
          ),
          takeWhile((state) => !state.ended, true),
        ),
      ),
    ),
  );
  /** The latest poll, or the answer to the own bid until the next poll replaces it. */
  protected readonly auction = linkedSignal<AuctionState | undefined>(() => this.polled());
  protected readonly maxChf = signal<number | null>(null);
  protected readonly bidError = signal('');
  protected readonly bidding = signal(false);

  protected placeBid(event: Event, id: number): void {
    event.preventDefault();
    if (!this.auth.user()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const maxChf = this.maxChf();
    if (maxChf === null || Number.isNaN(maxChf) || this.bidding()) return;
    this.bidding.set(true);
    this.auctions
      .placeBid({ id, body: { maxChf } }, new HttpContext().set(HANDLES_ERRORS, true))
      .subscribe({
        next: (state) => {
          this.auction.set(state);
          this.maxChf.set(null);
          this.bidError.set('');
          this.bidding.set(false);
        },
        error: (err: HttpErrorResponse) => {
          // a too low maximum belongs under the field, everything else in the toast
          if (err.status === 400) this.bidError.set(messageOf(err, this.i18n));
          else this.banner.show(messageOf(err, this.i18n));
          this.bidding.set(false);
        },
      });
  }

  protected toDate(iso: string): Date {
    return new Date(iso);
  }

  protected meta(item: ListingDetail): string {
    return metaLine(
      this.i18n.t(conditionLabel(item.condition)),
      [item.postcode, item.locality].join(' '),
    );
  }
}
