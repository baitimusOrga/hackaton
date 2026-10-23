import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ListingSummary } from '../api/models';
import { conditionLabel, metaLine } from '../conditions';
import { ListingCard } from './listing-card';

/** A backend listing as a fixed-price card linking to its detail page. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListingCard],
  selector: 'app-summary-card',
  styles: ':host { display: block; }',
  template: `<app-listing-card
    [link]="['/listings', listing().id]"
    [title]="listing().title ?? ''"
    [price]="listing().priceChf ?? 0"
    [image]="listing().imageUrl ?? ''"
    [meta]="meta()"
  />`,
})
export class SummaryCard {
  readonly listing = input.required<ListingSummary>();
  protected readonly meta = computed(() => {
    const l = this.listing();
    return metaLine(conditionLabel(l.condition), [l.postcode, l.locality].join(' '));
  });
}
