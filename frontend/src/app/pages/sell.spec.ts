import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
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
  button(element, 'Weiter').click();
  await fixture.whenStable();
  return { fixture, element, uploadPhotos, run, place };
}

/** Analyses, skips the open questions and switches to the one-page view. */
async function full(draft: ListingDraft, extra: object = {}, place = vi.fn(), places: object = {}) {
  const page = await analyse([streams(done(draft))], extra, place, places);
  button(page.element, 'Zur Übersicht')?.click();
  await page.fixture.whenStable();
  button(page.element, 'Alles auf einer Seite').click();
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

  it('shows every section of the one-page form before the photos are analysed', async () => {
    const { fixture, element } = await reopen(undefined);
    button(element, 'Alles auf einer Seite').click();
    await fixture.whenStable();

    const headings = Array.from(element.querySelectorAll('h2')).map((h) => h.textContent!.trim());
    expect(headings).toEqual(['Fotos', 'Artikel', 'Zustand', 'Preis', 'Übergabe']);
    expect(button(element, 'Veröffentlichen').disabled).toBe(true);
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
    expect(saved).toMatchObject({ draft: { title: 'Dell U2719D' }, gapsActive: true, step: 1 });
    expect(saved.photos[0]).toMatchObject({ id: 7 });
    expect(saved.photos[0].file).toBeInstanceOf(File);
  });

  it('restores a saved draft at its step', async () => {
    const { element } = await reopen({
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

    expect(element.textContent).toContain('3 von 5');
    expect(element.textContent).toContain('Entwurf wiederhergestellt.');
  });

  it('drops a saved draft older than its photos on the server', async () => {
    const { element } = await reopen({ savedAt: Date.now() - 21 * 60 * 60 * 1000, draft: DRAFT });

    expect(store.clear).toHaveBeenCalled();
    expect(element.textContent).toContain('1 von 5');
    expect(element.textContent).not.toContain('Entwurf wiederhergestellt.');
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

  it('uploads once, marks detections on the photo and asks for the model first', async () => {
    const { element, uploadPhotos, run } = await analyse([
      streams(detection('Brand: Dell'), done(DRAFT)),
    ]);

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toEqual({ photoIds: [7], confirmedFacts: [] });
    expect(element.querySelector('[data-testid="detection"]')!.textContent).toContain(
      'Brand: Dell',
    );
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Model?');
    expect(element.textContent).toContain('Frage 1 von 3');
  });

  it('answers, confirms and skips the open questions, then continues with the details', async () => {
    const { fixture, element } = await analyse([streams(done(DRAFT))]);

    const answer = element.querySelector<HTMLInputElement>('#gap-answer')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Speichern').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Size: 27"?');
    button(element, 'Stimmt').click();
    await fixture.whenStable();
    button(element, 'Überspringen').click();
    await fixture.whenStable();

    expect(element.textContent).toContain('2 von 5');
    expect(element.textContent).toContain('Noch offen: Resolution');
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
    const { fixture, element, uploadPhotos, run } = await analyse([
      streams(photoGap, done(DRAFT)),
      streams(done({ ...DRAFT, photoIds: [7, 8] })),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain(
      'Fotografiere das Typenschild',
    );

    const input = element.querySelector<HTMLInputElement>(
      '[data-testid="gap"] input[type="file"]',
    )!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledTimes(2);
    expect(uploadPhotos.mock.calls[1][0].body.photos).toHaveLength(1);
    expect(run.mock.calls[1][0].photoIds).toEqual([7, 8]);
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
    expect(element.querySelector('[data-testid="gap"]')).not.toBeNull();
  });

  it('rewrites title, description and price once when the questions are done', async () => {
    const price = { lowChf: 300, midChf: 350, highChf: 400, provisional: false, evidence: [] };
    const rewriteText = vi
      .fn()
      .mockReturnValue(of({ title: 'Dell U2719D', description: 'My Dell U2719D monitor.', price }));
    const { fixture, element } = await analyse([streams(done(DRAFT))], { rewriteText });

    const answer = element.querySelector<HTMLInputElement>('#gap-answer')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Speichern').click();
    await fixture.whenStable();
    button(element, 'Stimmt').click();
    await fixture.whenStable();
    expect(rewriteText).not.toHaveBeenCalled(); // not while answering

    button(element, 'Zur Übersicht').click();
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

  it('skipping every question needs no rewrite', async () => {
    const rewriteText = vi.fn();
    const { fixture, element } = await analyse([streams(done(DRAFT))], { rewriteText });

    button(element, 'Zur Übersicht').click();
    await fixture.whenStable();

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
      auctionDays: null,
    });
    expect(JSON.parse(localStorage.getItem('sell.lastLocation')!)).toEqual({
      postcode: '8001',
      locality: 'Zürich',
    });
  });

  it('publishes an auction with its duration and the start price', async () => {
    const publish = vi.fn().mockReturnValue(of({ id: 1 }));
    const { fixture, element } = await full(DRAFT, { publish });
    const sell = fixture.componentInstance;
    sell['price'].set(80);
    sell['postcode'].set('8001');
    sell['locality'].set('Zürich');
    button(element, 'Auktion').click();
    await fixture.whenStable();
    expect(element.querySelector('label[for="price-compact"]')!.textContent).toContain(
      'Startpreis',
    );
    const days = element.querySelector<HTMLSelectElement>('#auction-days')!;
    days.value = '7';
    days.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(publish.mock.calls[0][0].body).toMatchObject({ priceChf: 80, auctionDays: 7 });
  });
});
