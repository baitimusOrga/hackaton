import {
  afterNextRender,
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ListingsService } from '../api/services';
import { CATEGORIES } from '../categories';
import { TranslatePipe } from '../i18n/i18n';
import { HeroSearch } from '../shell/hero-search';
import { ListingMap } from '../components/listing-map';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { IconName } from '../ui/icons';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

const QUICK_FILTERS: [string, Record<string, string>][] = [
  ['Nur Auktionen', { saleMode: 'AUCTION' }],
  ['Unter CHF 50', { maxPrice: '50' }],
  ['Endet heute', { saleMode: 'AUCTION', ends: 'today' }],
];

const CATEGORY_ICONS: Record<string, IconName> = {
  Computers: 'computer',
  Laptops: 'laptop',
  Monitors: 'electronics',
  Phones: 'phone',
  Tablets: 'tablet',
  'Office furniture': 'furniture',
  'Office equipment': 'printer',
  Audio: 'audio',
  Cameras: 'camera',
  Household: 'household',
  Bikes: 'bike',
  Gaming: 'gaming',
  'TV & home cinema': 'tv',
};

const CATEGORY_TILES = CATEGORIES.map((name) => ({
  name,
  icon: CATEGORY_ICONS[name],
}));

/** Landing page: hero search, quick filters, categories, ending auctions, new listings, business band. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    RouterLink,
    Button,
    Chip,
    Icon,
    ListingMap,
    SectionHeading,
    SummaryCard,
    TranslatePipe,
  ],
  selector: 'app-home',
  host: { class: 'zw-bleed' },
  templateUrl: './home.html',
})
export class Home {
  protected readonly hero = inject(HeroSearch);
  private readonly heroForm = viewChild.required<ElementRef<HTMLElement>>('heroForm');
  protected readonly quickFilters = QUICK_FILTERS;
  protected readonly categories = CATEGORY_TILES;
  protected readonly placeholders = Array.from({ length: 8 }, (_, i) => i);
  protected readonly query = this.hero.query;
  private readonly router = inject(Router);
  private readonly api = inject(ListingsService);
  protected readonly auctions = toSignal(
    this.api.list({ saleMode: 'AUCTION' }).pipe(
      map((items) => items.slice(0, 4)),
      catchError(() => of([])),
    ),
  );
  protected readonly listings = toSignal(this.api.list({}).pipe(catchError(() => of([]))));
  protected readonly nearby = computed(() => this.listings()?.slice(0, 8));

  protected quickFilter(params: Record<string, string>): void {
    const q = this.query().trim();
    void this.router.navigate(['/search'], { queryParams: q ? { ...params, q } : params });
  }

  constructor() {
    const hero = this.hero;
    hero.active.set(true);
    hero.visible.set(true);
    let observer: IntersectionObserver | undefined;
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      // Dock the header search once the hero search has scrolled under the 72px header.
      observer = new IntersectionObserver(([entry]) => hero.visible.set(entry.isIntersecting), {
        rootMargin: '-72px 0px 0px 0px',
      });
      observer.observe(this.heroForm().nativeElement);
    });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      hero.active.set(false);
      hero.visible.set(false);
    });
  }
}
