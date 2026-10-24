import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../i18n/i18n';

/** Section title (h2) with an optional "see all" link on the right. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  selector: 'app-section-heading',
  host: { class: 'zw-section-heading' },
  template: `<h2 [id]="headingId()">{{ heading() | t }}</h2>
    @if (linkText()) {
      <a [routerLink]="link()">{{ linkText() | t }}</a>
    }`,
})
export class SectionHeading {
  readonly heading = input.required<string>();
  /** Target for the section's `aria-labelledby`. */
  readonly headingId = input.required<string>();
  readonly linkText = input('');
  readonly link = input<string | unknown[]>('/');
}
