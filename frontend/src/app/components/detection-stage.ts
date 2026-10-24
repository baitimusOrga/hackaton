import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One box on the photo: a detection, a privacy mark or where to photograph a missing detail. */
export interface StageMark {
  /** x, y, width, height as fractions of the image */
  box: number[];
  label: string;
  kind: 'detect' | 'privacy' | 'hint';
}

/**
 * A photo with the AI's findings as in "Sell Erkennung v3" (style "Kurz"): a thin progress bar while
 * it is scanned, then corner marks with labels flash up one after the other and fade out after a few
 * seconds. Privacy marks and "photograph it here" hints stay; a hint shows the projected content (the
 * camera button) beside its label.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-detection-stage',
  template: `
    <figure class="stage" [class.stage--compact]="compact()" [attr.aria-label]="label()">
      <div class="stage__frame">
        <img [src]="src()" [alt]="alt()" />
        <div class="fx">
          @if (scanning()) {
            <div class="shade"></div>
            <div class="load"><span></span></div>
          } @else if (hasHint()) {
            <div class="shade"></div>
          }
          @for (mark of placed(); track mark.label + $index; let i = $index) {
            <div
              class="mark"
              [class.mark--stay]="mark.kind !== 'detect'"
              [class.mark--hint]="mark.kind === 'hint'"
              [class.mark--privacy]="mark.kind === 'privacy'"
              [style.left.%]="mark.box[0] * 100"
              [style.top.%]="mark.box[1] * 100"
              [style.width.%]="mark.box[2] * 100"
              [style.height.%]="mark.box[3] * 100"
              [style.animation-delay.ms]="i * 450"
              [attr.data-testid]="mark.kind === 'detect' ? 'detection' : mark.kind"
            >
              <span class="c c--tl"></span><span class="c c--tr"></span>
              <span class="c c--bl"></span><span class="c c--br"></span>
              @if (mark.pill) {
                <span
                  class="tag"
                  [class.tag--above]="mark.pill === 'above'"
                  [class.tag--inside]="mark.pill === 'inside'"
                >
                  @if (mark.kind === 'hint') {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    </svg>
                  } @else if (mark.kind === 'privacy') {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 4l9 16H3zM12 10v4M12 17v.5" />
                    </svg>
                  }
                  {{ mark.label }}
                  @if (mark.kind === 'hint') {
                    <ng-content />
                  }
                </span>
              }
            </div>
          }
        </div>
      </div>
    </figure>
  `,
  styles: `
    /* Stage: the photo at its own aspect ratio, so the boxes (fractions of the image) sit right. */
    .stage {
      display: flex;
      justify-content: center;
      margin: 0;
      background: var(--bg-100);
      overflow: hidden;
      isolation: isolate;
    }
    .stage__frame {
      position: relative;
    }
    .stage__frame img {
      display: block;
      max-width: 100%;
      max-height: min(60vh, calc(100vh - 380px));
      min-height: 200px;
    }
    .stage--compact .stage__frame img {
      max-height: 32vh;
    }
    .fx {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: rgba(30, 29, 26, 0.22);
      animation: zwFade 0.3s linear both;
    }
    .load {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: rgba(30, 29, 26, 0.35);
    }
    .load span {
      position: absolute;
      inset: 0;
      background: #fbfaf7;
      transform-origin: left;
      animation: zwLoad 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    /* a detection flashes up, holds about 3 seconds and fades out */
    .mark {
      position: absolute;
      animation: zwBlip 4s ease-out both;
    }
    .mark--stay {
      animation: zwCorner 0.25s ease-out both;
    }
    .mark--hint .c {
      animation: zwBlink 1.4s ease-in-out 0.4s infinite;
    }
    .c {
      position: absolute;
      width: 14px;
      height: 14px;
      border: 0 solid #fbfaf7;
    }
    .mark--privacy .c {
      border-color: #f3b4ba;
    }
    .c--tl {
      top: 0;
      left: 0;
      border-width: 2px 0 0 2px;
    }
    .c--tr {
      top: 0;
      right: 0;
      border-width: 2px 2px 0 0;
    }
    .c--bl {
      bottom: 0;
      left: 0;
      border-width: 0 0 2px 2px;
    }
    .c--br {
      bottom: 0;
      right: 0;
      border-width: 0 2px 2px 0;
    }
    .tag {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      white-space: nowrap;
      border-radius: 2px;
      background: #fbfaf7;
      color: #1e1d1a;
      font: 600 13px/18px var(--font-sans);
    }
    .mark--hint .tag {
      pointer-events: auto;
      padding: 4px 4px 4px 8px;
      gap: 8px;
    }
    .tag--inside {
      top: 6px;
      left: 6px;
    }
    .tag--above {
      top: auto;
      bottom: calc(100% + 6px);
    }
    .tag svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    @media (prefers-reduced-motion: reduce) {
      .mark,
      .mark--hint .c,
      .shade {
        animation: none;
      }
      .mark:not(.mark--stay) {
        display: none;
      }
      .load span {
        animation: none;
        transform: scaleX(0.6);
      }
    }
    @keyframes zwFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes zwLoad {
      0% {
        transform: scaleX(0);
      }
      60% {
        transform: scaleX(0.8);
      }
      100% {
        transform: scaleX(1);
      }
    }
    @keyframes zwBlip {
      0% {
        opacity: 0;
        transform: scale(1.05);
      }
      5% {
        opacity: 1;
        transform: scale(1);
      }
      85% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
    @keyframes zwCorner {
      from {
        opacity: 0;
        transform: scale(1.06);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes zwBlink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }
  `,
})
export class DetectionStage {
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly label = input('');
  readonly marks = input<StageMark[]>([]);
  readonly scanning = input(false);
  /** a smaller photo beside a chip question */
  readonly compact = input(false);

  /**
   * Where each label goes: above, below or inside its box, whichever does not cover a label placed
   * before; a label with no free spot is left out (the box stays). Sizes are estimated as fractions of
   * a ~560px wide photo.
   */
  protected readonly placed = computed(() => {
    const taken: Rect[] = [];
    return this.marks().map((mark) => {
      const [x, y, , h] = mark.box;
      // a hint label also carries the camera button
      const button = mark.kind === 'hint' ? 150 : 0;
      const width = Math.min(0.95, (mark.label.length * 7.5 + 44 + button) / 560);
      const height = mark.kind === 'hint' ? 0.11 : 0.075;
      const spots: [Pill, Rect][] = [
        ['above', { x, y: y - height - 0.015, w: width, h: height }],
        ['below', { x, y: y + h + 0.015, w: width, h: height }],
        ['inside', { x: x + 0.015, y: y + 0.015, w: width, h: height }],
      ];
      const free = spots.find(
        ([, r]) =>
          r.y >= 0 && r.y + r.h <= 1 && r.x + r.w <= 1.02 && !taken.some((t) => overlaps(r, t)),
      );
      if (free) taken.push(free[1]);
      return { ...mark, pill: free?.[0] ?? null };
    });
  });

  protected readonly hasHint = computed(() => this.marks().some((m) => m.kind === 'hint'));
}

type Pill = 'above' | 'below' | 'inside';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
