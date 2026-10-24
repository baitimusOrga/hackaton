import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MyListing } from '../api/models';
import { MyListingsService } from '../api/services';
import { ProfileListings } from './profile-listings';

describe('ProfileListings', () => {
  const row = (
    id: number,
    status: MyListing['status'],
    saleMode: 'FIXED' | 'AUCTION' = 'FIXED',
    bidCount = 0,
  ): MyListing => ({
    status,
    listing: {
      id,
      title: 'Listing ' + id,
      priceChf: 100,
      condition: 'GOOD',
      category: 'Audio',
      postcode: '8004',
      locality: 'Zürich',
      saleMode,
      bidCount,
    },
  });

  async function setup(rows: MyListing[]) {
    const api = {
      listMine: vi.fn().mockReturnValue(of(rows)),
      withdraw: vi.fn().mockReturnValue(of(null)),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MyListingsService, useValue: api }],
    });
    const fixture = TestBed.createComponent(ProfileListings);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const click = async (text: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!.click();
      await fixture.whenStable();
    };
    return { api, element, click };
  }

  it('shows each listing with its status and withdraws an active one after confirming', async () => {
    const { api, element, click } = await setup([
      row(1, 'AVAILABLE'),
      row(2, 'SOLD'),
      row(3, 'AVAILABLE', 'AUCTION', 2),
      row(4, 'AVAILABLE', 'AUCTION'),
    ]);
    const rows = [...element.querySelectorAll('li')].map((li) =>
      li.textContent!.replace(/\s+/g, ' '),
    );
    expect(rows[0]).toContain('Aktiv');
    expect(rows[1]).toContain('Verkauft');
    expect(rows[2]).toContain('2 Gebote');
    // only the active fixed-price listing can be withdrawn, auctions never
    expect(element.querySelectorAll('button').length).toBe(1);

    await click('Zurückziehen');
    expect(api.withdraw).not.toHaveBeenCalled();
    await click('Ja, zurückziehen');
    expect(api.withdraw).toHaveBeenCalledWith({ id: 1 });
    expect(element.querySelector('li')!.textContent).toContain('Zurückgezogen');
    expect(element.querySelectorAll('button').length).toBe(0);
  });

  it('offers to sell when there is nothing yet', async () => {
    const { element } = await setup([]);
    expect(element.textContent).toContain('Noch keine Inserate.');
    expect(element.textContent).toContain('Jetzt inserieren');
  });
});
