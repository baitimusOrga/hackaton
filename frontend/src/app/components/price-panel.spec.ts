import { registerLocaleData } from '@angular/common';
import localeEnCh from '@angular/common/locales/en-CH';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PriceEstimate } from '../api/models';
import { PricePanel } from './price-panel';

registerLocaleData(localeEnCh);

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

// the currency pattern uses a non-breaking space
const plain = (el: Element) => (el.textContent ?? '').replace(/\u00a0/g, ' ');

function setup(estimate: PriceEstimate | null, condition: string | null = null) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'en-CH' }],
  });
  const fixture = TestBed.createComponent(PricePanel);
  fixture.componentRef.setInput('estimate', estimate);
  fixture.componentRef.setInput('condition', condition);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('PricePanel', () => {
  it('shows range, evidence and Swiss currency', () => {
    const { element } = setup(ESTIMATE);
    const text = plain(element);
    expect(text).toContain('High confidence');
    expect(text).toContain('CHF 90.00');
    expect(text).toContain('CHF 110.00');
    expect(text).toContain('Same model');
    expect(text).toContain('Sold');
    expect(text).toContain('Asking');
    expect(text).toContain('51 days ago');
    expect(text).toContain('1 day ago');
    expect(element.querySelector('a[href="/listings/1101"]')).not.toBeNull();
  });

  it('choosing a strategy sets the price', () => {
    const { fixture, element } = setup(ESTIMATE);
    const balanced = element.querySelectorAll<HTMLButtonElement>('button')[1];
    balanced.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.price()).toBe(100);
    expect(balanced.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks a provisional estimate', () => {
    const { element } = setup({ ...ESTIMATE, confidence: 'LOW', provisional: true });
    expect(element.textContent).toContain('Provisional estimate');
    expect(element.querySelectorAll('button').length).toBe(3);
  });

  it('shows no estimate without buttons', () => {
    const { element } = setup({
      lowChf: null,
      midChf: null,
      highChf: null,
      confidence: 'LOW',
      provisional: true,
      explanation: 'No estimate: we could not identify brand and model.',
      evidence: [],
    });
    expect(element.textContent).toContain('No estimate');
    expect(element.textContent).toContain('brand and model');
    expect(element.querySelectorAll('button').length).toBe(0);
  });

  it('rescales when the condition changes', () => {
    const { fixture, element } = setup({ ...ESTIMATE, midChf: 100 });
    fixture.componentRef.setInput('condition', 'USED');
    fixture.detectChanges();
    expect(plain(element.querySelectorAll('button')[1])).toContain('CHF 85.00');
  });
});
