import { inject, Injectable, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

/** Free-text search shared by the header and a page's hero; also tells the header when the hero search is on screen. */
@Injectable({ providedIn: 'root' })
export class HeroSearch {
  private readonly router = inject(Router);
  /** A page with a hero search is shown (its search is the screen's primary action). */
  readonly active = signal(false);
  readonly visible = signal(false);
  private readonly urlQuery = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );
  readonly query = linkedSignal(() => this.urlQuery());

  open(text: string): void {
    const q = text.trim();
    void this.router.navigate(['/find'], { queryParams: q ? { q } : {} });
  }
}
