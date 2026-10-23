import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';
import { Auth } from './auth/auth';
import { ErrorToast } from './shell/error-toast';
import { Footer } from './shell/footer';
import { Header } from './shell/header';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer, ErrorToast],
  selector: 'app-root',
  host: { class: 'zw-shell' },
  templateUrl: './app.html',
})
export class App {
  constructor() {
    const errors = inject(ErrorBanner);
    void inject(Auth)
      .restore()
      .catch(() =>
        errors.show('Deine Anmeldung lässt sich gerade nicht prüfen. Versuch es nochmals.'),
      );
  }
}
