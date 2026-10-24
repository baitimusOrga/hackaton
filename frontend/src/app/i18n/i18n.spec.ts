import { TestBed } from '@angular/core/testing';
import { I18n, LANGS } from './i18n';
import { MESSAGES } from './messages';

describe('I18n', () => {
  it('falls back to the German key and fills placeholders', () => {
    const i18n = TestBed.inject(I18n);
    i18n.lang.set('fr');
    expect(i18n.t('Nicht übersetzt {n}', { n: 3 })).toBe('Nicht übersetzt 3');
  });

  it('has every message in every language', () => {
    for (const [key, texts] of Object.entries(MESSAGES)) {
      for (const lang of LANGS.filter((l) => l !== 'de')) {
        expect(texts[lang], `${lang}: ${key}`).toBeTruthy();
        const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
        expect(params(texts[lang]), `${lang} placeholders: ${key}`).toBe(params(key));
      }
    }
  });
});
