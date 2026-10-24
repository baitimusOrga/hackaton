import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BookmarksService } from '../api/services';
import { TranslatePipe } from '../i18n/i18n';
import { SummaryCard } from '../ui/summary-card';

/** The signed-in user's saved ("Merken") listings. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bookmarks',
  imports: [SummaryCard, TranslatePipe],
  template: `<div class="zw-container zw-section zw-section--last">
    <h1>{{ 'Merkliste' | t }}</h1>
    @if (bookmarks(); as items) {
      @if (items.length) {
        <div class="grid">
          @for (item of items; track item.id) {
            <app-summary-card [listing]="item" />
          }
        </div>
      } @else {
        <p class="zw-muted">{{ 'Du hast noch nichts gemerkt.' | t }}</p>
      }
    }
  </div>`,
  styles: `
    h1 {
      margin-bottom: var(--space-4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-6);
    }
  `,
})
export class Bookmarks {
  protected readonly bookmarks = toSignal(inject(BookmarksService).mine());
}
