import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18n, TranslatePipe } from '../i18n/i18n';
import { Icon } from '../ui/icon';

export type TokenKind = 'must' | 'nice' | 'budget' | 'region';

/** A requirement, the budget or the region as the page shows it: `key` is unique per token, `phrase` is where it sits in the sentence. */
export interface Token {
  key: string;
  kind: TokenKind;
  label: string;
  phrase: string | null;
}

export interface Segment {
  text: string;
  token?: Token;
}

/**
 * Places each token's phrase in the sentence: the first case-insensitive hit that overlaps no earlier token.
 * Tokens without a hit are returned as chips.
 */
export function place(text: string, tokens: Token[]): { segments: Segment[]; chips: Token[] } {
  // shortcut: indices assume toLowerCase keeps the length (not for İ); fine for de/fr/it/en
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; token: Token }[] = [];
  const chips: Token[] = [];
  for (const token of tokens) {
    const phrase = token.phrase?.trim().toLowerCase();
    if (!phrase) {
      chips.push(token);
      continue;
    }
    let start = lower.indexOf(phrase);
    while (start >= 0 && ranges.some((r) => start < r.end && start + phrase.length > r.start)) {
      start = lower.indexOf(phrase, start + 1);
    }
    if (start < 0) chips.push(token);
    else ranges.push({ start, end: start + phrase.length, token });
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) segments.push({ text: text.slice(pos, r.start) });
    segments.push({ text: text.slice(r.start, r.end), token: r.token });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return { segments, chips };
}

/** "Du suchst": the sentence as a heading with tappable tokens; the page owns the off state. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-find-sentence',
  imports: [Icon, TranslatePipe],
  template: `<p class="zw-caption">{{ 'Du suchst' | t }}</p>
    <h1 class="sentence">
      @for (s of placed().segments; track $index) {
        @if (s.token; as tok) {
          <button
            type="button"
            class="token"
            [class.token--nice]="tok.kind === 'nice'"
            [class.token--off]="off().has(tok.key)"
            [attr.aria-pressed]="!off().has(tok.key)"
            [title]="
              (off().has(tok.key) ? '{label} wieder verlangen' : '{label} nicht mehr verlangen')
                | t: { label: tok.label }
            "
            (click)="toggled.emit(tok.key)"
          >
            <span>{{ s.text }}</span>
          </button>
        } @else {
          <span>{{ s.text }}</span>
        }
      }
    </h1>
    <p class="zw-help">{{ hint() }}</p>
    @if (placed().chips.length) {
      <div class="extra">
        <span class="zw-help">{{ 'Dazu:' | t }}</span>
        @for (tok of placed().chips; track tok.key) {
          <button
            type="button"
            class="zw-chip"
            [attr.aria-pressed]="!off().has(tok.key)"
            (click)="toggled.emit(tok.key)"
          >
            @if (!off().has(tok.key)) {
              <app-icon name="check" [size]="16" />
            }
            <span>{{ tok.label }}</span>
          </button>
        }
      </div>
    }`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .sentence {
      margin: 0;
      max-width: 960px;
      font-size: 28px;
      line-height: 38px;
      font-weight: 700;
      letter-spacing: -0.015em;
      text-wrap: pretty;
    }
    .token {
      display: inline;
      padding: 0;
      font: inherit;
      letter-spacing: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-thickness: 1.5px;
      text-underline-offset: 6px;
    }
    .token--nice {
      text-decoration-style: dotted;
    }
    .token--off {
      color: var(--ink-muted);
      text-decoration-line: line-through;
    }
    .token:hover {
      color: var(--blue-text);
    }
    .extra {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .extra .zw-chip {
      max-width: 100%;
    }
    @media (max-width: 639px) {
      .sentence {
        font-size: 22px;
        line-height: 30px;
      }
    }
  `,
})
export class FindSentence {
  readonly text = input.required<string>();
  readonly tokens = input.required<Token[]>();
  /** Keys of the tokens the buyer tapped off. */
  readonly off = input.required<ReadonlySet<string>>();
  readonly toggled = output<string>();
  private readonly i18n = inject(I18n);
  protected readonly placed = computed(() => place(this.text(), this.tokens()));
  protected readonly hint = computed(() => {
    const count = this.tokens().filter((t) => this.off().has(t.key)).length;
    return count
      ? this.i18n.t('{count} entfernt. Nochmals antippen, um es wieder zu verlangen.', { count })
      : this.i18n.t(
          'Unterstrichen ist, was wir verstanden haben. Antippen, um es nicht mehr zu verlangen.',
        );
  });
}
