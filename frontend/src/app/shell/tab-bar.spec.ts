import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from '../auth/auth';
import { TabBar } from './tab-bar';

async function setup(url: string, user: object | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'find', children: [] },
        { path: 'profile', children: [] },
        { path: 'login', children: [] },
        { path: 'sell', outlet: 'modal', children: [] },
      ]),
      { provide: Auth, useValue: { user: signal(user) } },
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
  it('has four targets; the plus button opens the sell dialog', async () => {
    const el = await setup('/');
    expect(labels(el, 'a')).toEqual(['Start', 'Suchen', 'Verkaufen', 'Konto']);
    const sell = el.querySelectorAll('a')[2];
    expect(sell.getAttribute('href')).toContain('modal:sell');
    expect(sell.getAttribute('aria-label')).toBe('Verkaufen, neues Inserat');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Start']);
  });

  it('marks the current page, Start only on /', async () => {
    const el = await setup('/find');
    expect(labels(el, 'a[aria-current="page"]')).toEqual(['Suchen']);
  });

  it('Konto goes to the profile when signed in, to the login otherwise', async () => {
    const konto = (el: HTMLElement) => el.querySelectorAll('a')[3].getAttribute('href');
    expect(konto(await setup('/'))).toBe('/login');
    TestBed.resetTestingModule();
    expect(konto(await setup('/profile', { id: '1', name: 'Ana' }))).toBe('/profile');
  });
});
