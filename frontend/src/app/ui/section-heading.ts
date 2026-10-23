import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Section title (h2) with an optional "see all" link on the right. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  selector: 'app-section-heading',
  host: { class: 'zw-section-heading' },
  template: `<h2 [id]="headingId()">{{ heading() }}</h2>
    @if (linkText()) {
      <a [routerLink]="link()">{{ linkText() }}</a>
    }`,
})
export class SectionHeading {
  readonly heading = input.required<string>();
  /** Target for the section's `aria-labelledby`. */
  readonly headingId = input.required<string>();
  readonly linkText = input('');
  readonly link = input<string | unknown[]>('/');
}
