import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ListingsService } from '../api/services';
import { HeroSearch } from '../shell/hero-search';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { IconName } from '../ui/icons';
import { ListingCard } from '../ui/listing-card';
import { SectionHeading } from '../ui/section-heading';
import { SummaryCard } from '../ui/summary-card';

const QUICK_FILTERS = ['Nur Auktionen', 'Unter CHF 50', 'Abholung', 'Endet heute', 'Grüne Wahl'];

const CATEGORIES: { label: string; icon: IconName }[] = [
  { label: 'Elektronik', icon: 'electronics' },
  { label: 'Büro & Möbel', icon: 'furniture' },
  { label: 'Velo & E-Bike', icon: 'bike' },
  { label: 'Haushalt', icon: 'household' },
  { label: 'Kleidung', icon: 'clothing' },
  { label: 'Kinder', icon: 'kids' },
  { label: 'Garten', icon: 'garden' },
  { label: 'Maschinen', icon: 'machines' },
  { label: 'Alle Kategorien', icon: 'menu' },
];

const MINUTE = 60 * 1000;
// shortcut: the backend has no auctions yet, so "Endet bald" shows the design's sample; load them once the API serves auctions.
const SAMPLE_AUCTIONS = [
  {
    title: 'iMac 27" 2017, 5K Retina, 32 GB RAM',
    bid: 420,
    bids: 7,
    endsIn: 8,
    meta: 'Gut · Zürich-Oerlikon · Abholung',
  },
  {
    title: 'Herman Miller Aeron, Grösse B',
    bid: 310,
    bids: 12,
    endsIn: 134,
    meta: 'Sehr gut · Winterthur · Abholung oder Versand',
  },
  {
    title: 'Canyon Grail CF SL 8, Rahmen M',
    bid: 1250,
    bids: 4,
    endsIn: 340,
    meta: 'Gut · Bern · Abholung',
  },
  {
    title: 'Bosch Akku-Bohrschrauber GSR 18V, 2 Akkus',
    bid: 65,
    bids: 9,
    endsIn: 662,
    meta: 'Gebraucht · Baden · Versand CHF 9.–',
  },
];

/** Landing page: hero search, quick filters, categories, ending auctions, new listings, business band. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, Chip, Icon, ListingCard, SectionHeading, SummaryCard],
  selector: 'app-home',
  host: { class: 'zw-bleed' },
  templateUrl: './home.html',
})
export class Home {
  protected readonly hero = inject(HeroSearch);
  private readonly heroForm = viewChild.required<ElementRef<HTMLElement>>('heroForm');
  protected readonly quickFilters = QUICK_FILTERS;
  protected readonly categories = CATEGORIES;
  protected readonly placeholders = Array.from({ length: 8 }, (_, i) => i);
  protected readonly query = signal('');
  protected readonly auctions = SAMPLE_AUCTIONS.map((a) => ({
    ...a,
    endsAt: Date.now() + a.endsIn * MINUTE,
  }));
  protected readonly nearby = toSignal(
    inject(ListingsService)
      .list({})
      .pipe(
        map((items) => items.slice(0, 8)),
        catchError(() => of([])),
      ),
  );

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
