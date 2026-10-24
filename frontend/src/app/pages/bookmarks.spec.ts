import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BookmarksService } from '../api/services';
import { Bookmarks } from './bookmarks';

describe('Bookmarks', () => {
  it('lists the saved listings or says there are none', async () => {
    const list = vi.fn().mockReturnValueOnce(of([{ id: 4, title: 'Desk', priceChf: 80 }]));
    list.mockReturnValueOnce(of([]));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BookmarksService, useValue: { mine: list } }],
    });
    const full = TestBed.createComponent(Bookmarks);
    await full.whenStable();
    expect((full.nativeElement as HTMLElement).textContent).toContain('Desk');
    const empty = TestBed.createComponent(Bookmarks);
    await empty.whenStable();
    expect((empty.nativeElement as HTMLElement).textContent).toContain('noch nichts gemerkt');
  });
});
