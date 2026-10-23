# USP plan: Price with evidence

## Goal and demo moment
Seller photographs a Dell U2719D type plate. The price panel shows a confidence badge ("High confidence"), three strategy buttons
(Sell faster CHF 144.00 · Balanced CHF 157.00 · Higher CHF 164.00), a strip with one dot per comparable, and the evidence list:
"Dell U2719D 27" QHD monitor · Same model 100 % · Sold · Good · 51 days ago · CHF 165.00". Switching condition to "Used" moves
every number at once. Then a blurry photo of an unknown monitor: **"No estimate"** with the reason (brand and model unknown) and
a tip to photograph the type plate. Message: we never invent a price; every franc is backed by listings you can click.

## Findings covered
- **H4**: only same brand + same model is real evidence; title look-alikes are allowed but always `provisional` + `LOW` with
  the reason in the text; different brand or different known model is never evidence; nothing similar → no numbers at all.
- **L1**: `LOCALE_ID = 'en-CH'` (English UI, Swiss number format) → `currency:'CHF'` renders `CHF 450.00`, `CHF 1’250.00`.
  `en-CH` is in `@angular/common/locales/en-CH` (pattern `¤ #,##0.00`, grouping `’`); dates stay English (`de-CH` would not).

## Algorithm (pure Java, no AI, `PriceEstimator`)
New method `estimate(String category, String title, List<DraftFact> facts, Condition condition)`; the old
`estimate(category, title)` stays and delegates with `List.of(), null`. `facts` may be null → treat as empty.
1. **Draft identity**: `brand` / `model` = value of the first fact named `Brand` / `Model` (ignore case, non-blank).
   `identified = brand != null && model != null`. `suggested` = brand or model fact has source `SUGGESTION`.
2. **Tokens**: `title.toLowerCase().split("[^\\p{L}\\p{N}]+")`, keep length ≥ 2 (so `27`, `5k`, `m1` count).
   `norm(s)` = lowercase without non-letters/digits (brand comparison). `J(a,b)` = Jaccard of the two title token sets.
3. **Candidates**: `listings.findAll()` (AVAILABLE and SOLD), same category (ignore case). Comparable brand/model = its
   `attributes` `Brand` / `Model`. Skip if both brands are known and `norm` differs.
4. **Similarity tier** (first match wins, else skip):
   - `SAME_MODEL`, 100 %: brands known and equal, draft model known, and either all tokens of the draft model ⊆ tokens(comp
     title + comp model) or comp model known and all its tokens ⊆ tokens(draft title + draft model).
   - both brands known and equal, both models known (and not matched above) → **skip** (different model).
   - `SAME_BRAND`: brands known and equal, `J ≥ 0.4`; percent = `min(90, round(100·J))`.
   - `SIMILAR_TITLE`: a brand is missing on either side, `J ≥ 0.6`; percent = `min(80, round(100·J))`.
5. **Which comparables count**: if ≥ 3 `SAME_MODEL` → only those; else all matches. Then, if ≥ 3 of them are SOLD → only
   the sold ones (product plan §7: completed sales beat asking prices).
6. **Condition adjustment**: `F = {NEW 1.30, LIKE_NEW 1.15, GOOD 1.00, USED 0.85, DEFECTIVE 0.40}`. Target = `condition`
   or `GOOD` when null. `adjusted = price / F[comp] · F[target]`, scale 2, HALF_UP. Percentiles on the sorted adjusted prices
   with the existing `percentile()` (whole francs): low = p25, mid = p50, high = p75.
7. **Confidence** (`modelCount` = SAME_MODEL among used):
   - 0 used → no estimate: low/mid/high `null`, `LOW`, `provisional = true`.
   - `!identified` → `LOW`. Else `modelCount ≥ 5` → `HIGH`, `≥ 3` → `MEDIUM`, else `LOW`.
   - spread: n ≥ 2 and `high > 1.75 · low` → one step down. `suggested` → at most `MEDIUM`.
   - `provisional = confidence == LOW`.
8. **Evidence**: used comparables sorted by percent desc, sold first, newest first; at most 8.
   `ageDays = Duration.between(createdAt, Instant.now()).toDays()` (no cut-off; age is shown, not hidden).
9. **Explanation** ("why this range"), sentences joined with a space:
   - basis: `"Based on %d completed sales and %d asking prices of %s in %s."` (drop a zero part; `%s` = `"the same model"` if
     all used are SAME_MODEL, else `"similar items"`).
   - range: `"Half of them land between CHF %s and CHF %s once adjusted to condition %s."` (add `" (assumed)"` when condition
     was null; condition label: New, Like new, Good, Used, Defective).
   - reason, first that applies: `!identified` → `"Brand and model are not confirmed, so these are look-alikes only. Photograph
     the type plate for a reliable range."`; spread downgrade → `"Prices vary widely, so treat this as a rough guide."`;
     LOW → `"Only %d sales or listings of this exact model, so this estimate is provisional."`; `suggested` → `"Brand or model
     is a suggestion from the photo; confirm it to firm this up."`
   - no estimate: `!identified` → `"No estimate: we could not identify brand and model and found no listing similar enough.
     Photograph the type plate or set your own price."`; else `"No estimate: no listing of this model in %s yet. Set your own
     price, we don't guess."`

## Record / API changes (`ListingDraft.java`, additive only; existing names unchanged)
`PriceEstimate` gains `Condition condition` (target the range is adjusted to, never null), `int comparableCount`, `int soldCount`.
`PriceEvidence` gains `Similarity similarity`, `int similarityPercent`, `Condition condition`, `boolean sold`, `long ageDays`,
`BigDecimal adjustedPriceChf`. New `public enum Similarity { SAME_MODEL, SAME_BRAND, SIMILAR_TITLE }` next to `PriceConfidence`.
```json
"price": {"lowChf": 144, "midChf": 157, "highChf": 164, "confidence": "HIGH", "provisional": false,
  "condition": "GOOD", "comparableCount": 6, "soldCount": 6,
  "explanation": "Based on 6 completed sales of the same model in Monitors. Half of them land between CHF 144 and CHF 164 once adjusted to condition Good.",
  "evidence": [{"listingId": 1101, "title": "Dell U2719D 27\" QHD monitor", "priceChf": 165.00, "similarity": "SAME_MODEL",
    "similarityPercent": 100, "condition": "GOOD", "sold": true, "ageDays": 51, "adjustedPriceChf": 165.00}]}
```
No estimate: `lowChf/midChf/highChf: null, confidence: "LOW", provisional: true, comparableCount: 0, evidence: []`.

## Frontend component `components/price-panel.ts` (selector `app-price-panel`, class `PricePanel`)
- Inputs: `estimate = input<PriceEstimate | null | undefined>()` (type from `../api/models`; fallback `ListingDraft['price']`),
  `condition = input<string | null | undefined>()`. Two-way: `price = model<number | null>(null)`. Imports `CurrencyPipe`, `RouterLink`.
- Condition rescale (computed): `ratio = F[condition() || est.condition] / F[est.condition]` with the same `F` table as Java
  (comment: `keep in sync with PriceEstimator.FACTORS`); low/mid/high and dot positions = `Math.round(value · ratio)`.
- Renders nothing when `estimate()` is null/undefined. States:
  - **normal** (MEDIUM/HIGH): badge (HIGH emerald, MEDIUM sky), three buttons from the existing `strategies` labels with
    `| currency: 'CHF'` and a hint line (faster: "cheaper than 3 in 4 comparables", balanced: "middle of the evidence",
    higher: "may take longer"), `aria-pressed` + click sets `price`; strip: `relative h-6` bar, one dot per evidence item at
    `left: (adj - min)/(max - min)·100 %` (sold filled, asking hollow, `title` = item title), shaded band from low to high.
  - **provisional** (LOW with numbers): amber box with the literal text **`Provisional estimate`** (sell.spec checks it) + same
    buttons and strip.
  - **no estimate** (`midChf == null`): grey box "No estimate", no buttons, no strip.
  - Always: `explanation` paragraph; evidence `<ul>`: link `/listings/:id`, chip `Same model` / `Same brand` / `Similar title` +
    `similarityPercent %`, `Sold` or `Asking`, condition label, age (`today`, `1 day ago`, `n days ago`), `priceChf | currency`,
    and `≈ adjusted` value when it differs. Strip and chips get text alternatives (`aria-label` / visible text).
- `pages/sell.ts`: replace only the `@if (draft()?.price; as estimate) { … }` block inside the Price fieldset with
  `<app-price-panel [estimate]="draft()?.price" [condition]="fields().condition" [(price)]="price" />`; add `PricePanel` to
  `imports`, move the `strategies` constant into the panel; drop `RouterLink` from sell.ts only if no other use remains.
  The "Your price (CHF)" input stays in sell.ts.
- `app.config.ts`: `registerLocaleData(localeEnCh)` (`import localeEnCh from '@angular/common/locales/en-CH'`), providers
  `{ provide: LOCALE_ID, useValue: 'en-CH' }`, `{ provide: DEFAULT_CURRENCY_CODE, useValue: 'CHF' }`.

## Demo data: `V10__price_demo_sales.sql` (SOLD only, so Discover/Find never show them; detail page still opens)
Dell (Monitors, attrs Brand `Dell`, Model `U2719D`, Size `27"`): 1101 `Dell U2719D 27" QHD monitor` 165 GOOD 8004 Zürich 09-02 ·
1102 `Dell UltraSharp U2719D` 175 LIKE_NEW 3008 Bern 09-15 · 1103 `Dell U2719D monitor with stand` 140 GOOD 4052 Basel 09-28 ·
1104 `Dell UltraSharp U2719D 27 inch` 120 USED 6005 Luzern 10-06 · 1105 `Dell U2719D, box included` 185 LIKE_NEW 8400 Winterthur
10-12 · 1106 `Dell U2719D (dead pixel)` 70 DEFECTIVE 1004 Lausanne 10-16.
iMac (Computers, Brand `Apple`, Model `iMac 18,3 A1419`, Year `2017`): 1107 `Apple iMac 27" Retina 5K 2017 (A1419)` 420 GOOD 8032
Zürich 08-30 · 1108 `iMac 27" Retina 5K 2017, 16 GB` 480 LIKE_NEW 3006 Bern 09-10 · 1109 `Apple iMac 27" 2017 A1419 i5` 390 GOOD
9000 St. Gallen 09-24 · 1110 `iMac 27" Retina 5K 2017 with keyboard` 350 USED 6003 Luzern 10-08 · 1111 `Apple iMac 27" 2017,
scratch on screen` 260 USED 2502 Biel/Bienne 10-14. All 2026, `T10:00:00Z`, `status 'SOLD'`, one fictional English description
sentence each, no seller. Add a V10 row to `docs/DATA-MODEL.md` ("12 SOLD demo sales for price evidence, ids 1101–1111").

## Tests
`PriceEstimatorTest` (rewrite; helper sets condition GOOD, createdAt `now - days`, attributes, status):
`unidentifiedItemGetsNoEstimateFromUnrelatedListings` (H4: "Computer monitor", no facts, LG/Samsung monitors → nulls, text
contains "brand and model") · `titleLookAlikesAreAlwaysProvisionalAndLow` · `differentModelOfSameBrandIsNotEvidence` ·
`otherBrandIsNeverEvidence` · `fiveSameModelSalesGiveHighConfidence` (similarity SAME_MODEL, 100) ·
`completedSalesWinOverAskingPricesFromThree` · `conditionAdjustsComparablePrices` (LIKE_NEW 115 → target USED → 85) ·
`wideSpreadLowersConfidence` · `suggestedModelCapsConfidenceAtMedium` · `oldSignatureStillWorks`.
`components/price-panel.spec.ts` (provide `LOCALE_ID 'en-CH'` + `registerLocaleData`): `shows range, evidence and Swiss
currency` (`CHF 144.00`, `Same model`, `Sold`) · `choosing a strategy sets the price` · `marks a provisional estimate` ·
`shows no estimate without buttons` · `rescales when the condition changes` (GOOD mid 100 → USED → `CHF 85.00`).
`DraftControllerTest` and `sell.spec.ts` must pass unchanged.

## File ownership
Yours: `selling/PriceEstimator.java`, `PriceEstimatorTest.java`, the nested price records + `Similarity` in `ListingDraft.java`,
one line in `DraftController.java` (`prices.estimate(draft.category(), draft.title(), draft.facts(), draft.condition())`),
`V10__price_demo_sales.sql`, the V10 row in `docs/DATA-MODEL.md`, `components/price-panel.ts` + spec, the price block and
`imports` in `pages/sell.ts`, `app.config.ts`, regenerated `frontend/openapi.json` + `frontend/src/app/api/`. Nothing else.

## Implementation steps
1. Records in `ListingDraft.java` (additive). 2. `PriceEstimator` per the algorithm, keep the `shortcut:` comment on `findAll`.
3. `PriceEstimatorTest`. 4. DraftController one-liner. 5. V10 + DATA-MODEL row. 6. `cd backend && ./mvnw verify`.
7. `cd frontend && pnpm run api`. 8. `app.config.ts` locale. 9. `price-panel.ts` + spec. 10. `sell.ts` swap.
11. Frontend checks from AGENTS.md. 12. Local run: Sell with a Dell U2719D / iMac label photo and a blurry photo; Discover shows `CHF 1’250.00`.

## Acceptance criteria
- Unidentified item never gets numbers from unrelated listings; title-only matches are always `LOW` + provisional with the reason.
- Every number in the panel is traceable to clickable evidence with similarity, sold/asking, condition and age.
- Changing the condition in the form rescales range and dots instantly; no extra request.
- All prices in the app render `CHF 450.00` / `CHF 1’250.00`. Both check suites green; old `estimate(category, title)` compiles.

## Out of scope
New price endpoint, AI explanations, age cut-off or decay weighting, location/accessory adjustment, auction advice, bulk pricing,
sold-date column, persisting the estimate on the listing.

## Risks
- Merge conflicts in `openapi.json` / generated client / `ListingDraft.java` / `DATA-MODEL.md` with parallel teams: rebase,
  then rerun `./mvnw verify` + `pnpm run api`; never hand-merge generated files.
- Model token match is loose ("iMac" alone matches every iMac); acceptable for the demo. Before the pitch, run a real draft
  with the demo photo and check the Model fact matches the V10 attributes; adjust V10 titles if not (before it reaches main).
- Sell team's H3 fix may send `condition: null`: handled (assumed Good, said in the text). F table exists twice (Java + TS).
- SOLD demo listings open on the detail page without a "sold" marker (detail page is not ours). V10 number must stay unique.

## Integration notes (orchestrator)
- The photo team makes `condition` null until the seller picks one. The estimator and the price panel must
  handle a null condition (no condition adjustment, say so in the explanation).
- The photo team also edits `DraftController.java` and `sell.ts`; change only your one line and the price block.
