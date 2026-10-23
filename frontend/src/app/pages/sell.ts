import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SellingService } from '../api/services';
import { CreateListingRequest, ListingDraft } from '../api/models';
import { PricePanel } from '../components/price-panel';
import { CATEGORIES } from '../categories';

type Source = 'LABEL' | 'SELLER' | 'SUGGESTION' | 'WEB';
type Condition = CreateListingRequest['condition'];
type Field = 'title' | 'category' | 'condition' | 'description';
interface Fact {
  name: string;
  value: string;
  source: Source;
  sourceUrl?: string | null;
}

const MAX_PHOTOS = 5;
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

    @if (!draft()) {
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
          (click)="createDraft()"
        >
          {{ busy() ? 'Creating draft…' : 'Create draft' }}
        </button>
      </div>
    } @else {
      <form class="mt-4 grid max-w-lg gap-4" (submit)="publish($event)">
        <ul class="flex flex-wrap gap-2" aria-label="Photos">
          @for (photo of photos(); track photo.url; let i = $index) {
            <li>
              <img
                [src]="photo.url"
                [alt]="'Photo ' + (i + 1) + (excluded().has(i) ? ' (left out)' : '')"
                class="h-20 w-20 rounded object-cover"
                [class]="excluded().has(i) ? 'opacity-40 ring-2 ring-rose-500' : ''"
              />
            </li>
          }
        </ul>

        @if (draft()?.privacyWarnings?.length) {
          <section class="rounded border border-rose-300 bg-rose-50 p-3" aria-label="Privacy check">
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

        <section class="rounded border border-amber-300 bg-amber-50 p-3" aria-label="Tips">
          @if (draft()?.questions?.length) {
            <h2 class="font-semibold">Tips to improve your listing</h2>
            <ul class="list-disc pl-5">
              @for (question of draft()?.questions; track $index) {
                <li>{{ question }}</li>
              }
            </ul>
          }
          @if (photos().length < maxPhotos) {
            <label class="secondary mt-2 inline-block"
              >{{ busy() ? 'Updating draft…' : 'Add photo and update draft' }}
              <input
                type="file"
                accept="image/*"
                multiple
                class="sr-only"
                [disabled]="busy()"
                (change)="addPhotos($any($event.target), true)"
            /></label>
          }
        </section>

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
            @for (category of categories; track category) {
              <option [value]="category" [selected]="category === fields().category">
                {{ category }}
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
            (input)="postcode.set($any($event.target).value)"
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
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly router = inject(Router);
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly markers = MARKERS;
  protected readonly markerStyles = MARKER_STYLES;
  protected readonly categories = CATEGORIES;
  protected readonly conditions: [Condition, string][] = [
    ['NEW', 'New'],
    ['LIKE_NEW', 'Like new'],
    ['GOOD', 'Good'],
    ['USED', 'Used'],
    ['DEFECTIVE', 'Defective'],
  ];
  protected readonly photos = signal<{ file: File; url: string }[]>([]);
  protected readonly busy = signal(false);
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
  // 0-based indexes of photos the seller leaves out of the listing
  protected readonly excluded = signal(new Set<number>());
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
  protected readonly postcode = signal('');
  protected readonly locality = signal('');
  // fields the seller typed in keep their value when the draft is re-run
  private readonly sellerFields = new Set<Field>();

  protected addPhotos(input: HTMLInputElement, redraft = false): void {
    const files = Array.from(input.files ?? []).slice(0, MAX_PHOTOS - this.photos().length);
    input.value = '';
    if (!files.length) return;
    this.photos.update((photos) => [
      ...photos,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    if (redraft) this.createDraft();
  }

  protected removePhoto(index: number): void {
    URL.revokeObjectURL(this.photos()[index].url);
    this.photos.update((photos) => photos.filter((_, i) => i !== index));
  }

  protected createDraft(): void {
    if (!this.photos().length || this.busy()) return;
    this.busy.set(true);
    this.api.createDraft({ body: { photos: this.photos().map((p) => p.file) } }).subscribe({
      next: (draft) => {
        this.applyDraft(draft);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
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
      next: (listing) => void this.router.navigate(['/listings', listing.id]),
      error: () => this.busy.set(false),
    });
  }
}
