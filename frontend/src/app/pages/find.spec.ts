import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SearchService } from '../api/services';
import { Find } from './find';

describe('Find', () => {
  it('renders chips and sends a moved chip as nice-to-have', async () => {
    const create = vi.fn().mockReturnValue(
      of({
        mustHave: [
          { attribute: 'Model', value: 'iMac 27' },
          { attribute: 'Year', value: '2017' },
        ],
        niceToHave: [],
        category: 'Computers',
        keywords: ['imac', 'apple'],
        maxBudgetChf: 600,
        postcode: '8001',
        acceptUnknown: true,
      }),
    );
    const matches = vi.fn().mockReturnValue(of({ confirmed: [], possible: [], alternatives: [] }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SearchService, useValue: { create, matches } }],
    });
    const fixture = TestBed.createComponent(Find);
    const el: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    const textarea = el.querySelector('textarea')!;
    textarea.value = 'working iMac 27';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({ body: { text: 'working iMac 27' } });
    const must = el.querySelector('[data-testid="mustHave"]')!;
    expect(must.textContent).toContain('Model: iMac 27');
    expect(must.textContent).toContain('Year: 2017');

    el.querySelector<HTMLButtonElement>('button[aria-label="Move Year to nice to have"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="niceToHave"]')!.textContent).toContain('Year: 2017');

    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Show matches'))!
      .click();
    await fixture.whenStable();

    const body = matches.mock.calls[0][0].body;
    expect(body.mustHave).toEqual([{ attribute: 'Model', value: 'iMac 27' }]);
    expect(body.niceToHave).toEqual([{ attribute: 'Year', value: '2017' }]);
    expect(body.keywords).toEqual(['imac', 'apple']);
    expect(body.maxBudgetChf).toBe(600);
    expect(el.textContent).toContain('Nothing matches yet.');
  });
});
