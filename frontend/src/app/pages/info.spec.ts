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
    expect((await render('about', About)).querySelector('h1')?.textContent).toContain('Über uns');
  });

  it('renders the info page and says the platform never marks anything as paid', async () => {
    const element = await render('info', Info);
    expect(element.querySelector('h1')?.textContent).toContain('Informationen');
    expect(element.textContent).toContain('markiert nichts als bezahlt');
  });
});
