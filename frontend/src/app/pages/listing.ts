import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';

@Component({
  selector: 'app-listing',
  imports: [CurrencyPipe],
  template: `
    @if (listing(); as item) {
      <h1 class="text-2xl font-semibold">{{ item.title }}</h1>
      <p data-testid="seller">
        {{ item.sellerName ? 'Sold by ' + item.sellerName : 'Demo listing' }}
      </p>
      <p>{{ item.priceChf | currency: 'CHF' }}</p>
      <p>{{ item.description }}</p>
      <p>{{ item.postcode }} {{ item.locality }}</p>
    }
  `,
})
export class ListingPage {
  private readonly api = inject(ListingsService);
  protected readonly listing = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => Number(params.get('id'))),
      filter((id) => Number.isSafeInteger(id) && id > 0),
      distinctUntilChanged(),
      switchMap((id) => this.api.get({ id })),
    ),
  );
}
