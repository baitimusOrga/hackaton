# Zweit — Frontend handoff

Zweit is a Swiss second-hand marketplace: free listings, no commission, auctions, camera-first selling, requirement-based buying. This package contains the designed screens, the design system, and the rules the UI must enforce. Read this file first, then `design-system/README.md`, then the screens.

What this package is not: there is no backend, no API contract and no payment integration. Direct payment only (cash / TWINT between the parties); the platform never marks anything as paid.

## Contents

```
HANDOFF.md                      this file
PLAN.md                         product plan (source of truth for behaviour and rules)
design/screens/*.dc.html        one file per designed screen, reference markup
design-system/README.md         visual principles, voice, colour/type rules
design-system/tokens.json       colours (light/dark), type scale, spacing, radii
design-system/components/       bundle.css (component classes), bundle.js (vanilla helpers), per-component READMEs
```

## How to read the screen files

Each `*.dc.html` is a self-contained page. Use it as reference markup, not as code to ship:

- Everything inside `<x-dc> … </x-dc>` is the screen. Ignore `<script src="./support.js">`, the `<helmet>` wrapper and the `<script type="text/x-dc">` block at the end; they belong to the design tool.
- `{{holes}}`, `<sc-for>` and `<sc-if>` are template syntax for repeated/conditional content. The sample data lives in `renderVals()` in the trailing script and shows the expected shape of a listing / bid / search result.
- Styling is inline plus the classes from `design-system/components/bundle.css` (`zw-btn`, `zw-input`, `zw-chip`, `zw-badge`, `zw-card`, `zw-timer`, `zw-row`). The CSS variables they rely on (`--bg-000`, `--ink`, `--blue` …) are generated from `tokens.json`; each screen file declares the light values in its `:root` block as a reference.
- Dialog-style screens (Sell1–Sell5, Sell1b, Bids) are drawn on a flat grey backdrop (`#605f5c`) to stand in for the dimmed page behind. In the product they are modals over the page they were opened from, with the `overlay` token as scrim.
- Images are grey placeholders (`bg-100`). Real listing photos are seller photos; no stock imagery.
- Screens are designed at 1440 px. Phone layouts are not drawn; follow the design system's rules (grids 2 columns at 360 px, stacked menus, 44 px targets, 16 px input text) and the `@media` hints already present in the files.
- Copy is German, informal "du". Every string must also exist in FR, IT, EN. Design for the longest string (FR/DE +30%).

## Screen inventory and flows

### Flow 1 — Landing (`Main`, `Scrolled`)

`Main.dc.html` top of page: header (wordmark + tagline, location chip, Meine Suchen, Nachrichten, outlined Verkaufen, Anmelden), hero with the search field as the one primary action, quick-filter chips, nine categories, then "Endet bald" (auctions), "Neu in deiner Nähe" (fixed/offer), a sunken business band, footer with language switch.

`Scrolled.dc.html` the same page once the hero is scrolled past: the search field docks into the header between wordmark and actions, taking the location chip with it; the header gains its single hairline. Implement as a sticky header whose middle slot switches from empty to the search form at the hero's scroll threshold.

Grid: 4 columns at ≥1280 px (cards ~308 px), not the design system's 6 — listings must stay large. 3 at 720, 2 at 360.

### Flow 2 — Create a listing (`Sell1`, `Sell1b`, `Sell2`–`Sell5`, `SellFull`)

A modal wizard, one question per step, with a permanent exit to a single-page form.

| Step | File | Content | Primary action |
|---|---|---|---|
| 1 | `Sell1` | Camera / upload, nothing else | Weiter |
| 1b (optional) | `Sell1b` | Shown only when identification failed: which photos help and why; photos so far | Fotos hinzufügen; "Ohne Erkennung weiter" (outlined) skips to 2 |
| 2 | `Sell2` | What was recognised (label-read facts) + the one open question (variant) as chips incl. "Weiss ich nicht" | Weiter |
| 3 | `Sell3` | Condition (5 radios) + defects field, prefilled from photos | Weiter |
| 4 | `Sell4` | Price: one sentence with the evidence range, 3 suggested prices + own price, sale mode chips | Weiter |
| 5 | `Sell5` | Pickup / shipping, compact preview | Veröffentlichen; "Erst prüfen" → SellFull |
| any | `SellFull` | All five sections on one page, prefilled with everything the photos gave | Veröffentlichen |

Every step's top bar has "Verkaufen · n von 5", an outlined button "Alles auf einer Seite" (→ `SellFull`) and a close control. `SellFull` has the reverse link "Schritt für Schritt". State is shared: switching views never loses input.

Rules (from PLAN.md §6–7):
- Separate three kinds of facts and keep the distinction through to the public listing: read from a label, confirmed by the seller, suggested/unconfirmed. Never infer internals, working condition or accessories from appearance.
- If identification is uncertain, ask one focused question or ask for one specific photo (Sell1b, Sell2). Unanswered → the listing says "nicht bestätigt".
- Detect private information (serial numbers, documents, screens, names) and let the seller mask it before publishing; keep the original for the transaction record.
- Price recommendation: show range, evidence count and age, confidence; prefer completed sales over asking prices; when evidence is thin, label it provisional or don't estimate. Never invent comparables.
- For auctions: estimated result ≠ reserve; reserve is secret and seller-set; automatic price reductions only with explicit seller approval.
- Publishing is never automatic; the seller always confirms.

### Flow 3 — Listing page (`Detail`, `DetailAuction`, `Bids`)

Buyer's view, logged in. Two columns: photos left, buying column right (badges, title, one grey meta line, price with total cost, one primary action, two text links, seller block). Below: "Angaben" facts with their source as grey suffix, description, public Q&A, similar listings.

`Detail` fixed price: primary = Kaufen (black). Total cost line: "Abholung gratis · Versand CHF 35.– · neu CHF 1’890.–".

`DetailAuction` running auction, buyer currently outbid: Auktion badge + timer, current bid in `blue-text` with bid count, one red line "Du wurdest überboten. Dein Maximum war CHF 300.–.", maximum-bid field with minimum and help text, blue "Jetzt bieten" (the only blue fill in the product), one line with end time and the extension rule, then "Letzte Gebote" (3 most recent) and the link "Alle 7 Gebote" → `Bids`.

`Bids` modal: all bids newest first — amount, anonymised bidder (`m···a`, `k···7`, or "Du"), time, "automatisch" where proxy bidding placed it; own rows bold; leading bid blue; outbid own bid marked in red text. Footer: "Auffälliges melden" and a blue bid button.

Rules (PLAN.md §9):
- Sale modes and their one primary action: Festpreis → Kaufen, Auktion → Jetzt bieten (blue), Preisvorschlag → Vorschlag senden. Never two primaries.
- Private maximum bids are never exposed to anyone, seller included. Proxy bidding raises only as far as needed, in the published increment.
- Extension rule: a bid in the last 2 minutes extends by 2 minutes. Equal maxima: earlier wins. Both stated on the page.
- Once bids exist, material listing details are frozen; corrections are visible.
- Sold/reserved listings disappear from search and from "available" states immediately.

### Flow 4 — Search (`Search`)

Left: a full manual filter form (Kategorie, Marke, Modell/Stichwort, Preis von–bis + "inkl. Versand", Region = PLZ + Umkreis, Abholung/Versand, Zustand ×5, Verkaufsart ×3, "Nur": getestet / Grüne Wahl / geprüfte Verkäufer). Top strip: chips taken from the natural-language query ("iMac 2017 · 5K-Display · Getestet · Bis CHF 600 · 25 km um Zürich"); tapping a chip removes it and clears the matching filter. Right: results in three groups.

| Group | Meaning | Card extra line |
|---|---|---|
| Bestätigt | listing evidence supports every mandatory requirement | green, e.g. "alles vom Verkäufer bestätigt" |
| Möglich | a required detail is missing/unconfirmed | grey, e.g. "Display nicht angegeben" |
| Alternativen | a requirement differs | grey, e.g. "2019 statt 2017, CHF 90.– über Budget" |

Rules (PLAN.md §8): results only from our marketplace; show total known cost; an auction's current bid is labelled "Gebot, nicht Endpreis"; "Suche speichern" creates alerts (immediate / daily / weekly) with dedup of relists; the page states when the last scan ran. "Gesuch aufgeben" creates a wanted listing; the buyer's budget stays private.

### Flow 5 — Bought (`Bought`)

After Kaufen / winning an auction. Five steps, one active: 1 Kauf bestätigt (done) · 2 Abholung abmachen (slot chips, "Termin vorschlagen" primary) · 3 Prüfen und bezahlen (direct, cash/TWINT, "Zweit sieht die Zahlung nicht") · 4 Übergabe bestätigen (buyer confirms "erhalten und bezahlt", seller confirms "übergeben und Geld erhalten"; the purchase is complete only when both have) · 5 Bewerten (only after 4). Right: item, price, seller's full address (revealed only now, only to the buyer), phone behind "anzeigen", payment line, purchase number, "Nachricht an Lea" outlined, "Kauf abbrechen" / "Hilfe" as text links.

Rules (PLAN.md §10): no payment state is ever set from a chat message, screenshot or e-mail claim; precise address is revealed only after purchase; problems → report, platform mediates, no refund promise with direct payment. The seller sees the mirrored page.

## Cross-cutting rules

- Colour: `blue` fills only the bid button, selected filter chips and the running countdown; `green-text` only as text/outline for sustainability; `danger` only with a word (outbid, error). One black (`bg-900`) primary per screen. No tints, shadows, gradients, pills or emoji. Corners 2 px, images 0.
- Type: Inter only; sizes and weights from `tokens.json`. Prices `CHF 1’250.–` with tabular numerals; dates `23.10.2026`; countdown `hh:mm:ss`, no animation.
- Every control is a real `<button>`, `<a href>`, `<input>` + `<label>`; icon-only controls carry `aria-label`; visible focus ring on everything; 44 px targets.
- Copy: sentence case, no exclamation marks, numbers before adjectives, uppercase only for the `caption` style (badges).
- Trust information is specific (count of sales, rating with count, named checks), never a score.
- Platform-owned stock (future) is shown under an identifiable seller account and gets no ranking advantage.

## Not designed yet

Chat with structured offers / counter-offers and pickup scheduling · seller side of Bought and the sold state of a listing · Meine Suchen (saved searches, alerts) · Nachrichten inbox · account, sign-in, profile · business liquidation project · phone layouts · dark theme (tokens exist).

## Open decisions (see PLAN.md §17)

Livestream auctions; professional-seller distinction; protected checkout (explicitly out of scope for now — direct payment only); external price reference data; categories the platform buys itself; logistics model; brand emphasis.
