import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth/auth';
import { ErrorBanner } from '../errors';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { HeroSearch } from './hero-search';

// shortcut: fixed location until the user can set one; the location picker is not designed yet.
const LOCATION = { place: '8001 Zürich', radius: '25 km' };

/** Sticky page header. The search docks into it whenever no hero search is on screen. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, Icon],
  selector: 'app-header',
  host: { class: 'zw-header', '[class.zw-header--docked]': 'docked()' },
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  protected readonly hero = inject(HeroSearch);
  private readonly errors = inject(ErrorBanner);
  private readonly router = inject(Router);
  protected readonly location = LOCATION;
  protected readonly locationLabel = `Standort ändern: ${LOCATION.place}, Umkreis ${LOCATION.radius}`;
  protected readonly docked = computed(() => !this.hero.visible());
  protected readonly query = signal('');
  protected readonly signingOut = signal(false);

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
