import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TabBar } from './tab-bar';

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'find', children: [] },
        { path: 'messages', children: [] },
        { path: 'saved', children: [] },
        { path: 'sell', outlet: 'modal', children: [] },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(TabBar);
  await TestBed.inject(Router).navigateByUrl(url);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const labels = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((a) => a.textContent!.trim());

describe('TabBar', () => {
  it('has five targets; the plus button opens the sell dialog', async () => {
    const el = await setup('/');
    expect(labels(el, 'a')).toEqual([
      'Start',
      'Suchen',
      'Verkaufen',
      'Nachrichten',
      'Meine Suchen',
    ]);
    const sell = el.querySelectorAll('a')[2];
    expect(sell.getAttribute('href')).toContain('modal:sell');
    expect(sell.getAttribute('aria-label')).toBe('Verkaufen, neues Inserat');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Start']);
  });

  it('marks the current page, Start only on /', async () => {
    const el = await setup('/find');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Suchen']);
  });
});
