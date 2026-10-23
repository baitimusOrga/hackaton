import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';
import { CATEGORIES } from '../categories';
import { ListingMap } from '../components/listing-map';

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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  imports: [CurrencyPipe, ListingMap, RouterLink, TitleCasePipe],
  template: `
    <h1 class="mb-4 text-2xl font-semibold">Discover</h1>
    <form
      class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      role="search"
      (submit)="$event.preventDefault()"
    >
      <label class="grid gap-1 text-sm font-semibold">
        Search
        <input
          #q
          name="q"
          type="search"
          placeholder="e.g. iMac"
          class="rounded-md border border-slate-400 p-2 font-normal"
          [value]="filters().q ?? ''"
          (change)="set('q', q.value)"
        />
      </label>
      <label class="grid gap-1 text-sm font-semibold">
        Category
        <select
          #category
          name="category"
          class="rounded-md border border-slate-400 p-2 font-normal"
          (change)="set('category', category.value)"
        >
          <option value="">All categories</option>
          @for (c of categories; track c) {
            <option [value]="c" [selected]="c === filters().category">{{ c }}</option>
          }
        </select>
      </label>
      <label class="grid gap-1 text-sm font-semibold">
        Max price (CHF)
        <input
          #maxPrice
          name="maxPrice"
          type="number"
          min="0"
          class="rounded-md border border-slate-400 p-2 font-normal"
          [value]="filters().maxPrice ?? ''"
          (change)="set('maxPrice', maxPrice.value)"
        />
      </label>
      <label class="grid gap-1 text-sm font-semibold">
        Postcode
        <input
          #postcode
          name="postcode"
          inputmode="numeric"
          maxlength="4"
          placeholder="e.g. 80"
          class="rounded-md border border-slate-400 p-2 font-normal"
          [value]="filters().postcode ?? ''"
          (change)="set('postcode', postcode.value)"
        />
      </label>
      <label class="grid gap-1 text-sm font-semibold">
        Range around my location
        <select
          #radiusKm
          name="radiusKm"
          class="rounded-md border border-slate-400 p-2 font-normal"
          (change)="nearMe(radiusKm.value)"
        >
          <option value="" [selected]="!filters().radiusKm">Any distance</option>
          @for (km of radii; track km) {
            <option [value]="km" [selected]="filters().radiusKm === km">{{ km }} km</option>
          }
        </select>
      </label>
    </form>
    @if (locationError()) {
      <p role="alert" class="mb-4 text-red-700">{{ locationError() }}</p>
    }

    @if (listings(); as items) {
      @if (items.length === 0) {
        <p class="text-slate-600">No listings match your filters.</p>
      } @else {
        <div class="mb-4 flex gap-2" role="group" aria-label="View">
          @for (mode of ['list', 'map']; track mode) {
            <button
              type="button"
              class="rounded-md border border-slate-400 px-3 py-1 text-sm capitalize aria-pressed:bg-slate-800 aria-pressed:text-white"
              [attr.aria-pressed]="view() === mode"
              (click)="view.set($any(mode))"
            >
              {{ mode }}
            </button>
          }
        </div>
      }
      @if (items.length > 0 && view() === 'map') {
        <app-listing-map [items]="items" label="Map of the matching listings" />
      } @else if (items.length > 0) {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of items; track item.id) {
            <li>
              <a
                [routerLink]="['/listings', item.id]"
                class="block h-full overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-400"
              >
                @if (item.imageUrl) {
                  <img [src]="item.imageUrl" alt="" class="aspect-4/3 w-full object-cover" />
                } @else {
                  <div
                    class="grid aspect-4/3 w-full place-items-center bg-slate-100 text-sm text-slate-400"
                  >
                    No photo
                  </div>
                }
                <div class="grid gap-1 p-3">
                  <h2 class="font-semibold">{{ item.title }}</h2>
                  <p class="text-lg font-semibold">{{ item.priceChf | currency: 'CHF' }}</p>
                  <p class="text-sm text-slate-600">
                    {{ item.condition?.replace('_', ' ') | titlecase }} · {{ item.postcode }}
                    {{ item.locality }}
                  </p>
                </div>
              </a>
            </li>
          }
        </ul>
      }
    } @else {
      <p class="text-slate-600">Loading listings…</p>
    }
  `,
})
export class Home {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ListingsService);
  protected readonly categories = CATEGORIES;
  protected readonly radii = RADII;
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
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        go({ radiusKm, lat: coords.latitude.toFixed(3), lon: coords.longitude.toFixed(3) }),
      () => {
        this.locationError.set('Could not get your location. Allow location access and try again.');
        go({ radiusKm: null, lat: null, lon: null });
      },
    );
  }
}
