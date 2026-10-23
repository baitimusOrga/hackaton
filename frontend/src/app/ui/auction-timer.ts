import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Icon } from './icon';

const URGENT_MS = 10 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Countdown `hh:mm:ss` without animation; inverts to black in the last ten minutes. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  selector: 'app-auction-timer',
  host: { '[class]': 'classes()', role: 'timer', 'aria-live': 'off' },
  template: `<app-icon name="clock" [size]="16" />
    <span class="zw-timer__label">{{ ended() ? endedLabel() : label() }}</span>
    <span>{{ value() }}</span>`,
})
export class AuctionTimer {
  readonly endsAt = input.required<Date | number>();
  readonly label = input('Endet in');
  readonly endedLabel = input('Beendet');
  private readonly now = signal(Date.now());
  private readonly left = computed(() => Math.max(0, +this.endsAt() - this.now()));
  protected readonly ended = computed(() => this.left() === 0);
  protected readonly classes = computed(() =>
    this.ended()
      ? 'zw-timer zw-timer--ended'
      : this.left() < URGENT_MS
        ? 'zw-timer zw-timer--urgent'
        : 'zw-timer',
  );
  protected readonly value = computed(() => {
    const s = Math.floor(this.left() / 1000);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
