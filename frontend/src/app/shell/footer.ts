import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n, LANGS, TranslatePipe } from '../i18n/i18n';

// shortcut: the info pages do not exist yet, so those links go nowhere; link them once they do.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  selector: 'app-footer',
  template: `<footer class="zw-footer">
    <div class="zw-container zw-footer__bar">
      <span class="zw-footer__name">Zweit.</span>
      <a href="#">{{ "So funktioniert's" | t }}</a>
      <a href="#">{{ 'Sicher handeln' | t }}</a>
      <a href="#">{{ 'Auktionsregeln' | t }}</a>
      <a routerLink="/business">{{ 'Für Firmen' | t }}</a>
      <a href="#">{{ 'Hilfe' | t }}</a>
      <span class="zw-footer__langs" role="group" [attr.aria-label]="'Sprache' | t">
        @for (code of langs; track code) {
          <button
            type="button"
            [attr.lang]="code"
            [attr.aria-current]="i18n.lang() === code ? 'true' : null"
            (click)="i18n.lang.set(code)"
          >
            {{ code.toUpperCase() }}
          </button>
        }
      </span>
    </div>
  </footer>`,
})
export class Footer {
  protected readonly i18n = inject(I18n);
  protected readonly langs = LANGS;
}
