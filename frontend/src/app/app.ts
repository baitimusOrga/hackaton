import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';
import { I18n, TranslatePipe } from './i18n/i18n';
import { Auth } from './auth/auth';
import { Footer } from './shell/footer';
import { Header } from './shell/header';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer, TranslatePipe],
  selector: 'app-root',
  host: { class: 'zw-shell' },
  templateUrl: './app.html',
})
export class App {
  protected readonly errors = inject(ErrorBanner);
  private readonly i18n = inject(I18n);

  constructor() {
    void inject(Auth)
      .restore()
      .catch(() =>
        this.errors.show(
          this.i18n.t('Deine Anmeldung lässt sich gerade nicht prüfen. Versuch es nochmals.'),
        ),
      );
  }
}
