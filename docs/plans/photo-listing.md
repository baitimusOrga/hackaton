# Plan: Honest photo listing

## Goal & demo moment

Photograph an item, get a listing draft that says what it **read**, what it **guesses**, what it
**cannot know**, and what the seller **should not publish**. Web lookup tops up specs, clearly marked.

20-second pitch beat: photo of the iMac type plate → draft with a short title ("Apple iMac 27" Retina
5K (2017)"), blue "From label" facts, condition empty with "The photos don't show the condition —
please choose", a rose box "Photo 1 shows a serial number" with "Leave out photo 1" ticked →
click **Complete technical data** → violet facts "From the web — please check" with source links.

## Findings covered

H3 condition null unless visible, seller must choose · M1 description in seller voice, no photo talk ·
M2 title ≤ 60 chars, specs in facts · M3 privacy warning per photo + leave the photo out · L5 real
labels on fact inputs · planned: "Complete technical data" button (web search, `source: WEB` + URL).

## User flow

1. Seller adds photos → **Create draft** (unchanged call `POST /api/listing-drafts`).
2. Draft view: privacy box (if any) above the tips; condition select empty unless AI saw wear;
   facts with markers LABEL / SUGGESTION / SELLER / WEB.
3. **Complete technical data** (enabled only when a `Model` fact is LABEL or SELLER) → new WEB facts
   appended; seller ticks "correct" (→ SELLER) or removes them. WEB and SUGGESTION facts are not published.
4. Publish sends only non-excluded photo ids; browser blocks publish while condition is empty.

## Backend changes

**`ListingDraft.java`** (do NOT touch `PriceEstimate`, `PriceConfidence`, `PriceEvidence`):
- `FactSource { LABEL, SELLER, SUGGESTION, WEB }`
- `DraftFact(String name, String value, FactSource source, @Schema(nullable = true) String sourceUrl)`
- new `public record PrivacyWarning(int photo, String text) {}` (`photo` is 1-based, same order as `photoIds`)
- append component **last**: `ListingDraft(..., PriceEstimate price, List<PrivacyWarning> privacyWarnings)`

**`DraftController.java`** (leave the `prices.estimate(...)` line as it is — the price team owns it):
- `AiDraft` gets `List<PrivacyWarning> privacyWarnings` (last). Pass it into `ListingDraft`; title
  goes through `static String shortTitle(String title)`: ≤ 60 chars, cut at the last space before 60,
  trimmed (`shortcut: hard cut, prompt does the real work`).
- `SCHEMA`: add `"privacyWarnings"` to `required` and `properties`:
  `{"type":"array","items":{"type":"object","additionalProperties":false,"required":["photo","text"],
  "properties":{"photo":{"type":"integer"},"text":{"type":"string"}}}}`. Fact `source` enum stays
  `["LABEL","SUGGESTION"]` (AI never sets SELLER/WEB). `sourceUrl` is not in the schema (stays null).
- `SYSTEM` prompt — replace the title/description/condition rules, add privacy; keep the fact rules:
  - title: at most 60 characters, brand + model + one distinguishing variant (size or year).
    No CPU/RAM/storage/part numbers in the title; those belong in facts.
  - description: written as the seller, first person, 2–3 sentences: what it is, known model details,
    visible wear. Never mention photos, pictures, images or labels ("The photo shows…" is wrong).
    Never claim it works, is complete, or includes accessories.
  - condition: null unless the photos clearly show the outside of the whole item. Label close-ups,
    partial views and blurry photos → null. Absence of visible wear in a partial view is not evidence.
  - questions: at most 3; first the one missing photo that would identify the exact model or variant
    ("Please photograph the type plate on the back").
  - privacyWarnings: one entry per photo that shows a serial number, IMEI, MAC address, a person's
    name, address, phone number, a document, an employee/asset tag, or a screen with personal content.
    Text e.g. "Shows a serial number. Leave this photo out or cover it." Never repeat the value.
  - Never copy serial numbers or personal data into title, description, facts or questions.

**New `WebFactsController.java`** (`@Tag(name = "Selling")`, so it lands in `SellingService`):
- `POST /api/listing-drafts/web-facts`, method `completeFacts(@Valid @RequestBody WebFactsRequest
  request, @AuthenticationPrincipal Jwt seller)` → `List<DraftFact>`.
- `seller == null` → `401 "Please log in."` (SecurityConfig only guards the exact path
  `/api/listing-drafts`; SecurityConfig is off limits, so check here, one-line comment why).
- `record WebFactsRequest(@NotBlank @Size(max=120) String title, @NotBlank @Size(max=80) String category,
  @NotNull @Size(max=30) List<@Valid @NotNull KnownFact> facts)`;
  `record KnownFact(@NotBlank @Size(max=80) String name, @NotBlank @Size(max=500) String value, @NotNull FactSource source)`.
- No `Model` fact with source LABEL or SELLER → `400 "Please confirm the model first, then we can
  look it up."` (we only look up what was read or confirmed; AI is not called).
- AI answer records: `record AiWebFacts(List<WebFact> facts)`, `record WebFact(String name, String value, String url)`.
- User text: `Item: <title>\nCategory: <category>\nKnown facts (do not repeat):\n- Brand: Apple\n...`.
- `WEB_SYSTEM` rules:
  - Search the web for the manufacturer's spec page or a reliable datasheet of exactly this model.
  - Return only facts not in the known list; names only from Brand, Model, Year, Color, Size, Display,
    Resolution, CPU, RAM, Storage, Material, Dimensions; values short and normalized.
  - Only specs that are fixed for this model. Skip anything that differs between configurations.
  - Every fact needs the URL of the page it came from. Nothing reliable → empty list.
  - Answer with JSON only, no other text: `{"facts":[{"name":"Resolution","value":"5120x2880","url":"https://..."}]}`
- Code filter before returning (one stream): allowed name, name not already known (case-insensitive),
  value non-blank ≤ 80 chars, url starts with `https://` or `http://`, first per name, max 8 →
  `new DraftFact(name, value.strip(), FactSource.WEB, url)`.

**`AiClient.java`** — one server tool, smallest change:
- New `public <T> T askWithWebSearch(String system, String text, Class<T> type)` on the default model.
- `request(...)` takes `schema == null` as web mode: no `output_config.format` (structured outputs
  can't be combined with web search citations → 400), instead `"output_config": {"effort": "low"}`
  and `"tools": [{"type": "web_search_20260209", "name": "web_search", "max_uses": 3,
  "user_location": {"type": "approximate", "country": "CH"}}]`. Keep headers and `fallbacks` as is.
- Share the HTTP call + parsing between both methods (private `send(Map request, Class<T> type)`).
- Lenient parsing for both: join the `text` of all `text` blocks (citations split answers into several
  blocks), take from the first `{` to the last `}` (strips preamble and ```json fences), `readValue`.
  No `{` → 502 as today. `stop_reason` other than `end_turn` (incl. `pause_turn`) → 502 as today.

**Migration / config:** none (V8 unused, no new `application.yml` key).

## Frontend changes (`pages/sell.ts` only; do not touch the `<fieldset>` "Price" block)

- `Source` adds `'WEB'`; `Fact` adds `sourceUrl?: string | null`; `MARKERS.WEB = 'From the web — please check'`,
  `MARKER_STYLES.WEB = 'bg-violet-100 text-violet-900'`. WEB facts show `<a [href]="fact.sourceUrl"
  target="_blank" rel="noopener noreferrer" class="underline">Source</a>`; the "correct" checkbox shows
  for SUGGESTION **and** WEB. Publish filter: drop `SUGGESTION` and `WEB`.
- L5: fact name becomes `<label [for]="'fact-' + i">`, input gets `[id]="'fact-' + i"` (drop `aria-label`);
  checkbox `[attr.aria-label]="fact.name + ' is correct'"`; Remove button `[attr.aria-label]="'Remove ' + fact.name"`.
- H3: `fields` default `condition: ''`; first option `<option value="" disabled [selected]="!fields().condition">Choose condition</option>`.
  Hint under the select: draft condition null → "The photos don't show the condition — please choose it.";
  otherwise, until the seller changes it → "Suggested from the photos — please check." `publish()` returns early when condition is empty.
- M3: `excluded = signal(new Set<number>())` (0-based photo index); `photoIdsToPublish = computed(...)`
  filters `draft().photoIds` by index; `publish()` uses it. Section `aria-label="Privacy check"`
  (`rounded border border-rose-300 bg-rose-50 p-3`) above the tips, heading "Check before publishing",
  per warning: "Photo {{photo}}: {{text}}" + checkbox "Leave out photo {{photo}}". Excluded thumbnails get
  `opacity-40 ring-2 ring-rose-500` and alt "Photo N (left out)".
- Web button inside the Details fieldset: `canLookUp = computed(() => facts().some(f => f.name === 'Model'
  && f.value.trim() && (f.source === 'LABEL' || f.source === 'SELLER')))`; button "Complete technical data"
  (`secondary`, disabled when `!canLookUp() || lookingUp()`, text "Searching the web…" while busy), hint when
  disabled: "Confirm the model first — we only look up what we know." `completeFacts()` sends
  `{title, category, facts}` (non-blank values only), appends returned facts whose name is new;
  empty answer → `webNote` "Nothing reliable found on the web for this model." Errors go to the banner.
- `listing.ts`: no change.

## Tests

Backend (`./mvnw verify`):
- `AiClientTest.webSearchSendsToolWithoutSchemaAndReadsJsonAcrossTextBlocks` — request has
  `tools[0].type == web_search_20260209`, `max_uses == 3`, no `output_config.format`, effort `low`;
  response content `[text "I'll look it up.", server_tool_use, web_search_tool_result, text "```json\n{\"title\":",
  text "\"Desk\"}\n```"]` parses to `Answer("Desk")`.
- `AiClientTest.refusalOrBrokenJsonIs502` — add a third case `pause_turn` → 502.
- `DraftControllerTest.draftFromOnePhoto...` — mock returns `condition null` and a privacy warning;
  asserts `$.condition` is null and `$.privacyWarnings[0].photo == 1`; rest unchanged.
- `DraftControllerTest.shortTitleCutsAtAWordBoundary` — 90-char title → ≤ 60 chars, ends with a whole word;
  short title unchanged.
- `WebFactsControllerTest.keepsOnlyNewAllowedFactsWithUrlAsWeb` — AI returns Resolution(url) ✓, Brand
  (already known) ✗, "Serial"(not allowed) ✗, Year without url ✗ → exactly one fact, `source WEB`, `sourceUrl` set.
- `WebFactsControllerTest.needsAConfirmedModel` — Model as SUGGESTION → 400 with the detail text; `verifyNoInteractions(ai)`.
- `WebFactsControllerTest.requiresLogin` — no jwt → 401.

Frontend (`sell.spec.ts`, Vitest):
- existing test keeps passing (markers, confirm).
- `asks the seller to choose the condition when the photos don't show it` — draft `condition: null` →
  condition select value `''`, hint text visible.
- `warns about private details and leaves the photo out` — warning text shown; tick "Leave out photo 1" →
  `fixture.componentInstance['photoIdsToPublish']()` equals `[]`.
- `completes technical data from the web` — draft with Model LABEL; `completeFacts` mock returns a WEB fact →
  marker "From the web — please check" and a "Source" link with the URL.
- `labels every fact input` — each `[data-testid="fact"] input:not([type=checkbox])` has `label[for=<id>]`.

## File ownership

`backend/.../ai/AiClient.java` · `backend/.../selling/DraftController.java` (not the `prices.estimate` line) ·
`backend/.../selling/ListingDraft.java` (not the price records) · `backend/.../selling/WebFactsController.java` (new) ·
`backend/src/test/.../ai/AiClientTest.java` · `backend/src/test/.../selling/DraftControllerTest.java` ·
`backend/src/test/.../selling/WebFactsControllerTest.java` (new) · `frontend/src/app/pages/sell.ts` (not Price) ·
`frontend/src/app/pages/sell.spec.ts` · regenerated `frontend/openapi.json` + `frontend/src/app/api/**` (never by hand).

## Ordered implementation steps

1. `ListingDraft`: `WEB`, `sourceUrl`, `PrivacyWarning`, `privacyWarnings` last; fix `new DraftFact(...)` in tests.
2. `AiClient`: `send(...)`, lenient parse, web mode, `askWithWebSearch`; AiClient tests.
3. `DraftController`: prompt, schema, `shortTitle`, privacy warnings; DraftControllerTest.
4. `WebFactsController` + its test.
5. `cd backend && ./mvnw verify` → `cd frontend && pnpm run api`.
6. `sell.ts`: labels, condition, privacy box, WEB facts + button; `sell.spec.ts`.
7. Frontend checks from `AGENTS.md`; then one live run with a real key: type-plate photo + blurry photo + web button.

## Acceptance criteria

- [ ] Type-plate photo: title ≤ 60 chars without CPU/RAM/storage; condition empty with the hint; description
      first person, no "photo"/"image"/"label"; a privacy warning for the serial number; serial nowhere in the draft.
- [ ] Publish is impossible until a condition is chosen; a "left out" photo's id is not in the publish request.
- [ ] Web button disabled while Model is only a suggestion; after confirming it returns ≥ 1 violet WEB fact with a
      working source link in < 40 s; WEB facts are not published unless ticked or edited.
- [ ] `./mvnw verify` and all frontend checks green; `openapi.json` + `src/app/api/` committed.

## Out of scope

Blurring or cropping photos; making unpublished photos private (`GET /api/photos/{id}` is public by id);
checking web URLs against the search results' citations; condition checklist; editing facts that the AI did not
return; showing the privacy flag on the listing page.

## Risks

- Web search must be enabled for the org of the API key; otherwise the call fails → 503/502 in the banner and the
  rest of the draft still works. Try it once before the pitch.
- If the API rejects `fallbacks` or `effort` together with the web tool (400), drop that field for web mode only.
- Web call latency 10–40 s; the pitch should use a rehearsed item (iMac type plate).
- The model may still invent a URL; the "please check" marker and non-publishing of WEB facts contain this.
- Merge conflicts: the price team edits `DraftController`/`ListingDraft`/`sell.ts` nearby — keep the `price`
  lines untouched; for `openapi.json` and `src/app/api/` regenerate after merging instead of hand-resolving.

## Integration notes (orchestrator)
- Auth for `POST /api/listing-drafts/web-facts`: add one rule in `config/SecurityConfig.java`,
  `.requestMatchers(HttpMethod.POST, "/api/listing-drafts/**").authenticated()`, instead of checking the
  JWT in the controller. The clearance team also adds one matcher there; the orchestrator resolves the merge.
- The price team changes the `prices.estimate(...)` line in `DraftController` and the price block in
  `sell.ts`; leave both as they are on `main`.
