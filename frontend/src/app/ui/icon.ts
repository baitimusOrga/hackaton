import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS, IconName } from './icons';

/** Decorative icon in `currentColor`; give the surrounding control a label. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-icon',
  host: { 'aria-hidden': 'true', style: 'display: inline-flex; flex: none' },
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    [style.width.px]="size()"
    [style.height.px]="size()"
    [innerHTML]="markup()"
  ></svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly markup = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]),
  );
}
