# `/search` on the facet bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The plain list page `/search` (behind the home category tiles, `?category=…`) gets the same look as `/find`: a heading, the sticky facet bar, a count row and the card grid — without AI, against `GET /api/listings`.

**Architecture:** The facet-bar CSS that lives in `pages/find.ts` moves to `frontend/src/components.css` as `zw-*` classes so both pages share it (find keeps its page-specific styles). `/search` keeps its URL-driven data flow (`queryParamMap` → `ListingsService.list`): every facet change navigates at once (the call is cheap), panels close on Übernehmen / backdrop / Escape, "Zurücksetzen" clears one facet, "Alle entfernen" clears all. `ui/facet.ts` is reused unchanged.

**Tech Stack:** Angular 22 (signals, `@if`/`@for`), generated `ListingsService`, Vitest. Worktree `.claude/worktrees/search-facets`, branch `search-facets`. House rules: `AGENTS.md`, `docs/LEAN-CODE.md`.

---

## File map

| File | Change |
|---|---|
| `frontend/src/app/i18n/messages/find.ts` | strings for the search page (Task 0) |
| `frontend/src/components.css` | shared facet-bar classes (Task A) |
| `frontend/src/app/pages/find.ts`, `find.html` | use the shared classes, drop the moved CSS (Task A) |
| `frontend/src/app/pages/search.ts`, `search.html`, `search.spec.ts` | rebuilt on the facet bar (Task B) |

Checks (from `frontend/`): `pnpm run format && pnpm run format:check && pnpm exec ng lint && pnpm exec ng test --watch=false && pnpm exec ng build`.

---

### Task 0 (Sonnet): strings

Append inside `FIND_MESSAGES` in `frontend/src/app/i18n/messages/find.ts`, before the closing `};`:

```ts
  // plain search page
  Liste: { fr: 'Liste', it: 'Elenco', en: 'List' },
  Karte: { fr: 'Carte', it: 'Mappa', en: 'Map' },
  Ansicht: { fr: 'Affichage', it: 'Vista', en: 'View' },
  'Karte der Treffer': { fr: 'Carte des résultats', it: 'Mappa dei risultati', en: 'Map of results' },
  'Keine Inserate gefunden.': {
    fr: 'Aucune annonce trouvée.',
    it: 'Nessun annuncio trovato.',
    en: 'No listings found.',
  },
  'Inserate werden geladen…': {
    fr: 'Chargement des annonces…',
    it: 'Caricamento degli annunci…',
    en: 'Loading listings…',
  },
  'Standort nicht verfügbar. Gib eine PLZ ein oder erlaube den Standortzugriff.': …
```

(The last key already exists — do not add it twice; check with grep. `Suchen`, `Kategorie`, `Preis`, `Preis bis`, `bis`, `Region`, `PLZ`, `Umkreis`, `Ganze Schweiz`, `Mein Standort`, `Verkaufsart`, `Auktion`, `Stichwort`, `Modell, Stichwort`, `Mehrere mit Komma trennen`, `Filter`, `Alle entfernen`, `Alle`, `{count} Inserate` exist too.)

### Task A (Opus): shared facet-bar classes

Move these rules out of the `styles:` of `frontend/src/app/pages/find.ts` into `frontend/src/components.css` (after the `/* Badge */` block or at the end of the component section — one new comment header `/* Facet bar (find, search) */`), renamed:

| in `find.ts` today | shared class |
|---|---|
| `.find__bar` | `.zw-facetbar` (sticky, top 72px, z 6, bg, top/bottom border) |
| `.find__bar-row` | `.zw-facetbar__row` |
| `.find__clear` | `.zw-facetbar__clear` |
| `.find__facets` | `.zw-facets` (incl. the `≤639px` nowrap/scroll rule) |
| `.find__opt`, `:last-child`, `> input` | `.zw-facet-option`, … |
| `.find__opt-text` | `.zw-facet-option__text` |
| `.find__opt-head` | `.zw-facet-option__head` |
| `.find__radii` | `.zw-radii` |
| `.find__count`, `.find__count .zw-help` | `.zw-count`, … |
| the `@media (max-width: 720px) { .find__bar { top: 0 } }` rule | same for `.zw-facetbar` |

Then replace the class names in `find.html` (every occurrence, incl. `class="zw-caption find__opt-head"` → `class="zw-caption zw-option__head"` and `class="zw-help find__opt"` → `class="zw-help zw-option"`). Nothing else in find changes; `find.spec.ts` does not reference these classes. Checks must stay green (find.spec.ts 15 tests).

### Task B (Opus): `/search` rebuilt

Rewrite `frontend/src/app/pages/search.ts`, `search.html`, `search.spec.ts`. Read `pages/find.ts`/`find.html` (after Task A) as the pattern for the bar, and `ui/facet.ts`.

**Data flow stays:** `filtersOf(params)` → `filters` signal and `listings = toSignal(queryParamMap.pipe(switchMap(list)))`. New URL param `saleMode=AUCTION` (passed to `list()` as `saleMode: 'AUCTION'` when present). Keep `set(name, value)` (navigate with `queryParamsHandling: 'merge'`, null removes) and `nearMe(radiusKm)` (geolocation → `lat`/`lon` rounded to 3 decimals, error text in `locationError`).

**Page, top to bottom (inside `.zw-container.zw-section.zw-section--last`):**
1. `<h1>`: the category translated (`filters().category | t`) or `'Suchen' | t`.
2. `<div class="zw-facetbar">`
   - row `.zw-facetbar__row`: `zw-caption` "Filter"; `button appButton variant="ghost" size="sm" class="zw-facetbar__clear"` "Alle entfernen" when any of q / category / maxPrice / postcode / radiusKm / saleMode is set → navigates to `/search` with no query params (`router.navigate([], { relativeTo: route, queryParams: {} })`).
   - `.zw-facets` with `app-facet`s, `openFacet = signal<string | null>(null)` keeps one open (`[open]="openFacet() === 'x'" (openChange)="openFacet.set($event ? 'x' : null)"`):
     - **Kategorie**: radio `zw-facet-option` rows "Alle" + `CATEGORIES` (`{{ c | t }}`), `(change)="set('category', c)"` / `''` for Alle; `(cleared)="set('category', '')"`; summary = translated category or ''.
     - **Preis**: label `zw-label` "Preis bis" + `input.zw-input.zw-input--price[type=number][min=0]` with `(change)="set('maxPrice', el.value)"`; summary `bis 600`; cleared → `set('maxPrice', '')`.
     - **Region**: label "PLZ" + `input.zw-input[inputmode=numeric][maxlength=4]` `(change)="set('postcode', el.value)"`; `.zw-radii` chips 5/10/25/50/100 km + "Ganze Schweiz" (`zw-chip`, `aria-pressed`, `(click)="nearMe('25')"` / `nearMe('')`); ghost button "Mein Standort" → `nearMe(String(filters().radiusKm ?? 25))` (asks for the position with the current or default radius). Summary: `'{km} km um {pc}'` with a postcode, `'{km} km um deinen Standort'` with lat/lon, else the postcode or ''. `(cleared)` → navigate with `postcode: null, radiusKm: null, lat: null, lon: null`.
     - **Verkaufsart**: checkbox `zw-facet-option` "Auktion" → `set('saleMode', checked ? 'AUCTION' : '')`; summary "Auktion" when set.
     - **Stichwort**: label "Modell, Stichwort" + `input.zw-input[type=search]` `(change)="set('q', el.value)"`, help "Mehrere mit Komma trennen" is NOT shown here (the API does a plain contains match) — show no help text; summary = the term.
   - `.zw-count`: `<span role="status" aria-live="polite">` with `'{count} Inserate' | t` (or `'Inserate werden geladen…'` while `listings()` is undefined); right side (`margin-left: auto`): the view toggle — two `zw-chip` buttons "Liste" / "Karte" with `aria-pressed`, in a `role="group"` labelled "Ansicht" (only when there are items).
3. `@if (locationError()) { <p class="zw-error" role="alert">…</p> }` (keep).
4. Results: `app-listing-map` (label `'Karte der Treffer' | t`) or `<div class="zw-grid">` of `app-summary-card`; empty → `<p class="zw-muted">{{ 'Keine Inserate gefunden.' | t }}</p>`.

Component styles in `search.ts`: only what is page-specific (e.g. `.search__view { margin-left: auto; display: flex; gap: var(--space-2) }`); the bar comes from the shared classes. Translate every visible string with the `t` pipe (import `TranslatePipe`); `h1` margin/spacing as the page has today.

**Tests (`search.spec.ts`, keep the `setup(url, items)` helper):**
1. `/search?category=Monitors` → `list` called with `{ category: 'Monitors' }`, a card links to `/listings/2`, the Kategorie trigger shows "Bildschirme", the `h1` reads "Bildschirme".
2. Open Preis, change the input to 500 (dispatch `change`) → `list` last called with `{ q: 'imac', maxPrice: 500 }` and the URL is `/search?q=imac&maxPrice=500` (start from `/search?q=imac`); Escape closes the panel.
3. Verkaufsart "Auktion" → `list` called with `saleMode: 'AUCTION'`; "Alle entfernen" → URL `/search`, `list` called with `{}`.
4. The empty state text shows for `[]`; the view toggle is absent then.

Then the full checks; `search.spec.ts` green together with the rest.

### Task C (orchestrator): review, browser, PR

One Opus review of the branch; fixes; full checks; `/search?category=Gaming` and `/search` in the browser at desktop and 375 px (bar, a facet, the map toggle, phone sheet); push, PR, merge after green CI.
