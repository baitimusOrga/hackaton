import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-info',
  template: `<h1>About the Project</h1>
    <p>
      Have you ever thought about how a few major platforms dominate the Swiss second-hand market?
      Several well-known platforms belong to the same company, leaving users with limited
      alternatives.
    </p>
    <p>We believe it's time for a change. That's how <em>Zweite.</em> was born.</p>
    <p>
      Our goal is to create an innovative online marketplace that offers a real alternative to
      existing platforms. With lower fees, smarter AI integration and a better user experience, we
      want to make buying and selling second-hand products easier, cheaper and more accessible for
      everyone.
    </p>`,
  styles: 'h1, p { margin-bottom: var(--space-4); }',
})
export class Info {}
