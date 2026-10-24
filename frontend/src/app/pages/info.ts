import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-info',
  template: `<h1>{{ 'Informationen' | t }}</h1>
    <p>{{ 'So laufen Kaufen, Verkaufen und Bezahlen ab.' | t }}</p>
    <h2>{{ 'Kaufen' | t }}</h2>
    <p>
      {{
        'Suche, stelle Fragen, mache ein Angebot oder biete bei einer Auktion mit. Dein Höchstgebot bleibt privat.'
          | t
      }}
    </p>
    <h2>{{ 'Verkaufen' | t }}</h2>
    <p>
      {{
        'Fotografiere den Artikel, beantworte ein paar Fragen und prüfe den Entwurf, bevor du ihn veröffentlichst. Private und Firmen können verkaufen.'
          | t
      }}
    </p>
    <h2>{{ 'Bezahlen' | t }}</h2>
    <p>
      {{
        'Ihr bezahlt direkt untereinander, zum Beispiel bar bei der Abholung oder per TWINT. Die Plattform wickelt keine Zahlung ab und markiert nichts als bezahlt.'
          | t
      }}
    </p>
    <p>
      {{
        'Ein Chat, ein Screenshot oder eine E-Mail ändert keinen Zahlungsstatus. Ein direkter Handel hat keinen Schutz durch die Plattform.'
          | t
      }}
    </p>`,
  styles: 'h1, h2, p { margin-bottom: var(--space-4); }',
})
export class Info {}
