import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SearchService } from '../api/services';
import { Find } from './find';

const REQ = {
  mustHave: [
    { attribute: 'Model', value: 'iMac' },
    { attribute: 'Year', value: '2017' },
  ],
  niceToHave: [],
  category: 'Computers',
  keywords: ['imac'],
  maxBudgetChf: 600,
  postcode: '8001',
  nearMe: false,
};

const IMAC = {
  listing: { id: 7, title: 'iMac 27" 5K', priceChf: 520, condition: 'GOOD', locality: 'Zürich' },
  score: 92,
  fit: 'MATCH',
  reason: 'Passt genau.',
  matched: ['Model: iMac'],
  missingDetails: [],
  differences: [],
};

interface Fixture {
  whenStable(): Promise<unknown>;
}

function setup(service: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: SearchService, useValue: service }],
  });
  const fixture = TestBed.createComponent(Find);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

async function type(
  fixture: Fixture,
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function search(fixture: Fixture, el: HTMLElement, text: string) {
  await type(fixture, el.querySelector('textarea')!, text);
  el.querySelector<HTMLButtonElement>('.find__query button[type="submit"]')!.click();
  await fixture.whenStable();
}

function geolocation(position: GeolocationPosition | null) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) =>
    position ? ok(position) : fail({ code: 1 } as GeolocationPositionError),
  );
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

describe('Find', () => {
  it('matches without a click and shows one ranked list', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 12 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, 'working iMac');

    expect(create).toHaveBeenCalledWith({ body: { text: 'working iMac' } });
    expect(matches).toHaveBeenCalledTimes(1);
    const body = matches.mock.calls[0][0].body;
    expect(body).not.toHaveProperty('acceptUnknown');
    expect(body.mustHave).toEqual(REQ.mustHave);
    expect(body.keywords).toEqual(['imac']);
    expect(body.latitude).toBeNull();
    expect(el.textContent).toContain('92 % · Passt — Passt genau.');
    expect(el.textContent).toContain('1 Inserate');
    expect(el.textContent).toContain('12 verglichen');
    expect(el.querySelector('[data-testid="mustHave"]')!.textContent).toContain('Year: 2017');
  });

  it('removing a chip or changing the radius matches again without a new parse', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, 'working iMac');

    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Year zu Wäre schön verschieben"]',
    )!.click();
    await fixture.whenStable();
    expect(matches.mock.calls[1][0].body.niceToHave).toEqual([
      { attribute: 'Year', value: '2017' },
    ]);

    const radius = el.querySelector<HTMLSelectElement>('#find-radius')!;
    radius.value = radius.options[3].value; // 25 km
    radius.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(matches.mock.calls[2][0].body.maxDistanceKm).toBe(25);

    expect(create).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Noch nichts Passendes.');
  });

  it('refines with the original prompt, history and top ids; a new prompt clears the history', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 12 }));
    const newer = {
      ...REQ,
      mustHave: [{ attribute: 'Year', value: '2019', comparison: 'AT_LEAST' }],
    };
    const refine = vi.fn().mockReturnValue(of(newer));
    const { fixture, el } = setup({ create, matches, refine });
    await fixture.whenStable();
    await search(fixture, el, 'working iMac');

    await type(
      fixture,
      el.querySelector<HTMLInputElement>('#find-adjust')!,
      'doch etwas neuere Modelle',
    );
    el.querySelector<HTMLButtonElement>('.find__adjust button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(refine).toHaveBeenCalledWith({
      body: {
        originalText: 'working iMac',
        refinements: [],
        current: expect.objectContaining({ category: 'Computers', mustHave: REQ.mustHave }),
        text: 'doch etwas neuere Modelle',
        topListingIds: [7],
      },
    });
    expect(matches.mock.calls[1][0].body.mustHave).toEqual(newer.mustHave);
    expect(el.textContent).toContain('↳ doch etwas neuere Modelle');
    expect(el.textContent).toContain('Year: ≥ 2019');

    await search(fixture, el, 'Bürostuhl');
    expect(el.textContent).not.toContain('↳ doch etwas neuere Modelle');
  });

  it('ignores a late answer to an older request', async () => {
    const first = new Subject();
    const second = new Subject();
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, 'working iMac');
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Year zu Wäre schön verschieben"]',
    )!.click();
    await fixture.whenStable();

    second.next({ matches: [IMAC], compared: 3 });
    first.next({
      matches: [{ ...IMAC, listing: { ...IMAC.listing, id: 8, title: 'Alte Antwort' } }],
      compared: 9,
    });
    await fixture.whenStable();

    expect(el.textContent).toContain('3 verglichen');
    expect(el.textContent).not.toContain('Alte Antwort');
  });

  it('near me asks for the position and searches around it', async () => {
    const asked = geolocation({
      coords: { latitude: 47.37812, longitude: 8.52345 },
    } as GeolocationPosition);
    const create = vi
      .fn()
      .mockReturnValue(of({ ...REQ, postcode: undefined, maxDistanceKm: 25, nearMe: true }));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC], compared: 4 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, 'iMac in meiner Nähe');

    expect(asked).toHaveBeenCalledTimes(1);
    const body = matches.mock.calls[0][0].body;
    expect(body).toMatchObject({
      latitude: 47.378,
      longitude: 8.523,
      maxDistanceKm: 25,
      nearMe: true,
    });
    expect(body.postcode).toBeUndefined();
    expect(el.textContent).toContain('25 km um deinen Standort');
  });

  it('without a position it says so and searches Swiss-wide', async () => {
    geolocation(null);
    const create = vi.fn().mockReturnValue(of({ ...REQ, maxDistanceKm: 25, nearMe: true }));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, 'iMac in meiner Nähe');

    const body = matches.mock.calls[0][0].body;
    expect(body.latitude).toBeNull();
    expect(body.maxDistanceKm).toBeUndefined();
    expect(el.textContent).toContain('Standort nicht verfügbar.');
  });
});
