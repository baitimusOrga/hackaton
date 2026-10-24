import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuctionState } from '../api/models';
import { AuctionsService, ListingsService } from '../api/services';
import { Auth } from '../auth/auth';
import { ListingPage } from './listing';

describe('ListingPage', () => {
  for (const [sellerName, label] of [
    ['Test Seller', 'Test Seller (eigene Angabe)'],
    [null, 'Demo-Inserat'],
  ]) {
    it('shows ' + label + ' and similar listings', async () => {
      const desk = { id: 4, title: 'Desk', priceChf: 1250, category: 'Möbel', postcode: '8001' };
      const get = vi.fn().mockReturnValue(of({ ...desk, sellerName }));
      const list = vi.fn().mockReturnValue(of([desk, { id: 5, title: 'Chair', priceChf: 40 }]));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })) } },
          { provide: ListingsService, useValue: { get, list } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(get).toHaveBeenCalledWith({ id: 4 });
      expect(list).toHaveBeenCalledWith({ category: 'Möbel', postcode: '8001', radiusKm: 25 });
      expect(element.querySelector('[data-testid="seller"]')!.textContent!.trim()).toBe(label);
      expect(element.querySelector('h1')!.textContent).toBe('Desk');
      expect(element.textContent).toContain('CHF 1’250.–');
      expect(element.textContent).toContain('Chair');
    });
  }

  it('polls the auction, shows the outbid line and places a bid', async () => {
    vi.useFakeTimers();
    try {
      const ends = new Date(Date.now() + 3_600_000).toISOString();
      const chair = { id: 9, title: 'Aeron', priceChf: 100, saleMode: 'AUCTION', endsAt: ends };
      const state = (over: Partial<AuctionState>): AuctionState => ({
        endsAt: ends,
        ended: false,
        currentBidChf: 205,
        bidCount: 3,
        minimumNextBidChf: 210,
        incrementChf: 5,
        myMaxChf: 200,
        leading: false,
        bids: [
          { amountChf: 205, bidder: 'a···a', at: ends, automatic: true, mine: false },
          { amountChf: 200, bidder: 'b···b', at: ends, automatic: false, mine: true },
          { amountChf: 100, bidder: 'a···a', at: ends, automatic: false, mine: false },
        ],
        ...over,
      });
      const getAuction = vi.fn().mockReturnValue(of(state({})));
      const placeBid = vi
        .fn()
        .mockReturnValue(of(state({ currentBidChf: 305, myMaxChf: 400, leading: true })));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '9' })) } },
          { provide: ListingsService, useValue: { get: () => of(chair), list: () => of([]) } },
          { provide: AuctionsService, useValue: { getAuction, placeBid } },
          { provide: Auth, useValue: { user: signal({ id: 'b' }) } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      // the poll interval keeps the app unstable, so render by hand instead of whenStable()
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(getAuction).toHaveBeenCalledTimes(1);
      expect(element.querySelector('.status--outbid h3')!.textContent).toContain(
        'Du wurdest überboten',
      );
      expect(element.textContent).toContain(
        'Dein Maximum war CHF 200.–. Biete mindestens CHF 210.–, um wieder zu führen.',
      );
      expect(element.textContent).toContain('Mindestens CHF 210.– · Schritte von CHF 5.–');
      expect(element.querySelectorAll('.bids li')).toHaveLength(3);
      expect(element.querySelector('.bids .mine')!.textContent).toContain('Du');

      await vi.advanceTimersByTimeAsync(5000);
      expect(getAuction).toHaveBeenCalledTimes(2);
      fixture.detectChanges();

      const picks = Array.from(element.querySelectorAll<HTMLButtonElement>('.picks button'));
      expect(picks.map((b) => b.textContent!.trim())).toEqual([
        'CHF 210.–',
        'CHF 215.–',
        'CHF 220.–',
      ]);
      picks[1].click();
      fixture.detectChanges();
      const input = element.querySelector<HTMLInputElement>('#bid-max')!;
      expect(input.value).toBe('215');
      expect(picks[1].getAttribute('aria-pressed')).toBe('true');
      expect(placeBid).not.toHaveBeenCalled();

      input.value = '400';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(element.querySelector('#bid-note')!.textContent).toContain(
        'Dein Gebot startet bei CHF 210.–. Bietet jemand mit, erhöhen wir automatisch bis CHF 400.–.',
      );
      element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(placeBid.mock.calls[0][0]).toEqual({ id: 9, body: { maxChf: 400 } });
      expect(element.textContent).toContain('Du führst mit CHF 305.–');
      expect(element.textContent).toContain(
        'Gebot angenommen. Dein Maximum CHF 400.– bleibt geheim',
      );
      expect(element.textContent).not.toContain('überboten');
      const raised = element.querySelectorAll<HTMLButtonElement>('.picks button');
      expect(raised[0].textContent!.trim()).toBe('CHF 405.–');

      // the mock keeps answering with the state from before the bid: a stale poll must not undo it
      await vi.advanceTimersByTimeAsync(5000);
      fixture.detectChanges();
      expect(getAuction).toHaveBeenCalledTimes(3);
      expect(element.textContent).toContain('Du führst mit CHF 305.–');
    } finally {
      vi.useRealTimers();
    }
  });

  for (const [coordinates, shown] of [
    [{ latitude: 47.378, longitude: 8.523 }, true],
    [{ latitude: null, longitude: null }, false],
  ] as const) {
    it(shown ? 'shows the area map' : 'hides the map without coordinates', async () => {
      const get = vi
        .fn()
        .mockReturnValue(of({ title: 'Desk', priceChf: 80, postcode: '8004', ...coordinates }));
      TestBed.configureTestingModule({
        providers: [
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })) } },
          { provide: ListingsService, useValue: { get, list: () => of([]) } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role="region"]') !== null).toBe(shown);
    });
  }

  describe('bid errors', () => {
    const ends = new Date(Date.now() + 3_600_000).toISOString();
    const open: AuctionState = {
      endsAt: ends,
      ended: false,
      currentBidChf: 205,
      bidCount: 2,
      minimumNextBidChf: 210,
      incrementChf: 5,
      myMaxChf: null,
      leading: false,
      ownListing: false,
      bids: [],
    };
    const problem = (status: number, detail: string) =>
      throwError(() => new HttpErrorResponse({ status, error: { status, detail } }));

    async function page(state: AuctionState, placeBid = vi.fn()) {
      vi.useFakeTimers();
      const getAuction = vi.fn().mockReturnValue(of(state));
      const chair = { id: 9, title: 'Aeron', priceChf: 100, saleMode: 'AUCTION', endsAt: ends };
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '9' })) } },
          { provide: ListingsService, useValue: { get: () => of(chair), list: () => of([]) } },
          { provide: AuctionsService, useValue: { getAuction, placeBid } },
          { provide: Auth, useValue: { user: signal({ id: 'b' }) } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      const bid = (amount: string) => {
        const input = element.querySelector<HTMLInputElement>('#bid-max')!;
        input.value = amount;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
        fixture.detectChanges();
      };
      const note = () => element.querySelector('#bid-note')!;
      return { fixture, element, getAuction, bid, note };
    }

    afterEach(() => vi.useRealTimers());

    it('catches a too low or malformed maximum before sending it', async () => {
      const placeBid = vi.fn();
      const { element, bid, note } = await page(open, placeBid);
      bid('200');
      expect(note().textContent).toContain('Dein Maximum muss mindestens CHF 210.– sein.');
      expect(note().getAttribute('role')).toBe('alert');
      expect(element.querySelector('#bid-max')!.getAttribute('aria-invalid')).toBe('true');
      bid('210.555');
      expect(note().textContent).toContain('Höchstens zwei Stellen nach dem Komma.');
      expect(placeBid).not.toHaveBeenCalled();
    });

    it('names the amount on the button', async () => {
      const { fixture, element } = await page(open);
      const input = element.querySelector<HTMLInputElement>('#bid-max')!;
      input.value = '400';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(element.querySelector('#bid-note')!.textContent).toContain(
        'Dein Gebot startet bei CHF 210.–. Bietet jemand mit, erhöhen wir automatisch bis CHF 400.–.',
      );
      expect(element.querySelector('button[type="submit"]')!.textContent).toContain(
        'Maximum CHF 400.– bieten',
      );
    });

    it('says when the own bid is outbid right away by a higher maximum', async () => {
      const placeBid = vi
        .fn()
        .mockReturnValue(
          of({ ...open, currentBidChf: 405, bidCount: 4, minimumNextBidChf: 410, myMaxChf: 400 }),
        );
      const { element, bid } = await page(open, placeBid);
      bid('400');
      expect(element.querySelector('.status--outbid')!.textContent).toContain(
        'Gebot angenommen, aber ein anderes Maximum ist höher. Der Preis stieg automatisch auf CHF 405.–. Biete mindestens CHF 410.–, um zu führen.',
      );
    });

    it('explains a lost race inline and refreshes the numbers', async () => {
      const placeBid = vi
        .fn()
        .mockReturnValue(problem(400, 'Your maximum must be at least CHF 215.'));
      const { getAuction, bid, note } = await page(open, placeBid);
      bid('210');
      expect(placeBid).toHaveBeenCalledOnce();
      expect(note().textContent).toContain('Dein Maximum muss mindestens CHF 215.– sein.');
      expect(getAuction).toHaveBeenCalledTimes(2);
    });

    it('shows an ended auction inline instead of a toast', async () => {
      const placeBid = vi.fn().mockReturnValue(problem(409, 'This auction has ended.'));
      const { getAuction, bid, note } = await page(open, placeBid);
      bid('210');
      expect(note().textContent).toContain('Diese Auktion ist beendet.');
      expect(getAuction).toHaveBeenCalledTimes(2);
    });

    it('tells the seller instead of offering a form', async () => {
      const { element } = await page({ ...open, ownListing: true });
      expect(element.querySelector('#bid-max')).toBeNull();
      expect(element.textContent).toContain('Das ist dein Inserat. Du kannst nicht mitbieten.');
    });
  });
});
