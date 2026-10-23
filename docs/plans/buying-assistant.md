# Plan: buying assistant that understands requirements

Implementer: one agent, ~40 min, own worktree. Read `AGENTS.md`, `docs/LEAN-CODE.md` first. No migration, no new
dependency, no new `application.yml` key. **The app decides the group, the AI only filters and explains.**

## 1. Goal and demo moment

Free text → editable requirement chips → our listings in three honest groups, fast and the same every run.

Demo query (it is already the textarea placeholder and the product plan example):
**`working iMac 27 5K from 2017, max 600 CHF near Zürich`** → Haiku parses roughly Must: `Model: iMac`,
`Display: 27" 5K`, `Year: 2017`, `Condition: working`; budget 600; postcode 8001. Expected (seed V4 + V6):

| Group | Listing | Why (deterministic, from code) |
|---|---|---|
| Confirmed | #1 iMac 27" Retina 5K (2017), CHF 450, 8004 Zürich, GOOD | every must-have stated, in budget, in 80xx |
| Possible | #1001 Apple iMac 27 inch, CHF 300, 8001 Zürich, USED | Ask the seller: `Display: 27" 5K`, `Year: 2017` (attributes absent) |
| Alternative | #1002 iMac 27" Retina 5K (2019), CHF 720, 3007 Bern | `CHF 720 instead of at most CHF 600` · `In Bern (3007), outside the 80xx area` · `Year: 2019 instead of 2017` |

#1002 is only reachable because budget (H1) and region become soft. #1015 Mac mini may appear as Alternative
(`Model: Mac mini instead of iMac`) or be left out by the AI; both are fine.
Backup query (H1 + M7): `Laptop von Apple, mindestens 16 GB RAM, bis 1200 CHF, Raum Luzern` → chip `RAM: ≥ 16 GB`,
#1003 MacBook Pro CHF 1250 Luzern as Alternative `CHF 1250 instead of at most CHF 1200`.

## 2. Findings covered

H1 soft budget (≤ 125 %) · H2 condition checked in code, grouping deterministic · M7 `comparison` on requirements ·
L3 chip labels · L4 Cmd/Ctrl+Enter · L7 progress text + "Compared N listings" · M4 (cheap part): region is soft
like budget (other region = alternative, named). `maxDistanceKm` stays unused.

## 3. Contract changes (additive)

`Requirement` gains a nullable `comparison` (null = `EXACT`); nested enum in the record file
`public enum Comparison { AT_LEAST, EXACT, AT_MOST }`, field annotated `@Schema(nullable = true)`:
```json
{"attribute": "RAM", "value": "16 GB", "comparison": "AT_LEAST"}
```
`SearchResults` gains `int compared` (number of listings handed to ranking, 0 when none):
```json
{"confirmed": [...], "possible": [...], "alternatives": [...], "compared": 4}
```
No other DTO changes. Update every `new Requirement(a, v)` / `new SearchResults(...)` call site (SearchService,
both tests); no convenience constructor. Then `cd backend && ./mvnw verify` (rewrites `frontend/openapi.json`) and
`cd frontend && pnpm run api`; commit both generated outputs.

## 4. Candidate query and grouping rules (exact)

Constants: `BUDGET_STRETCH = new BigDecimal("1.25")`, `MAX_FETCH = 60`, `MAX_CANDIDATES = 30`, `MAX_PER_GROUP = 10`.

**Query** (`candidates(req, withKeywords)`): as today, but
- budget: `l.priceChf <= :ceiling` with `ceiling = maxBudgetChf × 1.25` (no budget → no filter);
- **remove** the `postcode like :region` filter; `setMaxResults(MAX_FETCH)`, `order by l.createdAt desc`;
- in Java: stable sort by `(overBudget ? 1 : 0) + (outsideRegion ? 1 : 0)` ascending, then `limit(MAX_CANDIDATES)`.
- `overBudget` = budget set and `price > budget`. `outsideRegion` = req postcode has ≥ 2 chars and listing postcode
  does not start with its first two digits. Keyword fallback (`< 5` → without keywords) unchanged.

**Evidence per must-have** — replace `states()` with `static Evidence check(ListingDetail l, Requirement r)`,
`enum Evidence { STATED, MISSING, DIFFERENT }`:
- `Condition`: value contains `work`/`funktion`/`intakt`/`intact` (or matches no condition name) → "working":
  `STATED` if `l.condition() != DEFECTIVE`, else `DIFFERENT`. Value matching a condition name (`new`, `like new`,
  `good`, `used`, case/underscore-insensitive) → `STATED` if `l.condition().ordinal() <= required.ordinal()`, else
  `DIFFERENT`. The description is context for the AI only; the seller-chosen condition field is the evidence.
- `AT_LEAST`/`AT_MOST` with a number in the value: only the listing **attribute** counts (not the title). Absent →
  `MISSING`. Compare the first number of each (`,` → `.`; a `TB` unit ×1000 → GB, comment
  `shortcut: only TB→GB, add units when a demo needs them`). Pass → `STATED`, fail → `DIFFERENT`.
- `EXACT` (or comparison null / no number): today's `states()` logic (contains, or all numbers present) → `STATED`;
  otherwise `DIFFERENT` if the listing has that attribute, else `MISSING`.

**Labels**: requirement label `Attr: value` / `Attr: at least value` / `Attr: at most value` (missing details use it,
so the existing `"Year: 1995"` stays). Difference strings, in this order:
budget `CHF 720 instead of at most CHF 600` · region `In Bern (3007), outside the 80xx area` · must-have
`Year: 2019 instead of 2017` / `RAM: 8 GB instead of at least 16 GB` / `Condition: Defective instead of working`
(listing value = attribute value, or condition as `Like new`). CHF: whole francs without decimals, else 2 decimals.

**Grouping** in `validate(req, candidates, ranked)`. Walk AI items in order confirmed → possible → alternatives
(drop unknown/duplicate ids as today; first group wins = `aiGroup`), then every candidate the AI did not mention
(`aiGroup = NONE`, candidate order). `diffs`/`missing` from the rules above:
1. `NONE`: keep only if mustHave non-empty, diffs and missing empty → **confirmed**, reason `Listing states every must-have.`
2. diffs non-empty → **alternatives**, differences = diffs (AI differences dropped to avoid duplicates).
3. `aiGroup == alternatives` → **alternatives** with the AI's differences.
4. missing non-empty → **possible**, missingDetails = missing.
5. mustHave non-empty → **confirmed** (upgrades an AI "possible": fixes H2 non-determinism).
6. otherwise keep `aiGroup` (possible keeps AI missingDetails).
Then `acceptUnknown` and `MAX_PER_GROUP` as today; `compared = candidates.size()`.
**AI failure**: run the same `validate` with every candidate as a `possible` item with reason `NO_AI_REASON` (so the
fallback also shows three groups).

## 5. Prompt changes (`SearchService` only)

- `REQUIREMENT_SCHEMA`: add `"comparison": {"type": "string", "enum": ["AT_LEAST", "EXACT", "AT_MOST"]}`, required.
- `PARSE_SYSTEM` add: `comparison: AT_LEAST for "at least / mindestens / min. / ab / or newer", AT_MOST for
  "at most / höchstens / max. / or older", else EXACT; only numeric values (RAM, Storage, Year, Display, Size).`
  `Condition only when the buyer states it: "working" when they want it to work (funktionierend, works, intakt),
  else one of New, Like new, Good, Used.` `Model: the product line only ("iMac", "MacBook Pro"); sizes go into Display or Size.`
- `canonical()`: keep `comparison` only when the value contains a digit, else `EXACT`; null → `EXACT`.
- `RANK_SYSTEM`: replace the group definitions' authority with: `The app re-checks price, place, condition and stated
  attributes. Your job: leave out listings that don't fit at all, write one short reason, put what to ask the seller
  in missingDetails and other differences in differences. Never ask about the condition.`
- `rankPrompt`: must-have line without `Condition` (add `Condition: checked by the app.` when present), labels with
  comparisons, `Budget: at most CHF 600 (listings up to CHF 750 are shown as alternatives)`, `Near postcode 8001
  (other regions only as alternatives)`, and per listing the description cut to 160 chars as an extra column.

## 6. Frontend (`frontend/src/app/pages/find.ts` only)

- L4: textarea `(keydown.control.enter)="find()"` and `(keydown.meta.enter)="find()"`; hint under it
  `Tip: ⌘ / Ctrl + Enter`.
- Speed: after `create` succeeds call `showMatches()` automatically; the button reads `Update matches` once
  `results()` is set (`Show matches` before).
- L7: `progress = signal('')` in a `<p role="status" aria-live="polite">`. `find()`: `Reading your wish…`, after
  1500 ms `Turning it into requirements…`; `showMatches()`: `Searching our listings…`, after 1500 ms
  `Comparing listings with your requirements…`. One `setTimeout` handle, cleared and `progress` emptied on
  next/error. Results header: `Compared {{ compared }} listings · {{ n }} confirmed · {{ n }} possible · {{ n }} alternative`.
- M7 chips: `{{ r.attribute }}: {{ prefix(r) }}{{ r.value }}` with `≥ ` / `≤ ` / `` ; send requirements back unchanged.
- L3: visible move-button text `→ Nice to have` / `→ Must have` (keep the existing `aria-label`s).
- Differences rendered `Differences: a · b · c`; group title `Alternative` gets the subtitle `Differs in one point, named below`.

## 7. Tests (named)

`SearchServiceTest` (pure unit, extend fixtures: `IMAC_2019` id 2 CHF 720 3007 Bern Year 2019 Display `27" 5K`;
`OLD_IMAC` id 3 "Apple iMac 27 inch" CHF 300 8001 no Display/Year; a `DEFECTIVE` phone):
- `mustHaveIsStatedDespiteDifferentUnits` (adapt to `check(...) == STATED`)
- `differentValueIsDifferenceAbsentAttributeIsMissing` (Year 2019 vs 2017 → DIFFERENT, Storage → MISSING; replaces `differentNumberOrMissingAttributeIsNotStated`)
- `atLeastAndAtMostCompareNumbers` (RAM ≥16 vs 32 GB STATED, vs 8 GB DIFFERENT, absent MISSING; Storage ≥512 GB vs `1 TB` STATED; EXACT 16 vs 32 DIFFERENT)
- `workingMeansNotDefective` (working vs GOOD STATED, vs DEFECTIVE DIFFERENT; `Like new` vs GOOD DIFFERENT, vs NEW STATED)
- `demoQueryLandsInThreeGroups` (AI puts all three in `possible` → #1 confirmed, #3 possible with the 2 missing labels, #2 alternative with the 3 exact difference strings)
- `perfectMatchLeftOutByAiIsStillConfirmed` (ranked empty → #1 confirmed)

`SearchControllerTest` (H2 DB, mocked `AiClient`):
- `overBudgetUpTo125PercentIsAlternativeWithDifference` (add Technics CHF 240 → alternative `CHF 240 instead of at most CHF 200`; CHF 260 absent; `$.compared`)
- update `candidatesAreFilteredAndShownWithoutAiWhenItFails` → confirmed `match`, possible `noYear`, alternatives contains the Dual turntable (3011, region difference), reason `Ranked without AI right now.`
- update `textBecomesCanonicalRequirements` (3-arg `Requirement`; assert `$.mustHave[0].comparison == "EXACT"`; a non-numeric `AT_LEAST` becomes `EXACT`)
- the other existing tests keep their expectations (only constructor call sites change).

`find.spec.ts`: update the existing test (matches is called automatically after create, the moved chip is in the
**second** call after clicking `Update matches`); add `ctrlEnterSubmitsAndShowsComparedCount` (keydown Enter with
`ctrlKey` → `create` called; result with `compared: 4`, an `AT_LEAST` chip and one alternative → text contains
`Compared 4 listings`, `RAM: ≥ 16 GB`, `CHF 720 instead of at most CHF 600`).

## 8. File ownership

Write: `backend/src/main/java/one/absent/hackaton/search/**`, `backend/src/test/java/one/absent/hackaton/search/**`,
`frontend/src/app/pages/find.ts`, `find.spec.ts`, regenerated `frontend/openapi.json` + `frontend/src/app/api/`.
Read only: `listing/**`, `ai/AiClient`. Do not touch: `selling/`, `clearance/`, `ai/`, `app.html`, `app.routes.ts`,
`home.ts`, `listing.ts`, migrations, `application.yml`.

## 9. Implementation steps

1. `Requirement` + `Comparison`, `SearchResults.compared`; fix call sites; compile.
2. `Evidence check(...)`, labels, `differences(req, l)`, `missing(req, l)`; write the 4 `check` unit tests; green.
3. Candidate query (stretch budget, drop region filter, Java sort); grouping rules in `validate`; AI-failure path through `validate`; the 2 grouping unit tests.
4. Prompt changes (schema, parse rules, `canonical`, rank system + prompt with description).
5. Controller tests updated/added; `cd backend && ./mvnw verify`.
6. `cd frontend && pnpm run api`; `find.ts` changes; spec; full frontend check line from `AGENTS.md`.
7. Run locally with a real key, run the demo query 3× and the backup query once; adjust only prompt wording if the parse differs.

## 10. Acceptance criteria

- Demo query: #1 Confirmed, #1001 Possible with ask-the-seller details, #1002 Alternative with the price + region
  difference — identical groups in 3 consecutive runs.
- Backup query: chip `RAM: ≥ 16 GB`; MacBook Pro #1003 under Alternative with `CHF 1250 instead of at most CHF 1200`.
- A DEFECTIVE listing never lands in Confirmed when `Condition: working` is a must-have; a GOOD one is never asked about "working".
- Cmd/Ctrl+Enter submits; matches load without a second click; status text changes during both waits; result header shows the compared count.
- With the AI key empty, matches still return three code-grouped groups (no 5xx).
- `./mvnw verify` and the frontend check line pass; generated client committed.

## 11. Out of scope

Postcode→coordinates distance and `maxDistanceKm`; editing `comparison` or adding new chips in the UI; streaming
progress; notifications, feedback, total-cost/shipping; any change to `listing/` or `ai/`.

## 12. Risks

- **Generated client conflicts** with other teams: never hand-merge `openapi.json`/`src/app/api/`; take `main`'s,
  re-run `./mvnw verify` + `pnpm run api`.
- Haiku parse variance (e.g. `Model: iMac 27"`, or Year as nice-to-have) shifts #1001/#1002 between groups:
  rehearse; fix with parse-prompt wording, not with code special cases.
- Text mismatches on present attributes become DIFFERENT (e.g. `Grau` vs `Grey`) → alternative instead of confirmed;
  the parse prompt normalizes to English.
- Staging may hold extra Sell-published iMacs; they can join the groups — check the data before the pitch.
- Soft region/budget enlarge the ranking prompt (capped at 30 candidates); watch Haiku latency.

Skipped / not checked while planning: exact springdoc rendering of the nested enum (verify in `openapi.json`), and
whether Angular's `keydown.meta.enter` fires in the Vitest DOM (spec uses `ctrlKey`).
