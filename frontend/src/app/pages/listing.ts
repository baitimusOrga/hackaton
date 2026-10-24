import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';
import { ListingView } from '../components/listing-view';
import { TranslatePipe } from '../i18n/i18n';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

/** Listing detail, fixed price: photo left, buying column right, facts and description below. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [ListingView, SectionHeading, SummaryCard, TranslatePipe],
  templateUrl: './listing.html',
  styles: `
    .similar {
      padding-bottom: var(--space-16);
    }
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
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
}
