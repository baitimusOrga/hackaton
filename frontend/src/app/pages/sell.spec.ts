import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SellingService } from '../api/services';
import { ListingDraft } from '../api/models';
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
  questions: ['Please photograph the model label.'],
  price: { lowChf: 100, midChf: 120, highChf: 140, provisional: true, evidence: [] },
  privacyWarnings: [],
};

const button = (element: HTMLElement, text: string) =>
  Array.from(element.querySelectorAll('button')).find((b) => b.textContent!.includes(text))!;

/** Opens the sell page, creates a draft from one photo and switches to the one-page view. */
async function draftFrom(draft: ListingDraft, extra: object = {}) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const createDraft = vi.fn().mockReturnValue(of(draft));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: SellingService, useValue: { createDraft, ...extra } },
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
  const stepAfterDraft = element.textContent!;
  button(element, 'Alles auf einer Seite').click();
  await fixture.whenStable();
  return { fixture, element, createDraft, stepAfterDraft };
}

describe('Sell', () => {
  it('drafts from a photo, marks facts by source and confirms a suggestion', async () => {
    const { fixture, element, createDraft, stepAfterDraft } = await draftFrom(DRAFT);

    expect(createDraft).toHaveBeenCalledOnce();
    expect(stepAfterDraft).toContain('2 von 5');
    expect(stepAfterDraft).toContain('Please photograph the model label.');
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

  it('asks for more photos when nothing was read from a label', async () => {
    const { stepAfterDraft } = await draftFrom({ ...DRAFT, facts: [] });

    expect(stepAfterDraft).toContain('Das konnten wir nicht erkennen.');
  });

  it("asks the seller to choose the condition when the photos don't show it", async () => {
    const { element } = await draftFrom({ ...DRAFT, condition: null });

    expect(element.querySelector('input[name="condition"]:checked')).toBeNull();
    expect(element.textContent).toContain('Auf den Fotos sehen wir den Zustand nicht.');
  });

  it('warns about private details and leaves the photo out', async () => {
    const { fixture, element } = await draftFrom({
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
    const { fixture, element } = await draftFrom(
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
    const { element } = await draftFrom(DRAFT);

    const inputs = element.querySelectorAll<HTMLInputElement>(
      '[data-testid="fact"] input:not([type=checkbox])',
    );
    expect(inputs.length).toBe(2);
    for (const input of Array.from(inputs)) {
      expect(element.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });

  it('publishes only label and confirmed facts after an explicit click', async () => {
    const publish = vi.fn().mockReturnValue(of({ id: 1 }));
    const { fixture, element } = await draftFrom(DRAFT, { publish });
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
  });
});
