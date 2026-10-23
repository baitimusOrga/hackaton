import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorBanner } from './errors';
import { Auth } from './auth/auth';
import { Footer } from './shell/footer';
import { Header } from './shell/header';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer],
  selector: 'app-root',
  host: { class: 'zw-shell' },
  templateUrl: './app.html',
})
export class App {
  protected readonly errors = inject(ErrorBanner);

  constructor() {
    void inject(Auth)
      .restore()
      .catch(() =>
        this.errors.show('Deine Anmeldung lässt sich gerade nicht prüfen. Versuch es nochmals.'),
      );
  }
}
