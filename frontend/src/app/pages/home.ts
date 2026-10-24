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
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ListingsService } from '../api/services';
import { TranslatePipe } from '../i18n/i18n';
import { HeroSearch } from '../shell/hero-search';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { IconName } from '../ui/icons';
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

/** Landing page: hero search, quick filters, categories, ending auctions, new listings, business band. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    Button,
    Chip,
    Icon,
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
  protected readonly categories = CATEGORIES;
  protected readonly placeholders = Array.from({ length: 8 }, (_, i) => i);
  protected readonly query = signal('');
  private readonly router = inject(Router);
  private readonly listings = inject(ListingsService);
  protected readonly auctions = toSignal(
    this.listings.list({ saleMode: 'AUCTION' }).pipe(
      map((items) => items.slice(0, 4)),
      catchError(() => of([])),
    ),
  );
  protected readonly nearby = toSignal(
    this.listings.list({}).pipe(
      map((items) => items.slice(0, 8)),
      catchError(() => of([])),
    ),
  );

  protected quickFilter(filter: string): void {
    // shortcut: only "Nur Auktionen" has a backend filter; the other chips do nothing yet
    if (filter === 'Nur Auktionen')
      void this.router.navigate(['/find'], { queryParams: { mode: 'auction' } });
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
