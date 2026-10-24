import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-info',
  template: `<h1>{{ 'Über das Projekt' | t }}</h1>
    <p>
      {{
        'Hast du schon einmal darüber nachgedacht, wie wenige grosse Plattformen den Schweizer Secondhand-Markt dominieren? Mehrere bekannte Plattformen gehören demselben Unternehmen, sodass den Nutzenden nur wenige Alternativen bleiben.'
          | t
      }}
    </p>
    <p>
      {{ 'Wir glauben, es ist Zeit für eine Veränderung. So ist' | t }} <em>Zweite.</em
      >{{ ' entstanden.' | t }}
    </p>
    <p>
      {{
        'Unser Ziel ist es, einen innovativen Online-Marktplatz zu schaffen, der eine echte Alternative zu bestehenden Plattformen bietet. Mit tieferen Gebühren, intelligenterer KI-Integration und einer besseren Benutzererfahrung möchten wir den Kauf und Verkauf von Secondhand-Produkten für alle einfacher, günstiger und zugänglicher machen.'
          | t
      }}
    </p>`,
  styles: 'h1, p { margin-bottom: var(--space-4); }',
})
export class Info {}
