import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One box on the photo: a detection, a privacy mark or where to photograph a missing detail. */
export interface StageMark {
  /** x, y, width, height as fractions of the image */
  box: number[];
  label: string;
  kind: 'detect' | 'privacy' | 'hint';
}

/**
 * A photo with the AI's findings as in "Sell Erkennung v3": a glass sweep with sparks while it is
 * scanned, then the photo dims and glass boxes with labels appear one after the other.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-detection-stage',
  template: `
    <figure class="stage" [attr.aria-label]="label()">
      <div class="stage__frame">
        <img [src]="src()" [alt]="alt()" />
        <div class="fx">
          @if (scanning()) {
            <div class="sweep"></div>
            @for (spark of sparks; track $index) {
              <span
                class="spark"
                [style.left.%]="spark.x"
                [style.top.%]="spark.y"
                [style.animation-delay.ms]="spark.delay"
              ></span>
            }
          } @else if (marks().length) {
            <div class="dim"></div>
          }
          @for (mark of marks(); track mark.label + $index; let i = $index) {
            <div
              class="glass"
              [class.glass--privacy]="mark.kind === 'privacy'"
              [class.glass--hint]="mark.kind === 'hint'"
              [style.left.%]="mark.box[0] * 100"
              [style.top.%]="mark.box[1] * 100"
              [style.width.%]="mark.box[2] * 100"
              [style.height.%]="mark.box[3] * 100"
              [style.animation-delay.ms]="i * 120"
              [attr.data-testid]="mark.kind === 'detect' ? 'detection' : mark.kind"
            >
              <span
                class="pill"
                [class.pill--above]="mark.box[1] > 0.14"
                [style.animation-delay.ms]="i * 120 + 350"
              >
                <span class="pill__icon" aria-hidden="true">
                  @if (mark.kind === 'hint') {
                    <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /></svg>
                  } @else {
                    <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
                  }
                </span>
                {{ mark.label }}
              </span>
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
      max-height: 60vh;
    }
    .fx {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
    }
    .dim {
      position: absolute;
      inset: 0;
      background: rgba(12, 16, 28, 0.38);
      animation: zwDim 0.5s ease-out both;
    }
    .sweep {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 42%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(200, 225, 255, 0.1) 55%,
        rgba(255, 255, 255, 0.45) 96%,
        rgba(255, 255, 255, 0.95) 99%,
        rgba(255, 255, 255, 0) 100%
      );
      backdrop-filter: blur(10px) saturate(1.7) brightness(1.15);
      mask-image: linear-gradient(90deg, transparent, #000 70%);
      animation: zwSweep 1.7s cubic-bezier(0.45, 0, 0.25, 1) infinite;
    }
    .spark {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 10px 2px rgba(140, 200, 255, 0.9);
      animation: zwSpark 0.9s ease-out infinite;
    }
    .glass {
      position: absolute;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      animation:
        zwGlassIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both,
        zwGlow 3s ease-in-out infinite;
    }
    .glass::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(
        115deg,
        transparent 35%,
        rgba(255, 255, 255, 0.65) 50%,
        rgba(170, 210, 255, 0.35) 56%,
        transparent 68%
      );
      background-size: 260% 100%;
      animation: zwShimmer 1.1s ease-out 0.15s both;
    }
    .glass--hint {
      animation:
        zwGlassIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both,
        zwGlow 1.6s ease-in-out infinite;
    }
    .glass--hint::before {
      animation-iteration-count: infinite;
    }
    .glass--privacy {
      background: rgba(163, 16, 30, 0.18);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
      animation: zwGlassIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .pill {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 4px 10px 4px 6px;
      white-space: nowrap;
      border-radius: 999px;
      background: rgba(20, 22, 30, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.35);
      backdrop-filter: blur(14px) saturate(1.6);
      color: #fff;
      font: 600 13px/18px var(--font-sans);
      animation: zwLabel 0.5s ease-out 0.35s both;
    }
    .pill--above {
      top: auto;
      bottom: calc(100% + 8px);
    }
    .pill__icon {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      color: #1e1d1a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .pill__icon svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      width: 12px;
      height: 12px;
    }
    @media (prefers-reduced-motion: reduce) {
      .glass,
      .glass::before,
      .pill,
      .dim {
        animation: none;
      }
      .sweep,
      .spark {
        display: none;
      }
    }
    @keyframes zwSweep {
      0% {
        transform: translateX(-110%);
      }
      100% {
        transform: translateX(260%);
      }
    }
    @keyframes zwGlassIn {
      0% {
        opacity: 0;
        transform: scale(1.06);
        backdrop-filter: blur(18px) saturate(1) brightness(1);
      }
      55% {
        opacity: 1;
      }
      100% {
        opacity: 1;
        transform: scale(1);
        backdrop-filter: blur(0) saturate(1.5) brightness(1.28);
      }
    }
    @keyframes zwGlow {
      0%,
      100% {
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.7),
          0 0 22px 2px rgba(106, 149, 255, 0.55),
          inset 0 0 22px rgba(255, 255, 255, 0.28);
      }
      50% {
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.9),
          0 0 30px 4px rgba(140, 220, 255, 0.6),
          inset 0 0 30px rgba(200, 230, 255, 0.38);
      }
    }
    @keyframes zwLabel {
      0% {
        opacity: 0;
        transform: translateY(6px);
        filter: blur(4px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }
    }
    @keyframes zwSpark {
      0% {
        opacity: 0;
        transform: scale(0.2);
      }
      40% {
        opacity: 1;
        transform: scale(1);
      }
      100% {
        opacity: 0;
        transform: scale(0.6);
      }
    }
    @keyframes zwDim {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes zwShimmer {
      0% {
        background-position: 160% 0;
        opacity: 1;
      }
      100% {
        background-position: -60% 0;
        opacity: 0;
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

  // fixed spread of the sparks in the scanning sweep, as in the design
  protected readonly sparks = Array.from({ length: 14 }, (_, i) => {
    const x = ((i * 37) % 92) + 4;
    return { x, y: ((i * 53) % 88) + 6, delay: Math.round(x * 15) };
  });
}
