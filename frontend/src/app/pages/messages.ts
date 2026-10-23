import { ChangeDetectionStrategy, Component } from '@angular/core';

// TODO: Nachrichten (chat with structured offers, counter-offers and pickup scheduling) is neither designed
// nor backed by an API yet; replace this placeholder once both exist.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-messages',
  template: `<h1 class="title">Nachrichten</h1>
    <p class="zw-muted">Hier siehst du bald deine Unterhaltungen mit Käufern und Verkäufern.</p>`,
  styles: '.title { margin: 0 0 var(--space-4); font-size: 32px; line-height: 36px; font-weight: 700; }',
})
export class Messages {}
