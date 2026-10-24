import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';
import { I18n } from './i18n/i18n';
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
    const i18n = inject(I18n);
    void inject(Auth)
      .restore()
      .catch(() =>
        errors.show(i18n.t('Deine Anmeldung lässt sich gerade nicht prüfen. Versuch es nochmals.')),
      );
  }
}
