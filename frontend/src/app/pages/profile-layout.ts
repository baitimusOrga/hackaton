import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../auth/auth';
import { I18n, TranslatePipe } from '../i18n/i18n';

/** "Mein Konto": who you are and the account sections beside the page of the current section. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profile-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  styles: `
    .cols {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: var(--space-16);
      align-items: start;
      padding: var(--space-8) 0 var(--space-16);
    }
    @media (max-width: 900px) {
      .cols {
        grid-template-columns: 1fr;
        gap: var(--space-8);
      }
    }
    aside {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }
    .who {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }
    .who div span {
      display: block;
    }
    .who .name {
      font-weight: 600;
    }
    .avatar {
      width: 48px;
      height: 48px;
      font-size: 18px;
    }
    nav {
      display: flex;
      flex-direction: column;
    }
    nav a {
      display: flex;
      align-items: center;
      min-height: 44px;
      color: var(--ink-muted);
      text-decoration: none;
    }
    nav a:hover,
    nav a.active {
      color: var(--ink);
    }
    nav a.active {
      font-weight: 600;
    }
  `,
  template: `
    @if (user(); as user) {
      <div class="cols">
        <aside>
          <div class="who">
            <span class="zw-avatar avatar" aria-hidden="true">{{ initial() }}</span>
            <div>
              <span class="name">{{ user.name }}</span>
              <span class="zw-help">{{ 'dabei seit {date}' | t: { date: since() } }}</span>
            </div>
          </div>
          <nav [attr.aria-label]="'Mein Konto' | t">
            <a
              routerLink="/profile/trades"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              >{{ 'Käufe und Verkäufe' | t }}</a
            >
            <a
              routerLink="/profile"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              ariaCurrentWhenActive="page"
              >{{ 'Einstellungen' | t }}</a
            >
          </nav>
        </aside>
        <div><router-outlet /></div>
      </div>
    }
  `,
})
export class ProfileLayout {
  private readonly i18n = inject(I18n);
  protected readonly user = inject(Auth).user;
  protected readonly initial = computed(() => this.user()?.name.trim().charAt(0).toUpperCase());
  protected readonly since = computed(() => {
    const created = this.user()?.createdAt;
    return created
      ? new Intl.DateTimeFormat(this.i18n.lang(), { month: 'long', year: 'numeric' }).format(
          new Date(created),
        )
      : '';
  });
}
