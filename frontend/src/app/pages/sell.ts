import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SellingService } from '../api/services';
import { CreateListingRequest, ListingDraft } from '../api/models';
import { PricePanel } from '../components/price-panel';
import { CATEGORIES } from '../categories';
import { Button } from '../ui/button';
import { ChfPipe } from '../ui/chf';
import { Icon } from '../ui/icon';

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
const STEPS = 5;
const MARKERS: Record<Source, string> = {
  LABEL: 'Vom Etikett gelesen',
  SUGGESTION: 'Vorschlag, bitte prüfen',
  SELLER: 'Von dir bestätigt',
  WEB: 'Aus dem Web, bitte prüfen',
};
// TODO: the design's "Sehr gut" has no backend condition; CreateListingRequest knows only these five.
const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: 'NEW', label: 'Neu', hint: 'Unbenutzt, originalverpackt.' },
  { value: 'LIKE_NEW', label: 'Wie neu', hint: 'Keine Gebrauchsspuren.' },
  { value: 'GOOD', label: 'Gut', hint: 'Funktioniert einwandfrei, sichtbare Spuren.' },
  { value: 'USED', label: 'Gebraucht', hint: 'Deutliche Spuren, funktioniert.' },
  { value: 'DEFECTIVE', label: 'Defekt', hint: 'Für Bastler oder Ersatzteile.' },
];

/** Sell wizard (Sell1–Sell5) and the one-page form (SellFull); both views share the same signals. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sell',
  imports: [NgTemplateOutlet, RouterLink, PricePanel, Button, ChfPipe, Icon],
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
    .q {
      margin: 0;
      font-size: 32px;
      line-height: 36px;
      font-weight: 700;
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
    .sub {
      margin: 0;
      color: var(--ink-muted);
    }
    .small {
      font-size: 14px;
      line-height: 20px;
    }
    .strong {
      margin: 0;
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
    .link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0;
      border: 0;
      background: none;
      font: 600 15px/20px var(--font-sans);
      color: var(--ink);
      cursor: pointer;
      text-decoration: none;
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
      list-style: none;
      margin: 0;
      padding: 0;
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
    .opts {
      border: 0;
      padding: 0;
      margin: 0;
    }
    .opt {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-height: 56px;
      padding: var(--space-2) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
      cursor: pointer;
    }
    .opt:last-child {
      border-bottom: 0;
    }
    .opt input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--blue);
      flex: none;
    }
    .opt__t {
      display: block;
      font-weight: 600;
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
    .check {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 44px;
      cursor: pointer;
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
    .price {
      font-size: 20px;
      line-height: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-8) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .sec h2 {
      margin: 0;
      font-size: 24px;
      line-height: 28px;
      font-weight: 700;
    }
    textarea.zw-input {
      min-height: 120px;
      padding: 10px var(--space-3);
      resize: vertical;
    }
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly router = inject(Router);
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly steps = STEPS;
  protected readonly markers = MARKERS;
  protected readonly categories = CATEGORIES;
  protected readonly conditions = CONDITIONS;
  protected readonly view = signal<'steps' | 'full'>('steps');
  protected readonly step = signal(1);
  // Sell1b: the draft came back without anything read from a label
  protected readonly askForPhotos = signal(false);
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
  protected readonly labelFacts = computed(() =>
    this.facts().filter((f) => f.source === 'LABEL' && f.value.trim()),
  );
  protected readonly lookingUp = signal(false);
  protected readonly webNote = signal('');
  // 0-based indexes of photos the seller leaves out of the listing
  protected readonly excluded = signal(new Set<number>());
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
  protected readonly postcode = signal('');
  protected readonly locality = signal('');
  protected readonly canContinue = computed(() => {
    switch (this.step()) {
      case 1:
        return this.photos().length > 0 && !this.busy();
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

  protected next(): void {
    if (!this.canContinue()) return;
    if (this.step() === 1) this.createDraft();
    else this.step.update((s) => Math.min(STEPS, s + 1));
  }

  protected back(): void {
    if (this.step() === 1) this.askForPhotos.set(false);
    else this.step.update((s) => s - 1);
  }

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
        if (this.view() === 'steps') {
          const recognised = this.labelFacts().length > 0;
          this.askForPhotos.set(!recognised);
          if (recognised) this.step.set(2);
        }
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
      next: (listing) => void this.router.navigate(['/listings', listing.id]),
      error: () => this.busy.set(false),
    });
  }
}
