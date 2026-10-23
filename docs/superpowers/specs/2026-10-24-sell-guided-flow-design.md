# Sell: live detection and guided gap flow — design

Status: approved for planning, 2026-10-24. Scope: functionality only (backend, data flow, flow
logic). Visual design follows separately in Claude Design.

## Problem

The sell page shows up to three free-text AI `questions` in a "Tips" box with one button, "Add
photo and update draft". Questions that need an answer ("What is the frame size?") cannot be
answered, tips sit apart from the fields they concern, and skipping them has no effect. Re-drafting
uploads and stores every photo again.

## Goal

A demo-worthy, guided selling flow:

1. The seller adds photos; the AI's detections appear one by one as markings on the photos (live,
   streamed).
2. A guided flow asks for what is still missing, one card at a time, every card skippable.
3. The seller reviews the prefilled form and publishes.

## Backend

### Photo upload — `POST /api/photos`

Multipart, 1–5 images, same type/size checks as today (`DraftController`). Stores each photo once
for the seller and returns the `photoIds`. A photo added later is uploaded alone. Uses the
generated client.

### Draft stream — `POST /api/listing-drafts/stream`

Request body: `{ photoIds: number[], confirmedFacts: {name, value}[] }`. Photo ids must belong to
the caller. `confirmedFacts` are the seller's `SELLER` facts; the prompt tells the AI to keep them
and not ask for them again.

Response: `text/event-stream`, headers `Cache-Control: no-cache` and `X-Accel-Buffering: no`.

The AI does not use the JSON-schema structured output here. It writes NDJSON: one complete JSON
object per line, detections first, the draft line last. `AiClient` gets a streaming variant that
yields text lines. The backend parses and validates each line and emits it as an SSE event at once.
An invalid line is dropped (logged), never the whole stream.

| Event | Payload | Validation |
|---|---|---|
| `detection` | `photo` (1-based), `box` [x, y, w, h] in 0–1 of the image, `label`, optional `fact` {name, value, source LABEL\|SUGGESTION} | photo index in range, box inside 0–1, fact name in the catalog of any category |
| `privacy` | `photo`, `box`, `text` | as above; text never repeats the sensitive value |
| `gap` | `fact`, `kind` PHOTO\|ASK\|CONFIRM, `prompt`, `options` string[] | fact name in the catalog of the draft's category (checked when `draft` arrives; gaps are buffered until then) |
| `draft` | today's `ListingDraft` without `questions` (photoIds, category, title, description, condition, facts, price, privacyWarnings) | as today; price is computed by `PriceEstimator` after this line |
| `error` | `detail` | — |

The stream ends after `draft` or `error`. The old `POST /api/listing-drafts` and the free-text
`questions` field are removed.

The stream is the one endpoint the frontend calls by hand (`fetch` with the JWT, reading the body
stream), because `ng-openapi-gen` and `EventSource` cannot do a POST stream with an auth header.
This exception is noted in `AGENTS.md`. The event records are still part of the OpenAPI spec so
the frontend gets generated types for them.

### Category catalog — `GET /api/categories`

A thin catalog in `Categories` replaces the fixed fact-name enum in the draft schema: per
category, the ordered list of key fact names. `Categories.ALL` and `Categories.JSON` stay, derived
from the catalog, so other users (search, clearance) keep working. One line per category, e.g.

```
Bikes    → Brand, Model, Frame size, Wheel size, Gears, Brakes
Laptops  → Brand, Model, CPU, RAM, Storage, Display
Household → Brand, Model, Dimensions
```

All 11 categories get 3–6 facts; categories like Household and Office equipment stay short. The
union of all names is the allowed fact-name list in the prompt. The endpoint returns the catalog
through the generated client; `frontend/src/app/categories.ts` is deleted. Listing facts are stored
in the free `attributes` map, so no migration is needed.

The catalog decides *which* facts matter (deterministic). The AI decides *how* to ask for a missing
one (`gap` event): photo or question, the prompt text, and answer chips fitting the item (e.g.
"52, 54, 56 cm" for a road bike).

## Frontend flow

A state machine of signals in the sell page:

```
PHOTOS ──upload──▶ ANALYZING ──draft──▶ GAPS ──done / skip all──▶ REVIEW ──publish──▶ listing
                      ▲                   │                          │
                      └──new photo────────┘◀──answer open points─────┘
```

**PHOTOS** — pick or take 1–5 photos. "Analyse" uploads them and starts the stream.

**ANALYZING** — each `detection` appears as a marking (box + label) on its photo, in arrival
order; with several photos the view follows the photo of the latest detection. `privacy` marks the
area and flags the photo for review. `gap` events are collected. On `draft`, title, description,
category, condition and price are set; go to GAPS, or straight to REVIEW when no gap is open.

**GAPS** — one card at a time, progress "2 of 4", at most 5 cards. Order: Brand/Model, then
condition, then the remaining facts in catalog order.

Open gaps are computed in the frontend (pure function): a catalog fact of the current category is
open when it is missing or only `SUGGESTION`/`WEB`, and not skipped. A missing condition is always
a gap (PHOTO of the whole item, with the condition choice as the typed alternative). A suggested
value turns the card into CONFIRM. A fact without a `gap` event (e.g. after a category change) gets
a fallback ASK card "<fact>?" with free text.

| Card | Actions |
|---|---|
| ASK | answer chip or free text → fact with source `SELLER`, next card |
| CONFIRM | "Correct" → source `SELLER`; "Change" → input |
| PHOTO | take a photo → upload only it → stream again with all photo ids and all `SELLER` facts → ANALYZING (markings on the new photo) → GAPS with recomputed gaps. "Type instead" turns it into ASK; at 5 photos it is ASK |
| any | "Skip" → skipped for this session; "To overview" → REVIEW |

**REVIEW** — today's form, prefilled. Open and skipped gaps show as a hint at their fact; "Answer
open points" returns to GAPS. Completeness = confirmed catalog facts ÷ catalog facts of the
category. Changing the category recomputes the gaps at once. Gaps never block publishing; required
fields stay as today (condition, price, postcode, locality). Only `LABEL` and `SELLER` facts are
published, as today.

**Re-run after a new photo** — fields the seller edited and `SELLER` facts are never overwritten
(today's `sellerFields` logic). Answered or skipped gaps do not come back.

## Errors

- Stream fails before `draft`: markings stay, "Analyse again" re-runs only the stream (photos are
  already uploaded).
- Re-run after a new photo fails: the previous draft stays valid, the card counts as skipped.
- Upload errors and other API errors: `errorInterceptor` as today. Stream `error` events and
  network failures show the error banner.
- Bad AI lines are dropped, not fatal.

## Testing

- Backend: mocked `AiClient` stream yields NDJSON lines; assert the emitted events, that invalid
  lines and out-of-catalog fact names are dropped, that foreign photo ids are rejected, and the
  upload checks.
- Frontend: the gap computation (pure function) and the state transitions with a stubbed stream.
- Early manual check on staging that the stream is not buffered by the proxy in front of the
  backend.

## Out of scope

- Persisting a draft or answers across a reload (as today).
- Blurring or editing photos; privacy findings are marked and the photo can be left out.
- Cancelling a running stream.
- Visual design (Claude Design).
