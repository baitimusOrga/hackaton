import { computed, Directive, input } from '@angular/core';

/** `<button appButton>` / `<a appButton>`: outlined by default, one `primary` per screen, `bid` only for bids. */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: { '[class]': 'classes()' },
})
export class Button {
  readonly variant = input<'default' | 'primary' | 'bid' | 'ghost'>('default');
  readonly size = input<'md' | 'sm'>('md');
  readonly block = input(false);
  protected readonly classes = computed(() =>
    [
      'zw-btn',
      this.variant() !== 'default' && `zw-btn--${this.variant()}`,
      this.size() === 'sm' && 'zw-btn--sm',
      this.block() && 'zw-btn--block',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
