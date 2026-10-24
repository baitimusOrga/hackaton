import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18n, LANGS } from '../i18n/i18n';
import { About } from './about';
import { Info } from './info';

describe('About and Info pages', () => {
  for (const page of [
    {
      path: 'about',
      component: About,
      emphasis: 'Young Talents',
      headings: ['Über uns', 'À propos', 'Chi siamo', 'About us'],
      content: [
        'vier Informatiklernende',
        'quatre apprentis',
        'quattro apprendisti',
        'four software development apprentices',
      ],
    },
    {
      path: 'info',
      component: Info,
      emphasis: 'Zweite.',
      headings: ['Über das Projekt', 'À propos du projet', 'Il progetto', 'About the Project'],
      content: [
        'Schweizer Secondhand-Markt',
        'marché suisse de la seconde main',
        'mercato svizzero dell’usato',
        'Swiss second-hand market',
      ],
    },
  ]) {
    it(`updates ${page.path} when the language changes`, async () => {
      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: page.path, component: page.component }])],
      });
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/${page.path}`);
      const i18n = TestBed.inject(I18n);
      const element = harness.routeNativeElement as HTMLElement;
      for (const [index, lang] of LANGS.entries()) {
        i18n.lang.set(lang);
        harness.detectChanges();
        expect(element.querySelector('h1')?.textContent).toBe(page.headings[index]);
        expect(element.textContent).toContain(page.content[index]);
        expect(element.querySelector('em')?.textContent).toBe(page.emphasis);
      }
    });
  }
});
