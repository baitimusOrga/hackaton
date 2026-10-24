import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SavedSearchesService } from '../api/services';
import { SavedSearchResponse } from '../api/models';
import { TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';

/** "Meine Suchen": the signed-in user's saved searches; opening one restores it in Find through the URL. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-saved-searches',
  imports: [Button, TranslatePipe],
  templateUrl: './saved-searches.html',
  styles: `
    .ss-name {
      flex: 1 1 auto;
      font-weight: 600;
      color: var(--ink);
    }
  `,
})
export class SavedSearches {
  private readonly api = inject(SavedSearchesService);
  private readonly router = inject(Router);
  protected readonly searches = signal<SavedSearchResponse[] | undefined>(undefined);

  constructor() {
    this.api.listMine().subscribe((list) => this.searches.set(list));
  }

  protected open(s: SavedSearchResponse): void {
    const r = s.requirements!;
    const json = (list: unknown[]) => (list.length ? JSON.stringify(list) : undefined);
    const queryParams = {
      q: s.text || undefined,
      kw: r.keywords.join(',') || undefined,
      cat: r.category || undefined,
      max: r.maxBudgetChf ?? undefined,
      plz: r.postcode || undefined,
      km: r.postcode && r.maxDistanceKm ? r.maxDistanceKm : undefined,
      must: json(r.mustHave),
      nice: json(r.niceToHave),
    };
    // Find restores the filters from these params without asking the assistant again.
    // shortcut: "near me" (position) is not kept, and a search without any filter re-reads its text.
    void this.router.navigate(['/find'], { queryParams });
  }

  protected remove(s: SavedSearchResponse): void {
    this.api
      .delete({ id: s.id! })
      .subscribe(() => this.searches.update((l) => l?.filter((x) => x.id !== s.id)));
  }
}
