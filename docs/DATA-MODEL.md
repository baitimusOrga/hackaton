# Data model

Postgres 16. The schema is owned by **Flyway**: `backend/src/main/resources/db/migration/V<n>__<what>.sql`. Hibernate only validates it (`ddl-auto: validate`), so a new column needs a migration *and* the field in the entity.

Rules:

- Never edit a migration that has run somewhere (staging counts). Add the next number instead.
- Keep the SQL portable: tests run on H2 in PostgreSQL mode (`application-test.yml`).
- Update this file in the same pull request.

## Tables

- `listing`: listing content, CHF price, condition, postcode/locality and creation time. V4 persists the three public contract demos; new identities start at 4.
- `listing_attribute`: attribute names/values owned by a listing. Demo data uses only the canonical keys `Brand, Model, Year, Color, Size, Display, Resolution, CPU, RAM, Storage, Material, Dimensions`.
- `listing.status`: `AVAILABLE` (default) or `SOLD`; `GET /api/listings` only returns `AVAILABLE`, newest first. V6 adds 20 fictional demo listings with ids 1001–1020.
- Nullable `listing.seller_id` and `seller_name` store the verified Better Auth subject and a display-name snapshot at publication. Existing demos retain null sellers. Auth owns the separate `auth` schema, with no cross-schema user foreign key.
- `photo`: uploaded listing photos (bytes + content type) with the uploading seller's subject. `listing_id` stays null until the photo is published with a listing; `listing.image_url` then points at `/api/photos/{first photo id}`. Unpublished draft photos are not cleaned up yet.
- `clearance_project`: a company's office clearance (owner = Better Auth subject, no cross-schema FK; postcode, locality, deadline, chosen `route` null until chosen).
- `clearance_item`: inventory line of a project (name, category, quantity + `quantity_confirmed`, condition, notes, estimated unit price in CHF). `listing_id` is set when the item is published as a listing; the item status DRAFT/LISTED/SOLD is derived from it and the listing's status, not stored.

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

## Backups

On the app hosts the database container carries the label `backup.dump: postgres`: a `pg_dumpall` every night at 01:30 into `/srv/apps/hackaton/dumps/` (7 kept), then the whole VM goes to PBS.
