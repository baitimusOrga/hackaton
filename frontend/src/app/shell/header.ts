import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Auth } from '../auth/auth';
import { ErrorBanner } from '../errors';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

// shortcut: the landing hero is about this tall; read its real position once the landing page exists.
const HERO_HEIGHT = 280;

/** Sticky page header. On the landing page the search field docks into it once the hero is scrolled past. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, Icon],
  selector: 'app-header',
  host: {
    class: 'zw-header',
    '[class.zw-header--docked]': 'searchDocked()',
    '(window:scroll)': 'scrollY.set(window.scrollY)',
  },
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  private readonly errors = inject(ErrorBanner);
  private readonly router = inject(Router);
  protected readonly window = window;
  protected readonly scrollY = signal(window.scrollY);
  protected readonly query = signal('');
  protected readonly signingOut = signal(false);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );
  protected readonly searchDocked = computed(
    () => this.path() !== '/' || this.scrollY() > HERO_HEIGHT,
  );

  protected search(): void {
    const q = this.query().trim();
    void this.router.navigate(['/find'], { queryParams: q ? { q } : {} });
  }

  protected async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch {
      this.errors.show('Abmelden hat nicht geklappt. Versuch es nochmals.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
