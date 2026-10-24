import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { About } from './about';
import { Info } from './info';

describe('About and Info pages', () => {
  async function render(path: string, component: typeof About | typeof Info) {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path, component }])] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/${path}`, component);
    return harness.routeNativeElement as HTMLElement;
  }

  it('renders the about page', async () => {
    const element = await render('about', About);
    expect(element.querySelector('h1')?.textContent).toBe('About Us');
    expect(element.textContent).toContain('four software development apprentices');
    expect(element.querySelector('em')?.textContent).toBe('Young Talents');
  });

  it('renders the project page', async () => {
    const element = await render('info', Info);
    expect(element.querySelector('h1')?.textContent).toBe('About the Project');
    expect(element.textContent).toContain('Swiss second-hand market');
    expect(element.querySelector('em')?.textContent).toBe('Zweite.');
  });
});
