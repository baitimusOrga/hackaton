# Data model

Postgres 16. The schema is owned by **Flyway**: `backend/src/main/resources/db/migration/V<n>__<what>.sql`. Hibernate only validates it (`ddl-auto: validate`), so a new column needs a migration *and* the field in the entity.

Rules:

- Never edit a migration that has run somewhere (staging counts). Add the next number instead.
- Keep the SQL portable: tests run on H2 in PostgreSQL mode (`application-test.yml`).
- Update this file in the same pull request.

## Tables

- `listing`: listing content, CHF price, condition, postcode/locality, the postcode centroid (`latitude`/`longitude`, nullable) and creation time. V4 persists the three public contract demos; new identities start at 4.
- `listing_attribute`: attribute names/values owned by a listing. Demo data uses only the canonical keys `Brand, Model, Year, Color, Size, Display, Resolution, CPU, RAM, Storage, Material, Dimensions`.
- `listing.status`: `AVAILABLE` (default), `SOLD`, or `ENDED` (auction closed without a bid); `GET /api/listings` only returns `AVAILABLE`, newest first (`?saleMode=AUCTION`: ending soonest first). V6 adds 20 fictional demo listings with ids 1001–1020, V15 another 90 for the buying assistant (ids 1201–1290). V18 adds 300 deliberately messy ones (ids 2301–2600: dialect, typos, wrong categories, accessories, defects) for the cases in `docs/testing/search-eval.md`; V20 adds 200 more (ids 2601–2800) and 60 SOLD ones (2801–2860) as price evidence for common demo models.
- `listing.sale_mode`: `FIXED` (default) or `AUCTION`. For auctions `price_chf` is the start price, `ends_at` the end (extended to now + 2 min by a bid in the last 2 minutes), and `current_bid_chf` / `bid_count` are denormalised from `bid` so lists need no join. `AuctionClose` sets `SOLD` (with bids) or `ENDED` every 30 s.
- `bid`: one private maximum per row (`listing_id`, bidder subject + name snapshot, `max_chf`, `created_at`). Maxima are never returned by the API; the visible price history is replayed from them in insert order (proxy bidding, earlier wins on equal maxima).
- Nullable `listing.seller_id` and `seller_name` store the verified Better Auth subject and a display-name snapshot at publication. Existing demos retain null sellers. Auth owns the separate `auth` schema, with no cross-schema user foreign key.
- `photo`: uploaded listing photos (content type, and either the S3 `storage_key` or, for older rows and local dev without S3 credentials, the bytes in `data`) with the uploading seller's subject. `listing_id` stays null until the photo is published with a listing; `listing.image_url` then points at `/api/photos/{first photo id}`. Only published photos are served; unpublished draft photos are deleted by `PhotoCleanup` after 24 hours (and right away when the AI draft fails). JPEG and PNG uploads are re-encoded to drop EXIF metadata.
- `clearance_project`: a company's office clearance (owner = Better Auth subject, no cross-schema FK; postcode, locality, deadline, chosen `route` null until chosen).
- `clearance_item`: inventory line of a project (name, category, quantity + `quantity_confirmed`, condition, notes, estimated unit price in CHF, nullable `unit_price_chf` the company set; publishing requires it). `listing_id` is set when the item is published as a listing; the item status DRAFT/LISTED/SOLD is derived from it and the listing's status, not stored.

## Migrations so far

| Version | What |
|---|---|
| V1 | `app_user`, plus an example table `listing` |
| V2 | drops `listing` again |
| V3 | drops `app_user` (login removed) |
| V4 | listing content and attributes, with the existing contract demos |
| V5 | nullable seller identity/name on listing |
| V6 | `listing.status` (default `AVAILABLE`) and 20 demo listings (ids 1001–1020) |
| V7 | `photo` (listing photos, optional link to a listing) |
| V9 | `clearance_project`, `clearance_item` (business clearance); there is no V8 |
| V10 | 11 SOLD demo sales for price evidence, ids 1101–1111 (Dell U2719D, iMac 18,3) |
| V11 | nullable `brand`, `model` on `clearance_item` (used for price evidence and published listing attributes) |
| V12 | nullable `latitude`, `longitude` on `listing` (postcode centroid from swisstopo, set when a listing is published; demo listings backfilled) |
| V13 | `photo.storage_key` (S3 object key for new photos); `photo.data` nullable, kept for older rows |
| V14 | nullable `unit_price_chf` on `clearance_item` (the company's price per piece, used when publishing) |
| V15 | 90 fictional demo listings for the buying assistant (ids 1201–1290, with attributes and postcode centroids) |
| V16 | index on `listing (status, created_at desc)` for the search |
| V17 | auctions: `listing.sale_mode`, `ends_at`, `current_bid_chf`, `bid_count`; table `bid`; 4 demo auctions (ids 1301–1304) ending 3 h to 5 days after the migration ran — reseed (or publish new auctions) once they are over |
| V18 | 300 messy fictional demo listings for search evaluation (ids 2301–2600, with attributes and postcode centroids) |
| V19 | `image_url` for the V18 demo listings that have an AI-generated photo in `frontend/public/demo/<id>.jpg` |
| V20 | 200 more messy demo listings (ids 2601–2800) and 60 SOLD price-evidence listings (ids 2801–2860), with attributes and postcode centroids |

## Backups

On the app hosts the database container carries the label `backup.dump: postgres`: a `pg_dumpall` every night at 01:30 into `/srv/apps/hackaton/dumps/` (7 kept), then the whole VM goes to PBS.
