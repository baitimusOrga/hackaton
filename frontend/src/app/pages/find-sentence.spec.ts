import { TestBed } from '@angular/core/testing';
import { FindSentence, place, Token } from './find-sentence';

const TOKENS: Token[] = [
  { key: 'must:Model', kind: 'must', label: 'Model: iMac', phrase: 'iMac' },
  { key: 'must:Year', kind: 'must', label: 'Year: 2017', phrase: '2017' },
  { key: 'nice:RAM', kind: 'nice', label: 'RAM: 16 GB', phrase: null },
  { key: 'budget', kind: 'budget', label: 'Bis CHF 600.–', phrase: 'bis chf 600' },
];
const TEXT = 'Ein iMac 2017 mit 5K, bis CHF 600';

describe('place', () => {
  it('cuts the sentence into plain text and tokens in text order; the rest become chips', () => {
    const { segments, chips } = place(TEXT, TOKENS);
    expect(segments.map((s) => [s.text, s.token?.key])).toEqual([
      ['Ein ', undefined],
      ['iMac', 'must:Model'],
      [' ', undefined],
      ['2017', 'must:Year'],
      [' mit 5K, ', undefined],
      ['bis CHF 600', 'budget'],
    ]);
    expect(chips.map((t) => t.key)).toEqual(['nice:RAM']);
  });

  it('never lets two tokens overlap and keeps the original spelling', () => {
    const tokens: Token[] = [
      { key: 'must:Model', kind: 'must', label: 'Model: iPhone 13', phrase: 'iphone 13' },
      { key: 'must:Storage', kind: 'must', label: 'Storage: 13', phrase: '13' },
    ];
    const { segments, chips } = place('IPHONE 13 mit 13 Monaten Garantie', tokens);
    expect(segments.map((s) => s.text)).toEqual(['IPHONE 13', ' mit ', '13', ' Monaten Garantie']);
    expect(chips).toEqual([]);
  });
});

describe('FindSentence', () => {
  function setup(off: ReadonlySet<string> = new Set()) {
    const fixture = TestBed.createComponent(FindSentence);
    fixture.componentRef.setInput('text', TEXT);
    fixture.componentRef.setInput('tokens', TOKENS);
    fixture.componentRef.setInput('off', off);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders tokens as underlined buttons and the rest as chips', () => {
    const { el } = setup();
    const tokens = [...el.querySelectorAll<HTMLButtonElement>('.token')];
    expect(tokens.map((b) => b.textContent)).toEqual(['iMac', '2017', 'bis CHF 600']);
    expect(tokens[0].getAttribute('aria-pressed')).toBe('true');
    expect(tokens[0].title).toBe('Model: iMac nicht mehr verlangen');
    expect(el.querySelector('.extra .zw-chip')!.textContent).toContain('RAM: 16 GB');
    expect(el.textContent).toContain('Unterstrichen ist, was wir verstanden haben.');
  });

  it('shows off tokens struck through and counts them in the hint', () => {
    const { el } = setup(new Set(['must:Year']));
    const year = el.querySelectorAll<HTMLButtonElement>('.token')[1];
    expect(year.classList.contains('token--off')).toBe(true);
    expect(year.getAttribute('aria-pressed')).toBe('false');
    expect(year.title).toBe('Year: 2017 wieder verlangen');
    expect(el.textContent).toContain('1 entfernt.');
  });

  it('emits the key of a tapped token or chip', () => {
    const { fixture, el } = setup();
    const keys: string[] = [];
    fixture.componentInstance.toggled.subscribe((key) => keys.push(key));
    el.querySelectorAll<HTMLButtonElement>('.token')[1].click();
    el.querySelector<HTMLButtonElement>('.extra .zw-chip')!.click();
    expect(keys).toEqual(['must:Year', 'nice:RAM']);
  });
});
