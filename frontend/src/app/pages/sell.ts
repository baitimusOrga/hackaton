import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellingService } from '../api/services';
import { CreateListingRequest, ListingDraft } from '../api/models';

type Source = 'LABEL' | 'SELLER' | 'SUGGESTION';
type Condition = CreateListingRequest['condition'];
type Field = 'title' | 'category' | 'condition' | 'description';
interface Fact {
  name: string;
  value: string;
  source: Source;
}

const MAX_PHOTOS = 5;
const MARKERS: Record<Source, string> = {
  LABEL: 'From label',
  SUGGESTION: 'Suggested — please check',
  SELLER: 'Confirmed by you',
};
const MARKER_STYLES: Record<Source, string> = {
  LABEL: 'bg-sky-100 text-sky-900',
  SUGGESTION: 'bg-amber-100 text-amber-900',
  SELLER: 'bg-emerald-100 text-emerald-900',
};

@Component({
  selector: 'app-sell',
  imports: [RouterLink],
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
                [alt]="'Photo ' + (i + 1)"
                class="h-20 w-20 rounded object-cover"
              />
            </li>
          }
        </ul>

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
            @for (condition of conditions; track condition[0]) {
              <option [value]="condition[0]" [selected]="condition[0] === fields().condition">
                {{ condition[1] }}
              </option>
            }
          </select>
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
              <span>{{ fact.name }}</span>
              <input
                [attr.aria-label]="fact.name"
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
                @if (fact.source === 'SUGGESTION') {
                  <label class="flex! items-center gap-1 font-normal!"
                    ><input type="checkbox" (change)="confirmFact(i)" /> This is correct</label
                  >
                }
                <button type="button" class="underline" (click)="removeFact(i)">Remove</button>
              </div>
            </div>
          } @empty {
            <p class="text-sm">No details found in the photos.</p>
          }
        </fieldset>

        <fieldset class="grid gap-2">
          <legend class="font-semibold">Price</legend>
          @if (draft()?.price; as estimate) {
            <div class="flex flex-wrap gap-2">
              @for (strategy of strategies; track strategy.label) {
                @let amount = estimate[strategy.key] ?? null;
                <button
                  type="button"
                  class="secondary"
                  [disabled]="amount === null"
                  [attr.aria-pressed]="amount !== null && price() === amount"
                  (click)="price.set(amount)"
                >
                  {{ strategy.label }}
                  @if (amount !== null) {
                    (CHF {{ amount }})
                  }
                </button>
              }
            </div>
            @if (estimate.provisional) {
              <p class="font-semibold">Provisional estimate</p>
            }
            <p class="text-sm">{{ estimate.explanation }}</p>
            @if (estimate.evidence?.length) {
              <ul class="list-disc pl-5 text-sm">
                @for (item of estimate.evidence; track item.listingId) {
                  <li>
                    <a class="underline" [routerLink]="['/listings', item.listingId]">{{
                      item.title
                    }}</a>
                    — CHF {{ item.priceChf }}
                  </li>
                }
              </ul>
            }
          }
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
  protected readonly categories = [
    'Computers',
    'Laptops',
    'Monitors',
    'Phones',
    'Tablets',
    'Office furniture',
    'Audio',
    'Cameras',
    'Household',
    'Bikes',
  ];
  protected readonly conditions: [Condition, string][] = [
    ['NEW', 'New'],
    ['LIKE_NEW', 'Like new'],
    ['GOOD', 'Good'],
    ['USED', 'Used'],
    ['DEFECTIVE', 'Defective'],
  ];
  protected readonly strategies = [
    { label: 'Sell faster', key: 'lowChf' },
    { label: 'Balanced', key: 'midChf' },
    { label: 'Higher, less certain', key: 'highChf' },
  ] as const;

  protected readonly photos = signal<{ file: File; url: string }[]>([]);
  protected readonly busy = signal(false);
  protected readonly draft = signal<ListingDraft | null>(null);
  protected readonly fields = signal<Record<Field, string>>({
    title: '',
    category: 'Computers',
    condition: 'GOOD',
    description: '',
  });
  protected readonly facts = signal<Fact[]>([]);
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
        const value = draft[key];
        if (value && !this.sellerFields.has(key)) next[key] = value;
      }
      return next;
    });
    const confirmed = this.facts().filter((f) => f.source === 'SELLER');
    const fresh = (draft.facts ?? [])
      .filter((f) => f.name && !confirmed.some((c) => c.name === f.name))
      .map((f) => ({ name: f.name!, value: f.value ?? '', source: f.source ?? 'SUGGESTION' }));
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

  protected removeFact(index: number): void {
    this.facts.update((facts) => facts.filter((_, i) => i !== index));
  }

  protected publish(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    const price = this.price();
    if (!draft || price === null || this.busy()) return;
    const fields = this.fields();
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
          .filter((f) => f.source !== 'SUGGESTION' && f.value.trim())
          .map((f) => [f.name, f.value.trim()]),
      ),
      photoIds: draft.photoIds ?? [],
    };
    this.busy.set(true);
    this.api.publish({ body }).subscribe({
      next: (listing) => void this.router.navigate(['/listings', listing.id]),
      error: () => this.busy.set(false),
    });
  }
}
