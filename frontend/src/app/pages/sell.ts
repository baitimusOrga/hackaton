import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { ListingsService, PlacesService, SellingService } from '../api/services';
import {
  CreateListingRequest,
  Detection,
  DraftEvent,
  Gap,
  ListingDraft,
  PriceEstimate,
  PrivacyMark,
} from '../api/models';
import { DetectionStage, StageMark } from '../components/detection-stage';
import { PricePanel } from '../components/price-panel';
import { Condition, CONDITION_LABELS } from '../conditions';
import { devicePosition } from '../device-location';
import { DraftStore } from '../draft-store';
import { DraftStream } from '../draft-stream';
import { ErrorBanner, HANDLES_ERRORS, translateError } from '../errors';
import { CONDITION, GapCard, KnownFact, MAX_CARDS, completeness, openGaps } from '../gaps';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';

type Source = KnownFact['source'];
type Field = 'title' | 'category' | 'condition' | 'description';
interface Fact extends KnownFact {
  sourceUrl?: string | null;
}
interface SellPhoto {
  file: File;
  url: string;
  id?: number;
}

const MAX_PHOTOS = 5;
const STEPS = 4;
// per-browser default for the next listing
const LAST_LOCATION = 'sell.lastLocation';
// draft photos are deleted on the server after 24 h (PhotoCleanup); an older draft could not be published
const DRAFT_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/** Everything needed to continue a draft after a reload; photo files included for the previews. */
interface SavedDraft {
  savedAt: number;
  photos: { file: File; id?: number }[];
  draft: ListingDraft;
  fields: Record<Field, string>;
  sellerFields: Field[];
  facts: Fact[];
  aiGaps: Gap[];
  skipped: string[];
  answered: number;
  gapsActive: boolean;
  step: number;
  view: 'steps' | 'full';
  excluded: number[];
  price: number | null;
  postcode: string;
  locality: string;
  detections: Detection[];
  privacyMarks: PrivacyMark[];
}
const MARKERS: Record<Source, string> = {
  LABEL: 'Vom Etikett gelesen',
  SUGGESTION: 'Vorschlag, bitte prüfen',
  SELLER: 'Von dir bestätigt',
  WEB: 'Aus dem Web, bitte prüfen',
};
// TODO: the design's "Sehr gut" has no backend condition; CreateListingRequest knows only these five.
const HINTS: Record<Condition, string> = {
  NEW: 'Unbenutzt, originalverpackt.',
  LIKE_NEW: 'Keine Gebrauchsspuren.',
  GOOD: 'Funktioniert einwandfrei, sichtbare Spuren.',
  USED: 'Deutliche Spuren, funktioniert.',
  DEFECTIVE: 'Für Bastler oder Ersatzteile.',
};
const CONDITIONS = (Object.keys(HINTS) as Condition[]).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
  hint: HINTS[value],
}));

/**
 * Sell flow as in "Sell Erkennung v3": photo and live detection (1), one question at a time (2),
 * price (3) and handover (4) beside a live preview of the listing, then a success screen. "Alles
 * bearbeiten" shows the one-page form (SellFull); both views share the same signals.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    DetectionStage,
    PricePanel,
    Badge,
    Button,
    ChfPipe,
    Chip,
    Icon,
    TranslatePipe,
  ],
  templateUrl: './sell.html',
  host: {
    '[class.sell--full]': "view() === 'full'",
    '(document:keydown.escape)': 'close()',
    // a pasted image is a photo wherever the focus is; pasted text is left alone
    '(window:paste)': 'onPaste($event)',
  },
  styles: `
    /* Steps and the one-page form both cover the page they were opened from. */
    :host {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: block;
      overflow-y: auto;
      background: var(--bg-000);
    }
    .sell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-000);
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .bar__in {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-6);
      min-height: 72px;
    }
    .bar__step {
      margin-left: auto;
      white-space: nowrap;
    }
    .progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--line-soft);
    }
    .progress > div {
      height: 100%;
      background: var(--ink);
      transition: width 480ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .restored {
      background: var(--bg-100);
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .restored__in {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-3) var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      font-size: 14px;
      line-height: 20px;
    }
    .main {
      flex: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6) 0;
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 40px;
    }
    .dragging .main {
      outline: 2px dashed var(--blue);
      outline-offset: -8px;
    }
    .col {
      flex: 1 1 400px;
      max-width: 680px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }
    .col--center {
      margin-inline: auto;
    }
    .q {
      font-size: 32px;
      line-height: 36px;
      font-weight: 700;
      letter-spacing: -0.005em;
      text-wrap: pretty;
    }
    .shoot {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      width: 100%;
      min-height: 220px;
      padding: var(--space-6);
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
      border: var(--border-1) solid var(--line);
      border-radius: var(--radius-1);
      background: var(--bg-900);
      color: var(--ink-inverse);
      cursor: pointer;
    }
    .shoot:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .upload {
      align-self: center;
      text-align: center;
    }
    .foot2 {
      position: sticky;
      bottom: 0;
      z-index: 5;
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      min-height: 76px;
      padding: var(--space-4) 0;
      background: var(--bg-000);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .push {
      margin-left: auto;
    }
    .choice {
      min-width: 64px;
      height: 56px;
      padding: 0 var(--space-4);
      font: 600 18px/24px var(--font-sans);
      border: var(--border-1) solid var(--line);
      border-radius: var(--radius-1);
      background: var(--bg-000);
      color: var(--ink);
      cursor: pointer;
    }
    .choice:hover {
      background: var(--bg-100);
    }
    .danger {
      color: var(--danger);
    }
    .busy-slot {
      min-height: 16px;
    }
    .manual {
      display: flex;
      gap: var(--space-2);
    }
    .manual .zw-input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .status {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 20px;
    }
    /* Live preview of the listing, the design's "Fläche" variant */
    .aside {
      flex: 0 0 360px;
      min-width: 280px;
      margin-top: calc(-1 * var(--space-8));
      padding: var(--space-8) var(--space-6) 0;
      background: var(--bg-100);
    }
    .aside__in {
      position: sticky;
      top: calc(72px + var(--space-6));
      max-height: calc(100vh - 72px - 2 * var(--space-6));
      overflow: hidden auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }
    .aside__in > * {
      flex-shrink: 0;
    }
    .aside__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 20px;
    }
    .aside__photo {
      flex-shrink: 0;
    }
    .aside__photo,
    .card__photo {
      position: relative;
      aspect-ratio: 1 / 1;
      background: var(--bg-000) center / cover no-repeat;
      overflow: hidden;
    }
    .aside__photo--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: var(--ink-muted);
    }
    .aside__title,
    .card__title {
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
    }
    .tag {
      align-self: flex-start;
    }
    .fact-row {
      position: relative;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 40px;
      padding: var(--space-2) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
      font-size: 14px;
      line-height: 20px;
    }
    .fact-row__name {
      font-weight: 600;
    }
    .fact-row > :nth-child(2) {
      text-align: right;
    }
    .flashable {
      position: relative;
    }
    .flash {
      position: absolute;
      inset: -4px -8px;
      pointer-events: none;
      border-radius: 8px;
      animation: zwFlash 1.4s ease-out both;
    }
    .flash--row {
      inset: 0 -8px;
    }
    .flash--wide {
      inset: -6px -10px;
    }
    /* Success */
    .done {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
      padding-top: var(--space-6);
      text-align: center;
    }
    .done__text {
      align-items: center;
      max-width: 440px;
    }
    .done__acts {
      justify-content: center;
    }
    .check {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--green-text);
      border: 2px solid var(--green-text);
      border-radius: var(--radius-1);
      animation: zwDim 0.2s linear both;
    }
    .check svg {
      width: 36px;
      height: 36px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: square;
    }
    .check path {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: zwDraw 0.45s ease-out 0.15s forwards;
    }
    .card {
      width: 100%;
      max-width: 280px;
      padding-bottom: var(--space-12);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      text-align: left;
    }
    .card__photo::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        115deg,
        transparent 30%,
        rgba(255, 255, 255, 0.75) 50%,
        rgba(170, 210, 255, 0.4) 56%,
        transparent 70%
      );
      background-size: 260% 100%;
      animation: zwShimmer 1.2s ease-out 0.5s both;
    }
    /* Small screens: photo and question first; the preview would push them off the screen. */
    @media (max-width: 900px) {
      .aside {
        display: none;
      }
      .bar__in,
      .main {
        gap: var(--space-4);
        padding-left: var(--space-4);
        padding-right: var(--space-4);
      }
      .bar .strong,
      .bar__in > .bar__step:not(.close) {
        display: none;
      }
      .q {
        font-size: 26px;
        line-height: 30px;
        overflow-wrap: anywhere;
      }
      .col {
        flex-basis: 100%;
      }
      .foot2 .file {
        flex: 1 1 100%;
        justify-content: center;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .flash,
      .check,
      .check path,
      .card__photo::after {
        animation: none;
      }
      .check path {
        stroke-dashoffset: 0;
      }
      .flash {
        display: none;
      }
      .progress > div {
        transition: none;
      }
    }
    @keyframes zwDim {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes zwShimmer {
      0% {
        background-position: 160% 0;
        opacity: 1;
      }
      100% {
        background-position: -60% 0;
        opacity: 0;
      }
    }
    @keyframes zwFlash {
      0% {
        opacity: 0;
        background: rgba(160, 200, 255, 0);
        box-shadow: none;
      }
      25% {
        opacity: 1;
        background: rgba(170, 205, 255, 0.28);
        box-shadow:
          0 0 0 1px rgba(106, 149, 255, 0.5),
          0 0 22px rgba(106, 149, 255, 0.45);
      }
      100% {
        opacity: 0;
        background: rgba(160, 200, 255, 0);
        box-shadow: none;
      }
    }
    @keyframes zwDraw {
      to {
        stroke-dashoffset: 0;
      }
    }
    .page-head {
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .page-head > div,
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding-left: var(--space-6);
      padding-right: var(--space-6);
    }
    .page-head > div {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      min-height: 72px;
    }
    .page-head .zw-link {
      margin-left: auto;
    }
    .page {
      padding-top: var(--space-4);
      padding-bottom: var(--space-12);
    }
    .sec:last-of-type {
      border-bottom: 0;
    }
    .full-foot {
      padding-top: var(--space-6);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .close {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: -12px;
      color: var(--ink);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .strong {
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .foot > :first-child + * {
      margin-left: auto;
    }
    .link--muted {
      color: var(--ink-muted);
    }
    .shoot:focus-within,
    .add:focus-within,
    .file:focus-within {
      outline: var(--border-2) solid var(--focus);
      outline-offset: 2px;
    }
    .shots {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
    @media (min-width: 480px) {
      .shots {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
    }
    .shot {
      display: block;
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      background: var(--bg-100);
    }
    .shot--out {
      opacity: 0.4;
    }
    .add {
      aspect-ratio: 1 / 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      border: var(--border-1) solid var(--line);
      border-radius: var(--radius-1);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .fact {
      display: grid;
      grid-template-columns: minmax(0, 8rem) minmax(0, 1fr);
      gap: var(--space-1) var(--space-3);
      align-items: center;
      padding: var(--space-2) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .fact > :nth-child(n + 3) {
      grid-column: 2;
    }
    .fact__acts {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      font-size: 14px;
    }
    .two {
      display: grid;
      gap: var(--space-4);
    }
    @media (min-width: 480px) {
      .two {
        grid-template-columns: 8rem minmax(0, 1fr);
      }
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-8) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 8px);
    }
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly stream = inject(DraftStream);
  private readonly places = inject(PlacesService);
  private readonly banner = inject(ErrorBanner);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly store = inject(DraftStore);
  protected readonly restored = signal(false);
  // the fact a photo answer did not show; its question comes back with a hint
  protected readonly missed = signal<string | null>(null);
  protected readonly missedText = computed(() => {
    const fact = this.missed();
    return fact
      ? this.i18n.t(
          'Auf diesem Foto konnten wir es nicht lesen. Geh näher ran oder gib es selbst ein.',
        )
      : '';
  });
  // after a photo answered a photo question: what was read from it, shown before the next question
  protected readonly readFact = signal<{ fact: string; value: string } | null>(null);
  protected readonly published = signal<{
    id: number;
    title: string;
    price: number;
    photo?: string;
    meta: string;
  } | null>(null);
  // the price range on screen; moves smoothly to a new estimate (e.g. after the model is confirmed)
  protected readonly shownEstimate = signal<PriceEstimate | null>(null);
  protected readonly noEstimate = computed(() => this.shownEstimate()?.midChf == null);
  // bumped when the range moves, so the highlight plays again
  protected readonly priceRun = signal(0);

  protected close(): void {
    void this.router.navigate([{ outlets: { modal: null } }]);
  }

  protected openListing(id: number): void {
    void this.router.navigate([{ outlets: { primary: ['listings', id], modal: null } }]);
  }

  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly steps = STEPS;
  protected readonly markers = MARKERS;
  protected readonly conditions = CONDITIONS;
  protected readonly conditionGap = CONDITION;
  protected readonly categories = toSignal(inject(ListingsService).categories(), {
    initialValue: [],
  });
  protected readonly view = signal<'steps' | 'full'>('steps');
  protected readonly step = signal(1);
  protected readonly photos = signal<SellPhoto[]>([]);
  protected readonly shownPhoto = signal(0);
  protected readonly busy = signal(false);
  protected readonly dragging = signal(false);
  protected readonly locating = signal(false);
  protected readonly locationNote = signal('');
  protected readonly analyzing = signal(false);
  protected readonly streamFailed = signal(false);
  protected readonly detections = signal<Detection[]>([]);
  protected readonly privacyMarks = signal<PrivacyMark[]>([]);
  protected readonly aiGaps = signal<Gap[]>([]);
  // step 1 walks through the open gaps until the seller is done or skips to the overview
  protected readonly gapsActive = signal(false);
  protected readonly skipped = signal(new Set<string>());
  protected readonly answered = signal(0);
  protected readonly typing = signal(false);
  protected readonly draftAnswer = signal('');
  protected readonly draft = signal<ListingDraft | null>(null);
  protected readonly fields = signal<Record<Field, string>>({
    title: '',
    category: 'Computers',
    condition: '',
    description: '',
  });
  protected readonly facts = signal<Fact[]>([]);
  protected readonly labelFacts = computed(() =>
    this.facts().filter((f) => f.source === 'LABEL' && f.value.trim()),
  );
  protected readonly lookingUp = signal(false);
  protected readonly webNote = signal('');
  protected readonly rewriting = signal(false);
  // 0-based indexes of photos the seller leaves out of the listing
  protected readonly excluded = signal(new Set<number>());
  protected readonly keyFacts = computed(
    () => this.categories().find((c) => c.name === this.fields().category)?.keyFacts ?? [],
  );
  // at most MAX_CARDS questions per round, so "Noch N Fragen" goes down with every answer
  protected readonly cards = computed(() =>
    openGaps(
      this.keyFacts(),
      this.facts(),
      this.fields().condition,
      this.aiGaps(),
      this.skipped(),
      MAX_CARDS - this.answered(),
    ),
  );
  protected readonly currentCard = computed<GapCard | undefined>(() =>
    this.gapsActive() ? this.cards()[0] : undefined,
  );
  protected readonly percentComplete = computed(() =>
    Math.round(completeness(this.keyFacts(), this.facts()) * 100),
  );
  protected readonly openNames = computed(() =>
    [...new Set([...this.cards().map((c) => c.fact), ...this.skipped()])]
      .map((name) => this.i18n.t(name))
      .join(', '),
  );
  protected readonly photoIdsToPublish = computed(() =>
    (this.draft()?.photoIds ?? []).filter((_, i) => !this.excluded().has(i)),
  );
  protected readonly previewPhoto = computed(
    () => this.photos().find((_, i) => !this.excluded().has(i))?.url,
  );
  protected readonly conditionLabel = computed(() =>
    this.i18n.t(CONDITIONS.find((c) => c.value === this.fields().condition)?.label ?? ''),
  );
  protected readonly canLookUp = computed(() =>
    this.facts().some(
      (f) =>
        f.name === 'Model' && f.value.trim() && (f.source === 'LABEL' || f.source === 'SELLER'),
    ),
  );
  protected readonly price = signal<number | null>(null);
  protected readonly postcode = signal(lastLocation().postcode);
  protected readonly locality = signal(lastLocation().locality);
  protected readonly canContinue = computed(() => {
    switch (this.step()) {
      case 1:
        return !!this.draft() && !this.busy() && !this.analyzing();
      case 3:
        return this.price() !== null && this.price()! > 0;
      default:
        return true;
    }
  });
  protected readonly progress = computed(() => {
    if (this.published()) return 100;
    const step = this.step();
    if (step === 1) return this.draft() && !this.analyzing() ? 30 : this.photos().length ? 15 : 0;
    if (step === 2) {
      const total = this.answered() + this.cards().length;
      return 42 + Math.round((23 * this.answered()) / Math.max(1, total));
    }
    return step === 3 ? 82 : 94;
  });
  protected readonly remaining = computed(() => {
    const n = this.cards().length;
    if (this.step() > 2) return this.i18n.t('Fast fertig');
    return n === 0
      ? ''
      : n === 1
        ? this.i18n.t('Noch 1 Frage')
        : this.i18n.t('Noch {n} Fragen', { n });
  });
  protected readonly analyzeStatus = computed(() => {
    if (this.busy()) return this.i18n.t('Foto wird hochgeladen…');
    if (this.analyzing())
      return this.i18n.t(this.detections().length ? 'Erkannt wird…' : 'Foto wird ausgewertet…');
    return '';
  });
  /** What the stage shows: which photo, whether it is still being scanned, and the boxes on it. */
  protected readonly stage = computed(() => {
    const card = this.currentCard();
    const last = this.photos().length - 1;
    const waiting = this.busy() || this.analyzing();
    const asking = this.step() === 2 && !waiting && !this.readFact();
    const hint = asking ? card?.hint : undefined;
    // a question about something already seen shows that detection
    const seen =
      asking && card && !hint
        ? this.detections().find((d) => d.fact?.name === card.fact)
        : undefined;
    // the newest photo while it is analysed or read; otherwise the main photo, not a close-up
    const index = hint
      ? hint.photo - 1
      : seen
        ? (seen.photo ?? 1) - 1
        : this.step() === 2
          ? asking
            ? 0
            : last
          : this.shownPhoto();
    const marks: StageMark[] = seen
      ? [{ box: seen.box ?? [], label: seen.label ?? '', kind: 'detect' }]
      : hint
        ? [
            {
              box: hint.box,
              label: this.i18n.t('{name} hier', { name: this.i18n.t(card!.fact) }),
              kind: 'hint',
            },
          ]
        : asking
          ? []
          : this.marksOn(index + 1).map((m) => ({ ...m, kind: m.privacy ? 'privacy' : 'detect' }));
    return {
      index,
      photo: this.photos()[index],
      scanning: waiting && !marks.length,
      marks,
      compact: asking && !!card && card.kind !== 'PHOTO',
      // the camera button sits on the photo where the detail is; without a box it stays in the footer
      capture: !!hint && this.photos().length < this.maxPhotos,
    };
  });
  protected readonly asideTitle = computed(() =>
    this.draft() ? this.fields().title : this.i18n.t('Wird aus dem Foto erkannt'),
  );
  protected readonly asideMeta = computed(() =>
    this.draft()
      ? [this.conditionLabel(), this.locality()].filter(Boolean).join(' · ')
      : this.i18n.t('Zustand und Ort folgen'),
  );
  /** The live preview's facts: category, the category's key facts, condition and handover. */
  protected readonly asideFacts = computed(() => {
    if (!this.draft()) return [];
    const t = (key: string) => this.i18n.t(key);
    const rows = [{ name: t('Kategorie'), value: t(this.fields().category), muted: false }];
    for (const name of this.keyFacts()) {
      const fact = this.facts().find((f) => f.name === name && f.value.trim());
      const guess = fact && (fact.source === 'SUGGESTION' || fact.source === 'WEB');
      // only confirmed facts are published: a guess says so
      if (fact)
        rows.push({
          name: t(name),
          value: guess ? `${fact.value} · ${t('Vorschlag')}` : fact.value,
          muted: !!guess,
        });
      else if (this.skipped().has(name))
        rows.push({ name: t(name), value: t('nicht bestätigt'), muted: true });
    }
    if (this.fields().condition)
      rows.push({ name: t('Zustand'), value: this.conditionLabel(), muted: false });
    if (this.step() === 4 && this.postcode())
      rows.push({
        name: t('Übergabe'),
        value: `${this.postcode()} ${this.locality()}`.trim(),
        muted: false,
      });
    return rows;
  });
  // fields the seller typed in keep their value when the draft is re-run
  private readonly sellerFields = new Set<Field>();
  // the state worth keeping: only a finished analysis, never one in flight
  private readonly snapshot = computed((): Omit<SavedDraft, 'savedAt'> | null => {
    const draft = this.draft();
    if (!draft || this.busy() || this.analyzing()) return null;
    return {
      photos: this.photos().map(({ file, id }) => ({ file, id })),
      draft,
      fields: this.fields(),
      sellerFields: [...this.sellerFields],
      facts: this.facts(),
      aiGaps: this.aiGaps(),
      skipped: [...this.skipped()],
      answered: this.answered(),
      gapsActive: this.gapsActive(),
      step: this.step(),
      view: this.view(),
      excluded: [...this.excluded()],
      price: this.price(),
      postcode: this.postcode(),
      locality: this.locality(),
      detections: this.detections(),
      privacyMarks: this.privacyMarks(),
    };
  });

  constructor() {
    // The page behind the dialog must not scroll.
    const body = inject(DOCUMENT).body;
    body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => (body.style.overflow = ''));
    void this.store.load<SavedDraft>().then((saved) => {
      if (!saved || this.draft()) return;
      if (Date.now() - saved.savedAt > DRAFT_MAX_AGE_MS) void this.store.clear();
      else this.restore(saved);
    });
    effect(() => {
      const snapshot = this.snapshot();
      if (snapshot) void this.store.save({ ...snapshot, savedAt: Date.now() });
    });
    effect(() => this.moveEstimate(this.draft()?.price ?? null));
    // every step and the success screen start at the top
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // "Selbst eingeben" / "Ändern" puts the cursor into the answer field
    effect(() => {
      if (this.typing())
        setTimeout(() => host.querySelector<HTMLInputElement>('#gap-answer')?.focus());
    });
    effect(() => {
      this.step();
      this.published();
      this.readFact();
      this.answered();
      host.scrollTop = 0;
      this.typing.set(false);
      this.confirmRestart.set(false);
    });
  }

  private frame = 0;

  /** Shows a new estimate; an updated range glides from the old numbers to the new ones. */
  private moveEstimate(to: PriceEstimate | null): void {
    const from = untracked(this.shownEstimate);
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    const still =
      typeof requestAnimationFrame !== 'function' ||
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!to || !from || from.midChf == null || to.midChf == null || still) {
      this.shownEstimate.set(to);
      return;
    }
    if (from.lowChf === to.lowChf && from.midChf === to.midChf && from.highChf === to.highChf) {
      this.shownEstimate.set(to);
      return;
    }
    this.priceRun.update((n) => n + 1);
    const start = performance.now();
    const lerp = (a: number | null | undefined, b: number | null | undefined, k: number) =>
      a == null || b == null ? b : Math.round(a + (b - a) * k);
    const tick = (now: number) => {
      const k = 1 - Math.pow(1 - Math.min(1, (now - start) / 900), 3);
      this.shownEstimate.set({
        ...to,
        lowChf: lerp(from.lowChf, to.lowChf, k),
        midChf: lerp(from.midChf, to.midChf, k),
        highChf: lerp(from.highChf, to.highChf, k),
      });
      if (k < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private restore(saved: SavedDraft): void {
    this.photos.set(saved.photos.map((p) => ({ ...p, url: URL.createObjectURL(p.file) })));
    this.draft.set(saved.draft);
    this.fields.set(saved.fields);
    saved.sellerFields.forEach((field) => this.sellerFields.add(field));
    this.facts.set(saved.facts);
    this.aiGaps.set(saved.aiGaps);
    this.skipped.set(new Set(saved.skipped));
    this.answered.set(saved.answered);
    this.gapsActive.set(saved.gapsActive);
    this.step.set(saved.step);
    this.view.set(saved.view);
    this.excluded.set(new Set(saved.excluded));
    this.price.set(saved.price);
    this.postcode.set(saved.postcode);
    this.locality.set(saved.locality);
    this.detections.set(saved.detections);
    this.privacyMarks.set(saved.privacyMarks);
    this.restored.set(true);
  }

  // "Neu beginnen" asks once more before it throws the draft away
  protected readonly confirmRestart = signal(false);

  protected restart(): void {
    if (this.confirmRestart()) void this.startOver();
    else this.confirmRestart.set(true);
  }

  /** The question as shown: the AI's wording, or phrased here from the (translated) fact name. */
  protected cardTitle(card: GapCard): string {
    const name = this.i18n.t(card.fact);
    if (card.kind === 'CONFIRM')
      return this.i18n.t('{name}: {value} – stimmt das?', { name, value: card.value ?? '' });
    // typing instead of photographing: ask for the value, not for a photo
    if (card.kind === 'PHOTO' && this.typing()) return this.i18n.t('{name}?', { name });
    if (card.prompt) return /[.?!]$/.test(card.prompt) ? card.prompt : card.prompt + '.';
    if (card.fact === CONDITION) return this.i18n.t('In welchem Zustand ist er?');
    return this.i18n.t('{name}?', { name });
  }

  /** Forgets the saved draft and starts with an empty page. */
  protected async startOver(): Promise<void> {
    await this.store.clear();
    // shortcut: a reload resets every signal at once; replace with a reset method if reloads hurt
    location.reload();
  }
  // only the latest rewrite may change the text
  private rewriteRun = 0;
  // an answered question changed facts: rewrite title, description and price once the questions are done
  private textStale = false;

  protected next(): void {
    if (!this.canContinue()) return;
    this.restored.set(false);
    if (this.step() === 1) {
      if (this.cards().length) {
        this.step.set(2);
        this.gapsActive.set(true);
      } else this.finishGaps();
    } else this.step.update((s) => Math.min(STEPS, s + 1));
  }

  protected back(): void {
    this.restored.set(false);
    if (this.step() === 3 && this.cards().length) {
      this.step.set(2);
      this.gapsActive.set(true);
    } else if (this.step() === 3) this.step.set(1);
    else this.step.update((s) => Math.max(1, s - 1));
  }

  /** After the "read" moment of a photo question: on to the next question, or the price. */
  protected continueAfterRead(): void {
    // the seller saw the value read from their photo and went on: it counts as confirmed
    const read = this.readFact();
    if (read)
      this.facts.update((facts) =>
        facts.map((f) => (f.name === read.fact ? { ...f, source: 'SELLER' } : f)),
      );
    this.readFact.set(null);
    if (!this.cards().length) this.finishGaps();
  }

  protected marksOn(photo: number): { box: number[]; label: string; privacy: boolean }[] {
    return [
      ...this.detections()
        .filter((d) => d.photo === photo)
        .map((d) => ({ box: d.box ?? [], label: d.label ?? '', privacy: false })),
      ...this.privacyMarks()
        .filter((p) => p.photo === photo)
        .map((p) => ({
          box: p.box ?? [],
          label: this.i18n.t('Privat – lieber weglassen'),
          privacy: true,
        })),
    ];
  }

  protected addPhotos(input: HTMLInputElement, upload = false): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.addFiles(files, upload);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []), !!this.draft());
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []).filter(isImage);
    if (!files.length) return;
    event.preventDefault();
    this.addFiles(files, !!this.draft());
  }

  /** Adds image files up to the limit; with a draft they are uploaded and analysed right away. */
  private addFiles(all: File[], upload: boolean): void {
    const files = all.filter(isImage).slice(0, MAX_PHOTOS - this.photos().length);
    if (!files.length) return;
    this.photos.update((photos) => [
      ...photos,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    if (upload) this.analyse();
  }

  protected removePhoto(index: number): void {
    URL.revokeObjectURL(this.photos()[index].url);
    this.photos.update((photos) => photos.filter((_, i) => i !== index));
  }

  /** Uploads the photos that have no id yet, then streams the draft. */
  protected analyse(): void {
    if (!this.photos().length || this.busy() || this.analyzing()) return;
    const fresh = this.photos().filter((p) => p.id === undefined);
    if (!fresh.length) {
      void this.runStream();
      return;
    }
    this.busy.set(true);
    this.api.uploadPhotos({ body: { photos: fresh.map((p) => p.file) } }).subscribe({
      next: (ids) => {
        let next = 0;
        this.photos.update((photos) =>
          photos.map((p) => (p.id === undefined ? { ...p, id: ids[next++] } : p)),
        );
        this.busy.set(false);
        void this.runStream();
      },
      // the banner says why; the rejected photos go, so the seller can add others
      error: () => {
        fresh.forEach((p) => URL.revokeObjectURL(p.url));
        this.photos.update((photos) => photos.filter((p) => p.id !== undefined));
        this.busy.set(false);
      },
    });
  }

  protected async runStream(): Promise<void> {
    const hadDraft = !!this.draft();
    const photoGap = this.currentCard();
    // what the seller is answering with this photo, and what was known about it before
    this.asked = photoGap?.fact ?? null;
    const before = this.facts().find((f) => f.name === this.asked);
    this.analyzing.set(true);
    this.streamFailed.set(false);
    this.detections.set([]);
    this.privacyMarks.set([]);
    this.pendingGaps = [];
    this.missed.set(null);
    let drafted = false;
    try {
      await this.stream.run(
        {
          photoIds: this.photos().map((p) => p.id!),
          language: this.i18n.lang(),
          // read from a label or given by the seller: known, the AI must not ask again
          confirmedFacts: this.facts()
            .filter((f) => (f.source === 'SELLER' || f.source === 'LABEL') && f.value.trim())
            .map((f) => ({ name: f.name, value: f.value.trim() })),
        },
        (event) => {
          if (this.onEvent(event)) drafted = true;
        },
      );
    } catch (error) {
      this.banner.show(
        error instanceof Error
          ? translateError(error.message, this.i18n)
          : this.i18n.t('Der Server ist nicht erreichbar.'),
      );
    }
    this.analyzing.set(false);
    if (drafted || hadDraft) {
      // a failed re-run keeps the previous draft; the photo card counts as skipped
      if (!drafted && photoGap) this.skip(photoGap);
      // any new value the answer photo gave for the asked fact counts as read, also as a guess
      const now = photoGap && this.facts().find((f) => f.name === photoGap.fact && f.value.trim());
      const read =
        now &&
        (!before ||
          before.value !== now.value ||
          (now.source === 'LABEL' && before.source !== 'LABEL'))
          ? now
          : undefined;
      if (drafted && read && this.step() === 2) {
        this.readFact.set({ fact: read.name, value: read.value });
        this.answered.update((n) => n + 1);
        if (read.name === 'Brand' || read.name === 'Model') this.rewriteText();
        else this.textStale = true;
      } else if (drafted && photoGap && this.step() === 2) {
        // the photo did not show it: same question again, with a hint why
        this.missed.set(photoGap.fact);
      } else if (this.step() === 2 && !this.cards().length) this.finishGaps();
    } else {
      this.streamFailed.set(true);
    }
  }

  /** Applies one stream event; true when it was the draft. */
  private onEvent(event: DraftEvent): boolean {
    switch (event.type) {
      case 'DETECTION':
        this.detections.update((all) => [
          ...all,
          { ...event.detection!, label: swiss(event.detection!.label) },
        ]);
        this.shownPhoto.set((event.detection!.photo ?? 1) - 1);
        return false;
      case 'PRIVACY':
        this.privacyMarks.update((all) => [
          ...all,
          { ...event.privacy!, text: swiss(event.privacy!.text) },
        ]);
        return false;
      case 'GAP':
        this.pendingGaps.push({
          ...event.gap!,
          prompt: swiss(event.gap!.prompt),
          options: event.gap!.options?.map(swiss),
        });
        return false;
      case 'DRAFT':
        this.aiGaps.set(this.draft() ? this.mergeGaps(this.pendingGaps) : this.pendingGaps);
        if (this.draft()) this.mergeDraft(event.draft!);
        else this.applyDraft(event.draft!);
        return true;
      case 'ERROR':
        this.banner.show(event.detail ?? this.i18n.t('Der Entwurf konnte nicht erstellt werden.'));
        return false;
      default:
        return false;
    }
  }

  private pendingGaps: Gap[] = [];

  /** Questions of a later run keep the wording of the first one; questions it left out stay. */
  private mergeGaps(fresh: Gap[]): Gap[] {
    const before = this.aiGaps();
    const kept = fresh.map((gap) => {
      const old = before.find((o) => o.fact === gap.fact);
      return old
        ? { ...gap, prompt: old.prompt, options: old.options?.length ? old.options : gap.options }
        : gap;
    });
    return [...kept, ...before.filter((o) => !fresh.some((g) => g.fact === o.fact))];
  }

  /**
   * A later run (after a photo answer) only adds: new facts, a label reading that replaces a guess, a
   * condition if none was known, the new photo ids. Title and description stay; the AI rewrites them.
   */
  private asked: string | null = null;

  private mergeDraft(raw: ListingDraft): void {
    const next = this.swissDraft(raw);
    this.draft.update((old) => ({
      ...old!,
      photoIds: next.photoIds,
      privacyWarnings: next.privacyWarnings,
    }));
    if (next.condition && !this.fields().condition)
      this.fields.update((fields) => ({ ...fields, condition: next.condition! }));
    this.facts.update((facts) => {
      const merged = [...facts];
      for (const f of next.facts ?? []) {
        if (!f.name || !f.value?.trim()) continue;
        const i = merged.findIndex((m) => m.name === f.name);
        const fact: Fact = { name: f.name, value: f.value, source: f.source ?? 'SUGGESTION' };
        const mine = i >= 0 && merged[i].source === 'SELLER';
        if (i < 0) merged.push(fact);
        // the fact the seller just photographed takes the new reading; elsewhere only a label beats a guess
        else if (
          !mine &&
          (f.name === this.asked || (fact.source === 'LABEL' && merged[i].source !== 'LABEL'))
        )
          merged[i] = fact;
      }
      return merged;
    });
  }

  private swissDraft(raw: ListingDraft): ListingDraft {
    return {
      ...raw,
      title: swiss(raw.title),
      description: swiss(raw.description),
      facts: raw.facts?.map((f) => ({ ...f, value: swiss(f.value) })),
    };
  }

  private applyDraft(raw: ListingDraft): void {
    // Swiss spelling: the AI sometimes writes ß
    const draft = this.swissDraft(raw);
    this.draft.set(draft);
    this.fields.update((fields) => {
      const next = { ...fields };
      for (const key of ['title', 'category', 'condition', 'description'] as const) {
        // a draft without condition clears an earlier suggestion: the seller has to choose
        const value = draft[key] ?? '';
        if ((value || key === 'condition') && !this.sellerFields.has(key)) next[key] = value;
      }
      return next;
    });
    const confirmed = this.facts().filter((f) => f.source === 'SELLER');
    const fresh = (draft.facts ?? [])
      .filter((f) => f.name && !confirmed.some((c) => c.name === f.name))
      .map((f) => ({
        name: f.name!,
        value: f.value ?? '',
        source: f.source ?? 'SUGGESTION',
        sourceUrl: f.sourceUrl,
      }));
    this.facts.set([...confirmed, ...fresh]);
  }

  protected answer(card: GapCard, value: string): void {
    if (card.fact === CONDITION) {
      this.textStale ||= this.fields().condition !== value;
      this.setField('condition', value);
    } else {
      const fact: Fact = { name: card.fact, value: value.trim(), source: 'SELLER' };
      const before = this.facts().find((f) => f.name === card.fact);
      const changed = before?.value !== fact.value;
      this.facts.update((facts) =>
        facts.some((f) => f.name === card.fact)
          ? facts.map((f) => (f.name === card.fact ? fact : f))
          : [fact, ...facts],
      );
      // brand and model change what the item is: title and price follow right away (also a confirmed guess), the rest at the end
      const identity = card.fact === 'Brand' || card.fact === 'Model';
      if (identity && (changed || before?.source !== 'SELLER')) this.rewriteText();
      else this.textStale ||= changed;
    }
    this.nextCard();
  }

  protected skip(card: GapCard): void {
    this.skipped.update((set) => new Set(set).add(card.fact));
    this.nextCard();
  }

  private nextCard(): void {
    this.restored.set(false);
    this.missed.set(null);
    this.answered.update((n) => n + 1);
    this.typing.set(false);
    this.draftAnswer.set('');
    if (this.step() === 2 && !this.cards().length) this.finishGaps();
  }

  protected finishGaps(): void {
    this.gapsActive.set(false);
    this.readFact.set(null);
    this.step.set(3);
    if (this.textStale) this.rewriteText();
  }

  protected answerOpenPoints(): void {
    this.skipped.set(new Set());
    this.answered.set(0);
    this.view.set('steps');
    this.step.set(this.cards().length ? 2 : 1);
    this.gapsActive.set(true);
  }

  /** Lets the AI fit title, description and price to changed facts; text the seller wrote stays. */
  protected rewriteText(): void {
    const { title, description, category, condition } = this.fields();
    if (!this.draft()) return;
    this.textStale = false;
    const run = ++this.rewriteRun;
    this.rewriting.set(true);
    const facts = this.facts()
      .filter((f) => f.value.trim())
      .map((f) => ({ name: f.name, value: f.value.trim(), source: f.source }));
    this.api
      .rewriteText(
        {
          body: {
            category,
            title,
            description,
            facts,
            condition: (condition || null) as Condition,
            language: this.i18n.lang(),
          },
        },
        // a failed rewrite keeps the current text
        new HttpContext().set(HANDLES_ERRORS, true),
      )
      .subscribe({
        next: (text) => {
          if (run !== this.rewriteRun) return;
          this.fields.update((fields) => ({
            ...fields,
            title: this.sellerFields.has('title')
              ? fields.title
              : swiss(text.title) || fields.title,
            description: this.sellerFields.has('description')
              ? fields.description
              : swiss(text.description) || fields.description,
          }));
          if (text.price) this.draft.update((draft) => draft && { ...draft, price: text.price });
          this.rewriting.set(false);
        },
        error: () => {
          if (run === this.rewriteRun) this.rewriting.set(false);
        },
      });
  }

  protected setField(field: Field, value: string): void {
    this.sellerFields.add(field);
    this.fields.update((fields) => ({ ...fields, [field]: value }));
  }

  protected editFact(index: number, value: string): void {
    this.facts.update((facts) =>
      facts.map((f, i) => (i === index ? { ...f, value, source: 'SELLER' } : f)),
    );
  }

  protected confirmFact(index: number): void {
    this.editFact(index, this.facts()[index].value);
  }

  protected toggleExcluded(index: number): void {
    this.excluded.update((set) => {
      const next = new Set(set);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  /** Fills postcode and locality from the device position; both stay editable. */
  protected async useMyLocation(): Promise<void> {
    if (this.locating()) return;
    this.locating.set(true);
    this.locationNote.set('');
    const position = await devicePosition();
    if (!position) {
      this.locating.set(false);
      this.locationNote.set(
        'Standort nicht verfügbar. Gib die PLZ ein oder erlaube den Standortzugriff.',
      );
      return;
    }
    this.places.near(position, new HttpContext().set(HANDLES_ERRORS, true)).subscribe({
      next: (place) => {
        this.postcode.set(place.postcode ?? '');
        this.locality.set(place.locality ?? '');
        this.locating.set(false);
      },
      error: () => {
        this.locationNote.set('An deinem Standort finden wir keine Schweizer PLZ.');
        this.locating.set(false);
      },
    });
  }

  /** A complete postcode fills in its locality; the seller can still change the locality. */
  protected setPostcode(postcode: string): void {
    this.postcode.set(postcode);
    if (!/^\d{4}$/.test(postcode)) return;
    this.places.place({ postcode }, new HttpContext().set(HANDLES_ERRORS, true)).subscribe({
      next: (place) => {
        if (this.postcode() === postcode && place.locality) this.locality.set(place.locality);
      },
      // an unknown postcode leaves the locality as the seller typed it
      error: () => undefined,
    });
  }

  protected completeFacts(): void {
    if (!this.canLookUp() || this.lookingUp()) return;
    this.lookingUp.set(true);
    this.webNote.set('');
    const facts = this.facts()
      .filter((f) => f.value.trim())
      .map((f) => ({ name: f.name, value: f.value.trim(), source: f.source }));
    const { title, category } = this.fields();
    this.api.completeFacts({ body: { title: title.trim(), category, facts } }).subscribe({
      next: (found) => {
        const fresh = found
          .filter((f) => f.name && !this.facts().some((known) => known.name === f.name))
          .map((f) => ({
            name: f.name!,
            value: f.value ?? '',
            source: 'WEB' as const,
            sourceUrl: f.sourceUrl,
          }));
        this.facts.update((all) => [...all, ...fresh]);
        if (!fresh.length)
          this.webNote.set('Im Web nichts Verlässliches zu diesem Modell gefunden.');
        this.lookingUp.set(false);
      },
      error: () => this.lookingUp.set(false),
    });
  }

  protected removeFact(index: number): void {
    this.facts.update((facts) => facts.filter((_, i) => i !== index));
  }

  protected publish(event: Event): void {
    event.preventDefault();
    // Enter inside a wizard step means "Weiter", never publish
    if (this.view() === 'steps' && this.step() < STEPS) return this.next();
    if (!this.fields().condition) return;
    const draft = this.draft();
    const price = this.price();
    const fields = this.fields();
    if (!draft || price === null || !fields.condition || this.busy()) return;
    const body: CreateListingRequest = {
      title: fields.title.trim(),
      description: fields.description.trim(),
      category: fields.category,
      condition: fields.condition as Condition,
      priceChf: price,
      postcode: this.postcode(),
      locality: this.locality().trim(),
      attributes: Object.fromEntries(
        this.facts()
          .filter((f) => f.source !== 'SUGGESTION' && f.source !== 'WEB' && f.value.trim())
          .map((f) => [f.name, f.value.trim()]),
      ),
      photoIds: this.photoIdsToPublish(),
    };
    this.busy.set(true);
    this.api.publish({ body }).subscribe({
      next: (listing) => {
        void this.store.clear();
        saveLastLocation(body.postcode, body.locality);
        this.busy.set(false);
        // the success screen lives in the step view, also when published from the one-page form
        this.view.set('steps');
        this.published.set({
          id: listing.id!,
          title: body.title,
          price: body.priceChf,
          photo: this.previewPhoto(),
          meta: [this.conditionLabel(), body.locality].filter(Boolean).join(' · '),
        });
      },
      error: () => this.busy.set(false),
    });
  }
}

/** Swiss spelling for AI text: ss, never ß. */
function swiss(text: string | null | undefined): string {
  return (text ?? '').replaceAll('ß', 'ss');
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

function lastLocation(): { postcode: string; locality: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_LOCATION) ?? '{}');
    return { postcode: saved.postcode ?? '', locality: saved.locality ?? '' };
  } catch {
    return { postcode: '', locality: '' };
  }
}

function saveLastLocation(postcode: string, locality: string): void {
  try {
    localStorage.setItem(LAST_LOCATION, JSON.stringify({ postcode, locality }));
  } catch {
    // private mode or blocked storage: no default next time
  }
}
