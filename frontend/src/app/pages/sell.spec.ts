import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ListingsService, PlacesService, SellingService } from '../api/services';
import { DraftEvent, ListingDraft } from '../api/models';
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

type Run = (body: unknown, onEvent: (e: DraftEvent) => void) => Promise<void>;
const streams =
  (...events: DraftEvent[]): Run =>
  async (_body, onEvent) =>
    events.forEach(onEvent);

const button = (element: HTMLElement, text: string) =>
  Array.from(element.querySelectorAll('button')).find((b) => b.textContent!.includes(text))!;

/** Opens the sell page, adds one photo and analyses it with the given stream behaviour. */
async function analyse(runs: Run[], extra: object = {}, place = vi.fn()) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const uploadPhotos = vi.fn().mockReturnValue(of([7]));
  const run = vi.fn();
  runs.forEach((r) => run.mockImplementationOnce(r));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SellingService, useValue: { uploadPhotos, ...extra } },
      { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
      { provide: PlacesService, useValue: { place } },
      { provide: DraftStream, useValue: { run } },
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
async function full(draft: ListingDraft, extra: object = {}, place = vi.fn()) {
  const page = await analyse([streams(done(draft))], extra, place);
  button(page.element, 'Zur Übersicht')?.click();
  await page.fixture.whenStable();
  button(page.element, 'Alles auf einer Seite').click();
  await page.fixture.whenStable();
  return page;
}

describe('Sell', () => {
  afterEach(() => localStorage.clear());

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

  it('rewrites title and description when the seller answers a fact', async () => {
    const rewriteText = vi
      .fn()
      .mockReturnValue(of({ title: 'Dell U2719D', description: 'My Dell U2719D monitor.' }));
    const { fixture, element } = await analyse([streams(done(DRAFT))], { rewriteText });

    const answer = element.querySelector<HTMLInputElement>('#gap-answer')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Speichern').click();
    await fixture.whenStable();
    button(element, 'Stimmt').click(); // same value: no second rewrite
    await fixture.whenStable();

    expect(rewriteText).toHaveBeenCalledOnce();
    expect(rewriteText.mock.calls[0][0].body.facts).toContainEqual({
      name: 'Model',
      value: 'U2719D',
      source: 'SELLER',
    });
    expect(fixture.componentInstance['fields']()).toMatchObject({
      title: 'Dell U2719D',
      description: 'My Dell U2719D monitor.',
    });
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
