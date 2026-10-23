import { Injectable, signal } from '@angular/core';

/** Lets the header know whether a page's own hero search is on screen, so it docks its search only when needed. */
@Injectable({ providedIn: 'root' })
export class HeroSearch {
  /** A page with a hero search is shown (its search is the screen's primary action). */
  readonly active = signal(false);
  readonly visible = signal(false);
}
