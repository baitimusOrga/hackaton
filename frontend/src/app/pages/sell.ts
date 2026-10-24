import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  PrivacyMark,
} from '../api/models';
import { PricePanel } from '../components/price-panel';
import { Condition, CONDITION_LABELS } from '../conditions';
import { DraftStream } from '../draft-stream';
import { ErrorBanner, HANDLES_ERRORS, translateError } from '../errors';
import { CONDITION, GapCard, KnownFact, completeness, openGaps } from '../gaps';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';
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
const STEPS = 5;
// per-browser default for the next listing
const LAST_LOCATION = 'sell.lastLocation';
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
 * Sell wizard (Sell1–Sell5) and the one-page form (SellFull); both views share the same signals.
 * Step 1 streams the AI's detections onto the photos, then asks for what is missing, one card at a time.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sell',
  imports: [NgTemplateOutlet, RouterLink, PricePanel, Button, ChfPipe, Icon, TranslatePipe],
  templateUrl: './sell.html',
  styles: `
    .dlg {
      max-width: 600px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6) var(--space-8);
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
      background: var(--bg-000);
      border: var(--border-1) solid var(--line-soft);
      border-radius: var(--radius-1);
    }
    .dlg--full {
      max-width: 760px;
      gap: 0;
    }
    @media (min-width: 720px) {
      .dlg {
        padding: var(--space-8) 40px 40px;
      }
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    .top .zw-btn {
      margin-left: auto;
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
    .q--sm {
      font-size: 24px;
      line-height: 28px;
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
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-6);
      background: var(--bg-100);
      border-radius: var(--radius-1);
      text-align: center;
      cursor: pointer;
    }
    .drop:focus-within,
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
    .thumb {
      width: 96px;
      height: 96px;
      flex: none;
      object-fit: cover;
      background: var(--bg-100);
    }
    .head {
      display: flex;
      gap: 20px;
      align-items: center;
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
    .preview {
      display: flex;
      gap: var(--space-4);
      align-items: center;
      padding: var(--space-4);
      background: var(--bg-100);
    }
    .preview img {
      width: 72px;
      height: 72px;
      flex: none;
      object-fit: cover;
    }
    .preview__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .ellipsis {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-8) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .scan {
      position: relative;
    }
    .scan img {
      width: 100%;
      border-radius: var(--radius-1);
    }
    .mark {
      position: absolute;
      border: 2px solid var(--accent, #0f766e);
      border-radius: 4px;
    }
    .mark--privacy {
      border-color: var(--danger, #be123c);
    }
    .mark span {
      position: absolute;
      bottom: 100%;
      left: 0;
      white-space: nowrap;
      background: var(--bg-000);
      padding: 0 var(--space-1, 4px);
      font-size: 0.8125rem;
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
  protected readonly cards = computed(() =>
    openGaps(this.keyFacts(), this.facts(), this.fields().condition, this.aiGaps(), this.skipped()),
  );
  protected readonly currentCard = computed<GapCard | undefined>(() =>
    this.gapsActive() ? this.cards()[0] : undefined,
  );
  protected readonly percentComplete = computed(() =>
    Math.round(completeness(this.keyFacts(), this.facts()) * 100),
  );
  protected readonly openNames = computed(() =>
    [...new Set([...this.cards().map((c) => c.fact), ...this.skipped()])].join(', '),
  );
  protected readonly photoIdsToPublish = computed(() =>
    (this.draft()?.photoIds ?? []).filter((_, i) => !this.excluded().has(i)),
  );
  protected readonly previewPhoto = computed(
    () => this.photos().find((_, i) => !this.excluded().has(i))?.url,
  );
  protected readonly conditionLabel = computed(
    () => CONDITIONS.find((c) => c.value === this.fields().condition)?.label ?? '',
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
        return this.photos().length > 0 && !this.busy() && !this.analyzing();
      case 3:
        return !!this.fields().condition;
      case 4:
        return this.price() !== null && this.price()! > 0;
      default:
        return true;
    }
  });
  // fields the seller typed in keep their value when the draft is re-run
  private readonly sellerFields = new Set<Field>();
  // only the latest rewrite may change the text
  private rewriteRun = 0;

  protected next(): void {
    if (!this.canContinue()) return;
    if (this.step() === 1) {
      const fresh = this.photos().some((p) => p.id === undefined);
      if (this.draft() && !fresh) this.step.set(2);
      else this.analyse();
    } else this.step.update((s) => Math.min(STEPS, s + 1));
  }

  protected back(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  protected marksOn(photo: number): { box: number[]; label: string; privacy: boolean }[] {
    return [
      ...this.detections()
        .filter((d) => d.photo === photo)
        .map((d) => ({ box: d.box ?? [], label: d.label ?? '', privacy: false })),
      ...this.privacyMarks()
        .filter((p) => p.photo === photo)
        .map((p) => ({ box: p.box ?? [], label: p.text ?? '', privacy: true })),
    ];
  }

  protected addPhotos(input: HTMLInputElement, upload = false): void {
    const files = Array.from(input.files ?? []).slice(0, MAX_PHOTOS - this.photos().length);
    input.value = '';
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
      error: () => this.busy.set(false),
    });
  }

  protected async runStream(): Promise<void> {
    const hadDraft = !!this.draft();
    const photoGap = this.currentCard();
    this.analyzing.set(true);
    this.streamFailed.set(false);
    this.detections.set([]);
    this.privacyMarks.set([]);
    this.aiGaps.set([]);
    let drafted = false;
    try {
      await this.stream.run(
        {
          photoIds: this.photos().map((p) => p.id!),
          confirmedFacts: this.facts()
            .filter((f) => f.source === 'SELLER' && f.value.trim())
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
      if (this.view() === 'steps') {
        this.gapsActive.set(true);
        if (!this.cards().length) this.finishGaps();
      }
    } else {
      this.streamFailed.set(true);
    }
  }

  /** Applies one stream event; true when it was the draft. */
  private onEvent(event: DraftEvent): boolean {
    switch (event.type) {
      case 'DETECTION':
        this.detections.update((all) => [...all, event.detection!]);
        this.shownPhoto.set((event.detection!.photo ?? 1) - 1);
        return false;
      case 'PRIVACY':
        this.privacyMarks.update((all) => [...all, event.privacy!]);
        return false;
      case 'GAP':
        this.aiGaps.update((all) => [...all, event.gap!]);
        return false;
      case 'DRAFT':
        this.applyDraft(event.draft!);
        return true;
      case 'ERROR':
        this.banner.show(event.detail ?? this.i18n.t('Der Entwurf konnte nicht erstellt werden.'));
        return false;
      default:
        return false;
    }
  }

  private applyDraft(draft: ListingDraft): void {
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
      this.setField('condition', value);
    } else {
      const fact: Fact = { name: card.fact, value: value.trim(), source: 'SELLER' };
      const changed = this.facts().find((f) => f.name === card.fact)?.value !== fact.value;
      this.facts.update((facts) =>
        facts.some((f) => f.name === card.fact)
          ? facts.map((f) => (f.name === card.fact ? fact : f))
          : [fact, ...facts],
      );
      if (changed) this.rewriteText();
    }
    this.nextCard();
  }

  protected skip(card: GapCard): void {
    this.skipped.update((set) => new Set(set).add(card.fact));
    this.nextCard();
  }

  private nextCard(): void {
    this.answered.update((n) => n + 1);
    this.typing.set(false);
    this.draftAnswer.set('');
    if (this.gapsActive() && !this.cards().length) this.finishGaps();
  }

  protected finishGaps(): void {
    this.gapsActive.set(false);
    this.step.set(2);
  }

  protected answerOpenPoints(): void {
    this.skipped.set(new Set());
    this.answered.set(0);
    this.view.set('steps');
    this.step.set(1);
    this.gapsActive.set(true);
  }

  /** Lets the AI fit title and description to changed facts; text the seller wrote stays. */
  protected rewriteText(): void {
    const { title, description, category } = this.fields();
    if (!this.draft() || (this.sellerFields.has('title') && this.sellerFields.has('description')))
      return;
    const run = ++this.rewriteRun;
    this.rewriting.set(true);
    const facts = this.facts()
      .filter((f) => f.value.trim())
      .map((f) => ({ name: f.name, value: f.value.trim(), source: f.source }));
    this.api
      .rewriteText(
        { body: { category, title, description, facts } },
        // a failed rewrite keeps the current text
        new HttpContext().set(HANDLES_ERRORS, true),
      )
      .subscribe({
        next: (text) => {
          if (run !== this.rewriteRun) return;
          this.fields.update((fields) => ({
            ...fields,
            title: this.sellerFields.has('title') ? fields.title : (text.title ?? fields.title),
            description: this.sellerFields.has('description')
              ? fields.description
              : (text.description ?? fields.description),
          }));
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
        saveLastLocation(body.postcode, body.locality);
        void this.router.navigate(['/listings', listing.id]);
      },
      error: () => this.busy.set(false),
    });
  }
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
