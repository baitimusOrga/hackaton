import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';
import { Button } from './button';
import { Icon } from './icon';

/**
 * A filter as a dropdown: a trigger with label and summary, the projected panel, a footer with reset and apply.
 * Bind `[(open)]`; the parent keeps one facet open at a time and searches when `open` turns false.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-facet',
  imports: [Button, Icon, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `<button
      #trigger
      type="button"
      class="facet__trigger"
      [class.facet__trigger--on]="summary()"
      [class.facet__trigger--open]="open()"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <span>{{ label() }}</span>
      @if (summary()) {
        <span class="facet__summary">{{ summary() }}</span>
      }
      <app-icon class="facet__chevron" name="chevron" [size]="16" />
    </button>
    @if (open()) {
      <!-- pointer-only; keyboard users close with Escape or "Übernehmen" -->
      <div class="facet__backdrop" aria-hidden="true" (click)="close()"></div>
      <div
        class="facet__panel"
        [class.facet__panel--end]="end()"
        role="dialog"
        [attr.aria-label]="label()"
      >
        <div class="facet__body"><ng-content /></div>
        <div class="facet__foot">
          <button appButton variant="ghost" size="sm" type="button" (click)="clear()">
            {{ 'Zurücksetzen' | t }}
          </button>
          <button appButton variant="primary" size="sm" type="button" (click)="close()">
            {{ 'Übernehmen' | t }}
          </button>
        </div>
      </div>
    }`,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }
    .facet__trigger {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 8px 0 12px;
      font: 600 14px/20px var(--font-sans);
      white-space: nowrap;
      color: var(--ink);
      background: var(--bg-000);
      border: var(--border-1) solid var(--line-soft);
      border-radius: var(--radius-1);
      cursor: pointer;
    }
    .facet__trigger:hover,
    .facet__trigger--on,
    .facet__trigger--open {
      border-color: var(--line);
    }
    .facet__trigger--open {
      background: var(--bg-100);
    }
    .facet__summary {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      color: var(--ink-muted);
    }
    .facet__chevron {
      transform: rotate(90deg);
      transition: transform 0.12s;
    }
    .facet__trigger--open .facet__chevron {
      transform: rotate(-90deg);
    }
    /* below the trigger row, so the other triggers stay clickable while one panel is open */
    .facet__backdrop {
      position: fixed;
      inset: 0;
      z-index: 0;
    }
    .facet__panel {
      position: absolute;
      left: 0;
      top: calc(100% + 8px);
      z-index: 20;
      width: 300px;
      display: flex;
      flex-direction: column;
      background: var(--bg-000);
      border: var(--border-1) solid var(--line);
      border-radius: var(--radius-1);
      animation: facetFade 0.12s linear both;
    }
    .facet__panel--end {
      left: auto;
      right: 0;
    }
    .facet__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      max-height: 320px;
      overflow-y: auto;
    }
    .facet__foot {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-top: var(--border-1) solid var(--line-soft);
    }
    .facet__foot > :last-child {
      margin-left: auto;
    }
    @keyframes facetFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (max-width: 639px), (max-height: 520px) {
      /* a bottom sheet on phones and short viewports */
      .facet__backdrop {
        z-index: 19;
        background: var(--overlay);
      }
      .facet__panel {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        top: auto;
        width: auto;
        max-height: 70vh;
      }
      .facet__body {
        max-height: none;
      }
    }
  `,
})
export class Facet {
  readonly label = input.required<string>();
  /** What is set, shown next to the label; '' when the facet is inactive. */
  readonly summary = input('');
  readonly open = model(false);
  /** "Zurücksetzen": the parent empties this facet; the panel closes afterwards. */
  readonly cleared = output<void>();
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly end = signal(false);

  protected toggle(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    // flip to the right edge when the 300 px panel would leave the viewport
    this.end.set(rect.left + 300 > document.documentElement.clientWidth - 16);
    this.open.set(!this.open());
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected clear(): void {
    this.cleared.emit();
    this.close();
  }
}
