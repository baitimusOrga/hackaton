# Find: one-shot ranked search with refinement — design

Status: approved for planning, 2026-10-24. Scope: functionality only (backend, data flow, page
logic). Visual design follows separately in Claude Design. No learning system in this round.

## Problem

The buying assistant (`SearchService`, `find.ts`) works, but does not feel like "describe it and
get results":

- Two steps: the parsed requirements appear, then the buyer must click "Show matches".
- Results come in three groups without an order inside a group (newest first), no match score.
- Candidates are prefiltered with `LIKE '%keyword%'`: "notebook" misses "Laptop", German terms miss
  English titles, and a wrong keyword drops good listings before the AI sees them.
- A follow-up such as "no, rather newer models" starts a new search without the original prompt.
- About 23 available listings: too few for ranking or refinement to show any effect.

## Goal

1. The buyer describes what they want and presses Find once.
2. The requirements appear after the first AI call, the ranked results follow without a click.
3. One list, sorted by match score (0–100) with a fit badge and the reasons.
4. The search can be corrected either with filters at the top (instant) or with a follow-up text
   that the AI applies on top of the original prompt and the current results.

## Approach

Hybrid ranking: hard filters in SQL, a deterministic score in code for every candidate, the AI
adds a relevance and a short reason for the top 30. The code score keeps the ranking explainable
and testable; the AI covers what code cannot ("for gaming", synonyms, German descriptions).

Rejected: code score only (one AI call, faster, but generic reasons and no semantic fit);
embeddings / vector search (second provider, pgvector, no H2 support, no gain at ~120 listings).

The security rules from #48 stay: listing fields are untrusted seller data in every prompt, a
seller's text must not be able to hide a listing or promote it into a better fit, and every text
shown to buyers passes `SearchService.clean`.

## Backend

All endpoints public, unchanged path prefix `/api/searches`.

### `POST /api/searches` — free text → requirements

Unchanged, except the parse schema and prompt get `maxDistanceKm` (integer or null, only when the
buyer states a distance such as "max 20 km", "within 10 km").

### `POST /api/searches/matches` — requirements → ranked list

`SearchRequirements` loses `acceptUnknown` (listings with missing details are always shown, with a
badge). All other fields and their validation stay.

New response:

```
SearchResults(List<SearchMatch> matches, int compared)
SearchMatch(ListingSummary listing, int score, Fit fit, String reason,
            List<String> matched, List<String> missingDetails, List<String> differences)
enum Fit { MATCH, NEEDS_DETAILS, ALTERNATIVE }
```

`matches` is sorted by `score` descending (ties: newest first). `matched` lists the requirements
the listing states (`label(r)`, must-haves first, then nice-to-haves), for the "why" on the card.

#### Candidates

- Hard filters only: `status = AVAILABLE`, category (if set), `price ≤ maxBudgetChf × 1.25` (if
  set), distance box and exact distance (if `maxDistanceKm` and a locatable postcode are set).
- **No keyword filter.** Keywords only count in the score.
- `MAX_FETCH` 200 (the whole demo catalogue), newest first.
- If a category is set and fewer than 5 listings remain, fetch again without the category.

#### Code score (0–100), for every candidate

| Part | Points | Rule |
|---|---|---|
| Must-haves | 50 | Mean over must-haves: STATED = 1, MISSING = 0.5, DIFFERENT = 0 (existing `check`). No must-haves: the keyword share instead |
| Nice-to-haves | 15 | Share of nice-to-haves STATED; none → 15 |
| Keywords | 15 | Share of keywords found in title, description or attribute values (case-insensitive); none → 15 |
| Price | 10 | No budget or price ≤ budget → 10; linear down to 0 at budget × 1.25 |
| Place | 10 | No postcode → 10; a distance is set (SQL already filtered by it) → 10; else same 2-digit region → 10, other region → 0 |

Fit, decided by code only (existing `differences` / `missing`): any difference → `ALTERNATIVE`;
else any missing must-have → `NEEDS_DETAILS`; else `MATCH`.

#### AI relevance

The 30 best by code score go to the search model (Haiku) in one call, in the existing JSON block
marked as untrusted seller data. New rank schema: `{items: [{listingId, relevance 0–100, reason,
questions[]}]}`. `missingDetails` is code's `missing` list; only when the search has no
must-haves at all are the AI's `questions` shown there instead (the fit stays code's).

Final score:

- AI assessed the listing: `round(0.6 × code + 0.4 × relevance)`, relevance clamped to 0–100.
- AI left the listing out, gave an unknown id, or the call failed: the code score alone, reason
  `NOT_ASSESSED` (left out) or `NO_AI_REASON` (call failed). Leaving a listing out never removes it.
- Caps by fit: `ALTERNATIVE` at most 69, `NEEDS_DETAILS` at most 89, so neither a deviation nor a
  listing with missing details reaches the top band, whatever the AI says. Duplicate ids: the first
  one counts.
- Listings below 30 are dropped, at most 20 are returned. Listings beyond the top 30 keep their
  code score with reason `NOT_ASSESSED` and compete for the 20 places the same way.

### `POST /api/searches/refine` — follow-up text → new requirements

```
RefineRequest(@NotBlank @Size(max = 500) String originalText,
              @NotNull @Size(max = 5) List<@NotBlank @Size(max = 200) String> refinements,
              @NotNull @Valid SearchRequirements current,
              @NotBlank @Size(max = 200) String text,
              @NotNull @Size(max = 5) List<Long> topListingIds)
→ SearchRequirements
```

- The server loads the listings for `topListingIds` itself (available ones only, unknown ids are
  ignored) and puts title, price, condition and attributes into the prompt as untrusted seller data,
  so "newer", "cheaper" or "bigger" have an anchor (e.g. Year AT_LEAST above the years shown).
- One AI call with the parse schema. System prompt: the buyer refines an earlier search; return the
  complete new requirements; keep every value of `current` unless the new text changes it;
  `current` may contain values the buyer set by hand in the filters.
- The result passes the same normalisation as `create` (`canonical`, category from
  `Categories.ALL`, postcode format, keywords lowercase and at most 6).
- AI failure or unusable answer → 502 "Could not understand the change, please rephrase."

### Near me ("in meiner Nähe")

- The parse and refine schema get `nearMe` (boolean): true when the buyer means their own position
  ("in meiner Nähe", "near me", "bei mir", "hier in der Umgebung"), false otherwise. With `nearMe`
  and no stated distance, `maxDistanceKm` defaults to 25 km (the header's default range).
- `SearchRequirements` gets `nearMe` (boolean, output of the parse) and nullable `latitude` /
  `longitude` (input to `/matches`, range-checked, -90..90 / -180..180). The AI never sees or sets
  coordinates: create and refine return them null, and the refine prompt's copy of `current` drops
  them.
- `candidates`: with a distance, the origin is `latitude`/`longitude` when both are set, else the
  postcode's centroid (same rule as `GET /api/listings` in HAC-43, PR #46).
- Coordinates are not stored or logged; the frontend rounds them to 3 decimals (~100 m).

### Other backend changes

- Requirement attribute names stay `Attributes.ALL`.
- `SearchService` keeps one class; the score is a package-private static method so it can be
  unit-tested without the AI.
- No persistence, caching, pagination or streaming.

## Frontend (`find.ts` + `find.html`, Zweit redesign)

Keep the redesigned layout from #49 (query bar, chip strip, filter column, results column, German
UI text, `zw-*` classes, `app-summary-card`); change only what this feature needs.

### Flow

1. Prompt + Suchen (also `/find?q=…` from the header). A new prompt clears the refinement history.
2. `create` runs ("Lese deinen Wunsch…"); chips and filters appear as soon as it returns.
3. `matches` runs automatically ("Vergleiche die Inserate…"), then the list.

### Filters

- The redesign's filter column stays. Removing or moving a chip, changing the radius select and
  "Filter zurücksetzen" run `matches` at once; text and number inputs (category, keywords, budget,
  postcode) after 400 ms without typing. "Treffer aktualisieren" stays for keyboard users.
- The checkbox "Auch Inserate mit fehlenden Angaben" is removed (`acceptUnknown` is gone).
- The disabled TODO filters of the redesign stay as they are.

### Near me

- The region fieldset gets a button "Mein Standort". It asks the browser for the position
  (`navigator.geolocation.getCurrentPosition`), keeps it in memory, sets the radius to 25 km if none
  is set, clears the postcode and runs `matches` with `latitude`/`longitude`.
- When `create` or `refine` returns `nearMe: true`, the page does the same before matching.
- The region chip then reads "25 km um deinen Standort"; removing it drops position and radius.
- Denied or unavailable: the status line says "Standort nicht verfügbar. Gib eine PLZ ein oder
  erlaube den Standortzugriff." and the search runs without position and radius.
- The position is never put in the URL or storage.

### Refinement

- An input "Suche anpassen…" with a button "Anpassen" right below the chip strip.
- Sends the original prompt, the refinements so far, the current requirements (including manual
  filters), the new text and the ids of the top 5 matches.
- The returned requirements replace filters and chips, then `matches` runs automatically (with the
  position if `nearMe`).
- The history shows below the prompt ("↳ doch etwas neuere Modelle"). No undo.
- On error the previous state stays and the text stays in the input.

### Results

- One grid instead of the three groups: per match the `app-summary-card`, a line with score and
  fit ("92 % · Passt" / "Angaben fehlen" / "Alternative") and the reason, then "Nicht angegeben: …"
  for missing details and the differences, as the redesign's `why` line does today.
- Bar: "14 Inserate · 87 verglichen"; sort stays "Beste Passung".
- While a new result loads, the old list stays visible, dimmed and `aria-busy`.
- Empty: "Noch nichts Passendes. Entferne eine Anforderung oder vergrössere den Umkreis."
- Every request gets a sequence number; only the response to the newest one is applied.
- Parse and refine errors go through the error toast (#51).

## Demo data — `V15__search_demo_listings.sql`

- 90 fictional listings, ids 1201–1290 (explicit ids far above the identity counter, like V6/V10),
  `AVAILABLE`, no `image_url`, no real people.
- Only postcodes that V12 already knows; `latitude` / `longitude` set in the insert, so tests need
  no network.
- Attribute names only from `Attributes.ALL`. `Model` is the product line ("iMac", "MacBook Air");
  memory and storage as "16 GB", inches as `27"`.
- Clusters so that ranking and refinement visibly change something:

| Cluster | Count | Varies in |
|---|---|---|
| iMac / Mac mini | 12 | Year 2015–2023, RAM, 5K or not, price, place |
| MacBook / ThinkPad / Dell XPS | 16 | Year, CPU, RAM, Storage, condition |
| Monitors | 10 | Size 24–34", Resolution FHD / 4K / 5K, USB-C in the description |
| iPhone / Samsung, iPad | 14 | Model generation, Storage, battery in the description |
| Office chairs / desks | 12 | Brand (Steelcase, Herman Miller, IKEA), Material, Dimensions |
| Bikes | 10 | Size (frame), e-bike or not, gears in the description |
| Audio / cameras / household | 16 | Spread, so the category does not always decide |

- Descriptions partly German, partly English; some leave out key facts (e.g. no RAM), so all three
  fits occur.
- `docs/DATA-MODEL.md` gets the V15 row.

## Tests

Backend (H2, `AiClient` mocked):

- `SearchServiceTest`: code score (all must-haves > one missing > one different; price falloff to
  × 1.25; place in or out; keywords when there are no must-haves); fit caps; 60/40 mix; AI left a
  listing out or call failed → code score only; unknown ids ignored; relevance clamped; cutoff 30
  and at most 20; no keyword filter ("notebook" finds a listing titled "Laptop" through the
  description or the AI); category fallback below 5.
- `SearchControllerTest`: `/matches` returns a sorted list; `/refine` passes original text,
  history, current requirements and the top listings to the AI (checked on the mock call),
  ignores unknown `topListingIds`, returns 400 for more than 5 refinements or text over 200
  characters, 502 when the AI fails.
- Near me: parse with `nearMe` and no distance → 25 km; `/matches` with latitude/longitude uses
  them as origin and needs no postcode; the refine prompt contains no coordinates.
- V15 runs on H2 (covered by `./mvnw verify`).

Frontend (`find.spec.ts`, Vitest, `SearchService` mocked):

- Find calls `create`, then `matches` without a click.
- A filter change calls only `matches`.
- Refine sends original text, history and top ids; the history appears; a new prompt clears it.
- A late older response does not overwrite a newer one.
- Score and fit line render; the empty state shows.
- "Mein Standort" and a `nearMe` parse send rounded latitude/longitude; a denied position shows
  the message and matches without them (geolocation stubbed).

## Manual demo checklist

Not covered by tests: the real ranking quality and latency. Check by hand before a demo:

1. "working iMac 27 5K from 2017, max 600 CHF near Zürich" → 5K iMacs near Zürich on top.
   Then "no, rather newer models" → Year moves up, older iMacs drop or become alternatives.
2. "Bürostuhl ergonomisch, Herman Miller oder Steelcase, bis 300 Franken" → German prompt finds
   English listings.
3. "notebook for programming, at least 16 GB RAM" → laptops titled "Laptop" / "MacBook" appear;
   listings without RAM show "Details missing".
4. "e-bike for commuting in Bern" → set the distance filter to 10 km → results narrow instantly.
5. "Velo in meiner Nähe" → the browser asks for the position → bikes within 25 km, region chip
   "25 km um deinen Standort". Deny the permission once → the message appears, search runs Swiss-wide.

## Out of scope

Device location on the sell page (follow-up on `spec/sell-guided-flow`, next to its
`PlaceController`), learning or stored preferences, saved searches and alerts, search state in the URL, undo of
refinements, sorting by price, streaming, visual design.
