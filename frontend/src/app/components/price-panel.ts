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
  untracked,
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
type Strategy = (typeof STRATEGIES)[number]['key'];
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
          <label class="zw-label" for="price-compact">{{
            (auctionDays() === null ? 'Preis' : 'Startpreis') | t
          }}</label>
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
        <legend class="zw-sr-only">
          {{ (auctionDays() === null ? 'Preis' : 'Startpreis') | t }}
        </legend>
        @for (s of strategies(); track s.label) {
          <label class="zw-option">
            <input
              type="radio"
              name="price-choice"
              required
              [checked]="!own() && chosen() === s.key"
              (change)="choose(s.key, s.amount)"
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
        <!-- TODO: Preisvorschlag and Verschenken need sale modes in CreateListingRequest. -->
        <div class="modes" role="group" aria-labelledby="sale-mode">
          @for (mode of saleModes; track mode.label) {
            <button
              type="button"
              class="zw-chip"
              [attr.aria-pressed]="(auctionDays() !== null) === mode.auction"
              (click)="auctionDays.set(mode.auction ? (auctionDays() ?? 5) : null)"
            >
              @if ((auctionDays() !== null) === mode.auction) {
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              }
              <span>{{ mode.label | t }}</span>
            </button>
          }
          @for (mode of laterModes; track mode) {
            <button type="button" class="zw-chip" aria-pressed="false" disabled>
              <span>{{ mode | t }}</span>
            </button>
          }
        </div>
      </div>
      @if (auctionDays() !== null) {
        <div class="zw-field">
          <label class="zw-label" for="auction-days">{{ 'Dauer' | t }}</label>
          <select
            id="auction-days"
            class="zw-input"
            name="auctionDays"
            [value]="auctionDays()"
            (change)="auctionDays.set(+$any($event.target).value)"
          >
            @for (days of durations; track days) {
              <option [value]="days" [selected]="days === auctionDays()">
                {{ '{days} Tage' | t: { days } }}
              </option>
            }
          </select>
        </div>
      }
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
  /** null = fixed price, otherwise the auction runs this many days and the price is the start price. */
  readonly auctionDays = model<number | null>(null);
  protected readonly saleModes = [
    { label: 'Festpreis', auction: false },
    { label: 'Auktion', auction: true },
  ];
  protected readonly durations = [3, 5, 7];
  protected readonly laterModes = ['Preisvorschlag', 'Verschenken'];
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
    const middle = this.strategies().find((s) => s.key === 'midChf');
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
      // equal amounts (few comparables) collapse into the middle option instead of three same prices
      strategies: STRATEGIES.map((s) => ({ ...s, amount: amounts[s.key] })).filter(
        (s) => s.key === 'midChf' || s.amount !== mid,
      ),
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

  // the chosen suggestion; null while the seller types an own price
  protected readonly chosen = signal<Strategy | null>(null);

  constructor() {
    // The wizard starts on "Ausgewogen"; a new estimate (e.g. after the model is confirmed) keeps the choice.
    effect(() => {
      const strategies = this.strategies();
      if (this.compact() || this.own() || !strategies.length) return;
      const chosen = untracked(this.chosen);
      if (chosen === null && untracked(this.price) !== null) return;
      const pick =
        strategies.find((s) => s.key === chosen) ?? strategies.find((s) => s.key === 'midChf')!;
      this.chosen.set(pick.key);
      this.price.set(pick.amount);
    });
  }

  protected choose(key: Strategy, amount: number): void {
    this.own.set(false);
    this.chosen.set(key);
    this.price.set(amount);
  }

  protected typeOwn(value: number): void {
    const amount = Number.isNaN(value) ? null : value;
    this.chosen.set(null);
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
