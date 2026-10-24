import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { Search } from './search';

function trigger(el: HTMLElement, label: string): HTMLButtonElement {
  return [...el.querySelectorAll<HTMLButtonElement>('.facet__trigger')].find((b) =>
    b.textContent!.includes(label),
  )!;
}

function chip(el: HTMLElement, text: string): HTMLButtonElement {
  return [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent!.trim() === text,
  )!;
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

  it('shows a card per listing and the category as heading and facet summary', async () => {
    const { list, element } = await setup('/search?category=Monitors', [
      { id: 2, title: 'Dell monitor', priceChf: 120 },
    ]);
    expect(list).toHaveBeenCalledWith({ category: 'Monitors' });
    expect(element.querySelector('a[href="/listings/2"]')).not.toBeNull();
    expect(trigger(element, 'Kategorie').textContent).toContain('Bildschirme');
    expect(element.querySelector('h1')!.textContent!.trim()).toBe('Bildschirme');
  });

  it('reloads with the new price and keeps the other filters in the URL', async () => {
    const { list, harness, element } = await setup('/search?q=imac', []);
    trigger(element, 'Preis').click();
    await harness.fixture.whenStable();
    const price = element.querySelector<HTMLInputElement>('#search-price')!;
    price.value = '500';
    price.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ q: 'imac', maxPrice: 500 });
    expect(TestBed.inject(Router).url).toBe('/search?q=imac&maxPrice=500');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await harness.fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('filters auctions and removes all filters at once', async () => {
    const { list, harness, element } = await setup('/search', []);
    trigger(element, 'Verkaufsart').click();
    await harness.fixture.whenStable();
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ saleMode: 'AUCTION' });

    [...element.querySelectorAll('button')]
      .find((b) => b.textContent!.trim() === 'Alle entfernen')!
      .click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/search');
    expect(list).toHaveBeenLastCalledWith({});
  });

  it('shows the empty state without the view toggle', async () => {
    const { element } = await setup('/search', []);
    expect(element.textContent).toContain('Keine Inserate gefunden.');
    expect(element.querySelector('[role="group"][aria-label="Ansicht"]')).toBeNull();
  });

  it('keeps the radius only with an origin: a full postcode or the position', async () => {
    const full = await setup('/search?postcode=8004&radiusKm=25', []);
    expect(full.list).toHaveBeenCalledWith({ postcode: '8004', radiusKm: 25 });
    TestBed.resetTestingModule();
    const partial = await setup('/search?postcode=80&radiusKm=25', []);
    expect(partial.list).toHaveBeenCalledWith({ postcode: '80' });
    TestBed.resetTestingModule();
    const here = await setup('/search?radiusKm=5&lat=47.378&lon=8.523', []);
    expect(here.list).toHaveBeenCalledWith({ radiusKm: 5, lat: 47.378, lon: 8.523 });
  });

  it('a radius chip measures from a full postcode without asking for the position', async () => {
    const asked = geolocation(null);
    const { list, harness, element } = await setup('/search?postcode=8004', []);
    trigger(element, 'Region').click();
    await harness.fixture.whenStable();
    chip(element, '10 km').click();
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ postcode: '8004', radiusKm: 10 });
    expect(asked).not.toHaveBeenCalled();
  });

  it('"Mein Standort" switches from the postcode to the position', async () => {
    const asked = geolocation({
      coords: { latitude: 47.37812, longitude: 8.52345 },
    } as GeolocationPosition);
    const { list, harness, element } = await setup('/search?postcode=8004&radiusKm=10', []);
    trigger(element, 'Region').click();
    await harness.fixture.whenStable();
    [...element.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((b) => b.textContent!.includes('Mein Standort'))!
      .click();
    await harness.fixture.whenStable();
    expect(asked).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenLastCalledWith({ radiusKm: 10, lat: 47.378, lon: 8.523 });
    expect(trigger(element, 'Region').textContent).toContain('10 km um deinen Standort');
  });

  it('without a postcode a chip uses the rounded position, and a known position is not asked again', async () => {
    geolocation({ coords: { latitude: 47.37812, longitude: 8.52345 } } as GeolocationPosition);
    const { list, harness, element } = await setup('/search', []);
    trigger(element, 'Region').click();
    await harness.fixture.whenStable();
    chip(element, '25 km').click();
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ radiusKm: 25, lat: 47.378, lon: 8.523 });

    const askedAgain = geolocation(null);
    chip(element, '10 km').click();
    await harness.fixture.whenStable();
    expect(askedAgain).not.toHaveBeenCalled();
    expect(list).toHaveBeenLastCalledWith({ radiusKm: 10, lat: 47.378, lon: 8.523 });
  });

  it('a refused position shows the error and drops the radius', async () => {
    geolocation(null);
    const { harness, element } = await setup('/search', []);
    trigger(element, 'Region').click();
    await harness.fixture.whenStable();
    chip(element, '10 km').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/search');
    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Standort nicht verfügbar.',
    );
  });
});
