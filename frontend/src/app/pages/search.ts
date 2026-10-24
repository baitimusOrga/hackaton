import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';
import { CATEGORIES } from '../categories';
import { ListingMap } from '../components/listing-map';
import { SummaryCard } from '../ui/summary-card';

type FilterName = 'q' | 'category' | 'maxPrice' | 'postcode' | 'radiusKm';

const RADII = [5, 10, 25, 50, 100];

function filtersOf(params: ParamMap) {
  const maxPrice = Number(params.get('maxPrice') || NaN);
  const postcode = params.get('postcode') || undefined;
  const radiusKm = Number(params.get('radiusKm') || NaN);
  return {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    postcode,
    // a radius needs a full postcode to measure from
    radiusKm: RADII.includes(radiusKm) && /^\d{4}$/.test(postcode ?? '') ? radiusKm : undefined,
  };
}

/** Search with filters, a radius around a postcode, and a list or map view (clustered per 5 km). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-search',
  imports: [ListingMap, SummaryCard],
  templateUrl: './search.html',
  styles: `
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .view {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
  `,
})
export class Search {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ListingsService);
  protected readonly categories = CATEGORIES;
  protected readonly radii = RADII;
  protected readonly views = [
    ['list', 'Liste'],
    ['map', 'Karte'],
  ] as const;
  protected readonly view = signal<'list' | 'map'>('list');
  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersOf)), {
    initialValue: filtersOf(this.route.snapshot.queryParamMap),
  });
  protected readonly listings = toSignal(
    this.route.queryParamMap.pipe(switchMap((params) => this.api.list(filtersOf(params)))),
  );

  protected set(name: FilterName, value: string) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [name]: value.trim() || null },
      queryParamsHandling: 'merge',
    });
  }
}
