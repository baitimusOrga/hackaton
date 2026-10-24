import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SavedSearchesService } from '../api/services';
import { SavedSearches } from './saved-searches';

describe('SavedSearches', () => {
  const saved = {
    id: 3,
    name: 'Monitor',
    text: '27 Zoll Monitor',
    requirements: {
      mustHave: [{ attribute: 'Size', value: '27' }],
      niceToHave: [],
      keywords: ['monitor'],
      postcode: '8004',
      maxDistanceKm: 25,
    },
  };

  it('opens a search in Find and deletes one', async () => {
    const del = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SavedSearchesService, useValue: { listMine: () => of([saved]), delete: del } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SavedSearches);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    const [open, remove] = Array.from(element.querySelectorAll('button'));
    open.click();
    expect(navigate).toHaveBeenCalledWith(['/find'], {
      queryParams: expect.objectContaining({
        q: '27 Zoll Monitor',
        kw: 'monitor',
        plz: '8004',
        km: 25,
      }),
    });

    remove.click();
    await fixture.whenStable();
    expect(del).toHaveBeenCalledWith({ id: 3 });
    expect(element.querySelector('li')!.textContent).toContain('Noch keine');
  });
});
