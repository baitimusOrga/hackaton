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
  const lat = params.get('lat') ? Number(params.get('lat')) : undefined;
  const lon = params.get('lon') ? Number(params.get('lon')) : undefined;
  return {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    postcode,
    // a radius needs a full postcode or the buyer's position to measure from
    radiusKm:
      RADII.includes(radiusKm) && (/^\d{4}$/.test(postcode ?? '') || lat !== undefined)
        ? radiusKm
        : undefined,
    lat,
    lon,
  };
}

/** Search with filters, a radius around the buyer's position, and a list or map view (clustered per 5 km). */
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
  protected readonly locationError = signal('');
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

  /** Asks the browser for the position once and keeps it, rounded to ~100 m, in the URL with the range. */
  protected nearMe(radiusKm: string) {
    this.locationError.set('');
    const go = (queryParams: Record<string, string | null>) =>
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: 'merge',
      });
    if (!radiusKm) return go({ radiusKm: null, lat: null, lon: null });
    // a full postcode is enough to measure from, no location permission needed
    if (/^\d{4}$/.test(this.filters().postcode ?? ''))
      return go({ radiusKm, lat: null, lon: null });
    const fail = () => {
      this.locationError.set(
        'Standort nicht verfügbar. Gib eine PLZ ein oder erlaube den Standortzugriff.',
      );
      go({ radiusKm: null, lat: null, lon: null });
    };
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        go({ radiusKm, lat: coords.latitude.toFixed(3), lon: coords.longitude.toFixed(3) }),
      fail,
    );
  }
}
