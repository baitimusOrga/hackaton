import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';
import { ListingDetail } from '../api/models';
import { ListingsService } from '../api/services';
import { conditionLabel, metaLine } from '../conditions';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Badge } from '../ui/badge';
import { ListingMap } from '../components/listing-map';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

/** Listing detail, fixed price: photo left, buying column right, facts and description below. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [
    DatePipe,
    TranslatePipe,
    KeyValuePipe,
    Badge,
    Button,
    ChfPipe,
    ListingMap,
    SectionHeading,
    SummaryCard,
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
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
  private readonly i18n = inject(I18n);
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

  protected meta(item: ListingDetail): string {
    return metaLine(
      this.i18n.t(conditionLabel(item.condition)),
      [item.postcode, item.locality].join(' '),
    );
  }
}
