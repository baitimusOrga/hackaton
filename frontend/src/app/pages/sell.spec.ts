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

function button(element: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(element.querySelectorAll('button')).find((b) => b.textContent!.includes(text))!;
}

/** Opens the sell page, adds one photo and runs the analysis with the given stream behaviour. */
async function analyse(runs: Run[], extra: object = {}, place = vi.fn()) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const uploadPhotos = vi.fn().mockReturnValue(of([7]));
  const run = vi.fn();
  runs.forEach((r) => run.mockImplementationOnce(r));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SellingService, useValue: { uploadPhotos, ...extra } },
      { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
      { provide: DraftStream, useValue: { run } },
      { provide: PlacesService, useValue: { place } },
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
  button(element, 'Analyse').click();
  await fixture.whenStable();
  return { fixture, element, uploadPhotos, run, place };
}

/** Runs the analysis and skips straight to the review form. */
async function review(draft: ListingDraft, extra: object = {}) {
  const page = await analyse([streams(done(draft))], extra);
  button(page.element, 'To overview')?.click();
  await page.fixture.whenStable();
  return page;
}

describe('Sell', () => {
  it('uploads once, marks detections on the photo and starts with the identity gap', async () => {
    const { element, uploadPhotos, run } = await analyse([
      streams(detection('Brand: Dell'), done(DRAFT)),
    ]);

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toEqual({ photoIds: [7], confirmedFacts: [] });
    expect(element.querySelector('[data-testid="detection"]')!.textContent).toContain(
      'Brand: Dell',
    );
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Model?');
    expect(element.textContent).toContain('1 of 3');
  });

  it('answers, confirms and skips gaps, then shows what is still open', async () => {
    const { fixture, element } = await analyse([streams(done(DRAFT))]);

    const answer = element.querySelector<HTMLInputElement>('[data-testid="gap"] input')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    button(element, 'Save').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Size: 27"?');

    button(element, 'Correct').click();
    await fixture.whenStable();
    button(element, 'Skip').click();
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="gap"]')).toBeNull();
    expect(element.textContent).toContain('Still open: Resolution');
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

  it('a photo gap uploads only the new photo and streams again with the confirmed facts', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Photograph the label', options: [] },
    };
    const { fixture, element, uploadPhotos, run } = await analyse([
      streams(photoGap, done(DRAFT)),
      streams(done({ ...DRAFT, photoIds: [7, 8] })),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain(
      'Photograph the label',
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
    button(element, 'Analyse again').click();
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[data-testid="gap"]')).not.toBeNull();
  });

  it('marks facts by source in the review and confirms a suggestion', async () => {
    const { fixture, element } = await review(DRAFT);
    const markers = () =>
      Array.from(element.querySelectorAll('[data-testid="marker"]')).map((m) =>
        m.textContent!.trim(),
      );
    expect(markers()).toEqual(['From label', 'Suggested — please check']);
    expect(element.textContent).toContain('Provisional estimate');

    element.querySelector<HTMLInputElement>('[data-testid="fact"] input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(markers()).toEqual(['From label', 'Confirmed by you']);
  });

  it("asks the seller to choose the condition when the photos don't show it", async () => {
    const { element } = await review({ ...DRAFT, condition: null });

    expect(element.querySelector<HTMLSelectElement>('select[name="condition"]')!.value).toBe('');
    expect(element.textContent).toContain(
      "The photos don't show the condition — please choose it.",
    );
  });

  it('warns about private details and leaves the photo out', async () => {
    const { fixture, element } = await review({
      ...DRAFT,
      photoIds: [7, 8],
      privacyWarnings: [{ photo: 1, text: 'Shows a serial number.' }],
    });

    expect(element.querySelector('[aria-label="Privacy check"]')!.textContent).toContain(
      'Photo 1: Shows a serial number.',
    );
    element.querySelector<HTMLInputElement>('[aria-label="Privacy check"] input')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['photoIdsToPublish']()).toEqual([8]);
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
    const { fixture, element } = await review(
      { ...DRAFT, facts: [{ name: 'Model', value: 'iMac18,3', source: 'LABEL' }] },
      { completeFacts },
    );

    button(element, 'Complete technical data').click();
    await fixture.whenStable();

    expect(completeFacts.mock.calls[0][0].body.facts).toEqual([
      { name: 'Model', value: 'iMac18,3', source: 'LABEL' },
    ]);
    expect(element.textContent).toContain('From the web — please check');
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="https://example.com/specs"]')!.textContent,
    ).toContain('Source');
  });

  it('fills the locality from the postcode and keeps it editable', async () => {
    const place = vi.fn().mockReturnValue(of({ postcode: '1700', locality: 'Fribourg' }));
    const page = await analyse([streams(done(DRAFT))], {}, place);
    button(page.element, 'To overview').click();
    await page.fixture.whenStable();
    const postcode = page.element.querySelector<HTMLInputElement>('input[name="postcode"]')!;
    const locality = () => page.element.querySelector<HTMLInputElement>('input[name="locality"]')!;

    postcode.value = '1700';
    postcode.dispatchEvent(new Event('input'));
    await page.fixture.whenStable();

    expect(place.mock.calls[0][0]).toEqual({ postcode: '1700' });
    expect(locality().value).toBe('Fribourg');
    locality().value = 'Villars-sur-Glâne';
    locality().dispatchEvent(new Event('input'));
    await page.fixture.whenStable();
    expect(locality().value).toBe('Villars-sur-Glâne');
  });

  it('starts with the last location used', async () => {
    localStorage.setItem(
      'sell.lastLocation',
      JSON.stringify({ postcode: '8004', locality: 'Zürich' }),
    );
    const { element } = await review(DRAFT);
    localStorage.removeItem('sell.lastLocation');

    expect(element.querySelector<HTMLInputElement>('input[name="postcode"]')!.value).toBe('8004');
    expect(element.querySelector<HTMLInputElement>('input[name="locality"]')!.value).toBe('Zürich');
  });

  it('labels every fact input', async () => {
    const { element } = await review(DRAFT);

    const inputs = element.querySelectorAll<HTMLInputElement>(
      '[data-testid="fact"] input:not([type=checkbox])',
    );
    expect(inputs.length).toBe(2);
    for (const input of Array.from(inputs)) {
      expect(element.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });
});
