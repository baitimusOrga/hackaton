import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SearchService } from '../api/services';
import { Requirement, SearchMatch, SearchRequirements } from '../api/models';
import { Button } from '../ui/button';
import { chf } from '../ui/chf';
import { Icon } from '../ui/icon';
import { ListingCard } from '../ui/listing-card';

type Row = 'mustHave' | 'niceToHave';
type Results = Record<'confirmed' | 'possible' | 'alternatives', SearchMatch[]> & {
  compared: number;
};

const CONDITIONS: Record<string, string> = {
  NEW: 'Neu',
  LIKE_NEW: 'Wie neu',
  GOOD: 'Gut',
  USED: 'Gebraucht',
  DEFECTIVE: 'Defekt',
};

/** Search: free text → requirements (chips + filter form) → matches grouped Bestätigt / Möglich / Alternativen. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find',
  imports: [FormsModule, Button, Icon, ListingCard],
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
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
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
    .find__ck {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }
    .find__ck input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--blue);
    }
    .find__reqs {
      list-style: none;
      margin: 0;
      padding: 0;
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
      margin: 0;
      font-size: 24px;
      line-height: 28px;
      font-weight: 700;
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
    .find__why {
      margin: 0;
      font-size: 14px;
      line-height: 20px;
      color: var(--ink-muted);
    }
    .find__why--ok {
      color: var(--green-text);
      font-weight: 500;
    }
    .find__small {
      font-size: 14px;
      line-height: 20px;
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
  // TODO: the backend has no filters for these yet (condition, sale mode, "Nur" flags); wire them up once SearchRequirements has them.
  protected readonly conditionOptions = ['Neu', 'Wie neu', 'Gut', 'Gebraucht', 'Defekt'];
  protected readonly modeOptions = ['Festpreis', 'Preisvorschlag', 'Auktion'];
  protected readonly onlyOptions = ['Getestet, funktioniert', 'Grüne Wahl', 'Geprüfte Verkäufer'];

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
  private initial: SearchRequirements | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The header and the landing page search by navigating to /find?q=…
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const q = params.get('q')?.trim();
        if (!q) return;
        this.text.set(q);
        this.find();
      });
  }

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    this.loading.set(true);
    this.status('Lese deinen Wunsch…', 'Mache Anforderungen daraus…');
    this.search.create({ body: { text: this.text() } }).subscribe({
      next: (req) => {
        this.initial = req;
        this.apply(req);
        this.results.set(null);
        this.searched.set(true);
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
    if (this.initial) this.apply(this.initial);
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

  showMatches(): void {
    if (this.matching()) return;
    this.matching.set(true);
    this.status('Durchsuche die Inserate…', 'Vergleiche die Inserate mit deinen Anforderungen…');
    const body = {
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
      acceptUnknown: this.acceptUnknown(),
    };
    this.search.matches({ body }).subscribe({
      next: (res) => {
        this.results.set({
          confirmed: res.confirmed ?? [],
          possible: res.possible ?? [],
          alternatives: res.alternatives ?? [],
          compared: res.compared ?? 0,
        });
        this.matching.set(false);
        this.status('');
      },
      error: () => {
        this.matching.set(false);
        this.status('');
      },
    });
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
    const pc = this.postcode().trim();
    return this.radius() ? `${this.radius()} km um ${pc}` : pc;
  }

  protected total(res: Results): number {
    return res.confirmed.length + res.possible.length + res.alternatives.length;
  }

  protected meta(m: SearchMatch): string {
    const l = m.listing;
    const place = [l?.postcode, l?.locality].filter(Boolean).join(' ');
    return [CONDITIONS[l?.condition ?? ''], place].filter(Boolean).join(' · ');
  }

  /** The card's extra line: why it is in this group. */
  protected why(m: SearchMatch, group: keyof Omit<Results, 'compared'>): string {
    if (group === 'possible' && m.missingDetails?.length)
      return `Nicht angegeben: ${m.missingDetails.join(', ')}`;
    if (group === 'alternatives' && m.differences?.length) return m.differences.join(', ');
    return m.reason ?? '';
  }
}
