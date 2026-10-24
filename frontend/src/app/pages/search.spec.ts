import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { Search } from './search';

describe('Search', () => {
  async function setup(url: string, items: unknown[]) {
    const list = vi.fn().mockReturnValue(of(items));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'search', component: Search }]),
        { provide: ListingsService, useValue: { list } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Search);
    return { list, harness, element: harness.routeNativeElement as HTMLElement };
  }

  it('shows a card per listing and preselects the category', async () => {
    const { list, element } = await setup('/search?category=Monitors', [
      { id: 2, title: 'Dell monitor', priceChf: 120 },
    ]);
    expect(list).toHaveBeenCalledWith({ category: 'Monitors' });
    expect(element.querySelector('a[href="/listings/2"]')!.textContent).toContain('Dell monitor');
    expect(element.querySelector<HTMLSelectElement>('select')!.value).toBe('Monitors');
    expect(element.querySelector('h1')!.textContent).toBe('Bildschirme');
  });

  it('reloads with the new filter and keeps the others in the URL', async () => {
    const { list, harness, element } = await setup('/search?q=imac', []);
    expect(element.textContent).toContain('Keine Inserate gefunden.');
    const maxPrice = element.querySelector<HTMLInputElement>('input[name="maxPrice"]')!;
    maxPrice.value = '500';
    maxPrice.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ q: 'imac', maxPrice: 500 });
    expect(TestBed.inject(Router).url).toBe('/search?q=imac&maxPrice=500');
  });

  it('sends the radius with a full postcode and drops it without one', async () => {
    const { list } = await setup('/search?postcode=8004&radiusKm=25', []);
    expect(list).toHaveBeenCalledWith({ postcode: '8004', radiusKm: 25 });
    TestBed.resetTestingModule();
    const partial = await setup('/search?postcode=80&radiusKm=25', []);
    expect(partial.list).toHaveBeenCalledWith({ postcode: '80' });
  });

  it('measures the radius from the buyer position, no postcode needed', async () => {
    const { list } = await setup('/search?radiusKm=5&lat=47.378&lon=8.523', []);
    expect(list).toHaveBeenCalledWith({ radiusKm: 5, lat: 47.378, lon: 8.523 });
  });

  it('sets the radius from a typed postcode without asking for the position', async () => {
    const { list, harness, element } = await setup('/search?postcode=8004', []);
    const radius = element.querySelector<HTMLSelectElement>('select[name="radiusKm"]')!;
    radius.value = '10';
    radius.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ postcode: '8004', radiusKm: 10 });
  });

  it('switches from the list to the clustered map', async () => {
    const { harness, element } = await setup('/search', [
      { id: 2, title: 'Dell monitor', priceChf: 120, latitude: 47.4, longitude: 8.5 },
    ]);
    expect(element.querySelector('a[href="/listings/2"]')).not.toBeNull();
    [...element.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Karte')!.click();
    await harness.fixture.whenStable();
    expect(element.querySelector('a[href="/listings/2"]')).toBeNull();
    expect(element.querySelector('[role="region"]')).not.toBeNull();
  });
});
