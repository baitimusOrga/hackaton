import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ListingsService, PlacesService, SellingService } from '../api/services';
import { DraftEvent, ListingDraft } from '../api/models';
import { DraftStore } from '../draft-store';
import { DraftStream } from '../draft-stream';
import { ErrorBanner } from '../errors';
import { Sell } from './sell';

const DRAFT: ListingDraft = {
  photoIds: [7],
  category: 'Monitors',
  title: 'Dell U2719D',
  description: 'A monitor.',
  condition: 'GOOD',
  facts: [
    { name: 'Brand', value: 'Dell', source: 'LABEL' },
    { name: 'Size', value: '27"', source: 'SUGGESTION' },
  ],
  price: { lowChf: 100, midChf: 120, highChf: 140, provisional: true, evidence: [] },
  privacyWarnings: [],
};
const CATEGORIES = [{ name: 'Monitors', keyFacts: ['Brand', 'Model', 'Size', 'Resolution'] }];

const detection = (label: string): DraftEvent => ({
  type: 'DETECTION',
  detection: { photo: 1, box: [0.1, 0.1, 0.2, 0.2], label },
});
const done = (draft: ListingDraft): DraftEvent => ({ type: 'DRAFT', draft });

let store: {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

type Run = (body: unknown, onEvent: (e: DraftEvent) => void) => Promise<void>;
const streams =
  (...events: DraftEvent[]): Run =>
  async (_body, onEvent) =>
    events.forEach(onEvent);

const button = (element: HTMLElement, text: string) =>
  Array.from(element.querySelectorAll('button')).find((b) => b.textContent!.includes(text))!;

/** Opens the sell page, adds one photo and analyses it with the given stream behaviour. */
async function analyse(runs: Run[], extra: object = {}, place = vi.fn(), places: object = {}) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const uploadPhotos = vi.fn().mockReturnValue(of([7]));
  const run = vi.fn();
  runs.forEach((r) => run.mockImplementationOnce(r));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SellingService, useValue: { uploadPhotos, rewriteText: () => of({}), ...extra } },
      { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
      { provide: PlacesService, useValue: { place, ...places } },
      { provide: DraftStream, useValue: { run } },
      { provide: DraftStore, useValue: store },
    ],
  });
  const fixture = TestBed.createComponent(Sell);
  const element = fixture.nativeElement as HTMLElement;
  await fixture.whenStable();
  const input = element.querySelector<HTMLInputElement>('input[multiple]')!;
  Object.defineProperty(input, 'files', {
    value: [new File(['x'], 'item.png', { type: 'image/png' })],
  });
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  return { fixture, element, uploadPhotos, run, place };
}

/** Analyses and goes on to the first question. */
async function questions(runs: Run[], extra: object = {}) {
  const page = await analyse(runs, extra);
  button(page.element, 'Weiter').click();
  await page.fixture.whenStable();
  return page;
}

/** Analyses and opens the one-page form ("Alles bearbeiten"). */
async function full(draft: ListingDraft, extra: object = {}, place = vi.fn(), places: object = {}) {
  const page = await analyse([streams(done(draft))], extra, place, places);
  button(page.element, 'Alles bearbeiten').click();
  await page.fixture.whenStable();
  return page;
}

/** Opens the sell page with a draft saved before a reload. */
async function reopen(saved: object | undefined) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  store.load.mockResolvedValue(saved);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SellingService, useValue: {} },
      { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
      { provide: PlacesService, useValue: {} },
      { provide: DraftStream, useValue: {} },
      { provide: DraftStore, useValue: store },
    ],
  });
  const fixture = TestBed.createComponent(Sell);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('Sell', () => {
  beforeEach(() => {
    store = {
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
  });
  afterEach(() => localStorage.clear());

  it('starts with one big photo button and the hint that one photo is enough', async () => {
    const { element } = await reopen(undefined);

    expect(element.querySelector('h1')!.textContent).toContain('Was verkaufst du?');
    expect(element.textContent).toContain('Ein Foto genügt');
    expect(element.querySelector('label.shoot input[capture]')).not.toBeNull();
    expect(element.textContent).toContain('1 von 4');
  });

  it('opens every section of the one-page form with "Alles bearbeiten"', async () => {
    const { element } = await full(DRAFT);

    const headings = Array.from(element.querySelectorAll('h2')).map((h) => h.textContent!.trim());
    expect(headings).toEqual(['Fotos', 'Artikel', 'Zustand', 'Preis', 'Übergabe']);
  });

  it('closes the dialog on Escape and unlocks the page behind it', async () => {
    const { fixture } = await reopen(undefined);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(document.body.style.overflow).toBe('hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(navigate).toHaveBeenCalledWith([{ outlets: { modal: null } }]);
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the analysed draft with its photos for a reload', async () => {
    await analyse([streams(done(DRAFT))]);

    const saved = store.save.mock.lastCall![0];
    expect(saved).toMatchObject({ draft: { title: 'Dell U2719D' }, step: 1 });
    expect(saved.photos[0]).toMatchObject({ id: 7 });
    expect(saved.photos[0].file).toBeInstanceOf(File);
  });

  it('restores a saved draft at its step', async () => {
    const { fixture, element } = await reopen({
      savedAt: Date.now(),
      photos: [{ file: new File(['x'], 'item.png', { type: 'image/png' }), id: 7 }],
      draft: DRAFT,
      fields: {
        title: 'Dell U2719D',
        category: 'Monitors',
        condition: 'GOOD',
        description: 'A monitor.',
      },
      sellerFields: [],
      facts: DRAFT.facts,
      aiGaps: [],
      skipped: ['Model', 'Resolution'],
      answered: 2,
      gapsActive: false,
      step: 3,
      view: 'steps',
      excluded: [],
      price: null,
      postcode: '',
      locality: '',
      detections: [],
      privacyMarks: [],
    });

    expect(element.textContent).toContain('3 von 4');
    expect(element.textContent).toContain('Zu welchem Preis?');
    // a bar right under the header, not inside the step
    expect(element.querySelector('header + .restored')!.textContent).toContain(
      'Dein Entwurf von vorhin ist wieder da.',
    );
    element
      .querySelector<HTMLButtonElement>('.restored [aria-label="Hinweis schliessen"]')!
      .click();
    await fixture.whenStable();
    expect(element.querySelector('.restored')).toBeNull();
  });

  it('drops a saved draft older than its photos on the server', async () => {
    const { element } = await reopen({ savedAt: Date.now() - 21 * 60 * 60 * 1000, draft: DRAFT });

    expect(store.clear).toHaveBeenCalled();
    expect(element.textContent).toContain('1 von 4');
    expect(element.textContent).not.toContain('Dein Entwurf von vorhin ist wieder da.');
  });

  it('takes photos dropped on the dialog or pasted, and ignores pasted text', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: SellingService, useValue: {} },
        { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
        { provide: PlacesService, useValue: {} },
        { provide: DraftStream, useValue: {} },
        { provide: DraftStore, useValue: store },
      ],
    });
    const fixture = TestBed.createComponent(Sell);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const image = new File(['x'], 'item.png', { type: 'image/png' });

    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [image, new File(['t'], 'notes.txt', { type: 'text/plain' })] },
    });
    element.querySelector('form')!.dispatchEvent(drop);
    const paste = new Event('paste', { cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files: [image] } });
    window.dispatchEvent(paste);
    const text = new Event('paste', { cancelable: true });
    Object.defineProperty(text, 'clipboardData', { value: { files: [] } });
    window.dispatchEvent(text);
    await fixture.whenStable();

    expect(drop.defaultPrevented).toBe(true);
    expect(paste.defaultPrevented).toBe(true);
    expect(text.defaultPrevented).toBe(false);
    expect(fixture.componentInstance['photos']()).toHaveLength(2);
  });

  it('analyses right after the photo, shows the findings, then asks for the model first', async () => {
    const { fixture, element, uploadPhotos, run } = await analyse([
      streams(detection('Brand: Dell'), done(DRAFT)),
    ]);

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toEqual({ photoIds: [7], confirmedFacts: [], language: 'de' });
    expect(element.querySelector('[data-testid="detection"]')!.textContent).toContain(
      'Brand: Dell',
    );
    expect(element.querySelector('h1')!.textContent).toContain('Dell U2719D');
    expect(element.textContent).not.toContain('erkannt');
    expect(element.textContent).toContain('Noch 3 Fragen');

    button(element, 'Weiter').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Modell?');
    expect(element.textContent).toContain('2 von 4');
  });

  it('shows the live preview of the listing beside the steps', async () => {
    const { element } = await analyse([streams(done(DRAFT))]);
    const aside = element.querySelector('aside')!;

    expect(aside.textContent).toContain('Dell U2719D');
    expect(aside.textContent).toContain('Bildschirme'); // the category, translated
    expect(aside.textContent).toContain('Marke');
    expect(aside.textContent).toContain('Dell');
  });

  it('answers, confirms and skips the questions, then goes on to the price', async () => {
    const { fixture, element } = await questions([streams(done(DRAFT))]);

    const answer = element.querySelector<HTMLInputElement>('#gap-answer')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Übernehmen').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain(
      'Grösse: 27" – stimmt das?',
    );
    button(element, 'Stimmt').click();
    await fixture.whenStable();
    button(element, 'Weiss ich nicht').click();
    await fixture.whenStable();

    expect(element.textContent).toContain('3 von 4');
    expect(element.textContent).toContain('Zu welchem Preis?');
    expect(element.querySelector('aside')!.textContent).toContain('nicht bestätigt');
    expect(
      fixture.componentInstance['facts']().map((f: { name: string; source: string }) => [
        f.name,
        f.source,
      ]),
    ).toEqual([
      ['Model', 'SELLER'],
      ['Brand', 'LABEL'],
      ['Size', 'SELLER'],
    ]);
  });

  it('a photo question uploads only the new photo and analyses again', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Fotografiere das Typenschild', options: [] },
    };
    const { fixture, element, uploadPhotos, run } = await questions([
      streams(photoGap, done(DRAFT)),
      streams(done({ ...DRAFT, photoIds: [7, 8] })),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain(
      'Fotografiere das Typenschild',
    );

    const input = element.querySelector<HTMLInputElement>('.foot2 input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledTimes(2);
    expect(uploadPhotos.mock.calls[1][0].body.photos).toHaveLength(1);
    expect(run.mock.calls[1][0].photoIds).toEqual([7, 8]);
  });

  it('a photo answer adds to what is known and never drops it', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Fotografiere das Typenschild', options: [] },
    };
    const english: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Please photograph the label', options: [] },
    };
    const poorer = { ...DRAFT, photoIds: [7, 8], title: 'Monitor', condition: null, facts: [] };
    const { fixture, element, uploadPhotos, run } = await questions([
      streams(photoGap, done(DRAFT)),
      streams(english, done(poorer)),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    const input = element.querySelector<HTMLInputElement>('.foot2 input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const sell = fixture.componentInstance;

    // the label read before goes along as known, so the AI does not ask again
    expect(run.mock.calls[1][0].confirmedFacts).toContainEqual({ name: 'Brand', value: 'Dell' });
    expect(sell['facts']().map((f: { name: string }) => f.name)).toEqual(['Brand', 'Size']);
    expect(sell['fields']()).toMatchObject({ title: 'Dell U2719D', condition: 'GOOD' });
    const card = element.querySelector('[data-testid="gap"]')!.textContent;
    expect(card).toContain('Fotografiere das Typenschild');
    expect(card).toContain('Auf diesem Foto konnten wir es nicht lesen.');
  });

  it('offers to analyse again when the stream fails before the draft', async () => {
    const { fixture, element, uploadPhotos, run } = await analyse([
      async (_b, onEvent) => {
        onEvent(detection('Monitor'));
        onEvent({ type: 'ERROR', detail: 'AI is not available right now.' });
      },
      streams(done(DRAFT)),
    ]);

    expect(TestBed.inject(ErrorBanner).message()).toBe('AI is not available right now.');
    button(element, 'Nochmals auswerten').click();
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(button(element, 'Weiter').disabled).toBe(false);
  });

  it('a value the answer photo gives is the read moment, even as a guess', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Fotografiere den Modellnamen', options: [] },
    };
    const guessed = {
      ...DRAFT,
      photoIds: [7, 8],
      facts: [{ name: 'Model', value: 'U2719D', source: 'SUGGESTION' as const }],
    };
    const { fixture, element, uploadPhotos } = await questions([
      streams(photoGap, done(DRAFT)),
      streams(done(guessed)),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    const input = element.querySelector<HTMLInputElement>('.foot2 input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(element.textContent).toContain('Vom Foto gelesen');
    expect(element.textContent).not.toContain('nicht lesen');
    button(element, 'Weiter').click();
    await fixture.whenStable();
    const model = fixture.componentInstance['facts']().find(
      (f: { name: string }) => f.name === 'Model',
    );
    expect(model).toMatchObject({ value: 'U2719D', source: 'SELLER' });
  });

  it('points at where to photograph and shows what the new photo read', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: {
        fact: 'Model',
        kind: 'PHOTO',
        prompt: 'Fotografiere den Modellnamen',
        options: [],
        photo: 1,
        box: [0.3, 0.3, 0.3, 0.2],
      },
    };
    const read = {
      ...DRAFT,
      photoIds: [7, 8],
      facts: [...DRAFT.facts!, { name: 'Model', value: 'U2719D', source: 'LABEL' as const }],
    };
    const { fixture, element, uploadPhotos } = await questions([
      streams(photoGap, done(DRAFT)),
      streams(done(read)),
    ]);
    expect(element.querySelector('[data-testid="hint"]')!.textContent).toContain('Modell hier');

    uploadPhotos.mockReturnValue(of([8]));
    const input = element.querySelector<HTMLInputElement>('.foot2 input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(element.querySelector('h1')!.textContent).toContain('U2719D.');
    expect(element.textContent).toContain('Vom Foto gelesen');
    button(element, 'Weiter').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain(
      'Grösse: 27" – stimmt das?',
    );
  });

  it('rewrites title, description and price right after the model is confirmed', async () => {
    const price = { lowChf: 300, midChf: 350, highChf: 400, provisional: false, evidence: [] };
    const rewriteText = vi
      .fn()
      .mockReturnValue(of({ title: 'Dell U2719D', description: 'My Dell U2719D monitor.', price }));
    const { fixture, element } = await questions([streams(done(DRAFT))], { rewriteText });

    const answer = element.querySelector<HTMLInputElement>('#gap-answer')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Übernehmen').click();
    await fixture.whenStable();
    expect(rewriteText).toHaveBeenCalledOnce(); // the model changes title and price at once
    button(element, 'Stimmt').click(); // same value: no further rewrite
    await fixture.whenStable();
    button(element, 'Weiss ich nicht').click();
    await fixture.whenStable();

    expect(rewriteText).toHaveBeenCalledOnce();
    expect(rewriteText.mock.calls[0][0].body).toMatchObject({ condition: 'GOOD' });
    expect(rewriteText.mock.calls[0][0].body.facts).toContainEqual({
      name: 'Model',
      value: 'U2719D',
      source: 'SELLER',
    });
    const sell = fixture.componentInstance;
    expect(sell['fields']()).toMatchObject({
      title: 'Dell U2719D',
      description: 'My Dell U2719D monitor.',
    });
    expect(sell['draft']()!.price).toEqual(price);
  });

  it('shows a busy hint and a sheen on the preview while the text is rewritten', async () => {
    const reply = new Subject<object>();
    const rewriteText = vi.fn().mockReturnValue(reply);
    const { fixture, element } = await full(DRAFT, { rewriteText });
    fixture.componentInstance['rewriteText']();
    button(element, 'Schritt für Schritt').click();
    await fixture.whenStable();
    const aside = () => element.querySelector('aside')!;

    expect(aside().textContent).toContain('Wird angepasst');
    expect(aside().querySelector('.aside__title.zw-shimmer')).not.toBeNull();

    reply.next({ title: 'Dell U2719D 27"', description: 'Mein Monitor.' });
    await fixture.whenStable();
    expect(aside().textContent).not.toContain('Wird angepasst');
    expect(aside().querySelector('.zw-shimmer')).toBeNull();
  });

  it('back from the price goes to the findings when no question is left', async () => {
    const { fixture, element } = await questions([streams(done(DRAFT))]);
    for (let i = 0; i < 3; i++) {
      button(element, 'Weiss ich nicht').click();
      await fixture.whenStable();
    }

    button(element, 'Zurück').click();
    await fixture.whenStable();

    expect(element.textContent).toContain('1 von 4');
    expect(element.querySelector('h1')!.textContent).toContain('Dell U2719D');
  });

  it('throws the draft away only after a second click', async () => {
    const { fixture, element } = await analyse([streams(done(DRAFT))]);

    button(element, 'Neu beginnen').click();
    await fixture.whenStable();

    expect(store.clear).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Entwurf wirklich verwerfen?');
  });

  it('skipping every question needs no rewrite', async () => {
    const rewriteText = vi.fn();
    const { fixture, element } = await questions([streams(done(DRAFT))], { rewriteText });

    for (let i = 0; i < 3; i++) {
      button(element, 'Weiss ich nicht').click();
      await fixture.whenStable();
    }
    expect(element.textContent).toContain('Zu welchem Preis?');

    expect(rewriteText).not.toHaveBeenCalled();
  });

  it('keeps a title the seller wrote when rewriting', async () => {
    const rewriteText = vi
      .fn()
      .mockReturnValue(of({ title: 'AI title', description: 'AI description.' }));
    const { fixture } = await full(DRAFT, { rewriteText });
    const sell = fixture.componentInstance;

    sell['setField']('title', 'My own title');
    sell['rewriteText']();

    expect(sell['fields']()).toMatchObject({
      title: 'My own title',
      description: 'AI description.',
    });
  });

  it('rewrites the text when a guessed model is confirmed as it is', async () => {
    const rewriteText = vi.fn().mockReturnValue(of({ title: 'Dell U2719D', description: 'x' }));
    const guessed = {
      ...DRAFT,
      facts: [...DRAFT.facts!, { name: 'Model', value: 'U2719D', source: 'SUGGESTION' as const }],
    };
    const { fixture, element } = await questions([streams(done(guessed))], { rewriteText });

    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('U2719D');
    button(element, 'Stimmt').click();
    await fixture.whenStable();

    expect(rewriteText).toHaveBeenCalledOnce();
  });

  it('marks facts by source and confirms a suggestion', async () => {
    const { fixture, element } = await full(DRAFT);
    const markers = () =>
      Array.from(element.querySelectorAll('[data-testid="marker"]')).map((m) =>
        m.textContent!.trim(),
      );
    expect(markers()).toEqual(['Vom Etikett gelesen', 'Vorschlag, bitte prüfen']);
    expect(element.textContent).toContain('Vorläufig');

    element.querySelector<HTMLInputElement>('[data-testid="fact"] input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(markers()).toEqual(['Vom Etikett gelesen', 'Von dir bestätigt']);
  });

  it("asks the seller to choose the condition when the photos don't show it", async () => {
    const { element } = await full({ ...DRAFT, condition: null });

    expect(element.querySelector('input[name="condition"]:checked')).toBeNull();
    expect(element.textContent).toContain('Auf den Fotos sehen wir den Zustand nicht.');
  });

  it('warns about private details and leaves the photo out', async () => {
    const { fixture, element } = await full({
      ...DRAFT,
      photoIds: [7, 8],
      privacyWarnings: [{ photo: 1, text: 'Shows a serial number.' }],
    });

    const privacy = element.querySelector('[aria-label="Datenschutz prüfen"]')!;
    expect(privacy.textContent).toContain('Foto 1: Shows a serial number.');
    privacy.querySelector<HTMLInputElement>('input')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['photoIdsToPublish']()).toEqual([8]);
    expect(element.querySelector('img[alt="Foto 1 (weggelassen)"]')).not.toBeNull();
  });

  it('completes technical data from the web', async () => {
    const completeFacts = vi.fn().mockReturnValue(
      of([
        {
          name: 'Resolution',
          value: '5120x2880',
          source: 'WEB',
          sourceUrl: 'https://example.com/specs',
        },
      ]),
    );
    const { fixture, element } = await full(
      { ...DRAFT, facts: [{ name: 'Model', value: 'iMac18,3', source: 'LABEL' }] },
      { completeFacts },
    );

    button(element, 'Technische Daten ergänzen').click();
    await fixture.whenStable();

    expect(completeFacts.mock.calls[0][0].body.facts).toEqual([
      { name: 'Model', value: 'iMac18,3', source: 'LABEL' },
    ]);
    expect(element.textContent).toContain('Aus dem Web, bitte prüfen');
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="https://example.com/specs"]')!.textContent,
    ).toContain('Quelle');
  });

  it('labels every fact input', async () => {
    const { element } = await full(DRAFT);

    const inputs = element.querySelectorAll<HTMLInputElement>(
      '[data-testid="fact"] input:not([type=checkbox])',
    );
    expect(inputs.length).toBe(2);
    for (const input of Array.from(inputs)) {
      expect(element.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });

  it('fills the locality from the postcode and keeps it editable', async () => {
    const place = vi.fn().mockReturnValue(of({ postcode: '1700', locality: 'Fribourg' }));
    const { fixture, element } = await full(DRAFT, {}, place);
    const postcode = element.querySelector<HTMLInputElement>('input[name="postcode"]')!;
    const locality = () => element.querySelector<HTMLInputElement>('input[name="locality"]')!;

    postcode.value = '1700';
    postcode.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(place.mock.calls[0][0]).toEqual({ postcode: '1700' });
    expect(locality().value).toBe('Fribourg');
    locality().value = 'Villars-sur-Glâne';
    locality().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(locality().value).toBe('Villars-sur-Glâne');
  });

  it('fills postcode and locality from the device location', async () => {
    const near = vi.fn().mockReturnValue(of({ postcode: '1700', locality: 'Fribourg' }));
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 46.80187, longitude: 7.15123 } } as GeolocationPosition),
      },
    });
    const { fixture, element } = await full(DRAFT, {}, vi.fn(), { near });

    button(element, 'Mein Standort').click();
    await fixture.whenStable();
    vi.unstubAllGlobals();

    expect(near.mock.calls[0][0]).toEqual({ latitude: 46.802, longitude: 7.151 });
    expect(element.querySelector<HTMLInputElement>('input[name="postcode"]')!.value).toBe('1700');
    expect(element.querySelector<HTMLInputElement>('input[name="locality"]')!.value).toBe(
      'Fribourg',
    );
  });

  it('asks for the postcode when the device location is denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (_: PositionCallback, fail: () => void) => fail() },
    });
    const { fixture, element } = await full(DRAFT);

    button(element, 'Mein Standort').click();
    await fixture.whenStable();
    vi.unstubAllGlobals();

    expect(element.textContent).toContain('Standort nicht verfügbar.');
  });

  it('starts with the last location used', async () => {
    localStorage.setItem(
      'sell.lastLocation',
      JSON.stringify({ postcode: '8004', locality: 'Zürich' }),
    );
    const { element } = await full(DRAFT);

    expect(element.querySelector<HTMLInputElement>('input[name="postcode"]')!.value).toBe('8004');
    expect(element.querySelector<HTMLInputElement>('input[name="locality"]')!.value).toBe('Zürich');
  });

  it('publishes only label and confirmed facts after an explicit click', async () => {
    const publish = vi.fn().mockReturnValue(of({ id: 1 }));
    const { fixture, element } = await full(DRAFT, { publish });
    const sell = fixture.componentInstance;
    sell['price'].set(120);
    sell['postcode'].set('8001');
    sell['locality'].set('Zürich');
    await fixture.whenStable();
    expect(publish).not.toHaveBeenCalled();

    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(store.clear).toHaveBeenCalled();
    await fixture.whenStable();
    expect(element.textContent).toContain('Dein Inserat ist online.');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    button(element, 'Inserat ansehen').click();
    expect(navigate).toHaveBeenCalledWith([{ outlets: { primary: ['listings', 1], modal: null } }]);
    expect(publish.mock.calls[0][0].body).toEqual({
      title: 'Dell U2719D',
      description: 'A monitor.',
      category: 'Monitors',
      condition: 'GOOD',
      priceChf: 120,
      postcode: '8001',
      locality: 'Zürich',
      attributes: { Brand: 'Dell' },
      photoIds: [7],
    });
    expect(JSON.parse(localStorage.getItem('sell.lastLocation')!)).toEqual({
      postcode: '8001',
      locality: 'Zürich',
    });
  });
});
