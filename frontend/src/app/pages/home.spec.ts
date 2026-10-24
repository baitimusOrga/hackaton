import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ListingsService } from '../api/services';
import { Home } from './home';

describe('Home', () => {
  async function setup(items: unknown[]) {
    const list = vi.fn().mockReturnValue(of(items));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Home },
          { path: 'find', children: [] },
        ]),
        { provide: ListingsService, useValue: { list } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', Home);
    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

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
});
