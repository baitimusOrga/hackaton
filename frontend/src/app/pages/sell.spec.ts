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
};

describe('Sell', () => {
  it('drafts from a photo, marks facts by source and confirms a suggestion', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
    const createDraft = vi.fn().mockReturnValue(of(DRAFT));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SellingService, useValue: { createDraft } }],
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
});
