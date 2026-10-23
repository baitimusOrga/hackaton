import { ChangeDetectionStrategy, Component } from '@angular/core';

// TODO: Nachrichten (chat with structured offers, counter-offers and pickup scheduling) is neither designed
// nor backed by an API yet; replace this placeholder once both exist.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-messages',
  template: `<h1>Nachrichten</h1>
    <p class="zw-muted">Hier siehst du bald deine Unterhaltungen mit Käufern und Verkäufern.</p>`,
  styles: 'h1 { margin-bottom: var(--space-4); }',
})
export class Messages {}
