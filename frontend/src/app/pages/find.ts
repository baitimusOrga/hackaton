import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, filter, map, merge, switchMap, tap } from 'rxjs';
import { SearchService } from '../api/services';
import { Requirement, SearchMatch, SearchRequirements } from '../api/models';
import { Button } from '../ui/button';
import { chf } from '../ui/chf';
import { Icon } from '../ui/icon';
import { SummaryCard } from '../ui/summary-card';

const FILTER_KEYS = ['kw', 'cat', 'max', 'plz', 'km', 'unknown', 'must', 'nice'];

/** True when the URL already holds exactly the filters the form shows (our own navigation). */
function sameQuery(params: ParamMap, query: Record<string, string | null>): boolean {
  return Object.entries(query).every(([k, v]) => params.get(k) === v);
}

type Row = 'mustHave' | 'niceToHave';
type Results = Record<'confirmed' | 'possible' | 'alternatives', SearchMatch[]> & {
  compared: number;
};

/** Search: free text → requirements (chips + filter form) → matches grouped Bestätigt / Möglich / Alternativen. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find',
  imports: [FormsModule, Button, Icon, SummaryCard],
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
      gap: var(--space-6);
    }
    .find__f {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .find__check {
      flex-wrap: nowrap;
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
    .find__status {
      min-height: 1.5em;
      margin: var(--space-2) 0;
      font-weight: 500;
    }
    .find__results--busy {
      opacity: 0.5;
      transition: opacity 0.15s;
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
  `,
})
export class Find {
  private readonly search = inject(SearchService);

  protected readonly rows = [
    { key: 'mustHave', label: 'Muss', other: 'Wäre schön' },
    { key: 'niceToHave', label: 'Wäre schön', other: 'Muss' },
  ] as const;
  protected readonly groups = [
    { key: 'confirmed', title: 'Bestätigt', note: 'alles belegt', empty: 'Noch nichts bestätigt.' },
    { key: 'possible', title: 'Möglich', note: 'eine Angabe fehlt', empty: 'Nichts Mögliches.' },
    {
      key: 'alternatives',
      title: 'Alternativen',
      note: 'ausserhalb deiner Filter',
      empty: 'Keine Alternativen.',
    },
  ] as const;
  protected readonly radii = [5, 10, 25, 50, 100];

  protected readonly text = signal('');
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly mustHave = signal<Requirement[]>([]);
  protected readonly niceToHave = signal<Requirement[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly budget = signal<number | null>(null);
  protected readonly postcode = signal('');
  protected readonly radius = signal<number | null>(null);
  protected readonly keywords = signal('');
  protected readonly acceptUnknown = signal(true);
  protected readonly matching = signal(false);
  protected readonly results = signal<Results | null>(null);
  protected readonly progress = signal('');
  private readonly body = computed(() => ({
    mustHave: this.mustHave(),
    niceToHave: this.niceToHave(),
    category: this.category()?.trim() || null,
    keywords: this.keywords()
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k),
    maxBudgetChf: this.budget() ?? undefined,
    postcode: this.postcode().trim() || undefined,
    maxDistanceKm: this.postcode().trim() ? (this.radius() ?? undefined) : undefined,
    acceptUnknown: this.acceptUnknown(),
  }));
  /** The text the filters were read from; it stays in the URL next to the filters. */
  private readonly asked = signal('');
  /** Everything the filter form holds, as URL query params (null = not in the URL). */
  private readonly query = computed(() => {
    const pc = this.postcode().trim();
    const json = (list: Requirement[]) => (list.length ? JSON.stringify(list) : null);
    return {
      q: this.asked() || null,
      kw: this.keywords().trim() || null,
      cat: this.category()?.trim() || null,
      max: this.budget() === null ? null : String(this.budget()),
      plz: pc || null,
      km: pc && this.radius() ? String(this.radius()) : null,
      unknown: this.acceptUnknown() ? null : '0',
      must: json(this.mustHave()),
      nice: json(this.niceToHave()),
    };
  });
  private readonly router = inject(Router);
  private readonly now = new Subject<void>();
  private lastKey = '';
  private initial: SearchRequirements | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Every filter change searches again once the user pauses; switchMap drops the answer of a replaced request.
    merge(
      toObservable(this.body).pipe(
        filter(() => this.searched()),
        debounceTime(600),
        filter((body) => JSON.stringify(body) !== this.lastKey),
      ),
      this.now.pipe(map(() => this.body())),
    )
      .pipe(
        tap((body) => {
          this.lastKey = JSON.stringify(body);
          this.matching.set(true);
          this.status(
            'Durchsuche die Inserate…',
            'Vergleiche die Inserate mit deinen Anforderungen…',
          );
        }),
        switchMap((body) =>
          this.search.matches({ body }).pipe(
            map((res) => {
              this.results.set({
                confirmed: res.confirmed ?? [],
                possible: res.possible ?? [],
                alternatives: res.alternatives ?? [],
                compared: res.compared ?? 0,
              });
              this.matching.set(false);
              this.status('');
            }),
            catchError(() => {
              this.matching.set(false);
              this.status('');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

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

  private restore(params: ParamMap): void {
    const list = (key: string): Requirement[] => {
      try {
        return JSON.parse(params.get(key) ?? '[]');
      } catch {
        return [];
      }
    };
    const max = params.get('max');
    const km = params.get('km');
    this.text.set(params.get('q') ?? '');
    this.asked.set(params.get('q') ?? '');
    this.searched.set(true);
    this.apply({
      mustHave: list('must'),
      niceToHave: list('nice'),
      category: params.get('cat'),
      keywords: (params.get('kw') ?? '').split(',').filter((k) => k.trim()),
      maxBudgetChf: max === null ? undefined : Number(max),
      postcode: params.get('plz') ?? undefined,
      maxDistanceKm: km === null ? undefined : Number(km),
      acceptUnknown: params.get('unknown') !== '0',
    });
    this.showMatches();
  }

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    this.loading.set(true);
    this.status('Lese deinen Wunsch…', 'Mache Anforderungen daraus…');
    this.search.create({ body: { text: this.text() } }).subscribe({
      next: (req) => {
        this.initial = req;
        this.asked.set(this.text().trim());
        this.searched.set(true);
        this.apply(req);
        this.results.set(null);
        this.loading.set(false);
        this.showMatches();
      },
      error: () => {
        this.loading.set(false);
        this.status('');
      },
    });
  }

  /** "Filter zurücksetzen": back to what the assistant read from the sentence. */
  protected reset(): void {
    this.apply(this.initial ?? { mustHave: [], niceToHave: [], keywords: [], acceptUnknown: true });
  }

  private apply(req: SearchRequirements): void {
    this.mustHave.set(req.mustHave);
    this.niceToHave.set(req.niceToHave);
    this.category.set(req.category ?? null);
    this.budget.set(req.maxBudgetChf ?? null);
    this.postcode.set(req.postcode ?? '');
    this.radius.set(req.maxDistanceKm ?? null);
    this.keywords.set(req.keywords.join(', '));
    this.acceptUnknown.set(req.acceptUnknown ?? true);
  }

  move(r: Requirement, from: Row): void {
    const to: Row = from === 'mustHave' ? 'niceToHave' : 'mustHave';
    this[from].update((list) => list.filter((x) => x !== r));
    this[to].update((list) => [...list, r]);
  }

  remove(r: Requirement, from: Row): void {
    this[from].update((list) => list.filter((x) => x !== r));
  }

  protected clearRegion(): void {
    this.postcode.set('');
    this.radius.set(null);
  }

  /** Searches right away, without waiting for the debounce. */
  showMatches(): void {
    this.now.next();
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
    return `Bis ${chf(this.budget() ?? 0)}`;
  }

  protected regionLabel(): string {
    const pc = `PLZ ${this.postcode().trim()}`;
    return this.radius() ? `${pc} · ${this.radius()} km` : pc;
  }

  protected total(res: Results): number {
    return res.confirmed.length + res.possible.length + res.alternatives.length;
  }

  /** The card's extra line: why it is in this group. */
  protected why(m: SearchMatch, group: keyof Omit<Results, 'compared'>): string {
    if (group === 'possible' && m.missingDetails?.length)
      return `Nicht angegeben: ${m.missingDetails.join(', ')}`;
    if (group === 'alternatives' && m.differences?.length) return m.differences.join(', ');
    return m.reason ?? '';
  }
}
