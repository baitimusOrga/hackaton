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
});
