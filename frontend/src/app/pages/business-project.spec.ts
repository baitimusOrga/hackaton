import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ClearanceService } from '../api/services';
import { ProjectDetail } from '../api/models';
import { BusinessProject } from './business-project';

const item = (id: number, confirmed: boolean, priceConfirmed = confirmed) => ({
  id,
  name: `Item ${id}`,
  category: 'Monitors',
  quantity: 2,
  quantityConfirmed: confirmed,
  condition: 'GOOD' as const,
  notes: null,
  estimatedUnitChf: 100,
  unitPriceChf: 100,
  priceConfirmed,
  estimatedTotalChf: 200,
  status: 'DRAFT' as const,
  listingId: null,
});

const PROJECT: ProjectDetail = {
  id: 3,
  companyName: 'Muster Treuhand AG',
  postcode: '8004',
  locality: 'Zürich',
  deadline: '2030-01-31',
  daysLeft: 30,
  route: 'SELF_SERVICE',
  items: [item(1, false), item(2, true)],
  totals: { itemLines: 2, units: 4, estimatedResaleChf: 400, draft: 2, listed: 0, sold: 0 },
  routes: [
    {
      route: 'SELF_SERVICE',
      netChf: 280,
      serviceFeeChf: 0,
      certain: false,
      timeframe: '6–8 weeks',
      yourWork: 'a',
    },
    {
      route: 'MANAGED',
      netChf: 289,
      serviceFeeChf: 51,
      certain: false,
      timeframe: '3–4 weeks',
      yourWork: 'b',
    },
    {
      route: 'DIRECT_PURCHASE',
      netChf: 180,
      serviceFeeChf: 0,
      certain: true,
      timeframe: 'Paid within 5 working days',
      yourWork: 'c',
    },
  ],
  recommendedRoute: 'MANAGED',
  recommendationReason: 'Highest expected net outcome without your team time.',
};

async function render(publishItems = vi.fn(), updateItem = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ClearanceService,
        useValue: { getProject: () => of(PROJECT), publishItems, updateItem },
      },
    ],
  });
  const fixture = TestBed.createComponent(BusinessProject);
  fixture.componentRef.setInput('id', '3');
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('BusinessProject', () => {
  it('shows provisional items and the recommended route', async () => {
    const { element } = await render();
    const badges = Array.from(element.querySelectorAll('[data-testid="badge"]')).map((b) =>
      b.textContent!.trim(),
    );
    expect(badges).toEqual(['Provisorisch', 'Bestätigt']);
    const routes = element.querySelectorAll('[data-testid="route"]');
    expect(routes).toHaveLength(3);
    expect(routes[1].textContent).toContain('Empfohlen');
    expect(routes[2].textContent).toContain('Festes Angebot');
    expect(element.textContent).toContain('noch 30 Tage');
  });

  it('publishes the selected items', async () => {
    const publishItems = vi.fn().mockReturnValue(of({ ...PROJECT, items: [PROJECT.items![0]] }));
    const { fixture, element } = await render(publishItems);
    const boxes = element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes[0].disabled).toBe(true);
    boxes[1].click();
    await fixture.whenStable();
    const publish = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent!.replace(/\s+/g, ' ').includes('1 Position veröffentlichen'),
    )!;
    publish.click();
    expect(publishItems).toHaveBeenCalledWith({ id: 3, body: { itemIds: [2] } });
  });

  it('sends the price the company typed', async () => {
    const updateItem = vi.fn().mockReturnValue(of(PROJECT));
    const { element } = await render(vi.fn(), updateItem);
    const price = element.querySelector<HTMLInputElement>('[data-testid="price"] input')!;
    price.value = '80';
    price.dispatchEvent(new Event('change'));
    expect(updateItem.mock.calls[0][0].body.unitPriceChf).toBe(80);
    expect(element.querySelector('[data-testid="price"]')!.textContent).toContain(
      'Schätzung CHF 100.–',
    );
  });
});
