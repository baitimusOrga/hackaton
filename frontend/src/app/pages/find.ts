import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ListingsService, SearchService } from '../api/services';
import {
  ListingSummary,
  Requirement,
  SearchMatch,
  SearchRequirements,
  SearchResults,
} from '../api/models';
import { CONDITION_LABELS } from '../conditions';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { chf } from '../ui/chf';
import { Icon } from '../ui/icon';
import { SummaryCard } from '../ui/summary-card';

type Row = 'mustHave' | 'niceToHave';
interface Position {
  latitude: number;
  longitude: number;
}

const FITS: Record<string, string> = {
  MATCH: 'Passt',
  NEEDS_DETAILS: 'Angaben fehlen',
  ALTERNATIVE: 'Alternative',
};
const NEAR_ME_KM = 25;
const NO_POSITION = 'Standort nicht verfügbar. Gib eine PLZ ein oder erlaube den Standortzugriff.';

/** Search: free text → requirements (chips + filter form) → one list ranked by score, refinable by text and position. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find',
  imports: [FormsModule, Button, Icon, SummaryCard, TranslatePipe],
  templateUrl: './find.html',
  styles: `
    .find__query {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .find__query textarea {
      flex: 1 1 auto;
      min-width: 0;
      padding-top: var(--space-2);
      padding-bottom: var(--space-2);
      resize: vertical;
    }
    .find__strip {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
      padding-top: var(--space-4);
    }
    .find__strip .zw-chip {
      max-width: none;
    }
    .find__strip > :last-child {
      margin-left: auto;
    }
    .find__cols {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: var(--space-16);
      align-items: start;
      padding-top: var(--space-8);
    }
    @media (max-width: 900px) {
      .find__cols {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-8);
      }
    }
    .find__filters {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .find__f {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .find__pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .find__reqs .zw-row {
      justify-content: space-between;
      min-height: 44px;
      font-size: 14px;
      line-height: 20px;
    }
    .find__results {
      display: flex;
      flex-direction: column;
      gap: var(--space-12);
    }
    .find__bar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .find__bar label {
      margin-left: auto;
      font-size: 14px;
      color: var(--ink-muted);
    }
    .find__bar select {
      width: 180px;
    }
    .find__grp {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .find__grp h2 {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }
    .find__grp h2 span {
      font-size: 16px;
      line-height: 24px;
      font-weight: 400;
      color: var(--ink-muted);
    }
    .find__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .find__why--ok {
      color: var(--green-text);
      font-weight: 500;
    }
    .find__adjust {
      display: flex;
      gap: var(--space-2);
      padding-top: var(--space-4);
      max-width: 40rem;
    }
    .find__adjust input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .find__history {
      list-style: none;
      padding: 0;
      margin: var(--space-2) 0 0;
    }
    .find__busy {
      opacity: 0.5;
    }
  `,
})
export class Find {
  private readonly search = inject(SearchService);
  private readonly listings = inject(ListingsService);
  private readonly i18n = inject(I18n);

  protected readonly rows = [
    { key: 'mustHave', label: 'Muss', other: 'Wäre schön' },
    { key: 'niceToHave', label: 'Wäre schön', other: 'Muss' },
  ] as const;
  protected readonly radii = [5, 10, 25, 50, 100];
  // TODO: the backend has no filters for these yet (condition, "Nur" flags); wire them up once SearchRequirements has them.
  protected readonly conditionOptions = Object.values(CONDITION_LABELS);
  protected readonly modeOptions = ['Festpreis', 'Preisvorschlag'];
  // shortcut: matches are filtered to auctions in the browser; move into SearchRequirements if lists get long
  protected readonly auctionsOnly = signal(false);
  /** All running auctions, shown on /find?mode=auction before a search. */
  protected readonly auctions = signal<ListingSummary[] | null>(null);
  protected readonly onlyOptions = ['Getestet, funktioniert', 'Grüne Wahl', 'Geprüfte Verkäufer'];

  protected readonly text = signal('');
  protected readonly adjust = signal('');
  protected readonly refinements = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly mustHave = signal<Requirement[]>([]);
  protected readonly niceToHave = signal<Requirement[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly budget = signal<number | null>(null);
  protected readonly postcode = signal('');
  protected readonly radius = signal<number | null>(null);
  protected readonly keywords = signal('');
  /** The buyer's position, rounded to ~100 m; kept in memory only, never in the URL or storage. */
  protected readonly position = signal<Position | null>(null);
  protected readonly matching = signal(false);
  protected readonly results = signal<SearchResults | null>(null);
  protected readonly shown = computed(() => {
    const res = this.results();
    if (!res || !this.auctionsOnly()) return res;
    const auction = (m: SearchMatch) => m.listing?.saleMode === 'AUCTION';
    return { ...res, matches: (res.matches ?? []).filter(auction) };
  });
  protected readonly progress = signal('');
  private initial: SearchRequirements | null = null;
  private original = '';
  private nearMe = false;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The header and the landing page search by navigating to /find?q=…
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        if (params.get('mode') === 'auction') {
          this.auctionsOnly.set(true);
          this.listings.list({ saleMode: 'AUCTION' }).subscribe((list) => this.auctions.set(list));
        }
        const q = params.get('q')?.trim();
        if (!q) return;
        this.text.set(q);
        this.find();
      });
  }

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    const text = this.text();
    this.loading.set(true);
    this.status(this.i18n.t('Lese deinen Wunsch…'), this.i18n.t('Mache Anforderungen daraus…'));
    this.search.create({ body: { text } }).subscribe({
      next: (req) => {
        this.initial = req;
        this.original = text;
        this.refinements.set([]);
        this.apply(req);
        this.results.set(null);
        this.searched.set(true);
        this.loading.set(false);
        this.afterParse(req);
      },
      error: () => this.failed(),
    });
  }

  /** "Suche anpassen": the AI changes the requirements, knowing the original wish and what is shown. */
  protected refine(): void {
    const text = this.adjust().trim();
    if (this.loading() || !text) return;
    this.loading.set(true);
    this.status(this.i18n.t('Passe deine Suche an…'));
    const topListingIds = (this.results()?.matches ?? [])
      .slice(0, 5)
      .map((m) => m.listing?.id)
      .filter((id): id is number => id != null);
    const body = {
      originalText: this.original,
      refinements: this.refinements().slice(-5),
      current: this.requirements(),
      text,
      topListingIds,
    };
    this.search.refine({ body }).subscribe({
      next: (req) => {
        this.refinements.update((list) => [...list, text]);
        this.adjust.set('');
        this.apply(req);
        this.loading.set(false);
        this.afterParse(req);
      },
      error: () => this.failed(),
    });
  }

  /** "Filter zurücksetzen": back to what the assistant read from the sentence. */
  protected reset(): void {
    if (!this.initial) return;
    this.apply(this.initial);
    this.afterParse(this.initial);
  }

  private apply(req: SearchRequirements): void {
    this.mustHave.set(req.mustHave);
    this.niceToHave.set(req.niceToHave);
    this.category.set(req.category ?? null);
    this.budget.set(req.maxBudgetChf ?? null);
    this.postcode.set(req.postcode ?? '');
    this.radius.set(req.maxDistanceKm ?? null);
    this.keywords.set(req.keywords.join(', '));
    this.nearMe = !!req.nearMe;
  }

  private afterParse(req: SearchRequirements): void {
    if (req.nearMe) this.useMyPosition();
    else this.showMatches();
  }

  move(r: Requirement, from: Row): void {
    const to: Row = from === 'mustHave' ? 'niceToHave' : 'mustHave';
    this[from].update((list) => list.filter((x) => x !== r));
    this[to].update((list) => [...list, r]);
    this.changed();
  }

  remove(r: Requirement, from: Row): void {
    this[from].update((list) => list.filter((x) => x !== r));
    this.changed();
  }

  protected clearRegion(): void {
    this.postcode.set('');
    this.radius.set(null);
    this.position.set(null);
    this.nearMe = false;
    this.changed();
  }

  /** "Mein Standort": asks the browser once, then searches around the position instead of a postcode. */
  protected useMyPosition(): void {
    const failed = () => {
      this.position.set(null);
      this.radius.set(null);
      this.nearMe = false;
      this.showMatches(this.i18n.t(NO_POSITION));
    };
    if (!navigator.geolocation) return failed();
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const round = (n: number) => Math.round(n * 1000) / 1000;
      this.position.set({ latitude: round(coords.latitude), longitude: round(coords.longitude) });
      this.postcode.set('');
      if (this.radius() === null) this.radius.set(NEAR_ME_KM);
      this.nearMe = true;
      this.showMatches();
    }, failed);
  }

  /** Matches again after a filter change; typing waits for a 400 ms pause. */
  protected changed(delay = 0): void {
    clearTimeout(this.debounce);
    if (delay) this.debounce = setTimeout(() => this.showMatches(), delay);
    else this.showMatches();
  }

  showMatches(message = ''): void {
    clearTimeout(this.debounce);
    const id = ++this.seq;
    this.matching.set(true);
    this.status(
      this.i18n.t('Durchsuche die Inserate…'),
      this.i18n.t('Vergleiche die Inserate mit deinen Anforderungen…'),
    );
    this.search.matches({ body: this.requirements() }).subscribe({
      next: (res) => {
        // a slower answer to an older request must not overwrite a newer one
        if (id !== this.seq) return;
        this.results.set(res);
        this.matching.set(false);
        this.status(message);
      },
      error: () => {
        if (id !== this.seq) return;
        this.matching.set(false);
        this.status(message);
      },
    });
  }

  private requirements(): SearchRequirements {
    const position = this.position();
    return {
      mustHave: this.mustHave(),
      niceToHave: this.niceToHave(),
      category: this.category()?.trim() || null,
      keywords: this.keywords()
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k),
      maxBudgetChf: this.budget() ?? undefined,
      postcode: this.postcode().trim() || undefined,
      maxDistanceKm: this.radius() ?? undefined,
      nearMe: this.nearMe,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
    };
  }

  private failed(): void {
    this.loading.set(false);
    this.status('');
  }

  /** Shows `first`, and `second` after 1.5 s if the call is still running. */
  private status(first: string, second?: string): void {
    clearTimeout(this.timer);
    this.progress.set(first);
    if (second) this.timer = setTimeout(() => this.progress.set(second), 1500);
  }

  protected list(row: Row): Requirement[] {
    return this[row]();
  }

  protected label(r: Requirement): string {
    const prefix = r.comparison === 'AT_LEAST' ? '≥ ' : r.comparison === 'AT_MOST' ? '≤ ' : '';
    return `${r.attribute}: ${prefix}${r.value}`;
  }

  protected budgetLabel(): string {
    return this.i18n.t('Bis {price}', { price: chf(this.budget() ?? 0) });
  }

  protected regionLabel(): string {
    if (this.position())
      return this.i18n.t('{km} km um deinen Standort', { km: this.radius() ?? NEAR_ME_KM });
    const pc = this.postcode().trim();
    return this.radius() ? this.i18n.t('{km} km um {pc}', { km: this.radius()!, pc }) : pc;
  }

  /** The card's line: score and fit, then why. */
  protected scoreLine(m: SearchMatch): string {
    const fit = this.i18n.t(FITS[m.fit ?? ''] ?? '');
    return [`${m.score ?? 0} % · ${fit}`, m.reason].filter((x) => x).join(' — ');
  }

  protected details(m: SearchMatch): string[] {
    return [
      ...(m.missingDetails?.length
        ? [this.i18n.t('Nicht angegeben: {details}', { details: m.missingDetails.join(', ') })]
        : []),
      ...(m.differences ?? []),
    ];
  }
}
