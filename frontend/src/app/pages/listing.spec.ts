import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { ListingPage } from './listing';

describe('ListingPage', () => {
  for (const [sellerName, label] of [
    ['Test Seller', 'Sold by Test Seller'],
    [null, 'Demo listing'],
  ]) {
    it('shows ' + label, async () => {
      const get = vi.fn().mockReturnValue(of({ title: 'Desk', priceChf: 80, sellerName }));
      TestBed.configureTestingModule({
        providers: [
          { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })) } },
          { provide: ListingsService, useValue: { get } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await fixture.whenStable();
      expect(get).toHaveBeenCalledWith({ id: 4 });
      expect(fixture.nativeElement.querySelector('[data-testid="seller"]').textContent.trim()).toBe(
        label,
      );
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
          { provide: ListingsService, useValue: { get } },
        ],
      });
      const fixture = TestBed.createComponent(ListingPage);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role="region"]') !== null).toBe(shown);
    });
  }
});
