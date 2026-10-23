import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { Home } from './home';

describe('Home (Discover)', () => {
  async function setup(url: string, items: unknown[]) {
    const list = vi.fn().mockReturnValue(of(items));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Home }]),
        { provide: ListingsService, useValue: { list } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Home);
    return { list, harness, element: harness.routeNativeElement as HTMLElement };
  }

  it('shows a card per listing linking to its detail page', async () => {
    const { list, element } = await setup('/?category=Monitors', [
      { id: 2, title: 'Dell monitor', priceChf: 120, condition: 'LIKE_NEW', locality: 'Bern' },
    ]);
    expect(list).toHaveBeenCalledWith({ category: 'Monitors' });
    const card = element.querySelector('li a')!;
    expect(card.getAttribute('href')).toBe('/listings/2');
    expect(card.textContent).toContain('Dell monitor');
    expect(card.textContent).toContain('Like New');
    expect(element.querySelector<HTMLSelectElement>('select')!.value).toBe('Monitors');
  });

  it('reloads with the new filter and keeps the others in the URL', async () => {
    const { list, harness, element } = await setup('/?q=imac', []);
    expect(element.textContent).toContain('No listings match your filters.');
    const maxPrice = element.querySelector<HTMLInputElement>('input[name="maxPrice"]')!;
    maxPrice.value = '500';
    maxPrice.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ q: 'imac', maxPrice: 500 });
    expect(TestBed.inject(Router).url).toBe('/?q=imac&maxPrice=500');
  });

  it('sends the radius with a full postcode and drops it without one', async () => {
    const { list } = await setup('/?postcode=8004&radiusKm=25', []);
    expect(list).toHaveBeenCalledWith({ postcode: '8004', radiusKm: 25 });
    TestBed.resetTestingModule();
    const partial = await setup('/?postcode=80&radiusKm=25', []);
    expect(partial.list).toHaveBeenCalledWith({ postcode: '80' });
    expect(
      partial.element.querySelector<HTMLSelectElement>('select[name="radiusKm"]')!.disabled,
    ).toBe(true);
  });

  it('keeps the list as default and switches to the map', async () => {
    const { harness, element } = await setup('/', [
      { id: 2, title: 'Dell monitor', priceChf: 120, latitude: 47.4, longitude: 8.5 },
    ]);
    expect(element.querySelector('li a')).not.toBeNull();
    const map = [...element.querySelectorAll('button')].find(
      (b) => b.textContent!.trim() === 'map',
    )!;
    map.click();
    await harness.fixture.whenStable();
    expect(element.querySelector('li a')).toBeNull();
    expect(element.querySelector('[role="region"]')).not.toBeNull();
  });
});
