import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { ListingPage } from './listing';

describe('ListingPage', () => {
  for (const [sellerName, label] of [
    ['Test Seller', 'Test Seller'],
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
});
