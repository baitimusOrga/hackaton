import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';
import { CATEGORIES } from '../categories';
import { ListingMap } from '../components/listing-map';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { Facet } from '../ui/facet';
import { Icon } from '../ui/icon';
import { SummaryCard } from '../ui/summary-card';

type FilterName = 'q' | 'category' | 'maxPrice' | 'postcode' | 'saleMode';

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
    saleMode: params.get('saleMode') === 'AUCTION' ? ('AUCTION' as const) : undefined,
  };
}

/** Search with a facet bar, a radius around the buyer's position, and a list or map view (clustered per 5 km). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-search',
  imports: [Button, Facet, Icon, ListingMap, SummaryCard, TranslatePipe],
  templateUrl: './search.html',
  styles: `
    h1 {
      padding-bottom: var(--space-6);
    }
    .search__results {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding-top: var(--space-6);
    }
    .search__view {
      display: flex;
      gap: var(--space-2);
      margin-left: auto;
    }
  `,
})
export class Search {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ListingsService);
  private readonly i18n = inject(I18n);
  protected readonly categories = CATEGORIES;
  protected readonly radii = RADII;
  protected readonly views = [
    ['list', 'Liste'],
    ['map', 'Karte'],
  ] as const;
  protected readonly view = signal<'list' | 'map'>('list');
  protected readonly openFacet = signal<string | null>(null);
  protected readonly locationError = signal('');
  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersOf)), {
    initialValue: filtersOf(this.route.snapshot.queryParamMap),
  });
  protected readonly listings = toSignal(
    this.route.queryParamMap.pipe(switchMap((params) => this.api.list(filtersOf(params)))),
  );
  protected readonly hasActive = computed(() => {
    const f = this.filters();
    return !!(
      f.q ||
      f.category ||
      f.maxPrice !== undefined ||
      f.postcode ||
      f.radiusKm ||
      f.saleMode
    );
  });
  protected readonly summaries = computed(() => {
    const f = this.filters();
    const t = this.i18n.t.bind(this.i18n);
    let region = f.postcode ?? '';
    if (f.radiusKm && f.lat !== undefined)
      region = t('{km} km um deinen Standort', { km: f.radiusKm });
    else if (f.radiusKm && f.postcode)
      region = t('{km} km um {pc}', { km: f.radiusKm, pc: f.postcode });
    return {
      category: f.category ? t(f.category) : '',
      price: f.maxPrice !== undefined ? `${t('bis')} ${f.maxPrice}` : '',
      region,
      saleMode: f.saleMode ? t('Auktion') : '',
      q: f.q ?? '',
    };
  });

  protected set(name: FilterName, value: string) {
    this.go({ [name]: value.trim() || null });
  }

  protected clearRegion() {
    this.go({ postcode: null, radiusKm: null, lat: null, lon: null });
  }

  protected clearAll() {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  /** Asks the browser for the position once and keeps it, rounded to ~100 m, in the URL with the range. */
  protected nearMe(radiusKm: number | null) {
    this.locationError.set('');
    if (radiusKm === null) return this.go({ radiusKm: null, lat: null, lon: null });
    const km = String(radiusKm);
    // a full postcode is enough to measure from, no location permission needed
    if (/^\d{4}$/.test(this.filters().postcode ?? ''))
      return this.go({ radiusKm: km, lat: null, lon: null });
    const fail = () => {
      this.locationError.set(
        'Standort nicht verfügbar. Gib eine PLZ ein oder erlaube den Standortzugriff.',
      );
      this.go({ radiusKm: null, lat: null, lon: null });
    };
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        this.go({
          radiusKm: km,
          lat: coords.latitude.toFixed(3),
          lon: coords.longitude.toFixed(3),
        }),
      fail,
    );
  }

  private go(queryParams: Record<string, string | null>) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
