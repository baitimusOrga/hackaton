# Input
Text field on a sunken `bg-100` ground with a `line` border; 16px text so phones never zoom.

**Provide:** `label` (always visible, never placeholder-only), optionally `placeholder`, `help`, `error`, `unit`, `type`, `inputMode`.

**Use**
- `unit: "CHF"` for prices and bids; it switches the field to tabular numerals and sets `inputMode: "decimal"` on your side.
- `help` for format hints ("Mindestens CHF 5.– über dem aktuellen Gebot").
- `error` replaces `help`, turns the border `danger` at 2px and sets `aria-invalid`. The message says what to do, not what went wrong: "Biete mindestens CHF 55.–".

**Don't**
- No floating labels, no icons inside the field.
- Never colour the field itself; only the border and the message change.
