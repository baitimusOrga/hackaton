import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Uppercase label for a sale mode or status; never placed on top of photos. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-badge',
  host: { '[class]': '"zw-badge" + (variant() ? " zw-badge--" + variant() : "")' },
  template: '<ng-content />',
})
export class Badge {
  readonly variant = input<'inverse' | 'green' | 'danger' | ''>('');
}
