import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PriceEstimate } from '../api/models';

type EvidenceItem = NonNullable<PriceEstimate['evidence']>[number];

// keep in sync with PriceEstimator.FACTORS
const FACTORS: Record<string, number> = {
  NEW: 1.3,
  LIKE_NEW: 1.15,
  GOOD: 1,
  USED: 0.85,
  DEFECTIVE: 0.4,
};
const CONDITIONS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  USED: 'Used',
  DEFECTIVE: 'Defective',
};
const SIMILARITY: Record<string, string> = {
  SAME_MODEL: 'Same model',
  SAME_BRAND: 'Same brand',
  SIMILAR_TITLE: 'Similar title',
};
const STRATEGIES = [
  { label: 'Sell faster', key: 'lowChf', hint: 'cheaper than 3 in 4 comparables' },
  { label: 'Balanced', key: 'midChf', hint: 'middle of the evidence' },
  { label: 'Higher, less certain', key: 'highChf', hint: 'may take longer' },
] as const;

const EMPTY = {
  noEstimate: false,
  explanation: '',
  provisional: false,
  confidence: undefined as PriceEstimate['confidence'],
  strategies: [] as { label: string; hint: string; amount: number }[],
  lowText: '',
  highText: '',
  bandLeft: 0,
  bandWidth: 0,
  items: [] as ReturnType<PricePanel['row']>[],
};

@Component({
  selector: 'app-price-panel',
  imports: [CurrencyPipe, RouterLink],
  template: `
    @if (view(); as v) {
      @if (v.noEstimate) {
        <div class="rounded-md bg-gray-100 p-3 text-gray-900">
          <p class="font-semibold">No estimate</p>
          <p class="text-sm">{{ v.explanation }}</p>
        </div>
      } @else {
        @if (v.provisional) {
          <div class="rounded-md bg-amber-100 p-3 text-amber-900">
            <p class="font-semibold">Provisional estimate</p>
            <p class="text-sm">Not enough comparable evidence for a firm range.</p>
          </div>
        } @else {
          <p>
            <span
              class="rounded-full px-2 py-0.5 text-sm font-semibold"
              [class]="
                v.confidence === 'HIGH'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-sky-100 text-sky-900'
              "
              >{{ v.confidence === 'HIGH' ? 'High confidence' : 'Medium confidence' }}</span
            >
          </p>
        }
        <div class="flex flex-wrap gap-2">
          @for (s of v.strategies; track s.label) {
            <button
              type="button"
              class="secondary"
              [attr.aria-pressed]="price() === s.amount"
              (click)="price.set(s.amount)"
            >
              {{ s.label }} {{ s.amount | currency: 'CHF' }}
              <span class="block text-xs font-normal">{{ s.hint }}</span>
            </button>
          }
        </div>
        <div
          class="relative h-6"
          role="img"
          [attr.aria-label]="
            'Price range from ' +
            v.lowText +
            ' to ' +
            v.highText +
            ' across ' +
            v.items.length +
            ' comparables'
          "
        >
          <div
            class="absolute top-2.5 h-1 rounded bg-gray-300"
            [style.left.%]="v.bandLeft"
            [style.width.%]="v.bandWidth"
          ></div>
          @for (item of v.items; track item.listingId) {
            <span
              class="absolute top-1 size-4 -translate-x-1/2 rounded-full border-2 border-gray-800"
              [class.bg-gray-800]="item.sold"
              [class.bg-white]="!item.sold"
              [style.left.%]="item.position"
              [attr.title]="item.title"
            ></span>
          }
        </div>
      }
      <p class="text-sm">{{ v.explanation }}</p>
      @if (v.items.length) {
        <ul class="grid gap-1 text-sm">
          @for (item of v.items; track item.listingId) {
            <li>
              <a class="underline" [routerLink]="['/listings', item.listingId]">{{ item.title }}</a>
              ·
              <span class="rounded bg-gray-100 px-1"
                >{{ item.similarityLabel }} {{ item.similarityPercent }} %</span
              >
              · {{ item.sold ? 'Sold' : 'Asking' }} · {{ item.conditionLabel }} · {{ item.age }} ·
              {{ item.priceChf | currency: 'CHF' }}
              @if (item.showAdjusted) {
                (≈ {{ item.adjusted | currency: 'CHF' }})
              }
            </li>
          }
        </ul>
      }
    }
  `,
})
export class PricePanel {
  readonly estimate = input<PriceEstimate | null | undefined>();
  readonly condition = input<string | null | undefined>();
  readonly price = model<number | null>(null);

  protected readonly view = computed(() => {
    const est = this.estimate();
    if (!est) return null;
    const explanation = est.explanation ?? '';
    const items = est.evidence ?? [];
    if (est.midChf == null) {
      return { ...EMPTY, noEstimate: true, explanation };
    }

    const from = FACTORS[est.condition ?? 'GOOD'] ?? 1;
    const ratio = (FACTORS[this.condition() || (est.condition ?? 'GOOD')] ?? from) / from;
    const scale = (value: number) => Math.round(value * ratio);
    const [low, mid, high] = [est.lowChf ?? est.midChf, est.midChf, est.highChf ?? est.midChf].map(
      scale,
    );

    const adjusted = items.map((item) => (item.adjustedPriceChf ?? item.priceChf ?? 0) * ratio);
    const min = Math.min(low, ...adjusted);
    const span = Math.max(high, ...adjusted) - min;
    const position = (value: number) => (span > 0 ? ((value - min) / span) * 100 : 50);
    const amounts = { lowChf: low, midChf: mid, highChf: high };

    return {
      noEstimate: false,
      explanation,
      provisional: est.provisional || est.confidence === 'LOW',
      confidence: est.confidence,
      strategies: STRATEGIES.map((s) => ({ ...s, amount: amounts[s.key] })),
      lowText: `CHF ${low}`,
      highText: `CHF ${high}`,
      bandLeft: position(low),
      bandWidth: position(high) - position(low),
      items: items.map((item, i) => this.row(item, adjusted[i], position(adjusted[i]))),
    };
  });

  row(item: EvidenceItem, adjusted: number, position: number) {
    const days = item.ageDays ?? 0;
    const price = item.priceChf ?? 0;
    return {
      listingId: item.listingId,
      title: item.title,
      sold: item.sold,
      priceChf: price,
      similarityPercent: item.similarityPercent,
      similarityLabel: SIMILARITY[item.similarity ?? ''] ?? '',
      conditionLabel: CONDITIONS[item.condition ?? ''] ?? '',
      age: days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`,
      adjusted,
      showAdjusted: Math.abs(adjusted - price) >= 0.005,
      position: Math.min(100, Math.max(0, position)),
    };
  }
}
