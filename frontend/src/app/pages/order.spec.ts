import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrdersService } from '../api/services';
import { OrderPage } from './order';

async function render(order: object) {
  const ship = vi.fn().mockReturnValue(of({ ...order, shippedAt: '2026-10-24T08:00:00Z' }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
      { provide: OrdersService, useValue: { getOrder: () => of(order), ship } },
    ],
  });
  const fixture = TestBed.createComponent(OrderPage);
  await fixture.whenStable();
  return { fixture, ship, el: fixture.nativeElement as HTMLElement };
}

describe('OrderPage', () => {
  const listing = { id: 7, title: 'Chair', priceChf: 100 };

  it('lets the seller mark the order as shipped', async () => {
    const { fixture, ship, el } = await render({ listing, seller: true, shippedAt: null });
    el.querySelector('button')!.click();
    await fixture.whenStable();
    expect(ship).toHaveBeenCalledWith({ id: 7 }, expect.anything());
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('24.10.2026');
  });

  it('shows the buyer only the state', async () => {
    const { el } = await render({ listing, seller: false, shippedAt: null });
    expect(el.querySelector('button')).toBeNull();
    expect(el.textContent).toContain('noch nicht versendet');
  });
});
