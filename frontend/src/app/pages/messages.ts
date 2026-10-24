import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

// TODO: Nachrichten (chat with structured offers, counter-offers and pickup scheduling) is neither designed
// nor backed by an API yet; replace this placeholder once both exist.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-messages',
  template: `<h1>{{ 'Nachrichten' | t }}</h1>
    <p class="zw-muted">
      {{ 'Hier siehst du bald deine Unterhaltungen mit Käufern und Verkäufern.' | t }}
    </p>`,
  styles: 'h1 { margin-bottom: var(--space-4); }',
})
export class Messages {}
