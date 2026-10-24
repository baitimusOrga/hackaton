import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ListingsService, SearchService } from '../api/services';
import { Find } from './find';

const TEXT = 'working iMac 2017, bis CHF 600 in Zürich';
const REQ = {
  mustHave: [
    { attribute: 'Model', value: 'iMac', phrase: 'iMac' },
    { attribute: 'Year', value: '2017', phrase: '2017' },
  ],
  niceToHave: [],
  category: 'Computers',
  keywords: ['imac'],
  maxBudgetChf: 600,
  budgetPhrase: 'bis CHF 600',
  postcode: '8001',
  regionPhrase: 'in Zürich',
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
const OLD = {
  ...IMAC,
  listing: { ...IMAC.listing, id: 8, title: 'iMac 2015' },
  score: 55,
  fit: 'ALTERNATIVE',
  reason: '2015 statt 2017.',
  differences: ['Year: 2015 instead of 2017'],
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

function trigger(el: HTMLElement, label: string): HTMLButtonElement {
  return [...el.querySelectorAll<HTMLButtonElement>('.facet__trigger')].find((b) =>
    b.textContent!.includes(label),
  )!;
}

async function escape(fixture: Fixture) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
  it('matches without a click: the sentence with tokens, then grouped results with a why line', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [IMAC, OLD], compared: 12 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, TEXT);

    expect(create).toHaveBeenCalledWith({ body: { text: TEXT } });
    expect(matches).toHaveBeenCalledTimes(1);
    const body = matches.mock.calls[0][0].body;
    expect(body.mustHave).toEqual(REQ.mustHave);
    expect(body.keywords).toEqual(['imac']);
    expect(body.conditions).toEqual([]);
    expect(body.latitude).toBeNull();

    expect(el.querySelector('textarea')).toBeNull();
    const tokens = [...el.querySelectorAll<HTMLButtonElement>('.token')].map((b) => b.textContent);
    expect(tokens).toEqual(['iMac', '2017', 'bis CHF 600', 'in Zürich']);

    const headings = [...el.querySelectorAll('.find__grp h2')].map((h) => h.textContent);
    expect(headings[0]).toContain('Passt');
    expect(headings[0]).toContain('1 · alles belegt');
    expect(headings[1]).toContain('Alternativen');
    expect(headings[1]).toContain('1 · ausserhalb deiner Suche');
    expect(el.textContent).not.toContain('Möglich');
    expect(el.querySelector('.zw-card__why--ok')!.textContent).toContain('Passt genau.');
    expect(el.textContent).toContain('Year: 2015 instead of 2017');
    expect(el.textContent).not.toContain('92 %');
    expect(el.textContent).toContain('2 Inserate');
    expect(el.textContent).toContain('12 verglichen');
  });

  it('tapping a token leaves it out of the next search; tapping again brings it back', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);
    const year = el.querySelector<HTMLButtonElement>(
      '.token[title="Year: 2017 nicht mehr verlangen"]',
    )!;

    year.click();
    await fixture.whenStable();
    expect(matches.mock.calls[1][0].body.mustHave).toEqual([REQ.mustHave[0]]);
    expect(year.classList.contains('token--off')).toBe(true);
    expect(el.textContent).toContain('1 entfernt.');
    expect(el.textContent).toContain('Noch nichts Passendes.');

    el.querySelector<HTMLButtonElement>('.token[title="Year: 2017 wieder verlangen"]')!.click();
    await fixture.whenStable();
    expect(matches.mock.calls[2][0].body.mustHave).toEqual(REQ.mustHave);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a requirement without a phrase is a chip below the sentence', async () => {
    const create = vi
      .fn()
      .mockReturnValue(
        of({ ...REQ, mustHave: [REQ.mustHave[0], { attribute: 'Year', value: '2017' }] }),
      );
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();

    await search(fixture, el, TEXT);

    expect([...el.querySelectorAll('.token')].map((b) => b.textContent)).toEqual([
      'iMac',
      'bis CHF 600',
      'in Zürich',
    ]);
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('Year: 2017');
  });

  it('a facet change searches once when the panel closes, not before and not without a change', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    trigger(el, 'Preis').click();
    await fixture.whenStable();
    await type(fixture, el.querySelector<HTMLInputElement>('#find-budget')!, '500');
    expect(matches).toHaveBeenCalledTimes(1);

    await escape(fixture);
    expect(matches).toHaveBeenCalledTimes(2);
    expect(matches.mock.calls[1][0].body.maxBudgetChf).toBe(500);
    expect(trigger(el, 'Preis').textContent).toContain('bis 500');
    // edited by hand: no underline anymore, a chip instead
    expect(el.querySelector('.token[title="Bis CHF 500.– nicht mehr verlangen"]')).toBeNull();
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('Bis CHF 500.–');

    trigger(el, 'Preis').click();
    await fixture.whenStable();
    await escape(fixture);
    expect(matches).toHaveBeenCalledTimes(2);
  });

  it('the condition facet sends conditions and shows what is set', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    trigger(el, 'Zustand').click();
    await fixture.whenStable();
    const boxes = [
      ...el.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]'),
    ];
    boxes[2].click(); // Gut
    boxes[3].click(); // Gebraucht
    await fixture.whenStable();
    await escape(fixture);

    expect(matches).toHaveBeenCalledTimes(2);
    expect(matches.mock.calls[1][0].body.conditions).toEqual(['GOOD', 'USED']);
    expect(trigger(el, 'Zustand').textContent).toContain('2');
    expect(el.textContent).toContain('Alle entfernen');
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
    await search(fixture, el, TEXT);

    await type(
      fixture,
      el.querySelector<HTMLInputElement>('#find-adjust')!,
      'doch etwas neuere Modelle',
    );
    el.querySelector<HTMLButtonElement>('.find__adjust button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(refine).toHaveBeenCalledWith({
      body: {
        originalText: TEXT,
        refinements: [],
        current: expect.objectContaining({ category: 'Computers', mustHave: REQ.mustHave }),
        text: 'doch etwas neuere Modelle',
        topListingIds: [7],
      },
    });
    expect(matches.mock.calls[1][0].body.mustHave).toEqual(newer.mustHave);
    expect(el.textContent).toContain('↳ doch etwas neuere Modelle');
    // no phrase in the sentence: shown as a chip
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('Year: ≥ 2019');

    await TestBed.inject(Router).navigate([], { queryParams: { q: 'Bürostuhl' } });
    await fixture.whenStable();
    expect(create).toHaveBeenLastCalledWith({ body: { text: 'Bürostuhl' } });
    expect(el.textContent).not.toContain('↳ doch etwas neuere Modelle');
  });

  it('ignores a late answer to an older request', async () => {
    const first = new Subject();
    const second = new Subject();
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);
    el.querySelector<HTMLButtonElement>('.token[title="Year: 2017 nicht mehr verlangen"]')!.click();
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

  it('shows a skeleton while the listings are compared', async () => {
    const pending = new Subject();
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(pending);
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    expect(el.querySelector('.find__skeleton')).not.toBeNull();
    expect(el.querySelector('.find__grp')).toBeNull();

    pending.next({ matches: [IMAC], compared: 1 });
    await fixture.whenStable();
    expect(el.querySelector('.find__skeleton')).toBeNull();
    expect(el.querySelector('.find__grp')).not.toBeNull();
  });

  it('near me asks for the position and searches around it', async () => {
    const asked = geolocation({
      coords: { latitude: 47.37812, longitude: 8.52345 },
    } as GeolocationPosition);
    const create = vi.fn().mockReturnValue(
      of({
        ...REQ,
        postcode: undefined,
        regionPhrase: 'in meiner Nähe',
        maxDistanceKm: 25,
        nearMe: true,
      }),
    );
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
    expect(trigger(el, 'Region').textContent).toContain('25 km um deinen Standort');
    expect(
      el.querySelector('.token[title="25 km um deinen Standort nicht mehr verlangen"]')!
        .textContent,
    ).toBe('in meiner Nähe');
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

  it('restores the filters, phrases and conditions from the URL without asking the assistant again', async () => {
    const create = vi.fn();
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SearchService, useValue: { create, matches } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'iMac bis 600 in Chur',
                kw: 'imac',
                max: '600',
                maxp: 'bis 600',
                plz: '7000',
                plzp: 'in Chur',
                km: '25',
                cond: 'GOOD,USED',
              }),
            ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Find);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(create).not.toHaveBeenCalled();
    expect(matches).toHaveBeenCalledTimes(1);
    expect(matches.mock.calls[0][0].body).toMatchObject({
      keywords: ['imac'],
      maxBudgetChf: 600,
      budgetPhrase: 'bis 600',
      postcode: '7000',
      regionPhrase: 'in Chur',
      maxDistanceKm: 25,
      conditions: ['GOOD', 'USED'],
    });
    expect([...el.querySelectorAll('.token')].map((b) => b.textContent)).toEqual([
      'bis 600',
      'in Chur',
    ]);
    expect(trigger(el, 'Zustand').textContent).toContain('2');
    const url = decodeURIComponent(TestBed.inject(Router).url);
    expect(url).toContain('cond=GOOD,USED');
    expect(url).toContain('maxp=bis 600');
    expect(url).toContain('plzp=in Chur');
  });

  it('lists the auctions on /find?mode=auction before a search', async () => {
    const list = vi
      .fn()
      .mockReturnValue(
        of([{ id: 3, title: 'Aeron', priceChf: 300, saleMode: 'AUCTION', bidCount: 2 }]),
      );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SearchService, useValue: { create: vi.fn(), matches: vi.fn() } },
        { provide: ListingsService, useValue: { list } },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ mode: 'auction' })) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Find);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(list).toHaveBeenCalledWith({ saleMode: 'AUCTION' });
    expect(el.textContent).toContain('Alle Auktionen');
    expect(el.querySelector('a[href="/listings/3"]')).not.toBeNull();
    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('"Mein Standort" in the Region facet switches to the position and searches once', async () => {
    const asked = geolocation({
      coords: { latitude: 47.37812, longitude: 8.52345 },
    } as GeolocationPosition);
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    trigger(el, 'Region').click();
    await fixture.whenStable();
    await type(fixture, el.querySelector<HTMLInputElement>('#find-postcode')!, '3000');
    [...el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((b) => b.textContent!.includes('Mein Standort'))!
      .click();
    await fixture.whenStable();
    await escape(fixture);

    expect(asked).toHaveBeenCalledTimes(1);
    expect(matches).toHaveBeenCalledTimes(2);
    expect(matches.mock.calls[1][0].body).toMatchObject({
      latitude: 47.378,
      longitude: 8.523,
      maxDistanceKm: 25,
      nearMe: true,
    });
    expect(matches.mock.calls[1][0].body.postcode).toBeUndefined();
    expect(trigger(el, 'Region').textContent).toContain('25 km um deinen Standort');
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('25 km um deinen Standort');
  });

  it('ignores malformed URL filters instead of breaking', async () => {
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SearchService, useValue: { create: vi.fn(), matches } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'iMac',
                must:
                  '[null, {"attribute":"Model","value":"iMac","phrase":"' +
                  'x'.repeat(100) +
                  '"}, 7]',
                nice: '{}',
                cond: 'toString,GOOD,GOOD',
              }),
            ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Find);
    await fixture.whenStable();

    const body = matches.mock.calls[0][0].body;
    expect(body.mustHave).toEqual([{ attribute: 'Model', value: 'iMac', phrase: 'x'.repeat(80) }]);
    expect(body.niceToHave).toEqual([]);
    expect(body.conditions).toEqual(['GOOD']);
  });

  it('"Alle entfernen" clears the filters but keeps the requirements', async () => {
    const create = vi.fn().mockReturnValue(of(REQ));
    const matches = vi.fn().mockReturnValue(of({ matches: [], compared: 0 }));
    const { fixture, el } = setup({ create, matches });
    await fixture.whenStable();
    await search(fixture, el, TEXT);

    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes('Alle entfernen'))!
      .click();
    await fixture.whenStable();

    expect(matches).toHaveBeenCalledTimes(2);
    const body = matches.mock.calls[1][0].body;
    expect(body.mustHave).toEqual(REQ.mustHave);
    expect(body.maxBudgetChf).toBeUndefined();
    expect(body.postcode).toBeUndefined();
    expect(body.category).toBeNull();
    expect(el.textContent).not.toContain('Alle entfernen');
    expect(el.textContent).toContain('2 entfernt.');
  });
});
