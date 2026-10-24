import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';
import { Icon } from './icon';

/** A listing's photos, one at a time: swipe or the ‹ › buttons move through them, wrapping at the ends. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-photo-gallery',
  imports: [Icon, TranslatePipe],
  host: {
    '(pointerdown)': 'swipeFrom = $event.clientX',
    '(pointerup)': 'swipeEnd($event.clientX)',
  },
  template: `
    <div class="track" [style.transform]="'translateX(' + index() * -100 + '%)'">
      @for (url of urls(); track $index) {
        <img [src]="url" [alt]="alt()" [attr.aria-hidden]="$index !== index()" draggable="false" />
      }
    </div>
    @if (urls().length > 1) {
      <button
        type="button"
        class="nav prev"
        [attr.aria-label]="'Vorheriges Foto' | t"
        (click)="show(index() - 1)"
      >
        <app-icon name="chevron" class="flip" />
      </button>
      <button
        type="button"
        class="nav next"
        [attr.aria-label]="'Nächstes Foto' | t"
        (click)="show(index() + 1)"
      >
        <app-icon name="chevron" />
      </button>
      <span class="count" aria-live="polite">{{ index() + 1 }} / {{ urls().length }}</span>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      background: var(--bg-100);
      touch-action: pan-y; /* horizontal swipes reach the pointer events, vertical ones still scroll the page */
    }
    .track {
      display: flex;
      height: 100%;
      transition: transform 250ms ease-out;
    }
    img {
      flex: none;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      user-select: none;
    }
    .nav {
      position: absolute;
      top: 50%;
      translate: 0 -50%;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-000);
      color: var(--ink);
      border: var(--border-1) solid var(--line-soft);
      cursor: pointer;
    }
    .prev {
      left: var(--space-3);
    }
    .next {
      right: var(--space-3);
    }
    .flip {
      transform: scaleX(-1);
    }
    .count {
      position: absolute;
      right: var(--space-3);
      bottom: var(--space-3);
      padding: 2px var(--space-2);
      background: var(--overlay);
      color: var(--ink-inverse);
      font-size: 12px;
      line-height: 16px;
    }
    @media (prefers-reduced-motion: reduce) {
      .track {
        transition: none;
      }
    }
  `,
})
export class PhotoGallery {
  readonly urls = input<string[]>([]);
  readonly alt = input('');
  /** back to the first photo when another listing comes in */
  protected readonly index = linkedSignal({ source: this.urls, computation: () => 0 });
  protected swipeFrom?: number;

  protected show(index: number): void {
    const count = this.urls().length;
    this.index.set((index + count) % count);
  }

  protected swipeEnd(x: number): void {
    const dx = x - (this.swipeFrom ?? x);
    this.swipeFrom = undefined;
    if (this.urls().length > 1 && Math.abs(dx) > 40) this.show(this.index() + (dx < 0 ? 1 : -1));
  }
}
