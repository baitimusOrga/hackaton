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
import { AuctionsService, ListingsService, PurchasesService } from '../api/services';
import { Auth } from '../auth/auth';
import { conditionLabel, metaLine } from '../conditions';
import { HANDLES_ERRORS, messageOf } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { AuctionTimer } from '../ui/auction-timer';
import { Badge } from '../ui/badge';
import { ListingMap } from '../components/listing-map';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { chf, ChfPipe } from '../ui/chf';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

interface BidStatus {
  tone: 'lead' | 'outbid';
  title: string;
  text: string;
}

/** Listing detail, fixed price or auction: photo left, buying column right, facts and description below. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [
    DatePipe,
    TranslatePipe,
    KeyValuePipe,
    NgTemplateOutlet,
    AuctionTimer,
    Badge,
    Button,
    ChfPipe,
    Icon,
    ListingMap,
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
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .status {
      display: grid;
      gap: var(--space-1);
      padding-left: var(--space-3);
      border-left: var(--border-2) solid var(--ink);
    }
    .status--outbid {
      border-left-color: var(--danger);
    }
    .status h3 {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .status--outbid h3 {
      color: var(--danger);
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
    @media (max-width: 720px) {
      .cols {
        padding-top: var(--space-4);
      }
      .fact {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }
    }
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
  private readonly auctions = inject(AuctionsService);
  private readonly purchases = inject(PurchasesService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
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
          map((state) => ({ id: item.id, state })),
        ),
      ),
    ),
  );
  /** The latest poll, or the answer to the own bid until a newer poll replaces it. */
  protected readonly auction = linkedSignal<
    { id?: number; state: AuctionState } | undefined,
    AuctionState | undefined
  >({
    source: this.polled,
    // a poll sent before the own bid can arrive after its answer; never step back on the same listing
    computation: (next, previous) => {
      const shown = previous?.value;
      const stale =
        !!next &&
        !!shown &&
        previous.source?.id === next.id &&
        ((next.state.bidCount ?? 0) < (shown.bidCount ?? 0) ||
          (next.state.myMaxChf ?? 0) < (shown.myMaxChf ?? 0));
      return stale ? shown : next?.state;
    },
  });
  protected readonly maxChf = signal<number | null>(null);
  /** Why the last bid was refused, shown under the field until the amount changes. */
  protected readonly bidError = signal('');
  /** The bid count right after the own bid; the status explains that bid until a poll shows newer bids. */
  private readonly ownBidCount = signal<number | null>(null);
  protected readonly bidding = signal(false);
  protected readonly buying = linkedSignal({ source: this.listing, computation: () => false });
  // the server's answer after a reload; set locally right after buying
  protected readonly bought = linkedSignal({
    source: this.listing,
    computation: (item) => !!item?.bought,
  });
  protected readonly buyError = linkedSignal({ source: this.listing, computation: () => '' });

  protected buy(id: number): void {
    if (this.buying()) return;
    if (!this.auth.user()) return this.signIn();
    const item = this.listing();
    this.buying.set(true);
    this.buyError.set('');
    this.purchases.buy({ id }, new HttpContext().set(HANDLES_ERRORS, true)).subscribe({
      next: () => {
        if (this.listing() !== item) return;
        this.bought.set(true);
        this.buying.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (this.listing() !== item) return;
        this.buying.set(false);
        if (err.status === 401) return this.signIn();
        this.buyError.set(messageOf(err, this.i18n));
      },
    });
  }

  /** The minimum (above the own maximum while leading) and the next two steps, so a bid needs no typing. */
  protected suggestions(a: AuctionState): number[] {
    const inc = a.incrementChf ?? 1;
    const min = Math.max(a.minimumNextBidChf ?? 0, a.leading ? (a.myMaxChf ?? 0) + inc : 0);
    return [0, 1, 2].map((steps) => Math.round((min + steps * inc) * 100) / 100);
  }

  protected setMax(amount: number): void {
    this.maxChf.set(Number.isNaN(amount) ? null : amount);
    this.bidError.set('');
  }

  /** Where the viewer stands, in one headline: leading, outbid or the result; null before the first own bid. */
  protected status(a: AuctionState): BidStatus | null {
    if (a.myMaxChf == null) return null;
    const t = (key: string, params: Record<string, string>) => this.i18n.t(key, params);
    const price = chf(a.currentBidChf ?? 0);
    const max = chf(a.myMaxChf);
    const min = chf(a.minimumNextBidChf ?? 0);
    const justBid = this.ownBidCount() === a.bidCount;
    if (a.ended)
      return a.leading
        ? { tone: 'lead', title: t('Du hast gewonnen', {}), text: t('Für {price}.', { price }) }
        : {
            tone: 'outbid',
            title: t('Jemand hat mehr geboten', {}),
            text: t('Verkauft für {price}. Dein Maximum war {max}.', { price, max }),
          };
    if (a.leading)
      return {
        tone: 'lead',
        title: t('Du führst mit {price}', { price }),
        text: t(
          justBid
            ? 'Gebot angenommen. Dein Maximum {max} bleibt geheim; wir bieten automatisch für dich, bis es erreicht ist.'
            : 'Dein Maximum ist {max}; wir bieten automatisch für dich, bis es erreicht ist.',
          { max },
        ),
      };
    return {
      tone: 'outbid',
      title: t('Du wurdest überboten', {}),
      text: justBid
        ? t(
            'Gebot angenommen, aber ein anderes Maximum ist höher. Der Preis stieg automatisch auf {price}. Biete mindestens {min}, um zu führen.',
            { price, min },
          )
        : t('Dein Maximum war {max}. Biete mindestens {min}, um wieder zu führen.', { max, min }),
    };
  }

  /** What the typed maximum will do, before it is sent; '' while the field is empty or invalid. */
  protected preview(a: AuctionState): string {
    const max = this.maxChf();
    if (max === null || this.problem(max, a)) return '';
    return a.leading
      ? this.i18n.t('Der Preis bleibt bei {price}. Du erhöhst nur dein Maximum auf {max}.', {
          price: chf(a.currentBidChf ?? 0),
          max: chf(max),
        })
      : this.i18n.t(
          'Dein Gebot startet bei {min}. Bietet jemand mit, erhöhen wir automatisch bis {max}.',
          { min: chf(a.minimumNextBidChf ?? 0), max: chf(max) },
        );
  }

  /** "Maximum CHF 400.– bieten" once the field holds a valid amount, so the button says what is sent. */
  protected bidLabel(a: AuctionState): string {
    const max = this.maxChf();
    if (max !== null && !this.problem(max, a))
      return this.i18n.t('Maximum {max} bieten', { max: chf(max) });
    return this.i18n.t(a.leading ? 'Maximum erhöhen' : 'Jetzt bieten');
  }

  protected placeBid(event: Event, id: number, a: AuctionState): void {
    event.preventDefault();
    if (this.bidding()) return;
    if (!this.auth.user()) return this.signIn();
    const maxChf = this.maxChf();
    const problem = this.problem(maxChf, a);
    if (problem) return this.bidError.set(problem);
    this.bidding.set(true);
    this.bidError.set('');
    this.auctions
      .placeBid({ id, body: { maxChf: maxChf! } }, new HttpContext().set(HANDLES_ERRORS, true))
      .subscribe({
        next: (state) => {
          this.auction.set(state);
          this.maxChf.set(null);
          this.ownBidCount.set(state.bidCount ?? null);
          this.bidding.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.bidding.set(false);
          if (err.status === 401) return this.signIn();
          this.bidError.set(messageOf(err, this.i18n));
          // someone bid meanwhile or the auction is over: show the server's numbers, not the old ones
          if (err.status === 400 || err.status === 409) this.refresh(id);
        },
      });
  }

  /** The same checks as the server, so most mistakes never leave the page; '' when the amount can be sent. */
  private problem(max: number | null, a: AuctionState): string {
    if (max === null) return this.i18n.t('Gib dein Maximum in CHF ein.');
    if (Math.abs(max * 100 - Math.round(max * 100)) > 1e-6)
      return this.i18n.t('Höchstens zwei Stellen nach dem Komma.');
    if (a.leading && max <= (a.myMaxChf ?? 0))
      return this.i18n.t(
        'Du führst schon mit einem Maximum von {max}. Erhöhe es oder lass es so.',
        {
          max: chf(a.myMaxChf ?? 0),
        },
      );
    const min = a.minimumNextBidChf ?? 0;
    if (max < min)
      return this.i18n.t('Dein Maximum muss mindestens {min} sein.', { min: chf(min) });
    return '';
  }

  private refresh(id: number): void {
    this.auctions
      .getAuction({ id }, new HttpContext().set(HANDLES_ERRORS, true))
      .subscribe({ next: (state) => this.auction.set(state), error: () => undefined });
  }

  private signIn(): void {
    void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
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
