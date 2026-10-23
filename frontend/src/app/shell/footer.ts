import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  selector: 'app-footer',
  template: `<footer class="zw-footer">
    <div class="zw-container zw-footer__bar">
      <span class="zw-footer__name">Zweit.</span>
      <a routerLink="/business">Für Firmen</a>
    </div>
  </footer>`,
})
export class Footer {}
