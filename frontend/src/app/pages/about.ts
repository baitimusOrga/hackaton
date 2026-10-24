import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-about',
  template: `<h1>{{ 'Über uns' | t }}</h1>
    <p>
      {{
        'Zweit. ist der Marktplatz für Secondhand in der Schweiz: Du findest, was du suchst, und verkaufst, was du nicht mehr brauchst.'
          | t
      }}
    </p>
    @for (s of sections; track s.title) {
      <h2>{{ s.title | t }}</h2>
      <p>{{ s.text | t }}</p>
    }`,
  styles: 'h1, h2, p { margin-bottom: var(--space-4); }',
})
export class About {
  protected readonly sections = [
    {
      title: 'Genaue Angaben',
      text: 'Fotos und Fragen führen zu einem Inserat mit klaren Angaben zu Artikel und Zustand.',
    },
    {
      title: 'Passende Treffer',
      text: 'Beschreibe, was du suchst, und sieh bestätigte Treffer getrennt von Alternativen.',
    },
    {
      title: 'Für Private und Firmen',
      text: 'Privatpersonen verkaufen einzelne Artikel, Firmen räumen ganze Bestände.',
    },
  ];
}
