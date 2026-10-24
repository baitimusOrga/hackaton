import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-about',
  template: `<h1>{{ 'Über uns' | t }}</h1>
    <p>
      {{
        'Wir sind vier Informatiklernende in der Fachrichtung Applikationsentwicklung im dritten Lehrjahr. Wir haben uns in der Schule kennengelernt und arbeiten in vier verschiedenen Unternehmen.'
          | t
      }}
    </p>
    <p>
      {{ 'Gemeinsam haben wir beschlossen, am Zentral Hack in der Kategorie' | t }}
      <em>Young Talents</em
      >{{ ' teilzunehmen. Unser Ziel ist es, einen Online-Marktplatz zu entwickeln.' | t }}
    </p>
    <p>
      {{
        'Obwohl wir aus verschiedenen Unternehmen kommen, teilen wir die Leidenschaft für Softwareentwicklung und arbeiten gerne an neuen Herausforderungen.'
          | t
      }}
    </p>
    <p>
      {{
        'Mit diesem Projekt möchten wir unsere Programmierkenntnisse verbessern, praktische Erfahrungen sammeln und gemeinsam etwas Nützliches schaffen.'
          | t
      }}
    </p>`,
  styles: 'h1, p { margin-bottom: var(--space-4); }',
})
export class About {}
