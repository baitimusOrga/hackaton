import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PriceEstimate } from '../api/models';
import { conditionLabel } from '../conditions';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { chf, ChfPipe } from '../ui/chf';

type EvidenceItem = NonNullable<PriceEstimate['evidence']>[number];

// keep in sync with PriceEstimator.FACTORS
const FACTORS: Record<string, number> = {
  NEW: 1.3,
  LIKE_NEW: 1.15,
  GOOD: 1,
  USED: 0.85,
  DEFECTIVE: 0.4,
};
const SIMILARITY: Record<string, string> = {
  SAME_MODEL: 'Gleiches Modell',
  SAME_BRAND: 'Gleiche Marke',
  SIMILAR_TITLE: 'Ähnlicher Titel',
};
const STRATEGIES = [
  { label: 'Schnell', key: 'lowChf', hint: 'Unter dem Schnitt, mehr Anfragen.' },
  { label: 'Ausgewogen', key: 'midChf', hint: 'In der Mitte der Vergleiche.' },
  { label: 'Hoch', key: 'highChf', hint: 'Oberer Rand, dauert eher länger.' },
] as const;
const CONFIDENCE: Record<string, string> = { HIGH: 'hoch', MEDIUM: 'mittel', LOW: 'tief' };

/** Price step (Sell4): evidence range in one sentence, 3 suggested prices + own price, sale mode. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-price-panel',
  imports: [ChfPipe, NgTemplateOutlet, RouterLink, TranslatePipe],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }
    .opt__p {
      margin-left: auto;
      white-space: nowrap;
    }
    .own {
      margin-left: auto;
      width: 160px;
    }
    .zw-muted strong {
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }
    summary {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-weight: 600;
      cursor: pointer;
    }
    .compact {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
    }
    @media (max-width: 480px) {
      .compact {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .modes {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
  `,
  template: `
    @if (view(); as v) {
      <!-- without an estimate only the own price field below is shown -->
      @if (!v.noEstimate) {
        <div>
          <p class="zw-muted zw-small">
            {{ 'Ähnliche Artikel auf Zweit:' | t }} <strong>{{ v.rangeText }}</strong
            >. {{ v.evidenceText }}
            @if (v.provisional) {
              <strong>{{ 'Vorläufig:' | t }}</strong>
              {{ 'zu wenig Vergleiche für eine feste Spanne.' | t }}
            } @else {
              {{ 'Sicherheit {level}.' | t: { level: v.confidenceText } }}
            }
          </p>
          @if (v.items.length) {
            <details>
              <summary>{{ 'Vergleiche ansehen' | t }}</summary>
              <ul class="zw-list">
                @for (item of v.items; track item.listingId) {
                  <li class="zw-row">
                    <span>
                      <a [routerLink]="['/listings', item.listingId]">{{ item.title }}</a>
                      <span class="zw-option__text">
                        {{ item.similarityLabel }} {{ item.similarityPercent }} % ·
                        {{ (item.sold ? 'Verkauft' : 'Angebot') | t }} · {{ item.conditionLabel }} ·
                        {{ item.age }}
                      </span>
                    </span>
                    <span class="zw-price opt__p">
                      {{ item.priceChf | chf }}
                      @if (item.showAdjusted) {
                        <span class="zw-option__text">≈ {{ item.adjusted | chf }}</span>
                      }
                    </span>
                  </li>
                }
              </ul>
            </details>
          }
        </div>
      }
    }

    @if (compact()) {
      <div class="compact">
        <div class="zw-field">
          <label class="zw-label" for="price-compact">{{ 'Preis' | t }}</label>
          <span class="zw-affix">
            <span class="zw-affix__unit">CHF</span>
            <input
              id="price-compact"
              class="zw-input zw-input--price"
              name="price"
              type="number"
              inputmode="decimal"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              [placeholder]="placeholder()"
              [value]="price() ?? ''"
              (input)="typeOwn($any($event.target).valueAsNumber)"
            />
          </span>
        </div>
        <ng-container *ngTemplateOutlet="modes" />
      </div>
    } @else {
      <fieldset class="zw-fieldset">
        <legend class="zw-sr-only">{{ 'Preis' | t }}</legend>
        @for (s of strategies(); track s.label) {
          <label class="zw-option">
            <input
              type="radio"
              name="price-choice"
              required
              [checked]="!own() && price() === s.amount"
              (change)="choose(s.amount, $index)"
            />
            <span>
              <span class="zw-option__title">{{ s.label | t }}</span>
              <span class="zw-option__text">{{ s.hint | t }}</span>
            </span>
            <span class="zw-price opt__p">{{ s.amount | chf }}</span>
          </label>
        }
        <label class="zw-option">
          @if (strategies().length) {
            <input
              type="radio"
              name="price-choice"
              required
              [checked]="own()"
              (change)="own.set(true); price.set(ownValue())"
            />
          }
          <span class="zw-option__title">{{ 'Eigener Preis' | t }}</span>
          <span class="zw-affix own">
            <span class="zw-affix__unit">CHF</span>
            <input
              class="zw-input zw-input--price"
              name="price"
              type="number"
              inputmode="decimal"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              placeholder="0.–"
              [attr.aria-label]="'Eigener Preis in CHF' | t"
              [required]="own() || !strategies().length"
              [value]="ownValue() ?? ''"
              (input)="typeOwn($any($event.target).valueAsNumber)"
            />
          </span>
        </label>
      </fieldset>
      <ng-container *ngTemplateOutlet="modes" />
    }

    <ng-template #modes>
      <div class="zw-field">
        <span class="zw-label" id="sale-mode">{{ 'Wie verkaufen?' | t }}</span>
        <!-- TODO: the backend only publishes fixed-price listings; Preisvorschlag, Auktion (with a secret seller-set reserve) and Verschenken need sale modes in CreateListingRequest. -->
        <div class="modes" role="group" aria-labelledby="sale-mode">
          <button type="button" class="zw-chip" aria-pressed="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            <span>{{ 'Festpreis' | t }}</span>
          </button>
          @for (mode of laterModes; track mode) {
            <button type="button" class="zw-chip" aria-pressed="false" disabled>
              <span>{{ mode | t }}</span>
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class PricePanel {
  private readonly i18n = inject(I18n);
  readonly estimate = input<PriceEstimate | null | undefined>();
  readonly condition = input<string | null | undefined>();
  readonly price = model<number | null>(null);
  /** One price field beside the sale modes (one-page form) instead of the three suggestions (wizard step). */
  readonly compact = input(false);
  protected readonly laterModes = ['Preisvorschlag', 'Auktion', 'Verschenken'];
  protected readonly own = signal(false);
  protected readonly ownValue = signal<number | null>(null);

  protected readonly view = computed(() => {
    const est = this.estimate();
    if (!est) return null;
    const items = est.evidence ?? [];
    if (est.midChf == null) return { noEstimate: true as const };
    return this.estimateView(est, items);
  });

  protected readonly strategies = computed(() => {
    const v = this.view();
    return v && !v.noEstimate ? v.strategies : [];
  });

  // The middle suggestion as a hint in the compact field; the seller still types the price.
  protected readonly placeholder = computed(() => {
    const middle = this.strategies()[1];
    return middle ? chf(middle.amount).replace('CHF ', '') : '0.–';
  });

  private estimateView(est: PriceEstimate, items: EvidenceItem[]) {
    const from = FACTORS[est.condition ?? 'GOOD'] ?? 1;
    const ratio = (FACTORS[this.condition() || (est.condition ?? 'GOOD')] ?? from) / from;
    const scale = (value: number) => Math.round(value * ratio);
    const [low, mid, high] = [
      est.lowChf ?? est.midChf!,
      est.midChf!,
      est.highChf ?? est.midChf!,
    ].map(scale);
    const amounts = { lowChf: low, midChf: mid, highChf: high };
    const sold = items.filter((i) => i.sold).length;
    const oldest = Math.max(0, ...items.map((i) => i.ageDays ?? 0));

    return {
      noEstimate: false as const,
      provisional: est.provisional || est.confidence === 'LOW',
      confidenceText: this.i18n.t(CONFIDENCE[est.confidence ?? ''] ?? ''),
      rangeText: this.i18n.t('{low} bis {high}', { low: chf(low), high: chf(high).slice(4) }),
      evidenceText: items.length
        ? this.i18n.t('{sales} und {offers}, {since}.', {
            sales: this.count(sold, 'Verkauf', 'Verkäufe'),
            offers: this.count(items.length - sold, 'Angebot', 'Angebote'),
            since: this.since(oldest),
          })
        : '',
      strategies: STRATEGIES.map((s) => ({ ...s, amount: amounts[s.key] })),
      items: items.map((item) =>
        this.row(item, (item.adjustedPriceChf ?? item.priceChf ?? 0) * ratio),
      ),
    };
  }

  private count(n: number, one: string, many: string): string {
    return `${n} ${this.i18n.t(n === 1 ? one : many)}`;
  }

  private since(days: number): string {
    return days <= 0
      ? this.i18n.t('heute')
      : days === 1
        ? this.i18n.t('seit gestern')
        : this.i18n.t('letzte {days} Tage', { days });
  }

  // the chosen suggestion (0 Schnell, 1 Ausgewogen, 2 Hoch); null while the seller types an own price
  private chosen: number | null = null;

  constructor() {
    // The wizard starts on "Ausgewogen"; a new estimate (e.g. after the model is confirmed) keeps the choice.
    effect(() => {
      const strategies = this.strategies();
      if (this.compact() || this.own() || !strategies.length) return;
      if (this.chosen === null && this.price() === null) this.chosen = 1;
      if (this.chosen !== null) this.price.set(strategies[this.chosen].amount);
    });
  }

  protected choose(amount: number, index: number): void {
    this.own.set(false);
    this.chosen = index;
    this.price.set(amount);
  }

  protected typeOwn(value: number): void {
    const amount = Number.isNaN(value) ? null : value;
    this.chosen = null;
    this.own.set(true);
    this.ownValue.set(amount);
    this.price.set(amount);
  }

  row(item: EvidenceItem, adjusted: number) {
    const days = item.ageDays ?? 0;
    const price = item.priceChf ?? 0;
    return {
      listingId: item.listingId,
      title: item.title,
      sold: item.sold,
      priceChf: price,
      similarityPercent: item.similarityPercent,
      similarityLabel: this.i18n.t(SIMILARITY[item.similarity ?? ''] ?? ''),
      conditionLabel: this.i18n.t(conditionLabel(item.condition)),
      age:
        days <= 0
          ? this.i18n.t('heute')
          : days === 1
            ? this.i18n.t('vor 1 Tag')
            : this.i18n.t('vor {days} Tagen', { days }),
      adjusted,
      showAdjusted: Math.abs(adjusted - price) >= 0.005,
    };
  }
}
