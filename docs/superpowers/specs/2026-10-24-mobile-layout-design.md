# Mobile layout: tab bar, sheets, phone-sized pages — design

Status: approved for planning, 2026-10-24. Source: the Claude Design canvas "Mobile Layout Plus
Button" (`ZweitApp.dc.html`, frames 1a Start, 1b after tapping +, 2a Suchen with results, 2b filter
open), chosen variant: round plus button, labels on. Branch `feature/mobile-layout`, cut from
`feature/sell-v3` (the sell flow it covers full screen is not on `main` yet).

## Problem

The web app is designed for desktop. On a phone the header wraps to a third of the screen, the
nav is a row of text links, the find page shows its 260px filter column above the results, and
nothing is laid out for a 393px-wide viewport. There is no phone navigation.

## Goal

One Angular app, one codebase: below 720px (the existing breakpoint) the app takes the layout of
the mobile mockup; from 720px nothing changes. Reference viewport: 393 × 852 CSS px (iPhone 15
Pro), bottom safe area respected. The design follows the web design system (tokens, type scale,
2px radius, Inter); the only round element is the plus button, as in the mockup.

## Shell

### Tab bar — `frontend/src/app/shell/tab-bar.ts`, rendered last in `app.html`

- `position: fixed; bottom: 0`, full width, paper background, 1px `--line-soft` top border,
  `padding-bottom: env(safe-area-inset-bottom)`, z-index 20 (below the sell page's 30, above the
  sticky header's 10). `display: none` from 720px.
- Five targets, each a 44px-high touch target, icon 24px over an 11px/14px label
  (`font-weight: 500`): Start `/`, Suchen `/find`, Verkaufen (the plus button), Konto
  (`/profile` signed in, `/login` signed out). Two groups of equal width around the sell button
  keep it centred. (Rebased onto main on 2026-10-24: Nachrichten and Meine Suchen were removed from
  the product by then, so the mockup's fifth and fourth targets are gone.) `nav aria-label="Hauptnavigation"`; the header's nav is
  hidden on phones so the label is not duplicated.
- Active target: ink colour plus a 2px ink bar at the top edge of the item; inactive targets are
  `--ink-muted`. `routerLinkActive` with `exact: true` for `/`.
- Plus button: 56px round, `--bg-900` background, `--ink-inverse` plus icon, centred, raised 16px
  above the bar's top edge, `aria-label="Verkaufen, neues Inserat"`, label "Verkaufen" under it.
  It is a `routerLink` to `[{ outlets: { modal: ['sell'] } }]` like the header button, so the
  auth guard and the modal outlet work as on the web.
- New icon `home` in `ui/icons.ts` (outline house, same stroke style as the others).
- `.zw-main` gets `padding-bottom: calc(72px + env(safe-area-inset-bottom))` below 720px so the
  last content and the footer clear the bar. The error toast moves up by the same amount.
- `index.html`: `viewport-fit=cover` added to the viewport meta so the safe-area inset is non-zero
  on iPhones.

### Header below 720px

Wordmark and location chip only, in one 56px row with 16px side gutters (mockup 1a). `.zw-nav`
and the docked search `.zw-dock` are hidden; the tagline is hidden. The header stays `static`
(scrolls away) as today. From 720px the header is unchanged.

### Footer

Stays at the end of the content, above the tab bar. Below 720px: links wrap in two columns of
44px rows, the language group is a row of 44px buttons. It gets an account entry, shown below
720px only: "Anmelden" (link to `/login`) when signed out, "Abmelden" (button) when signed in.
The logout logic (signingOut signal, error message) moves from `Header` into a small shared
`Account` component `shell/account.ts` with a `[variant]` of `link` that the header and the footer
both render; the header keeps its current markup and behaviour.

### Sell

`/sell` already covers the viewport (`position: fixed; inset: 0; z-index: 30`), so it covers the
tab bar. Only its bottom padding gets `env(safe-area-inset-bottom)`; its own 900px breakpoint stays.

## Start — `pages/home.html`, mockup 1a

- Hero: title and lead as today; the search form becomes one row, input flex 1, submit as a
  44 × 44 icon-only button (the "Suchen" label is `zw-sr-only` below 720px); from 720px the
  current form with the labelled button stays.
- Quick-filter chips: one row, horizontal scroll, hidden scrollbar, `scroll-snap` off, 8px gap,
  no wrapping below 720px.
- "Endet bald" and "Neu in deiner Nähe": section heading left, "Alle Auktionen" / "Alles in 25 km"
  link right on the same row; cards in the existing 2-column `.zw-grid`.
- The hero hint ("Oder speichere die Suche…") is hidden below 720px (not in the mockup).

## Suchen — `pages/find.ts`, `find.html`, mockup 2a/2b

Below 720px:

- Query: the textarea keeps its role; the submit becomes a 44px icon button on the right. The
  "⌘ / Ctrl + Enter" tip is hidden.
- Chip strip: a button "Filter" (`app-icon name="menu"`, outline, 36px high) first, a 1px
  `--line-soft` divider, then the chips in one horizontally scrolling row (no wrap). Under it the
  help line "Aus deinem Satz übernommen. Antippen zum Entfernen." The web keeps the wrapping strip
  and has no Filter button.
- Adjust form: input flex 1, submit as a 44px icon button (`chevron`), label `zw-sr-only`.
- Results bar: "{n} Inserate" bold, "{n} verglichen" muted, "Suche speichern" (bookmark icon,
  ghost) right. The disabled "Sortieren" select is hidden below 720px.
- Results: existing 2-column `.zw-grid`.
- Filter sheet: `filterOpen = signal(false)` in `Find`. Below 720px the filter `form` is hidden
  unless open; open, it is a bottom sheet: overlay `--overlay` over the page, the form fixed at
  the bottom with `max-height: 88dvh` and the design system's 2px radius (no rounded sheet top),
  header row "Filter" (h3) with a close button (`x` icon, 44px), scrollable body with the existing
  fieldsets, sticky footer with the primary button "{n} Treffer anzeigen" (n = current result
  count; "Treffer anzeigen" while there are no results yet) and the ghost "Filter zurücksetzen".
  `role="dialog" aria-modal="true" aria-labelledby` on the form while open; opening moves focus to
  the close button and sets `overflow: hidden` on `body`; closing restores focus to the Filter
  button. Escape and a tap on the overlay close it. Submitting runs `showMatches()` as today and
  closes the sheet. From 720px the form is the plain left column as today and `filterOpen` has no
  effect (the overlay and header row are `display: none`).

## Other pages, below 720px

Listing detail, Profile, Login/Register, Info, About, the old `/search`: CSS
only. Rules checked at 393px: no horizontal overflow (`overflow-wrap: anywhere` on titles, images
`max-width: 100%`), inputs and primary buttons full width, interactive controls at least 44px
high, multi-column grids collapse to one column, wide tables scroll horizontally in
their own box instead of widening the page.

## i18n

New German keys with FR/IT/EN in `i18n/messages.ts`: "Start", "Verkaufen, neues Inserat",
"Filter", "{count} Treffer anzeigen",
"Treffer anzeigen", "Aus deinem Satz übernommen. Antippen zum Entfernen.", "Schliessen" (if
missing). Existing keys are reused where the text exists.

## Tests

- `shell/tab-bar.spec.ts`: renders five targets; the plus button links to the sell modal outlet;
  the target matching the current URL is marked active.
- `pages/find.spec.ts` (extend): Filter button opens the sheet (`role="dialog"` present, focus on
  close), Escape closes, submit closes.
- `shell/footer.spec.ts` or `shell/account.spec.ts`: shows Anmelden signed out, Abmelden signed
  in, logout calls `Auth.logout`.
- Header spec (if any) updated for the moved logout.

Verification before done: `pnpm run format:check`, `pnpm exec ng lint`, `pnpm exec ng test
--watch=false`, `pnpm exec ng build`, then every route opened in the browser pane at 393 × 852
(and `/` with the sell modal open) with screenshots checked for overflow and the tab bar; the same
routes at 1280px to confirm the web layout is unchanged.

## Out of scope

Real saved searches, result sorting, the mockup's "Verkaufen" intro sheet (1b), PWA manifest,
dark-mode changes, a native app, changes to the backend.
