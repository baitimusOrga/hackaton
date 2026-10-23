import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';
import { ListingDetail } from '../api/models';
import { ListingsService } from '../api/services';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';
import { ListingCard } from '../ui/listing-card';
import { SectionHeading } from '../ui/section-heading';

const CONDITIONS: Record<NonNullable<ListingDetail['condition']>, string> = {
  NEW: 'Neu',
  LIKE_NEW: 'Wie neu',
  GOOD: 'Gut',
  USED: 'Gebraucht',
  DEFECTIVE: 'Defekt',
};

/** Listing detail, fixed price: photo left, buying column right, facts and description below. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [DatePipe, KeyValuePipe, Badge, Button, ChfPipe, ListingCard, SectionHeading],
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
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 28px;
      font-weight: 700;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    .meta {
      margin: 0;
      font-size: 16px;
      line-height: 24px;
      color: var(--ink-muted);
    }
    .price {
      font-size: 32px;
      line-height: 36px;
      font-weight: 700;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }
    .links {
      display: flex;
      gap: var(--space-6);
    }
    .tl {
      min-height: 44px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 15px;
      line-height: 20px;
      font-weight: 600;
      color: var(--ink);
      cursor: pointer;
    }
    .tl[disabled] {
      color: var(--ink-muted);
      cursor: not-allowed;
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
    .small {
      font-size: 14px;
      line-height: 20px;
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
      margin: 0;
      line-height: 26px;
      white-space: pre-line;
    }
    .similar {
      padding-bottom: var(--space-16);
    }
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
  protected readonly conditions = CONDITIONS;
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

  protected join(...parts: (string | undefined)[]): string {
    return parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' · ');
  }
}
