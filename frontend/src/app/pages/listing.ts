import { CurrencyPipe, DatePipe, KeyValuePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs';
import { ListingsService } from '../api/services';
import { ListingMap } from '../components/listing-map';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing',
  imports: [CurrencyPipe, DatePipe, KeyValuePipe, TitleCasePipe, ListingMap],
  template: `
    @if (listing(); as item) {
      <article class="grid max-w-3xl gap-3">
        @if (item.imageUrl) {
          <img
            [src]="item.imageUrl"
            [alt]="item.title"
            class="max-h-96 w-full rounded-xl object-cover"
          />
        }
        <h1 class="text-2xl font-semibold">{{ item.title }}</h1>
        <p class="text-xl font-semibold">{{ item.priceChf | currency: 'CHF' }}</p>
        <p class="text-sm text-slate-600">
          {{ item.condition?.replace('_', ' ') | titlecase }} · {{ item.category }} · Listed
          {{ item.createdAt | date: 'mediumDate' }}
        </p>
        <p data-testid="seller">
          {{ item.sellerName ? 'Sold by ' + item.sellerName : 'Demo listing' }}
        </p>
        <p class="whitespace-pre-line">{{ item.description }}</p>
        <p>{{ item.postcode }} {{ item.locality }}</p>
        @if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
          <!-- the postcode area, not the address: the exact spot stays private -->
          <app-listing-map
            [items]="[item]"
            [label]="'Map of the area around ' + item.postcode + ' ' + item.locality"
          />
        }
        @if (item.attributes | keyvalue; as attributes) {
          @if (attributes.length) {
            <table class="w-full max-w-md text-left text-sm">
              <tbody>
                @for (attribute of attributes; track attribute.key) {
                  <tr class="border-b border-slate-200">
                    <th scope="row" class="py-1 pr-4 font-semibold">{{ attribute.key }}</th>
                    <td class="py-1">{{ attribute.value }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      </article>
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
