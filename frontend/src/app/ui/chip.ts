import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { Icon } from './icon';

/** Filter toggle; selected chips fill blue with a check. Bind with `[(selected)]`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  selector: 'app-chip',
  template: `<button
    type="button"
    class="zw-chip"
    [attr.aria-pressed]="selected()"
    (click)="selected.set(!selected())"
  >
    @if (selected()) {
      <app-icon name="check" [size]="16" />
    }
    <span><ng-content /></span>
  </button>`,
})
export class Chip {
  readonly selected = model(false);
}
