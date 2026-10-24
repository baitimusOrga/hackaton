import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { Home } from './home';
import { Header } from '../shell/header';
import { HeroSearch } from '../shell/hero-search';

describe('Home', () => {
  async function setup(items: unknown[]) {
    const list = vi.fn().mockReturnValue(of(items));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Home },
          { path: 'find', children: [] },
          { path: 'search', children: [] },
        ]),
        { provide: ListingsService, useValue: { list } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', Home);
    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  it('links every category tile to its listings on /search', async () => {
    const { element } = await setup([]);
    const tiles = [...element.querySelectorAll<HTMLAnchorElement>('a.zw-cat')];
    expect(tiles[0].getAttribute('href')).toBe('/search?category=Computers');
    expect(tiles[0].textContent).toContain('Computer');
    expect(tiles.at(-1)!.getAttribute('href')).toBe('/search');
  });

  it('shows new listings as cards linking to their detail page', async () => {
    const { element } = await setup([
      { id: 2, title: 'Dell monitor', priceChf: 120, condition: 'LIKE_NEW', locality: 'Bern' },
    ]);
    const card = element.querySelector('[aria-labelledby="h-near"] a.zw-card')!;
    expect(card.getAttribute('href')).toBe('/listings/2');
    expect(card.textContent).toContain('Dell monitor');
    expect(card.textContent).toContain('CHF 120.–');
    expect(card.textContent).toContain('Wie neu · Bern');
  });

  it('shows auctions under "Endet bald" and hides the section without any', async () => {
    const { element } = await setup([
      {
        id: 1201,
        title: 'Aeron',
        priceChf: 300,
        currentBidChf: 310,
        bidCount: 2,
        saleMode: 'AUCTION',
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    ]);
    expect(TestBed.inject(ListingsService).list).toHaveBeenCalledWith({ saleMode: 'AUCTION' });
    const card = element.querySelector('[aria-labelledby="h-auction"] a.zw-card')!;
    expect(card.textContent).toContain('CHF 310.–');
    expect(card.textContent).toContain('2 Gebote');
  });

  it('keeps the hero and docked search in sync in both directions', async () => {
    const { harness, element } = await setup([]);
    const header = TestBed.createComponent(Header);
    const hero = TestBed.inject(HeroSearch);
    await header.whenStable();
    const input = element.querySelector<HTMLInputElement>('#hero-q')!;
    input.value = 'iMac 2017';
    input.dispatchEvent(new Event('input'));
    hero.visible.set(false);
    await header.whenStable();
    const dockedInput = header.nativeElement.querySelector('#header-q') as HTMLInputElement;
    expect(dockedInput.value).toBe('iMac 2017');

    dockedInput.value = 'MacBook';
    dockedInput.dispatchEvent(new Event('input'));
    hero.visible.set(true);
    await harness.fixture.whenStable();
    expect(input.value).toBe('MacBook');

    hero.visible.set(false);
    await header.whenStable();
    header.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await header.whenStable();
    expect(TestBed.inject(Router).url).toBe('/find?q=MacBook');
  });
  it('sends the hero search to the search page', async () => {
    const { harness, element } = await setup([]);
    expect(element.textContent).toContain('Noch keine Inserate in deiner Nähe.');
    expect(element.querySelector('[aria-labelledby="h-auction"]')).toBeNull();
    const input = element.querySelector<HTMLInputElement>('#hero-q')!;
    input.value = 'iMac 2017';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/find?q=iMac%202017');
  });

  it('links each category tile to the search filtered by that category', async () => {
    const { element } = await setup([]);
    const hrefs = [...element.querySelectorAll('nav.zw-cats a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/search?category=Bikes');
    expect(hrefs).toContain('/search?category=TV%20%26%20home%20cinema');
    expect(hrefs.at(-1)).toBe('/search');
  });

  it('opens /search with the chosen quick filter and the typed text', async () => {
    const { harness, element } = await setup([]);
    const chips = [...element.querySelectorAll('.zw-hero__chips button')] as HTMLButtonElement[];
    expect(chips.map((c) => c.textContent!.trim())).toEqual([
      'Nur Auktionen',
      'Unter CHF 50',
      'Endet heute',
    ]);
    TestBed.inject(HeroSearch).query.set(' iMac ');
    chips[1].click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/search?maxPrice=50&q=iMac');
  });
});
