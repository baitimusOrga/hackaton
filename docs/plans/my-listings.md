# Plan: Manage my listings

## Goal and demo moment
A seller opens **Mein Konto → Meine Inserate** and sees every listing they published, newest first, each with
its status (Aktiv, Verkauft, Beendet, Zurückgezogen), price or current bid, and a link to the listing. An active
listing has **Zurückziehen**: after an inline confirmation it disappears from search and shows "Zurückgezogen".
An auction that already has bids cannot be withdrawn (the bidders have a claim on it).

Decisions (2026-10-24): status is stored as a fourth `ListingStatus` value `WITHDRAWN` (no migration: the column
is `varchar(20)` without a check), withdrawn listings keep their photos and stay readable at `/listings/:id`,
there is no undo.

## Findings
- `TradesController` (`/api/me/trades`) already answers "what did I sell?" from `listing.seller_id`; "Käufe und
  Verkäufe" and "Einstellungen" are the two sub pages of `ProfileLayout`. The new page is the third.
- `ListingSummary` has no status (search results are always `AVAILABLE`), and `ListingDetail` is constructed in
  nine places in `SearchServiceTest`; adding a field there costs more than a small record for this page.
- `ListingRepository.search` and `SearchService` filter on `AVAILABLE`, so a new status hides a listing from
  search and the buying assistant with no further change. `PurchaseController` and `AuctionService` already
  refuse anything that is not `AVAILABLE`.
- `bid_count` is denormalised on the listing, so "has bids" needs no join.

## Phase 1 (this change): list and withdraw
Backend `listing/MyListingsController.java`, `@Tag("MyListings")`, `/api/me/listings`, signed in only
(`SecurityConfig` already authenticates everything not listed):
- `record MyListing(ListingSummary listing, ListingStatus status)`.
- `GET` `list` → `List<MyListing>` from `ListingRepository.findBySellerIdOrderByCreatedAtDesc` (new derived query).
- `DELETE /{id}` `withdraw` → 204. 404 when the listing is not mine (same answer as unknown, nothing to probe),
  409 when it is not `AVAILABLE` ("already sold or ended") or an auction with bids.
- `ListingStatus.WITHDRAWN`; `docs/DATA-MODEL.md` names it.
- Test `MyListingsControllerTest`: only my listings with their status; withdraw works; auction with bids → 409;
  someone else's → 404; anonymous → 401.

Frontend:
- Route `profile/listings` → `pages/profile-listings.ts` (`ProfileListings`), link "Meine Inserate" first in the
  `ProfileLayout` nav.
- Page: `listings` signal loaded once from `MyListingsService.list()`; rows like the trades page (photo, title,
  mode · place, status badge, price) linking to the listing. `Zurückziehen` on active rows opens an inline
  "Wirklich zurückziehen?" with `Ja, zurückziehen` / `Abbrechen`; success patches the row's status locally.
  Empty state links to the sell dialog. Messages in `i18n/messages/profile.ts`.
- Spec: renders the status of each row; withdraw calls the service and the row shows "Zurückgezogen".

## Phase 2: edit an active listing (not built)
- `PUT /api/me/listings/{id}` with the fields of `CreateListingRequest` minus photos; only `AVAILABLE` listings,
  auctions only while `bid_count = 0` (price and end date are the bidders' terms). Reuse the sell page's preview
  step as the edit form, opened from a `Bearbeiten` link on the row.
- Photo changes reuse `PhotoController`; ordering and removal need `photo.listing_id` to be cleared on removal.

## Phase 3: relist (not built)
- `POST /api/me/listings/{id}/relist` copies a `SOLD`/`ENDED`/`WITHDRAWN` listing into a new `AVAILABLE` one
  (fresh `created_at`, new auction end), so the seller does not retype. Photos are shared by storage key.

## Out of scope (named, not built)
- Undo of a withdrawal, scheduled or bulk withdrawals, pausing (hide without ending).
- Buyer contact or pickup state on sold rows (no such data yet, see `profile-trades.ts`).
- A notification to bidders or watchers.

Risk: `ClearanceService` shows any non-`AVAILABLE` listing as `SOLD` on the business side, so a company that
withdraws a published clearance item sees it as sold there. Acceptable for now; fix when clearance gets its own
withdraw.
