# Plan: Bought and sold states on the listing page

## Bug
A fixed-price listing on `/listings/:id` always offers **Kaufen**, whatever happened to it. After a
purchase the page says "Gekauft! …", but a reload brings the button back; pressing it again fails
with "This listing has already been sold." Everyone else, signed in or not, sees the same button on
a sold listing and gets the same error. The seller sees it on their own listing (403).

## Findings (2026-10-24, reproduced on the dev server, listing 2598 bought by the test session)
- `GET /api/listings/{id}` returns the same JSON before and after the purchase: `ListingDetail`
  carries no `status`, no buyer, no viewer relation. The entity has both (`status`, `buyerId`,
  `sellerId`), and `PurchaseController` sets them, but `Listing.detail()` leaves them out.
- The page's `bought`, `buying`, `buyError` are `linkedSignal`s reset per listing; "bought" exists
  only in the component's memory. `listing.html` has two branches: `bought()` → message, else →
  button. There is no third state.
- Auctions already solve this: `AuctionState` has `ended`, `ownListing`, `leading`, computed per
  viewer in `AuctionService.get(id, viewerId)`, viewer taken from `@AuthenticationPrincipal Jwt`
  (null when anonymous, the route is `permitAll`).
- Search and the similar-nearby list already hide non-`AVAILABLE` listings; only the detail page
  is blind.
- Side finding: the button reads **"Buying"** in English. `messages.ts` spreads `INFO_MESSAGES`
  (`Kaufen` → "Buying", the info page section title) after `FIND_MESSAGES` (`Kaufen` → "Buy").

## Fix (smallest complete)
Backend, no migration (`status` and `buyer_id` exist):
- `ListingDetail`: append `ListingStatus status`, `boolean ownListing`, `boolean bought` (viewer is
  the buyer). Viewer-relative booleans, never the buyer id, same shape as `AuctionState`.
- `Listing.detail(String viewerId)`; keep `detail()` = `detail(null)` for the six callers that only
  need `summary()` or no viewer (`TradesController`, `ListingController.list`,
  `MyListingsController`, `SellingController`).
- `ListingController.get`: add `@AuthenticationPrincipal Jwt viewer`, return
  `detail(viewer == null ? null : viewer.getSubject())`. `PurchaseController.buy`: return
  `detail(buyer.getSubject())` so the answer already says `bought: true`.
- `SearchServiceTest`: the four `new ListingDetail(...)` constants and the `withX` helpers
  (nine sites, same file) get the three new arguments. Alternative, if that looks noisy: a
  secondary record constructor defaulting to `AVAILABLE, false, false`.
- Tests: `ListingControllerTest` already flips a listing to `SOLD` (line ~100); extend it to assert
  `status` and `bought` for the buyer, another user and anonymous. `PurchaseControllerTest`: the
  response has `bought: true`.
- `./mvnw verify`, `pnpm run api`, commit `frontend/openapi.json` + `frontend/src/app/api/`.

Frontend `pages/listing.ts` + `listing.html`, fixed-price branch only (auctions are fine):
- `bought = linkedSignal({ source: listing, computation: (item) => !!item?.bought })` — the
  server's truth after a reload, the local `set(true)` right after buying stays.
- Template order: `bought()` → existing "Gekauft! …" message; `item.ownListing` → "Das ist dein
  Inserat." (new short message; the auction one says "…Du kannst nicht mitbieten."); `item.status
  !== 'AVAILABLE'` → "Verkauft" / "Zurückgezogen" as a `role="status"` line (both keys exist in
  `sell.ts` / `profile.ts`); else the button. Price stays visible in every state.
- Optional, same cost: swap the "Festpreis" badge for "Verkauft" when sold, like
  `profile-listings` does.
- `listing.spec.ts`: one test with three fixtures — sold+bought shows the message and no button,
  sold by someone else shows "Verkauft" and no button, own listing shows no button.
- `profile-trades.ts` line 10 comment ("only auctions record a buyer") is stale; drop it.

## Not in this change (named)
- The "Buying" label: one-line fix, move or rename the `info.ts` key — separate tiny PR, or fold in
  if the reviewer prefers.
- Re-fetching the listing after a purchase, a "bought on <date>" line, buyer contact or pickup
  state: no data for it yet (see `profile-trades.ts`).
- Hiding sold listings from the detail route entirely (404): they stay readable, the my-listings
  decision of 2026-10-24 wants withdrawn ones readable too.

Risk: `ListingDetail` is also what the search/buying assistant feeds to the AI (`SearchService`);
three more fields in that record are harmless but show up in its JSON. The test session bought
listing 2598 ("Beamer BenQ 4K") on the local database while reproducing.
