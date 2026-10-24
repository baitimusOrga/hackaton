import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorBanner } from '../errors';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

/** The app-wide error message, bottom right: a paper panel with a line-soft edge, "Fehler" in danger. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  selector: 'app-error-toast',
  template: `@if (errors.message(); as message) {
    <div class="toast" role="alert">
      <div class="toast__text">
        <span class="zw-caption toast__label">{{ 'Fehler' | t }}</span>
        <p>{{ message }}</p>
      </div>
      <button
        type="button"
        class="toast__close"
        [attr.aria-label]="'Meldung schliessen' | t"
        (click)="errors.dismiss()"
      >
        <app-icon name="x" />
      </button>
    </div>
  }`,
  styles: `
    .toast {
      position: fixed;
      right: var(--space-6);
      bottom: var(--space-6);
      z-index: 40;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      width: min(400px, calc(100vw - 2 * var(--space-4)));
      padding: var(--space-4);
      background: var(--bg-000);
      border: var(--border-1) solid var(--line-soft);
      border-radius: var(--radius-1);
    }
    @media (max-width: 720px) {
      .toast {
        right: var(--space-4);
        bottom: var(--space-4);
      }
    }
    .toast__text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: 14px;
      line-height: 20px;
    }
    .toast__label {
      color: var(--danger);
    }
    .toast__close {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin: -12px -12px 0 0;
      color: var(--ink);
      background: none;
      border: 0;
      border-radius: var(--radius-1);
      cursor: pointer;
    }
    .toast__close:hover {
      background: var(--bg-100);
    }
  `,
})
export class ErrorToast {
  protected readonly errors = inject(ErrorBanner);
}
