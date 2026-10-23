import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// shortcut: the info pages and FR/IT/EN do not exist yet, so those links go nowhere; link them once they do.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  selector: 'app-footer',
  template: `<footer class="zw-footer">
    <div class="zw-container zw-footer__bar">
      <span class="zw-footer__name">Zweit.</span>
      <a href="#">So funktioniert's</a>
      <a href="#">Sicher handeln</a>
      <a href="#">Auktionsregeln</a>
      <a routerLink="/business">Für Firmen</a>
      <a href="#">Hilfe</a>
      <span class="zw-footer__langs">
        <a href="#" aria-current="true">DE</a>
        <a href="#" lang="fr">FR</a>
        <a href="#" lang="it">IT</a>
        <a href="#" lang="en">EN</a>
      </span>
    </div>
  </footer>`,
})
export class Footer {}
