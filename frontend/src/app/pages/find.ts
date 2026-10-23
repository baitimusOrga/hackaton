import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SearchService } from '../api/services';
import { Requirement, SearchMatch } from '../api/models';

type Row = 'mustHave' | 'niceToHave';
type Results = Record<'confirmed' | 'possible' | 'alternatives', SearchMatch[]>;

const CONDITIONS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  USED: 'Used',
  DEFECTIVE: 'Defective',
};

@Component({
  selector: 'app-find',
  imports: [FormsModule, RouterLink],
  template: `
    <h1 class="text-2xl font-semibold">Find an item</h1>
    <p class="text-slate-600">Describe what you are looking for, the assistant does the rest.</p>

    <form (ngSubmit)="find()" class="mt-4 grid max-w-2xl gap-3">
      <label for="find-text" class="font-semibold">What do you want to buy?</label>
      <textarea
        id="find-text"
        name="text"
        [(ngModel)]="text"
        required
        maxlength="500"
        rows="3"
        placeholder="working iMac 27 5K from 2017, max 600 CHF near Zürich"
        class="rounded-md border border-slate-400 bg-white p-3"
      ></textarea>
      <button
        type="submit"
        [disabled]="loading() || !text().trim()"
        class="cursor-pointer justify-self-start rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
      >
        {{ loading() ? 'Finding…' : 'Find' }}
      </button>
    </form>

    @if (searched()) {
      <section aria-labelledby="req-heading" class="mt-6 grid max-w-2xl gap-4">
        <h2 id="req-heading" class="text-xl font-semibold">Your requirements</h2>
        @for (row of rows; track row.key) {
          <div>
            <h3 class="font-semibold">{{ row.label }}</h3>
            <ul class="mt-1 flex flex-wrap gap-2" [attr.data-testid]="row.key">
              @for (r of list(row.key); track r.attribute + r.value) {
                <li class="flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3">
                  <span>{{ r.attribute }}: {{ r.value }}</span>
                  <button
                    type="button"
                    (click)="move(r, row.key)"
                    class="cursor-pointer rounded-full px-2 text-sm underline"
                    [attr.aria-label]="'Move ' + r.attribute + ' to ' + row.other"
                  >
                    {{ row.key === 'mustHave' ? 'optional' : 'required' }}
                  </button>
                  <button
                    type="button"
                    (click)="remove(r, row.key)"
                    class="cursor-pointer rounded-full px-2"
                    [attr.aria-label]="'Remove ' + r.attribute"
                  >
                    ×
                  </button>
                </li>
              } @empty {
                <li class="text-slate-600">None.</li>
              }
            </ul>
          </div>
        }
        @if (category()) {
          <p>Category: {{ category() }}</p>
        }
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="grid gap-1 font-semibold"
            >Max budget (CHF)
            <input
              type="number"
              min="0"
              name="budget"
              [(ngModel)]="budget"
              class="rounded-md border border-slate-400 bg-white p-2 font-normal"
          /></label>
          <label class="grid gap-1 font-semibold"
            >Postcode
            <input
              name="postcode"
              [(ngModel)]="postcode"
              maxlength="4"
              class="rounded-md border border-slate-400 bg-white p-2 font-normal"
          /></label>
          <label class="grid gap-1 font-semibold sm:col-span-2"
            >Keywords (comma-separated)
            <input
              name="keywords"
              [(ngModel)]="keywords"
              class="rounded-md border border-slate-400 bg-white p-2 font-normal"
          /></label>
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="acceptUnknown" [(ngModel)]="acceptUnknown" />
          Show items with missing details
        </label>
        <button
          type="button"
          (click)="showMatches()"
          [disabled]="matching()"
          class="cursor-pointer justify-self-start rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
        >
          {{ matching() ? 'Searching…' : 'Show matches' }}
        </button>
      </section>
    }

    @if (results(); as res) {
      <section aria-label="Matches" class="mt-8 grid gap-6">
        @if (!res.confirmed.length && !res.possible.length && !res.alternatives.length) {
          <p>Nothing matches yet.</p>
        } @else {
          @for (group of groups; track group.key) {
            <div>
              <h2 class="text-xl font-semibold">{{ group.title }}</h2>
              <ul class="mt-2 grid gap-3">
                @for (m of res[group.key]; track m.listing?.id) {
                  <li class="rounded-md border border-slate-200 bg-white p-4">
                    <a
                      [routerLink]="['/listings', m.listing?.id]"
                      class="font-semibold underline"
                      >{{ m.listing?.title }}</a
                    >
                    <p>
                      CHF {{ m.listing?.priceChf }} · {{ condition(m) }} · {{ m.listing?.locality }}
                    </p>
                    <p class="text-slate-700">{{ m.reason }}</p>
                    @if (m.missingDetails?.length) {
                      <p>Ask the seller: {{ m.missingDetails?.join(', ') }}</p>
                    }
                    @if (m.differences?.length) {
                      <p>Differences: {{ m.differences?.join(', ') }}</p>
                    }
                  </li>
                } @empty {
                  <li class="text-slate-600">{{ group.empty }}</li>
                }
              </ul>
            </div>
          }
        }
      </section>
    }
  `,
})
export class Find {
  private readonly search = inject(SearchService);

  protected readonly rows = [
    { key: 'mustHave', label: 'Must have', other: 'nice to have' },
    { key: 'niceToHave', label: 'Nice to have', other: 'must have' },
  ] as const;
  protected readonly groups = [
    { key: 'confirmed', title: 'Confirmed match', empty: 'No confirmed match yet.' },
    { key: 'possible', title: 'Possible match', empty: 'No possible match.' },
    { key: 'alternatives', title: 'Alternative', empty: 'No alternatives.' },
  ] as const;

  protected readonly text = signal('');
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly mustHave = signal<Requirement[]>([]);
  protected readonly niceToHave = signal<Requirement[]>([]);
  protected readonly category = signal<string | null>(null);
  protected readonly budget = signal<number | null>(null);
  protected readonly postcode = signal('');
  protected readonly keywords = signal('');
  protected readonly acceptUnknown = signal(true);
  protected readonly matching = signal(false);
  protected readonly results = signal<Results | null>(null);

  find(): void {
    if (this.loading() || !this.text().trim()) return;
    this.loading.set(true);
    this.search.create({ body: { text: this.text() } }).subscribe({
      next: (req) => {
        this.mustHave.set(req.mustHave);
        this.niceToHave.set(req.niceToHave);
        this.category.set(req.category ?? null);
        this.budget.set(req.maxBudgetChf ?? null);
        this.postcode.set(req.postcode ?? '');
        this.keywords.set(req.keywords.join(', '));
        this.acceptUnknown.set(req.acceptUnknown ?? true);
        this.results.set(null);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  move(r: Requirement, from: Row): void {
    const to: Row = from === 'mustHave' ? 'niceToHave' : 'mustHave';
    this[from].update((list) => list.filter((x) => x !== r));
    this[to].update((list) => [...list, r]);
  }

  remove(r: Requirement, from: Row): void {
    this[from].update((list) => list.filter((x) => x !== r));
  }

  showMatches(): void {
    if (this.matching()) return;
    this.matching.set(true);
    const body = {
      mustHave: this.mustHave(),
      niceToHave: this.niceToHave(),
      category: this.category(),
      keywords: this.keywords()
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k),
      maxBudgetChf: this.budget() ?? undefined,
      postcode: this.postcode().trim() || undefined,
      acceptUnknown: this.acceptUnknown(),
    };
    this.search.matches({ body }).subscribe({
      next: (res) => {
        this.results.set({
          confirmed: res.confirmed ?? [],
          possible: res.possible ?? [],
          alternatives: res.alternatives ?? [],
        });
        this.matching.set(false);
      },
      error: () => this.matching.set(false),
    });
  }

  protected list(row: Row): Requirement[] {
    return this[row]();
  }

  protected condition(m: SearchMatch): string {
    return CONDITIONS[m.listing?.condition ?? ''] ?? '';
  }
}
