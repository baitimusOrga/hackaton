import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

/** Labelled text field. `unit` (e.g. "CHF") switches to tabular price styling; `error` replaces `help`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  selector: 'app-input',
  template: `<div class="zw-field">
      <label class="zw-label" [for]="id">{{ label() }}</label>
      @if (unit()) {
        <div class="zw-affix">
          <span class="zw-affix__unit">{{ unit() }}</span>
          <ng-container *ngTemplateOutlet="field" />
        </div>
      } @else {
        <ng-container *ngTemplateOutlet="field" />
      }
      @if (error()) {
        <p class="zw-help zw-help--error" [id]="id + '-help'">{{ error() }}</p>
      } @else if (help()) {
        <p class="zw-help" [id]="id + '-help'">{{ help() }}</p>
      }
    </div>
    <ng-template #field>
      <input
        class="zw-input"
        [class.zw-input--price]="unit()"
        [id]="id"
        [type]="type()"
        [attr.inputmode]="inputMode()"
        [placeholder]="placeholder()"
        [value]="value()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="error() || help() ? id + '-help' : null"
        (input)="onInput($event)"
      />
    </ng-template>`,
})
export class Input {
  protected readonly id = `app-input-${nextId++}`;
  readonly label = input.required<string>();
  readonly value = model('');
  readonly type = input('text');
  readonly inputMode = input<string | null>(null);
  readonly placeholder = input('');
  readonly unit = input('');
  readonly help = input('');
  readonly error = input('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
