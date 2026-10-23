# E2E test findings — 23 Oct 2026, 23:30

State tested: `main` at `da5a47b` (PR #39). Staging for Discover / Find (real Haiku), a local stack
(auth + backend + frontend, throwaway Postgres, real Anthropic key) for login and Sell, because login
does not work on staging (B1).

## What works

- **Discover:** every filter (`q`, category, max price, postcode prefix), filters kept in the URL,
  empty state, 23 listings. Detail page with attributes, seller line and photo.
- **Find (staging, real Haiku):** German input becomes normalized requirements ("27 Zoll" → `27"`),
  editable chips, three groups with reasons and "Ask the seller" questions. ~2–7 s per call.
- **Sell (local, real Sonnet):** login with the seed account, upload, a type-plate photo yields all
  7 facts correctly as "From label" (serial number not taken over as a fact), blurry photo yields
  concrete tips, three price strategies, publish with photo, "Sold by …".
- **Full loop:** the listing published via Sell is found by Find as "Confirmed match".

## Blocker

| # | Finding | Where | Fix idea |
|---|---|---|---|
| B1 | `/api/auth/*` reaches Spring (404), not the auth service. Every page shows "Cannot check your session. Please try again."; login, register and Sell are unusable. Same on prod. | staging + prod routing | Traefik rule `PathPrefix(/api/auth)` → auth service in `baitimusOrga/deployments` (HAC-34), then sync. |

## High

| # | Finding | Where | Fix idea |
|---|---|---|---|
| H1 | Budget is a hard SQL filter, so nothing slightly over budget can be an "Alternative". "Laptop von Apple, 16 GB, bis 1200 CHF, Raum Luzern" → "Nothing matches", although a MacBook Pro 16 GB for CHF 1250 is in 6003 Luzern. | `SearchService.candidates` | Fetch candidates up to ~125 % of the budget; over-budget items can only be alternatives, with the difference named. |
| H2 | Must-have "Condition: Working" makes the ranker put the perfect 2017 iMac under "Possible" ("working condition not stated"), although the description says "Works well". Not deterministic: an earlier run had it as confirmed. | search prompt / ranking | Don't send condition as a must-have; map "working" to "condition ≠ DEFECTIVE" in code, or tell the ranker that a description saying it works counts. |
| H3 | The draft always sets condition GOOD, even when the AI itself writes that the condition can't be judged (label photo, blurry photo). Breaks the product rule "don't infer working condition". | sell prompt | `condition` null unless visible; the seller must choose before publishing. |
| H4 | Price range looks confident when the item isn't identified: blurry monitor → "typically around CHF 120" from three unrelated monitors. | `PriceEstimator` | Only same brand/model as evidence; without brand/model always `provisional` + `LOW`. |

## Medium

| # | Finding | Where | Fix idea |
|---|---|---|---|
| M1 | Description is written about the photo ("The photo shows a label for …") instead of as a listing text. | sell prompt | "Write the description as the seller, 2–3 sentences, no mention of the photo." |
| M2 | Title is the whole spec line ("Apple iMac 27" Retina 5K (A1419, 2017) Intel Core i5 3.4 GHz, 8 GB, 1 TB Fusion Drive"). | sell prompt | Max ~60 characters, specs belong in facts. |
| M3 | The published photo shows the serial number. Product plan §6: detect private information and let the seller review it. | sell | At least a tip "Your photo shows a serial number"; later blur. |
| M4 | Region = first two postcode digits: coarse and sometimes wrong (Zug 63xx doesn't find Zürich 80xx, "near" is not distance). `maxDistanceKm` unused. | search | OK for the demo; later a postcode → coordinates table. |
| M5 | Only one message fits in the error banner: on `/listings/99999` the session error hides "Listing not found.", the page stays empty. | `errors.ts` / detail page | Detail page shows its own "not found" state. |
| M6 | Mobile Discover: filters fill the first screen, the first card is below the fold; placeholder images are very tall. | `home.ts` | Collapsible filters, smaller placeholder. |
| M7 | "mindestens 16 GB" becomes `RAM: 16 GB` (no "at least"); a 32 GB laptop would count as different. | search | Numeric must-haves as minimum ("≥ 16 GB"). |

## Low

| # | Finding | Where |
|---|---|---|
| L1 | Prices without a space: "CHF450.00" instead of "CHF 450.00" (Swiss format). | currency pipe locale `de-CH` |
| L2 | Listing cards are links without an accessible name (screen readers only hear "link"). | `home.ts` |
| L3 | Chip action labelled "optional" is unclear (it moves the requirement to "Nice to have"). | `find.ts` |
| L4 | Find: no keyboard submit from the text area (Cmd/Ctrl+Enter). | `find.ts` |
| L5 | Sell: some fact inputs have no label. | `sell.ts` |
| L6 | Detail page has no "back to results" link. | `listing.ts` |
| L7 | Find takes 2–7 s per step with only a spinner; a short status text ("Reading your wish…", "Comparing 12 listings…") would help. | `find.ts` |

## Not tested

Real phone photos (HEIC, > 5 MB), register and logout, prod beyond the health check, many parallel users.

## Re-test after the USP round (local stack, real Claude, `usp-integration`)

Fixed and confirmed live: H1–H4, M1–M3, L1, L4, L7. Demo query "working iMac 27 5K from 2017, max 600 CHF
near Zürich" gives the same three groups in 3 of 3 runs (#1 confirmed, #1001 possible, #1002 alternative with
"CHF 720 instead of at most CHF 600" and "In Bern"). Type-plate draft: title "Apple iMac 27" Retina 5K 2017",
no condition, seller-voice text, serial-number warning, price from 5 sales of the same model (HIGH). Web
lookup adds the 5K resolution with an Apple support link (~10 s). Clearance: 5 inventory lines from pasted
German text in ~3.5 s, three routes with net amounts, Direct purchase recommended for a 10-day deadline,
publishing refused before quantities are confirmed (409), then 5 listings on Discover.

| # | Finding | Status |
|---|---|---|
| N1 | `PriceEstimator` threw `LazyInitializationException` on Postgres (attributes read outside a transaction); every photo draft returned 500. Tests on H2 didn't catch it. | fixed in the integration branch (`@Transactional(readOnly = true)`) |
| N2 | Clearance: the AI invents categories outside the 10 allowed ones ("Office equipment" for printers), so those listings can't be found with the category filter. | fixed in PR fix/n2-n4: one category list (`Categories`, `categories.ts`) incl. "Office equipment" for sell, search and clearance |
| N3 | Clearance: unit prices fall back to category averages because German names don't match the price evidence (20 Aeron chairs at CHF 120 each; a demo Aeron asks CHF 380). | fixed in PR fix/n2-n4: brand/model stored per item (V11) and passed to `PriceEstimator`; live: Aeron CHF 380, ThinkPad CHF 290, Dell U2719D CHF 157 |
| N4 | Search: the AI adds noise to `differences` / `missingDetails` ("Keyboard and mouse included, which the buyer did not ask for" on a confirmed match). | fixed in PR fix/n2-n4: missing details and differences come from code; the AI only writes the reason |
| N5 | Clearance runs the AI call inside a DB transaction (holds a connection for a few seconds). | open, low |
