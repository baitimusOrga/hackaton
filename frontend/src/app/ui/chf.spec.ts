import { chf } from './chf';

describe('chf', () => {
  it('formats whole francs with the Swiss dash and apostrophe grouping', () => {
    expect(chf(1250)).toBe('CHF 1’250.–');
  });
  it('shows rappen with two digits', () => {
    expect(chf(12.5)).toBe('CHF 12.50');
    expect(chf(0.05)).toBe('CHF 0.05');
  });
});
