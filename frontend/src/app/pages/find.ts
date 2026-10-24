import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ListingsService, SearchService } from '../api/services';
import {
  ListingSummary,
  Relaxation,
  Requirement,
  SearchMatch,
  SearchRequirements,
  SearchResults,
} from '../api/models';
import { CATEGORIES } from '../categories';
import { Condition, CONDITION_LABELS } from '../conditions';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { chf } from '../ui/chf';
import { Facet } from '../ui/facet';
import { Icon } from '../ui/icon';
import { SummaryCard } from '../ui/summary-card';
import { FindSentence, Token } from './find-sentence';

const FILTER_KEYS = ['kw', 'cat', 'max', 'plz', 'km', 'must', 'nice', 'cond'];

/** True when the URL already holds exactly the filters the form shows (our own navigation). */
function sameQuery(params: ParamMap, query: Record<string, string | null>): boolean {
  return Object.entries(query).every(([k, v]) => params.get(k) === v);
}

type Row = 'mustHave' | 'niceToHave';

/** The three result groups, in page order; `mark` is the card's why-line style. */
const GROUPS = [
  { fit: 'MATCH', title: 'Passt', sub: 'alles belegt', mark: 'ok' },
  { fit: 'NEEDS_DETAILS', title: 'Möglich', sub: 'Angaben fehlen', mark: 'maybe' },
  { fit: 'ALTERNATIVE', title: 'Alternativen', sub: 'ausserhalb deiner Suche', mark: 'alt' },
] as const;

/** Search: free text → the sentence with tokens + facets → results in three groups, refinable by text. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find',
  imports: [FormsModule, Button, Facet, FindSentence, Icon, SummaryCard, TranslatePipe],
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
    .find__phone {
      display: none;
    }
    @media (max-width: 720px) {
      .find__phone {
        display: flex;
        margin-bottom: var(--space-4);
      }
      .find__query .zw-btn {
        width: 44px;
        padding: 0;
      }
      .find__query .zw-btn span {
        display: none;
      }
    }
    .find__head {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-bottom: var(--space-6);
    }
    .find__history {
      list-style: none;
      padding: 0;
      margin: 0;
      font-weight: 500;
    }
    .find__adjust {
      display: flex;
      gap: var(--space-2);
      max-width: 40rem;
    }
    .find__adjust input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .find__bar {
      position: sticky;
      top: 72px;
      z-index: 6;
      background: var(--bg-000);
      border-top: var(--border-1) solid var(--line-soft);
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    @media (max-width: 720px) {
      /* the header is static on phones */
      .find__bar {
        top: 0;
      }
    }
    .find__bar-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-height: 32px;
      padding-top: var(--space-3);
    }
    .find__clear {
      margin-left: auto;
    }
    .find__facets {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-2) 0 var(--space-3);
    }
    @media (max-width: 639px) {
      /* one scrolling row; the panels are fixed on phones, so nothing is clipped */
      .find__facets {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
    }
    .find__opt {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 44px;
      font-size: 16px;
      line-height: 24px;
      cursor: pointer;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .find__opt:last-child {
      border-bottom: 0;
    }
    .find__opt > input {
      flex: none;
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--blue);
    }
    .find__opt-text {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      line-height: 20px;
    }
    .find__opt-head {
      padding-top: var(--space-2);
    }
    .find__radii {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .find__count {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      min-height: 56px;
      padding: var(--space-2) 0;
      border-top: var(--border-1) solid var(--line-soft);
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .find__count .zw-help {
      font-weight: 400;
    }
    .find__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-8) var(--space-4);
    }
    .find__skeleton {
      padding-top: var(--space-6);
    }
    .find__bone {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .find__bone-media {
      aspect-ratio: 1 / 1;
      background: var(--bg-100);
    }
    .find__bone-line {
      height: 20px;
      background: var(--bg-100);
    }
    .find__bone-line--70 {
      width: 70%;
    }
    .find__bone-line--40 {
      width: 40%;
    }
    .find__grp {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding-top: var(--space-6);
      animation: findFade 0.2s ease-out both;
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
    .find__foot {
      padding-top: var(--space-8);
    }
    .find__steps {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      list-style: none;
      padding: var(--space-4) 0 0;
      margin: 0;
    }
    .find__steps li {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    .find__step--now {
      color: var(--ink);
      font-weight: 600;
    }
    .find__relax {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      padding-top: var(--space-4);
    }
    @keyframes findFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
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
  protected readonly categories = CATEGORIES;
  protected readonly conditionOptions = Object.keys(CONDITION_LABELS) as Condition[];
  protected readonly conditionLabels = CONDITION_LABELS;
  protected readonly skeleton = [1, 2, 3, 4];

  protected readonly text = signal('');
  protected readonly adjust = signal('');
  protected readonly refinements = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly mustHave = signal<Requirement[]>([]);
  protected readonly niceToHave = signal<Requirement[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly budget = signal<number | null>(null);
  protected readonly budgetPhrase = signal<string | null>(null);
  protected readonly postcode = signal('');
  protected readonly regionPhrase = signal<string | null>(null);
  protected readonly radius = signal<number | null>(null);
  /** A distance needs a full postcode to measure from. */
  protected readonly hasPostcode = computed(() => /^\d{4}$/.test(this.postcode().trim()));
  protected readonly keywords = signal('');
  protected readonly conditions = signal<Condition[]>([]);
  /** Keys of the tokens the buyer tapped off; their values stay, so a second tap restores them. */
  protected readonly off = signal<ReadonlySet<string>>(new Set());
  protected readonly openFacet = signal<string | null>(null);
  protected readonly matching = signal(false);
  protected readonly results = signal<SearchResults | null>(null);
  // shortcut: matches are filtered to auctions in the browser; move into SearchRequirements if lists get long
  protected readonly auctionsOnly = signal(false);
  /** All running auctions, shown on /find?mode=auction before a search. */
  protected readonly auctions = signal<ListingSummary[] | null>(null);
  protected readonly shown = computed(() => {
    const res = this.results();
    if (!res || !this.auctionsOnly()) return res;
    const auction = (m: SearchMatch) => m.listing?.saleMode === 'AUCTION';
    return { ...res, matches: (res.matches ?? []).filter(auction) };
  });
  protected readonly groups = computed(() => {
    const found = this.shown()?.matches ?? [];
    return GROUPS.map((g) => ({ ...g, items: found.filter((m) => m.fit === g.fit) })).filter(
      (g) => g.items.length,
    );
  });
  protected readonly busy = computed(() => this.loading() || this.matching());
  protected readonly progress = signal('');
  protected readonly steps = [
    'Wunsch verstehen',
    'Inserate durchsuchen',
    'Passung bewerten',
  ] as const;
  /** 0 = idle, else the running step of `steps` (1-based). */
  protected readonly step = signal(0);
  /** The status line: what runs right now, else the count. */
  protected readonly countText = computed(() =>
    this.busy()
      ? this.progress()
      : this.i18n.t('{count} Inserate', { count: this.shown()?.matches?.length ?? 0 }),
  );
  /** The sentence's tokens: requirements, budget and region, with where they sit in the sentence. */
  protected readonly tokens = computed<Token[]>(() => {
    const tokens: Token[] = [
      ...this.mustHave().map((r) => ({
        key: this.key('must', r),
        kind: 'must' as const,
        label: this.label(r),
        phrase: r.phrase ?? null,
      })),
      ...this.niceToHave().map((r) => ({
        key: this.key('nice', r),
        kind: 'nice' as const,
        label: this.label(r),
        phrase: r.phrase ?? null,
      })),
    ];
    if (this.budget() !== null) {
      tokens.push({
        key: 'budget',
        kind: 'budget',
        label: this.budgetLabel(),
        phrase: this.budgetPhrase(),
      });
    }
    if (this.postcode().trim()) {
      tokens.push({
        key: 'region',
        kind: 'region',
        label: this.regionLabel(),
        phrase: this.regionPhrase(),
      });
    }
    return tokens;
  });
  /** What each facet trigger shows next to its label; '' = inactive. */
  protected readonly summaries = computed(() => {
    const on = (key: string) => !this.off().has(key);
    const count = (n: number) => (n ? String(n) : '');
    const conditions = this.conditions();
    const requirements =
      this.mustHave().filter((r) => on(this.key('must', r))).length +
      this.niceToHave().filter((r) => on(this.key('nice', r))).length;
    return {
      category: this.category() ? this.i18n.t(this.category()!) : '',
      price: on('budget') && this.budget() !== null ? `${this.i18n.t('bis')} ${this.budget()}` : '',
      conditions:
        conditions.length === 1
          ? this.i18n.t(CONDITION_LABELS[conditions[0]])
          : count(conditions.length),
      region: on('region') && this.postcode().trim() ? this.regionLabel() : '',
      auction: this.auctionsOnly() ? this.i18n.t('Auktion') : '',
      requirements: count(requirements),
      keywords: count(this.keywordList().length),
    };
  });
  protected readonly hasActive = computed(() => {
    const s = this.summaries();
    return !!(s.category || s.price || s.conditions || s.region || s.auction || s.keywords);
  });
  private readonly router = inject(Router);
  /** The text the filters were read from; it stays in the URL next to the filters. */
  protected readonly asked = signal('');
  /** The filters as URL query params (null = not in the URL); off tokens never go in. */
  private readonly query = computed(() => {
    const on = (key: string) => !this.off().has(key);
    const pc = on('region') ? this.postcode().trim() : '';
    const budget = on('budget') ? this.budget() : null;
    const json = (list: Requirement[]) => (list.length ? JSON.stringify(list) : null);
    return {
      q: this.asked() || null,
      kw: this.keywords().trim() || null,
      cat: this.category()?.trim() || null,
      max: budget === null ? null : String(budget),
      maxp: budget === null ? null : this.budgetPhrase(),
      plz: pc || null,
      plzp: pc ? this.regionPhrase() : null,
      km: pc && this.radius() ? String(this.radius()) : null,
      must: json(this.mustHave().filter((r) => on(this.key('must', r)))),
      nice: json(this.niceToHave().filter((r) => on(this.key('nice', r)))),
      cond: this.conditions().length ? this.conditions().join(',') : null,
      mode: this.auctionsOnly() ? 'auction' : null,
    };
  });
  private original = '';
  /** A facet changed something since it opened: search when it closes. */
  private dirty = false;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Keep the filters in the URL so a reload or a shared link shows the same search.
    effect(() => {
      const queryParams = this.query();
      if (!this.searched()) return;
      untracked(() =>
        this.router.navigate([this.router.url.split('?')[0]], { queryParams, replaceUrl: true }),
      );
    });

    // The header and the landing page search by navigating to /find?q=…; a URL with filters restores them.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        if (params.get('mode') === 'auction' && !this.auctionsOnly()) {
          this.auctionsOnly.set(true);
          this.listings.list({ saleMode: 'AUCTION' }).subscribe((list) => this.auctions.set(list));
        }
        if (FILTER_KEYS.some((k) => params.has(k))) {
          if (!this.searched() || !sameQuery(params, this.query())) this.restore(params);
          return;
        }
        const q = params.get('q')?.trim();
        if (!q || (this.searched() && sameQuery(params, this.query()))) return;
        this.text.set(q);
        this.find();
      });
  }

  /** A link with filters shows that search directly, without asking the assistant again. */
  private restore(params: ParamMap): void {
    const list = (key: string): Requirement[] => {
      try {
        const parsed = JSON.parse(params.get(key) ?? '[]');
        return Array.isArray(parsed)
          ? parsed
              .filter((r) => r && typeof r.attribute === 'string' && typeof r.value === 'string')
              .map((r) => ({
                ...r,
                phrase: typeof r.phrase === 'string' ? r.phrase.slice(0, 80) : null,
              }))
          : [];
      } catch {
        return [];
      }
    };
    const max = params.get('max');
    const km = params.get('km');
    const q = (params.get('q') ?? '').slice(0, 500);
    this.text.set(q);
    this.asked.set(q);
    this.original = q;
    this.searched.set(true);
    this.conditions.set(
      [...new Set((params.get('cond') ?? '').split(','))]
        .filter((c): c is Condition => Object.hasOwn(CONDITION_LABELS, c))
        .slice(0, 5),
    );
    this.apply({
      mustHave: list('must'),
      niceToHave: list('nice'),
      category: params.get('cat'),
      keywords: (params.get('kw') ?? '').split(',').filter((k) => k.trim()),
      maxBudgetChf: max === null ? undefined : Number(max),
      budgetPhrase: params.get('maxp')?.slice(0, 80) ?? null,
      postcode: params.get('plz') ?? undefined,
      regionPhrase: params.get('plzp')?.slice(0, 80) ?? null,
      maxDistanceKm: km === null ? undefined : Number(km),
    });
    this.showMatches();
  }

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    const text = this.text();
    this.loading.set(true);
    this.step.set(1);
    this.status(this.i18n.t('Lese deinen Wunsch…'), this.i18n.t('Mache Anforderungen daraus…'));
    this.search.create({ body: { text } }).subscribe({
      next: (req) => {
        this.original = text;
        this.asked.set(text.trim());
        this.refinements.set([]);
        this.conditions.set([]);
        this.apply(req);
        this.results.set(null);
        this.searched.set(true);
        this.loading.set(false);
        this.showMatches();
      },
      error: () => this.failed(),
    });
  }

  /** "Suche anpassen": the AI changes the requirements, knowing the original wish and what is shown. */
  protected refine(): void {
    const text = this.adjust().trim();
    if (this.loading() || !text) return;
    this.loading.set(true);
    this.step.set(1);
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
        this.showMatches();
      },
      error: () => this.failed(),
    });
  }

  /** Sets what the assistant (or the URL) says; conditions are the buyer's own filter and stay as they are. */
  private apply(req: SearchRequirements): void {
    this.mustHave.set(req.mustHave);
    this.niceToHave.set(req.niceToHave);
    this.category.set(req.category ?? null);
    this.budget.set(req.maxBudgetChf ?? null);
    this.budgetPhrase.set(req.budgetPhrase ?? null);
    this.postcode.set(req.postcode ?? '');
    this.regionPhrase.set(req.regionPhrase ?? null);
    this.radius.set(req.maxDistanceKm ?? null);
    this.keywords.set(req.keywords.join(', '));
    this.off.set(new Set());
  }

  /** A token tap: off ↔ on, then search at once. */
  protected toggleToken(key: string): void {
    this.off.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    this.showMatches();
  }

  private turnOn(key: string): void {
    if (!this.off().has(key)) return;
    this.off.update((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  /** One facet open at a time; a facet that changed something searches when it closes. */
  protected setOpen(key: string, open: boolean): void {
    if (!open && this.openFacet() !== key) return;
    this.openFacet.set(open ? key : null);
    if (!this.dirty) return;
    this.dirty = false;
    this.showMatches();
  }

  protected setCategory(value: string): void {
    this.category.set(value || null);
    this.dirty = true;
  }

  protected setBudget(value: string): void {
    const n = Number(value);
    this.budget.set(value.trim() && Number.isFinite(n) ? n : null);
    this.budgetPhrase.set(null);
    this.turnOn('budget');
    this.dirty = true;
  }

  protected toggleCondition(condition: Condition, checked: boolean): void {
    this.conditions.update((list) =>
      checked ? [...list, condition] : list.filter((c) => c !== condition),
    );
    this.dirty = true;
  }

  protected clearConditions(): void {
    this.conditions.set([]);
    this.dirty = true;
  }

  protected setPostcode(value: string): void {
    this.postcode.set(value);
    this.regionPhrase.set(null);
    this.turnOn('region');
    this.dirty = true;
  }

  protected setRadius(km: number | null): void {
    this.radius.set(km);
    this.regionPhrase.set(null);
    this.turnOn('region');
    this.dirty = true;
  }

  protected setKeywords(value: string): void {
    this.keywords.set(value);
    this.dirty = true;
  }

  protected clearRequirements(): void {
    this.mustHave.set([]);
    this.niceToHave.set([]);
    this.dirty = true;
  }

  /** "Alle entfernen": the six filter facets go; the requirements from the sentence stay. */
  protected clearFilters(): void {
    this.category.set(null);
    this.conditions.set([]);
    this.auctionsOnly.set(false);
    this.keywords.set('');
    this.off.update((set) => new Set([...set, 'budget', 'region']));
    this.dirty = false;
    this.showMatches();
  }

  move(r: Requirement, from: Row): void {
    const to: Row = from === 'mustHave' ? 'niceToHave' : 'mustHave';
    this[from].update((list) => list.filter((x) => x !== r));
    this[to].update((list) => [...list, r]);
    this.dirty = true;
  }

  remove(r: Requirement, from: Row): void {
    this[from].update((list) => list.filter((x) => x !== r));
    this.dirty = true;
  }

  protected clearRegion(): void {
    this.postcode.set('');
    this.radius.set(null);
    this.dirty = false;
    this.showMatches();
  }

  showMatches(message = ''): void {
    const id = ++this.seq;
    this.matching.set(true);
    this.step.set(2);
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
        this.step.set(0);
        this.status(message);
      },
      error: () => {
        if (id !== this.seq) return;
        this.matching.set(false);
        this.step.set(0);
        this.status(message);
      },
    });
  }

  private keywordList(): string[] {
    return this.keywords()
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k);
  }

  /** The effective requirements: off tokens are left out, their values stay for a second tap. */
  private requirements(): SearchRequirements {
    const on = (key: string) => !this.off().has(key);
    const budget = on('budget') ? this.budget() : null;
    return {
      mustHave: this.mustHave().filter((r) => on(this.key('must', r))),
      niceToHave: this.niceToHave().filter((r) => on(this.key('nice', r))),
      category: this.category()?.trim() || null,
      keywords: this.keywordList(),
      maxBudgetChf: budget ?? undefined,
      postcode: (on('region') && this.postcode().trim()) || undefined,
      maxDistanceKm: on('region') ? (this.radius() ?? undefined) : undefined,
      conditions: this.conditions(),
      budgetPhrase: budget === null ? null : this.budgetPhrase(),
      regionPhrase: on('region') ? this.regionPhrase() : null,
    };
  }

  private failed(): void {
    this.loading.set(false);
    this.step.set(0);
    this.status('');
  }

  /** Shows `first`, and `second` after 1.5 s if the call is still running. */
  private status(first: string, second?: string): void {
    clearTimeout(this.timer);
    this.progress.set(first);
    if (!second) return;
    this.timer = setTimeout(() => {
      this.progress.set(second);
      // after 1.5 s the app has scored the listings and the assistant is ranking them
      if (this.step() === 2) this.step.set(3);
    }, 1500);
  }

  /** The buyer drops the filter that costs the most matches. */
  protected relax(r: Relaxation): void {
    if (r.kind === 'BUDGET') return this.toggleToken('budget');
    if (r.kind === 'REGION') return this.toggleToken('region');
    if (r.kind === 'CATEGORY') this.category.set(null);
    else {
      const must = this.mustHave().find((x) => x.attribute === r.attribute);
      if (must) this.move(must, 'mustHave');
    }
    this.showMatches();
  }

  protected relaxLabel(r: Relaxation): string {
    const count = r.count ?? 0;
    switch (r.kind) {
      case 'BUDGET':
        return this.i18n.t('Ohne Budgetgrenze ({count})', { count });
      case 'REGION':
        return this.i18n.t('Ganze Schweiz ({count})', { count });
      case 'CATEGORY':
        return this.i18n.t('Alle Kategorien ({count})', { count });
      default:
        return this.i18n.t('{attribute} nur wünschen ({count})', {
          attribute: r.attribute ?? '',
          count,
        });
    }
  }

  protected list(row: Row): Requirement[] {
    return this[row]();
  }

  /** Token key: unique per list, attribute and comparison. */
  private key(kind: 'must' | 'nice', r: Requirement): string {
    return `${kind}:${r.attribute}:${r.comparison ?? 'EXACT'}`;
  }

  protected label(r: Requirement): string {
    const prefix = r.comparison === 'AT_LEAST' ? '≥ ' : r.comparison === 'AT_MOST' ? '≤ ' : '';
    return `${r.attribute}: ${prefix}${r.value}`;
  }

  private budgetLabel(): string {
    return this.i18n.t('Bis {price}', { price: chf(this.budget() ?? 0) });
  }

  private regionLabel(): string {
    const pc = this.postcode().trim();
    return this.radius() ? this.i18n.t('{km} km um {pc}', { km: this.radius()!, pc }) : pc;
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
