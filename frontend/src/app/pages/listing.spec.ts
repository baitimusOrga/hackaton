import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BookmarksService, ListingsService } from '../api/services';
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

  for (const [saved, label, call] of [
    [false, 'Merken', 'add'],
    [true, 'Gemerkt', 'remove'],
  ] as const) {
    it('shows "' + label + '" and calls ' + call + ' on click', async () => {
      const bookmarks = {
        mine: vi.fn().mockReturnValue(of(saved ? [{ id: 4 }] : [])),
        add: vi.fn().mockReturnValue(of(undefined)),
        remove: vi.fn().mockReturnValue(of(undefined)),
      };
      const user = { id: 'u' };
      TestBed.configureTestingModule({
        providers: [
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })) } },
          {
            provide: ListingsService,
            useValue: { get: () => of({ id: 4, title: 'Desk' }), list: () => of([]) },
          },
          { provide: BookmarksService, useValue: bookmarks },
          { provide: Auth, useValue: { user: () => user, restore: () => Promise.resolve(user) } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await fixture.whenStable();
      const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (b) => b.textContent!.trim() === label,
      )!;
      button.click();
      await fixture.whenStable();
      expect(bookmarks[call]).toHaveBeenCalledWith({ id: 4 });
      expect(button.textContent!.trim()).toBe(saved ? 'Merken' : 'Gemerkt');
    });
  }
});
