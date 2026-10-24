import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Auth, AuthRequestError } from '../auth/auth';
import { translateError } from '../errors';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

type Editing = 'name' | 'password' | null;

// Only what the auth schema stores today: name, email, password and the creation date. Phone,
// address, location, notification and privacy settings from the design have no data yet.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-profile',
  imports: [FormsModule, Button, Icon, TranslatePipe],
  styles: `
    h1 {
      margin: 0 0 var(--space-2);
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-8) 0;
      max-width: 640px;
    }
    .sec h2 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    .kv {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr) auto;
      gap: var(--space-4);
      align-items: center;
      min-height: 44px;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .kv:last-of-type {
      border-bottom: 0;
    }
    @media (max-width: 600px) {
      .kv {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .kv .k {
        grid-column: 1 / -1;
      }
    }
    .k {
      font-size: 14px;
      color: var(--ink-muted);
    }
    .v {
      overflow-wrap: anywhere;
    }
    .ok {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: var(--space-2);
      font-size: 14px;
      font-weight: 500;
      color: var(--green-text);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4) 0;
      border-bottom: var(--border-1) solid var(--line-soft);
    }
    .actions {
      display: flex;
      gap: var(--space-3);
    }
  `,
  template: `
    @if (user(); as user) {
      <div>
        <h1>{{ 'Einstellungen' | t }}</h1>
        @if (error()) {
          <p role="alert" class="zw-error">{{ error() }}</p>
        }
        <p role="status" class="zw-help">{{ saved() }}</p>

        <section class="sec" aria-labelledby="account-heading">
          <h2 id="account-heading">{{ 'Konto' | t }}</h2>

          <div class="kv">
            <span class="k">{{ 'Name' | t }}</span>
            <span class="v">{{ user.name }}</span>
            @if (editing() !== 'name') {
              <button type="button" class="zw-link" (click)="edit('name')">
                {{ 'Ändern' | t }}
              </button>
            }
          </div>
          @if (editing() === 'name') {
            <form #nameForm="ngForm" (ngSubmit)="saveName(nameForm)">
              <div class="zw-field">
                <label for="name" class="zw-label">{{ 'Anzeigename' | t }}</label>
                <input
                  id="name"
                  name="name"
                  class="zw-input"
                  [(ngModel)]="name"
                  #nameField="ngModel"
                  required
                  maxlength="80"
                  autocomplete="nickname"
                  [attr.aria-invalid]="
                    nameField.invalid && (nameField.touched || nameForm.submitted)
                  "
                  aria-describedby="name-hint name-error"
                />
                <p id="name-hint" class="zw-help">
                  {{ 'So sehen dich Käufer und Verkäufer.' | t }}
                </p>
                <p id="name-error" class="zw-help zw-help--error">
                  @if (nameField.invalid && (nameField.touched || nameForm.submitted)) {
                    {{ 'Gib einen Anzeigenamen ein.' | t }}
                  }
                </p>
              </div>
              <div class="actions">
                <button appButton variant="primary" type="submit" [disabled]="busy()">
                  {{ (busy() ? 'Einen Moment…' : 'Speichern') | t }}
                </button>
                <button appButton variant="ghost" type="button" (click)="edit(null)">
                  {{ 'Abbrechen' | t }}
                </button>
              </div>
            </form>
          }

          <div class="kv">
            <span class="k">{{ 'E-Mail' | t }}</span>
            <span class="v"
              >{{ user.email }}
              @if (user.emailVerified) {
                <span class="ok"><app-icon name="check" [size]="16" />{{ 'bestätigt' | t }}</span>
              }
            </span>
          </div>

          <div class="kv">
            <span class="k">{{ 'Passwort' | t }}</span>
            <span class="v">••••••••••••</span>
            @if (editing() !== 'password') {
              <button type="button" class="zw-link" (click)="edit('password')">
                {{ 'Ändern' | t }}
              </button>
            }
          </div>
          @if (editing() === 'password') {
            <form #passwordForm="ngForm" (ngSubmit)="savePassword(passwordForm)">
              <div class="zw-field">
                <label for="current" class="zw-label">{{ 'Aktuelles Passwort' | t }}</label>
                <input
                  id="current"
                  name="current"
                  type="password"
                  class="zw-input"
                  [(ngModel)]="current"
                  required
                  maxlength="128"
                  autocomplete="current-password"
                />
              </div>
              <div class="zw-field">
                <label for="new-password" class="zw-label">{{ 'Neues Passwort' | t }}</label>
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  class="zw-input"
                  [(ngModel)]="next"
                  #nextField="ngModel"
                  required
                  minlength="12"
                  maxlength="128"
                  autocomplete="new-password"
                  [attr.aria-invalid]="
                    nextField.invalid && (nextField.touched || passwordForm.submitted)
                  "
                  aria-describedby="password-hint password-error"
                />
                <p id="password-hint" class="zw-help">{{ '12 bis 128 Zeichen.' | t }}</p>
                <p id="password-error" class="zw-help zw-help--error">
                  @if (nextField.invalid && (nextField.touched || passwordForm.submitted)) {
                    {{ 'Mindestens 12 Zeichen.' | t }}
                  }
                </p>
              </div>
              <div class="zw-field">
                <label for="confirmation" class="zw-label">{{ 'Passwort wiederholen' | t }}</label>
                <input
                  id="confirmation"
                  name="confirmation"
                  type="password"
                  class="zw-input"
                  [(ngModel)]="confirmation"
                  required
                  maxlength="128"
                  autocomplete="new-password"
                />
              </div>
              <p class="zw-help">{{ 'Andere Geräte werden dabei abgemeldet.' | t }}</p>
              <div class="actions">
                <button appButton variant="primary" type="submit" [disabled]="busy()">
                  {{ (busy() ? 'Einen Moment…' : 'Passwort ändern') | t }}
                </button>
                <button appButton variant="ghost" type="button" (click)="edit(null)">
                  {{ 'Abbrechen' | t }}
                </button>
              </div>
            </form>
          }
        </section>
      </div>
    }
  `,
})
export class Profile {
  private readonly auth = inject(Auth);
  private readonly i18n = inject(I18n);
  protected readonly user = this.auth.user;
  protected readonly editing = signal<Editing>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal('');
  name = '';
  current = '';
  next = '';
  confirmation = '';

  edit(what: Editing): void {
    this.editing.set(what);
    this.error.set('');
    this.saved.set('');
    this.name = this.user()?.name ?? '';
    this.current = this.next = this.confirmation = '';
  }

  async saveName(form: NgForm): Promise<void> {
    if (form.invalid || !this.name.trim()) {
      form.control.markAllAsTouched();
      return;
    }
    await this.run(() => this.auth.updateName(this.name.trim()), 'Name gespeichert.');
  }

  async savePassword(form: NgForm): Promise<void> {
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.error.set(this.i18n.t('Bitte prüf die markierten Felder.'));
      return;
    }
    if (this.next !== this.confirmation) {
      this.error.set(this.i18n.t('Die Passwörter stimmen nicht überein.'));
      return;
    }
    await this.run(() => this.auth.changePassword(this.current, this.next), 'Passwort geändert.');
  }

  private async run(action: () => Promise<void>, success: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      this.edit(null);
      this.saved.set(this.i18n.t(success));
    } catch (error) {
      this.error.set(
        error instanceof AuthRequestError
          ? translateError(error.message, this.i18n)
          : this.i18n.t('Das Konto ist gerade nicht erreichbar. Versuch es nochmals.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
