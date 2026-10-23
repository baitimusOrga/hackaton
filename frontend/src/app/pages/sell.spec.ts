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

/** Opens the sell page and creates a draft from one photo, with the given service mocks. */
async function draftFrom(draft: ListingDraft, extra: object = {}) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const createDraft = vi.fn().mockReturnValue(of(draft));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
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
  element.querySelector<HTMLButtonElement>('button.primary')!.click();
  await fixture.whenStable();
  return { fixture, element, createDraft };
}

describe('Sell', () => {
  it('drafts from a photo, marks facts by source and confirms a suggestion', async () => {
    const { fixture, element, createDraft } = await draftFrom(DRAFT);

    expect(createDraft).toHaveBeenCalledOnce();
    const markers = () =>
      Array.from(element.querySelectorAll('[data-testid="marker"]')).map((m) =>
        m.textContent!.trim(),
      );
    expect(markers()).toEqual(['From label', 'Suggested — please check']);
    expect(element.textContent).toContain('Please photograph the model label.');
    expect(element.textContent).toContain('Provisional estimate');

    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(markers()).toEqual(['From label', 'Confirmed by you']);
  });

  it("asks the seller to choose the condition when the photos don't show it", async () => {
    const { element } = await draftFrom({ ...DRAFT, condition: null });

    expect(element.querySelector<HTMLSelectElement>('select[name="condition"]')!.value).toBe('');
    expect(element.textContent).toContain(
      "The photos don't show the condition — please choose it.",
    );
  });

  it('warns about private details and leaves the photo out', async () => {
    const { fixture, element } = await draftFrom({
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
    expect(element.querySelector('img[alt="Photo 1 (left out)"]')).not.toBeNull();
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
    const button = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent!.includes('Complete technical data'),
    )!;

    button.click();
    await fixture.whenStable();

    expect(completeFacts.mock.calls[0][0].body.facts).toEqual([
      { name: 'Model', value: 'iMac18,3', source: 'LABEL' },
    ]);
    expect(element.textContent).toContain('From the web — please check');
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="https://example.com/specs"]')!.textContent,
    ).toContain('Source');
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
});
