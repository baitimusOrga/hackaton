# Button
The one action control: outlined by default, inverted black for the primary action, blue only for placing a bid.

**Provide:** `label` (sentence case, all four languages), optionally `variant`, `size`, `block`, `href`, `icon`.

**Use**
- One `primary` per screen. On a listing it is "Kaufen"; on an auction the `bid` variant replaces it — never both.
- Default (outlined) for everything else: "Merken", "Teilen", "Nachricht".
- `ghost` only inside dense rows (table actions, dialog cancel).
- `block` on phones for the main action, pinned at the bottom of the detail page.

**Don't**
- No icon-only buttons without `aria-label`.
- No fixed widths — French labels are long.
- Never put a `blue` fill on anything that is not a bid or a selected filter. Green is never a button.
