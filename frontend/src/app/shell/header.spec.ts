import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Header } from './header';
import { HeroSearch } from './hero-search';

describe('Header', () => {
  it('shows the search term of the current URL and clears it when the page has none', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const router = TestBed.inject(Router);
    TestBed.inject(HeroSearch).visible.set(false);
    const fixture = TestBed.createComponent(Header);
    const input = () => fixture.nativeElement.querySelector('#header-q') as HTMLInputElement;

    await router.navigate(['/find'], { queryParams: { q: 'iMac' } });
    await fixture.whenStable();
    expect(input().value).toBe('iMac');

    input().value = 'iMac 2017';
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(input().value).toBe('iMac 2017');

    await router.navigate(['/listings/7']);
    await fixture.whenStable();
    expect(input().value).toBe('');
  });
});
