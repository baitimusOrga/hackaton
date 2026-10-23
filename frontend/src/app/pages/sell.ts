import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
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
import { DraftStream } from '../draft-stream';
import { ErrorBanner, HANDLES_ERRORS } from '../errors';
import { CONDITION, GapCard, KnownFact, completeness, openGaps } from '../gaps';

type Source = KnownFact['source'];
type Condition = CreateListingRequest['condition'];
type Field = 'title' | 'category' | 'condition' | 'description';
type Step = 'PHOTOS' | 'ANALYZING' | 'GAPS' | 'REVIEW';
interface Fact extends KnownFact {
  sourceUrl?: string | null;
}
interface SellPhoto {
  file: File;
  url: string;
  id?: number;
}

const MAX_PHOTOS = 5;
// per-browser default for the next listing
const LAST_LOCATION = 'sell.lastLocation';
const MARKERS: Record<Source, string> = {
  LABEL: 'From label',
  SUGGESTION: 'Suggested — please check',
  SELLER: 'Confirmed by you',
  WEB: 'From the web — please check',
};
const MARKER_STYLES: Record<Source, string> = {
  LABEL: 'bg-sky-100 text-sky-900',
  SUGGESTION: 'bg-amber-100 text-amber-900',
  SELLER: 'bg-emerald-100 text-emerald-900',
  WEB: 'bg-violet-100 text-violet-900',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sell',
  imports: [PricePanel],
  styles: `
    label {
      display: grid;
      gap: 0.25rem;
      font-weight: 600;
    }
    input:not([type='checkbox']):not([type='file']),
    textarea,
    select {
      border: 1px solid #94a3b8;
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-weight: 400;
      background: white;
    }
    .primary {
      background: #115e59;
      color: white;
      padding: 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .secondary {
      border: 1px solid #115e59;
      color: #115e59;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .secondary[aria-pressed='true'] {
      background: #115e59;
      color: white;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
  template: `
    <h1 class="text-2xl font-semibold">Sell an item</h1>

    @if (view() === 'PHOTOS') {
      <p class="mt-1">Add 1 to 5 photos. Include the type plate or model label if there is one.</p>
      <div class="mt-4 grid max-w-lg gap-3">
        <div class="flex flex-wrap gap-2">
          <label class="secondary"
            >Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              [disabled]="photos().length >= maxPhotos"
              (change)="addPhotos($any($event.target))"
          /></label>
          <label class="secondary"
            >Choose photos
            <input
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              [disabled]="photos().length >= maxPhotos"
              (change)="addPhotos($any($event.target))"
          /></label>
        </div>
        <ul class="flex flex-wrap gap-2" aria-label="Selected photos">
          @for (photo of photos(); track photo.url; let i = $index) {
            <li class="relative">
              <img
                [src]="photo.url"
                [alt]="'Photo ' + (i + 1)"
                class="h-24 w-24 rounded object-cover"
              />
              <button
                type="button"
                class="absolute top-1 right-1 rounded bg-white/90 px-1 text-sm"
                [attr.aria-label]="'Remove photo ' + (i + 1)"
                (click)="removePhoto(i)"
              >
                ✕
              </button>
            </li>
          }
        </ul>
        <button
          type="button"
          class="primary"
          [disabled]="!photos().length || busy()"
          (click)="analyse()"
        >
          {{ busy() ? 'Uploading…' : 'Analyse' }}
        </button>
      </div>
    } @else {
      <section class="mt-4 grid max-w-lg gap-2" aria-label="Detections">
        @if (photos()[shownPhoto()]; as photo) {
          <div class="relative">
            <img [src]="photo.url" [alt]="'Photo ' + (shownPhoto() + 1)" class="w-full rounded" />
            @for (mark of marksOn(shownPhoto() + 1); track $index) {
              <div
                class="absolute border-2"
                [class]="mark.privacy ? 'border-rose-500' : 'border-teal-500'"
                [style.left.%]="mark.box[0] * 100"
                [style.top.%]="mark.box[1] * 100"
                [style.width.%]="mark.box[2] * 100"
                [style.height.%]="mark.box[3] * 100"
                [attr.data-testid]="mark.privacy ? 'privacy' : 'detection'"
              >
                <span
                  class="absolute -top-6 left-0 rounded bg-white/90 px-1 text-sm whitespace-nowrap"
                  >{{ mark.label }}</span
                >
              </div>
            }
          </div>
        }
        <ul class="flex flex-wrap gap-2" aria-label="Photos">
          @for (photo of photos(); track photo.url; let i = $index) {
            <li>
              <button
                type="button"
                [attr.aria-pressed]="shownPhoto() === i"
                (click)="shownPhoto.set(i)"
              >
                <img
                  [src]="photo.url"
                  [alt]="'Photo ' + (i + 1) + (excluded().has(i) ? ' (left out)' : '')"
                  class="h-16 w-16 rounded object-cover"
                  [class]="excluded().has(i) ? 'opacity-40 ring-2 ring-rose-500' : ''"
                />
              </button>
            </li>
          }
        </ul>
        @if (view() === 'ANALYZING') {
          @if (streamFailed()) {
            <button type="button" class="primary" (click)="runStream()">Analyse again</button>
          } @else {
            <p aria-live="polite">Analysing… {{ detections().length }} found so far</p>
          }
        }
      </section>

      @if (view() === 'GAPS' && currentCard(); as card) {
        <section
          class="mt-4 grid max-w-lg gap-3 rounded border p-3"
          data-testid="gap"
          aria-live="polite"
        >
          <p class="text-sm">{{ answered() + 1 }} of {{ answered() + cards().length }}</p>
          <h2 class="font-semibold">{{ card.prompt }}</h2>
          @if (card.kind === 'CONFIRM' && !typing()) {
            <div class="flex gap-2">
              <button type="button" class="primary" (click)="answer(card, card.value ?? '')">
                Correct
              </button>
              <button type="button" class="secondary" (click)="typing.set(true)">Change</button>
            </div>
          } @else if (card.kind === 'PHOTO' && !typing() && photos().length < maxPhotos) {
            <label class="secondary w-fit"
              >{{ busy() ? 'Uploading…' : 'Take photo' }}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="sr-only"
                [disabled]="busy()"
                (change)="addPhotos($any($event.target), true)"
            /></label>
            <button type="button" class="w-fit underline" (click)="typing.set(true)">
              Type instead
            </button>
          } @else if (card.fact === conditionGap) {
            <div class="flex flex-wrap gap-2">
              @for (c of conditions; track c[0]) {
                <button type="button" class="secondary" (click)="answer(card, c[0])">
                  {{ c[1] }}
                </button>
              }
            </div>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (option of card.options; track option) {
                <button type="button" class="secondary" (click)="answer(card, option)">
                  {{ option }}
                </button>
              }
            </div>
            <label
              >{{ card.fact }}
              <input
                maxlength="500"
                [value]="draftAnswer()"
                (input)="draftAnswer.set($any($event.target).value)"
            /></label>
            <button
              type="button"
              class="primary w-fit"
              [disabled]="!draftAnswer().trim()"
              (click)="answer(card, draftAnswer())"
            >
              Save
            </button>
          }
          <div class="flex gap-4">
            <button type="button" class="underline" (click)="skip(card)">Skip</button>
            <button type="button" class="underline" (click)="step.set('REVIEW')">
              To overview
            </button>
          </div>
        </section>
      }

      @if (view() === 'REVIEW') {
        <form class="mt-4 grid max-w-lg gap-4" (submit)="publish($event)">
          <p>Listing {{ percentComplete() }} % complete</p>
          @if (openNames()) {
            <section
              class="rounded border border-amber-300 bg-amber-50 p-3"
              aria-label="Open points"
            >
              <p>Still open: {{ openNames() }}</p>
              <button type="button" class="secondary mt-2" (click)="answerOpenPoints()">
                Answer open points
              </button>
            </section>
          }

          @if (draft()?.privacyWarnings?.length) {
            <section
              class="rounded border border-rose-300 bg-rose-50 p-3"
              aria-label="Privacy check"
            >
              <h2 class="font-semibold">Check before publishing</h2>
              @for (warning of draft()?.privacyWarnings; track $index) {
                <div class="mt-2">
                  <p>Photo {{ warning.photo }}: {{ warning.text }}</p>
                  <label class="flex! items-center gap-1 font-normal!"
                    ><input
                      type="checkbox"
                      [checked]="excluded().has(warning.photo! - 1)"
                      (change)="toggleExcluded(warning.photo! - 1)"
                    />
                    Leave out photo {{ warning.photo }}</label
                  >
                </div>
              }
            </section>
          }

          @if (rewriting()) {
            <p class="text-sm" aria-live="polite">Updating title and description…</p>
          }
          <label
            >Title
            <input
              name="title"
              required
              maxlength="120"
              [value]="fields().title"
              (input)="setField('title', $any($event.target).value)"
          /></label>
          <label
            >Category
            <select
              name="category"
              required
              (change)="setField('category', $any($event.target).value)"
            >
              @for (category of categories(); track category.name) {
                <option [value]="category.name" [selected]="category.name === fields().category">
                  {{ category.name }}
                </option>
              }
            </select>
          </label>
          <label
            >Condition
            <select
              name="condition"
              required
              (change)="setField('condition', $any($event.target).value)"
            >
              <option value="" disabled [selected]="!fields().condition">Choose condition</option>
              @for (condition of conditions; track condition[0]) {
                <option [value]="condition[0]" [selected]="condition[0] === fields().condition">
                  {{ condition[1] }}
                </option>
              }
            </select>
            @if (!draft()?.condition && !fields().condition) {
              <span class="text-sm font-normal">
                The photos don't show the condition — please choose it.
              </span>
            } @else if (draft()?.condition && draft()?.condition === fields().condition) {
              <span class="text-sm font-normal">Suggested from the photos — please check.</span>
            }
          </label>
          <label
            >Description
            <textarea
              name="description"
              required
              maxlength="4000"
              rows="5"
              [value]="fields().description"
              (input)="setField('description', $any($event.target).value)"
            ></textarea>
          </label>

          <fieldset class="grid gap-2">
            <legend class="font-semibold">Details</legend>
            <p class="text-sm">Only details you confirm or that come from a label are published.</p>
            @for (fact of facts(); track fact.name; let i = $index) {
              <div class="grid grid-cols-[7rem_1fr] items-center gap-2" data-testid="fact">
                <label [for]="'fact-' + i" class="font-normal!">{{ fact.name }}</label>
                <input
                  [id]="'fact-' + i"
                  maxlength="500"
                  [value]="fact.value"
                  (input)="editFact(i, $any($event.target).value)"
                  (change)="rewriteText()"
                />
                <span
                  class="col-start-2 w-fit rounded px-2 text-sm {{ markerStyles[fact.source] }}"
                  data-testid="marker"
                  >{{ markers[fact.source] }}</span
                >
                <div class="col-start-2 flex gap-3 text-sm">
                  @if (fact.source === 'WEB' && fact.sourceUrl) {
                    <a
                      [href]="fact.sourceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline"
                      >Source</a
                    >
                  }
                  @if (fact.source === 'SUGGESTION' || fact.source === 'WEB') {
                    <label class="flex! items-center gap-1 font-normal!"
                      ><input
                        type="checkbox"
                        [attr.aria-label]="fact.name + ' is correct'"
                        (change)="confirmFact(i)"
                      />
                      This is correct</label
                    >
                  }
                  <button
                    type="button"
                    class="underline"
                    [attr.aria-label]="'Remove ' + fact.name"
                    (click)="removeFact(i)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            } @empty {
              <p class="text-sm">No details found in the photos.</p>
            }
            <button
              type="button"
              class="secondary w-fit"
              [disabled]="!canLookUp() || lookingUp()"
              (click)="completeFacts()"
            >
              {{ lookingUp() ? 'Searching the web…' : 'Complete technical data' }}
            </button>
            @if (!canLookUp()) {
              <p class="text-sm">Confirm the model first — we only look up what we know.</p>
            }
            @if (webNote()) {
              <p class="text-sm">{{ webNote() }}</p>
            }
          </fieldset>

          <fieldset class="grid gap-2">
            <legend class="font-semibold">Price</legend>
            <app-price-panel
              [estimate]="draft()?.price"
              [condition]="fields().condition"
              [(price)]="price"
            />
            <label
              >Your price (CHF)
              <input
                name="price"
                type="number"
                required
                min="0.01"
                max="9999999999.99"
                step="0.01"
                [value]="price() ?? ''"
                (input)="price.set($any($event.target).valueAsNumber || null)"
            /></label>
          </fieldset>

          <label
            >Postcode
            <input
              name="postcode"
              required
              pattern="[0-9]{4}"
              inputmode="numeric"
              [value]="postcode()"
              (input)="setPostcode($any($event.target).value)"
          /></label>
          <label
            >Locality
            <input
              name="locality"
              required
              maxlength="120"
              [value]="locality()"
              (input)="locality.set($any($event.target).value)"
          /></label>

          <button type="submit" class="primary" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : 'Publish listing' }}
          </button>
        </form>
      }
    }
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly stream = inject(DraftStream);
  private readonly places = inject(PlacesService);
  private readonly banner = inject(ErrorBanner);
  private readonly router = inject(Router);
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly markers = MARKERS;
  protected readonly markerStyles = MARKER_STYLES;
  protected readonly conditionGap = CONDITION;
  protected readonly conditions: [Condition, string][] = [
    ['NEW', 'New'],
    ['LIKE_NEW', 'Like new'],
    ['GOOD', 'Good'],
    ['USED', 'Used'],
    ['DEFECTIVE', 'Defective'],
  ];
  protected readonly categories = toSignal(inject(ListingsService).categories(), {
    initialValue: [],
  });
  protected readonly step = signal<Step>('PHOTOS');
  protected readonly photos = signal<SellPhoto[]>([]);
  protected readonly shownPhoto = signal(0);
  protected readonly busy = signal(false);
  protected readonly streamFailed = signal(false);
  protected readonly detections = signal<Detection[]>([]);
  protected readonly privacyMarks = signal<PrivacyMark[]>([]);
  protected readonly aiGaps = signal<Gap[]>([]);
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
  protected readonly currentCard = computed<GapCard | undefined>(() => this.cards()[0]);
  // GAPS with nothing left to ask is the review
  protected readonly view = computed<Step>(() =>
    this.step() === 'GAPS' && !this.currentCard() ? 'REVIEW' : this.step(),
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
  protected readonly canLookUp = computed(() =>
    this.facts().some(
      (f) =>
        f.name === 'Model' && f.value.trim() && (f.source === 'LABEL' || f.source === 'SELLER'),
    ),
  );
  protected readonly price = signal<number | null>(null);
  protected readonly postcode = signal(lastLocation().postcode);
  protected readonly locality = signal(lastLocation().locality);
  // fields the seller typed in keep their value when the draft is re-run
  private readonly sellerFields = new Set<Field>();
  // only the latest rewrite may change the text
  private rewriteRun = 0;

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
    if (!this.photos().length || this.busy()) return;
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
    this.step.set('ANALYZING');
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
      this.banner.show(error instanceof Error ? error.message : 'The server is not reachable.');
    }
    if (drafted) {
      this.step.set('GAPS');
    } else if (hadDraft) {
      // a failed re-run keeps the previous draft; the photo card counts as skipped
      if (photoGap) this.skip(photoGap);
      this.step.set('GAPS');
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
        this.banner.show(event.detail ?? 'The draft could not be created.');
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

  protected skip(card: GapCard): void {
    this.skipped.update((set) => new Set(set).add(card.fact));
    this.nextCard();
  }

  private nextCard(): void {
    this.answered.update((n) => n + 1);
    this.typing.set(false);
    this.draftAnswer.set('');
  }

  protected answerOpenPoints(): void {
    this.skipped.set(new Set());
    this.answered.set(0);
    this.step.set('GAPS');
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
        if (!fresh.length) this.webNote.set('Nothing reliable found on the web for this model.');
        this.lookingUp.set(false);
      },
      error: () => this.lookingUp.set(false),
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

  protected removeFact(index: number): void {
    this.facts.update((facts) => facts.filter((_, i) => i !== index));
  }

  protected publish(event: Event): void {
    event.preventDefault();
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
