# Find: results screen after the Claude Design — design

Status: approved for planning, 2026-10-24. Source: the Claude Design export `Suche.dc.html`
(results screen) from the project "Repo Zugriff Hackaton"; the card is the one used there, not a
variant from `Inserat-Karten.dc.html`. Builds on
[2026-10-24-find-ranked-search-design.md](2026-10-24-find-ranked-search-design.md) (one ranked
list, refine by text, near me) and on PR #85 (what the AI leaves out is not shown).

## Problem

`/find` works but looks like a form: a textarea above the header's search box, a chip strip, a
260 px filter column with inputs, and a flat grid whose cards carry "94 % · Match — reason". The
Claude Design shows the same data as a page: the buyer's sentence as the heading with the
recognised parts underlined, one sticky filter bar with dropdown facets, and the results in three
groups with a "why" line per card.

## Goal

Rebuild the results screen of `/find` after the design, on the existing API plus two small backend
additions:

1. The parser returns, per requirement, the words of the buyer's text it came from, so the page can
   underline them (no fuzzy matching of values).
2. A condition filter (Zustand facet) as a hard filter.

Out of scope, because the API has no data for it: Marke, Übergabe, Nur, option counts, price "von",
shipping, "Suche speichern" (removed in #71), sort orders (the backend has one), distances on cards.
The home screen in the same export is already implemented (#73, #85). No new visual tokens: colours,
spacing and radii come from `src/tokens.css`.

## Backend

### `Requirement.phrase`

```
Requirement(String attribute, String value, Comparison comparison, String phrase)
```

`phrase`: `@Schema(nullable = true) @Size(max = 80)`. The exact words of the buyer's text the
requirement comes from, copied verbatim; null when there are none (set by hand, or the model found
no words). `canonical()` trims it and cuts it to 80 characters, so a parse result always passes the
validation of `matches`; `matches` ignores it. Existing `new Requirement(a, v, c)` calls in tests
get the fourth argument.

`REQUIREMENT_SCHEMA` gets `"phrase": {"type": ["string", "null"]}` (required). `PARSE_SYSTEM` gets:

> - phrase: the exact words of the buyer's text the requirement comes from, copied verbatim
>   ("iMac 2017", "mindestens 128 GB"); null when there are none.

### `SearchRequirements.budgetPhrase`, `regionPhrase`, `conditions`

```
SearchRequirements(..., Boolean nearMe, Double latitude, Double longitude,
                   String budgetPhrase, String regionPhrase, List<Condition> conditions)
```

- `budgetPhrase`, `regionPhrase`: `@Schema(nullable = true) @Size(max = 80)`. The words that state
  the budget ("bis CHF 600") and the place, distance or "near me" ("Abholung nahe Zürich",
  "in meiner Nähe"); null when there are none. Added to `PARSE_SCHEMA` (required, nullable) and to
  `PARSE_SYSTEM`; `parse()` trims them and cuts them to 80 characters. The refine prompt needs no
  new rule: a phrase from the change text is simply not found in the original sentence, and the
  page shows that requirement as a chip (below).
- `conditions`: `@Schema(nullable = true) @Size(max = 5) List<Condition>`; null or empty = any.
  `candidates()` adds `and l.condition in :conditions` when set. The parser never fills it (it stays
  null in the parse result); it is a filter the buyer sets on the page. It is independent of a
  `Condition` requirement ("working"), which keeps its meaning.

`refine()` passes `current` through as before, so the phrases survive a refinement; the AI may
return new ones for requirements it changes.

Tests: `SearchControllerTest.textBecomesCanonicalRequirements` checks the phrases come through
trimmed; a new test shows `conditions` filters `candidates()`; `SecurityTest` stays.
`./mvnw verify` rewrites `frontend/openapi.json`; `pnpm run api` regenerates the client; both are
committed with the backend change.

## Page: `/find` after a search

Top to bottom, inside `.zw-container`. Before the first search (no `q` in the URL) the page keeps
today's textarea form and tip; `/find?mode=auction` without a search keeps the auction list. Once a
search ran, the textarea is gone: the sentence is the heading, and the header's search box already
mirrors it (#73).

### 1. "Du suchst" — the sentence with tokens

- Eyebrow `zw-caption` "Du suchst".
- The sentence the requirements were read from (`asked`) as a heading:
  28 px / 38 px, weight 700, letter-spacing −0.015em, max-width 960 px, `text-wrap: pretty`;
  22 px / 30 px below 640 px.
- Tokens are the parts of the sentence a phrase matches. Rendered as inline buttons in the heading
  with `text-decoration: underline`, thickness 1.5 px, offset 6 px; nice-to-have tokens use a
  dotted underline. Hover: `--blue-text`. An **off** token is `--ink-muted` with `line-through`.
  `title`: "{label} nicht mehr verlangen" / "{label} wieder verlangen".
- Hint line (14 / 20, `--ink-muted`): "Unterstrichen ist, was wir verstanden haben. Antippen, um es
  nicht mehr zu verlangen." — with off tokens: "{count} entfernt. Nochmals antippen, um es wieder zu
  verlangen."
- **Chips row** "Dazu:" with a `zw-chip` per requirement, budget or region that has no phrase or
  whose phrase is not found in the sentence (set by hand, added by a refinement, old link). Chips
  toggle off the same way (`aria-pressed`).
- Refinements as lines "↳ {text}" (16 / 24, weight 500), then the refine form: input (placeholder
  "Anpassen, z.B. „doch etwas neuere Modelle“", `zw-input`, `--bg-100`) and an outline button
  "Anpassen", max-width 640 px. Behaviour unchanged (`refine()`).

**Token model** (frontend):

```ts
type TokenKind = 'must' | 'nice' | 'budget' | 'region';
interface Token { key: string; kind: TokenKind; label: string; phrase: string | null }
```

Keys: `must:{attribute}`, `nice:{attribute}`, `budget`, `region`. Labels as today (`label(r)`,
`budgetLabel()`, `regionLabel()`). Matching: for each token in that order, the first
case-insensitive occurrence of `phrase` in the sentence that does not overlap a range already
taken; tokens without a hit become chips. Segments are built from the ranges in text order.

**Off state**: `off = signal<Set<string>>` of token keys. The values stay in memory, so a second
tap restores them; `requirements()` leaves off tokens out (an off budget sends no `maxBudgetChf`,
an off region sends no postcode, distance or position). While a token is off, its facet shows as
inactive (empty summary); editing that facet sets the new value and turns the token on again. The
URL (and so a reload or shared link) holds the effective requirements only; off
tokens are not persisted — the same as removing a chip today.

### 2. Sticky filter bar

Sticky at the header's height (72 px), `--bg-000`, 1 px `--line-soft` above and below, z-index 6.

Row 1: `zw-caption` "Filter"; "Alle entfernen" (ghost link, right-aligned) when any of the facets
Kategorie, Preis, Zustand, Region, Verkaufsart or Stichwort is active. It empties those six (the
budget and region tokens turn off, like a tap) and searches; the requirements stay. Today's
"Filter zurücksetzen" button goes: its job is covered by this link and by re-tapping tokens.

Row 2: the facets, wrapping, gap 8 px, padding 8 px 0 12 px. In this order, with the summary shown
in the trigger when active:

| Facet | Panel | Summary |
|---|---|---|
| Kategorie | radio list: "Alle" + `CATEGORIES` (translated via catalog messages) | the category |
| Preis | one `zw-input--price` "bis", CHF | "bis 600" |
| Zustand | checkboxes Neu, Wie neu, Gut, Gebraucht, Defekt (`CONDITION_LABELS`) | one → its label, several → the count |
| Region | PLZ input; radius buttons 5 / 10 / 25 / 50 / 100 km / Ganze Schweiz (`aria-pressed`); ghost button "Mein Standort" / "Standort aktualisieren" | "25 km um 8001", "25 km um dich", "8001" |
| Verkaufsart | checkbox "Auktion" (client-side filter as today) | "Auktion" |
| Anforderungen | two lists Muss / Wäre schön; per row "→ Wäre schön" / "→ Muss" and a remove button; "Keine." when empty | the count |
| Stichwort | text input, comma separated, help "Mehrere mit Komma trennen" | the count |

Row 3 (min-height 56 px, padding 8 px 0, `--line-soft` above): `role="status" aria-live="polite"`
with "{count} Inserate" (16 / 24, weight 600, tabular numbers) and "{compared} verglichen"
(14 / 20, muted). While a call runs the status shows the progress text instead ("Lese deinen
Wunsch…", "Durchsuche die Inserate…", as today).

**Facet component** `ui/facet.ts` (`app-facet`):

- Inputs: `label`, `summary` (string, '' when inactive), `open` (model, two-way). Content projected
  into the panel. Outputs: `cleared` (Zurücksetzen).
- Trigger: `button` height 36 px, padding 0 8 px 0 12 px, 600 14 / 20, radius 2 px, border
  `--line-soft` (`--line` when active or open), background `--bg-100` when open; label, summary
  (500, `--ink-muted`, max-width 160 px, ellipsis), chevron 16 px rotated 180° when open;
  `aria-expanded`.
- Panel: `role="dialog" aria-label=label`, absolute, `top: calc(100% + 8px)`, left 0, width 300 px,
  z-index 20, `--bg-000`, 1 px `--line`, radius 2 px, 120 ms fade-in. Body padding 8 px 16 px,
  max-height 320 px, scroll; checkbox and radio rows min-height 44 px with a `--line-soft` bottom
  border, 20 px `accent-color: var(--blue)` inputs. Footer (12 px 16 px, `--line-soft` above):
  ghost "Zurücksetzen" and primary "Übernehmen" (right).
- Below 640 px the panel is a bottom sheet: `position: fixed; left/right/bottom 16px;
  max-height: 70vh`, over an `--overlay` backdrop.
- Closes on "Übernehmen", on a click outside (a fixed backdrop, transparent on desktop, rendered
  inside the sticky bar below the facet row as in the design so the other triggers stay clickable),
  and on Escape; focus returns to the trigger. The page keeps `openFacet = signal<string | null>`
  so only one facet is open.

**Apply semantics**: edits in a panel change the page state at once (the trigger's summary
follows), but the search runs once, when the panel closes — only if something changed since it
opened (`dirty` flag). "Zurücksetzen" clears that facet, closes and searches. Token taps and
"Alle entfernen" search immediately. No per-keystroke debounce anymore.

### 3. Results

- While `loading()` or `matching()`: a skeleton grid (`repeat(auto-fill, minmax(240px, 1fr))`,
  gap 32 px 16 px) with four placeholders (`--bg-100`: square, a 20 px bar at 70 %, one at 40 %)
  instead of dimmed results.
- Then the groups, from `shown()` (the auction filter still applies in the browser), in this order,
  empty groups hidden, each with a 200 ms fade-in:

| Group | `fit` | Subtitle | Mark, colour |
|---|---|---|---|
| Passt | `MATCH` | "{n} · alles belegt" | ✓ `--green-text` |
| Möglich | `NEEDS_DETAILS` | "{n} · Angaben fehlen" | ? `--ink-muted` |
| Alternativen | `ALTERNATIVE` | "{n} · ausserhalb deiner Suche" | ↗ `--ink-muted` |

  Heading `h2` 24 / 28 weight 700 with the subtitle beside it (16 / 24, muted); grid as the
  skeleton. Order inside a group is the backend's (by score).
- Card: `app-summary-card` as today (photo, badges, title, price, meta), plus a **why line**
  (14 / 20, weight 500, flex gap 6 px, mark then text) in the group's colour with the backend's
  `reason`. Implemented as optional inputs `why` and `fit` (`'ok' | 'maybe' | 'alt'`) on
  `ListingCard`, passed through by `SummaryCard`. Below the card the page keeps today's muted
  detail lines (`details(m)`: "Nicht angegeben: …" for Möglich, the differences for
  Alternativen). No score or fit label on the card anymore.
- No matches: "Noch nichts Passendes. Entferne eine Anforderung oder vergrössere den Umkreis."
- Below the groups the "Nichts dabei? Gesuch aufgeben" line stays as it is (button disabled).

### URL

Today's params stay (`q`, `kw`, `cat`, `max`, `plz`, `km`, `must`, `nice`, `mode`). `must` and
`nice` carry `phrase` inside their JSON for free. New: `cond` (comma-separated `Condition`
names), `maxp` and `plzp` (budget and region phrase, only when present). `FILTER_KEYS` gains
`cond`; `restore()` reads all three.

### Structure

- `pages/find.ts` stays the orchestrator (state signals, URL sync, API calls, token model, groups)
  but loses the form markup and the per-field debounce; target well under its current 512 lines.
- New `pages/find-sentence.ts` (`app-find-sentence`, used by this page only): inputs `text`,
  `tokens`, `off` (set of keys); output `toggled` (key). Pure rendering of segments and chips; the
  page owns the state.
- New `ui/facet.ts` (`app-facet`) as above: a generic dropdown facet, next to `chip.ts` and
  `button.ts`.
- `ui/listing-card.ts`, `ui/summary-card.ts`: `why`, `fit` inputs.
- Styles stay component-scoped (`styles:`) except the skeleton and group layout, which live in
  `find.ts`.
- New strings in `i18n/messages/find.ts` (de keys with fr / it / en): Du suchst, the two hint
  lines, Dazu:, Filter, Alle entfernen, Zurücksetzen, Übernehmen, Alle, Zustand, Anforderungen,
  Stichwort, Passt, Möglich, Alternativen, alles belegt, Angaben fehlen, ausserhalb deiner Suche,
  {km} km um dich, {label} nicht mehr verlangen, {label} wieder verlangen, {count} entfernt.
  Nochmals antippen, um es wieder zu verlangen.

### Error handling

Unchanged: failed calls show in the error banner through `errorInterceptor`; the page resets its
loading flags (`failed()`), the skeleton disappears and the last results stay. A slower answer to an
older request never overwrites a newer one (`seq`).

### Tests

Frontend (`find.spec.ts`, `ui/facet.spec.ts`, `pages/find-sentence.spec.ts`):

1. The sentence renders the tokens from the phrases, underlined; tapping one strikes it through and
   the next `matches` call leaves it out; tapping again restores it.
2. A requirement without a phrase (or whose phrase is not in the sentence) is a chip.
3. Results are grouped by fit with heading, subtitle and why line; an empty group is not rendered.
4. Opening Preis, changing the value and closing runs one `matches` call with the new budget;
   opening and closing without a change runs none; Escape closes.
5. A URL with `cond=GOOD,USED` restores the Zustand facet and sends `conditions`; the URL gets
   `cond`, `maxp`, `plzp`.
6. The skeleton shows while `matches` is pending.
7. Kept from today: refine sends original text, history, current requirements and top ids;
   `mode=auction` lists auctions before a search; "Mein Standort" switches to the position.

Backend: see above.

### Checks

`cd backend && ./mvnw verify`; `cd frontend && pnpm run api && pnpm run format:check && pnpm exec
ng lint && pnpm exec ng test --watch=false && pnpm exec ng build`; then the page in the browser at
desktop and 375 px width against the local backend with the demo data.
