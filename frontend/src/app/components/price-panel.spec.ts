import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PriceEstimate } from '../api/models';
import { PricePanel } from './price-panel';

const ESTIMATE: PriceEstimate = {
  lowChf: 90,
  midChf: 100,
  highChf: 110,
  confidence: 'HIGH',
  provisional: false,
  condition: 'GOOD',
  comparableCount: 2,
  soldCount: 1,
  explanation: 'Based on 1 completed sale and 1 asking price of the same model in Monitors.',
  evidence: [
    {
      listingId: 1101,
      title: 'Dell U2719D 27" QHD monitor',
      priceChf: 90,
      similarity: 'SAME_MODEL',
      similarityPercent: 100,
      condition: 'GOOD',
      sold: true,
      ageDays: 51,
      adjustedPriceChf: 90,
    },
    {
      listingId: 2,
      title: 'Dell UltraSharp U2719D',
      priceChf: 126.5,
      similarity: 'SAME_MODEL',
      similarityPercent: 100,
      condition: 'LIKE_NEW',
      sold: false,
      ageDays: 1,
      adjustedPriceChf: 110,
    },
  ],
};

function setup(estimate: PriceEstimate | null, condition: string | null = null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(PricePanel);
  fixture.componentRef.setInput('estimate', estimate);
  fixture.componentRef.setInput('condition', condition);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const strategies = () =>
    Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]')).slice(0, -1);
  return { fixture, element, strategies };
}

describe('PricePanel', () => {
  it('shows range, evidence count and age, confidence and Swiss prices', () => {
    const { element } = setup(ESTIMATE);
    const text = element.textContent!;
    expect(text).toContain('CHF 90.– bis 110.–');
    expect(text).toContain('1 Verkauf und 1 Angebot, letzte 51 Tage.');
    expect(text).toContain('Sicherheit hoch');
    expect(text).toContain('Gleiches Modell');
    expect(text).toContain('Verkauft');
    expect(text).toContain('CHF 126.50');
    expect(text).toContain('vor 51 Tagen');
    expect(element.querySelector('a[href="/listings/1101"]')).not.toBeNull();
  });

  it('choosing a strategy sets the price', () => {
    const { fixture, strategies } = setup(ESTIMATE);
    strategies()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.price()).toBe(100);
    expect(strategies()[1].checked).toBe(true);
  });

  it('takes an own price', () => {
    const { fixture, element } = setup(ESTIMATE);
    const own = element.querySelector<HTMLInputElement>('input[name="price"]')!;
    own.value = '95.5';
    own.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.price()).toBe(95.5);
  });

  it('marks a provisional estimate', () => {
    const { element, strategies } = setup({ ...ESTIMATE, confidence: 'LOW', provisional: true });
    expect(element.textContent).toContain('Vorläufig');
    expect(strategies().length).toBe(3);
  });

  it('without an estimate shows only the own price, no note', () => {
    const { element } = setup({
      lowChf: null,
      midChf: null,
      highChf: null,
      confidence: 'LOW',
      provisional: true,
      explanation: 'No estimate: we could not identify brand and model.',
      evidence: [],
    });
    expect(element.textContent).not.toContain('Keine Schätzung');
    expect(element.textContent).not.toContain('brand and model');
    expect(element.querySelectorAll('input[type="radio"]').length).toBe(0);
    expect(element.querySelector<HTMLInputElement>('input[name="price"]')!.required).toBe(true);
  });

  it('rescales when the condition changes', () => {
    const { fixture, strategies } = setup({ ...ESTIMATE, midChf: 100 });
    fixture.componentRef.setInput('condition', 'USED');
    fixture.detectChanges();
    expect(strategies()[1].closest('label')!.textContent).toContain('CHF 85.–');
  });

  it('starts on "Ausgewogen" and keeps the choice when the range changes', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(PricePanel);
    fixture.componentRef.setInput('estimate', ESTIMATE);
    await fixture.whenStable();
    expect(fixture.componentInstance.price()).toBe(100);

    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]');
    radios[2].click(); // Hoch
    await fixture.whenStable();
    fixture.componentRef.setInput('estimate', {
      ...ESTIMATE,
      lowChf: 600,
      midChf: 700,
      highChf: 800,
    });
    await fixture.whenStable();

    expect(fixture.componentInstance.price()).toBe(800);
  });
});
