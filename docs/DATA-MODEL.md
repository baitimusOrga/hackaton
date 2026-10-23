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

Photo storage/linking (HAC-20) remains separate work.

## Migrations so far

| Version | What |
|---|---|
| V1 | `app_user`, plus an example table `listing` |
| V2 | drops `listing` again |
| V3 | drops `app_user` (login removed) |
| V4 | listing content and attributes, with the existing contract demos |
| V5 | nullable seller identity/name on listing |
| V6 | `listing.status` (default `AVAILABLE`) and 20 demo listings (ids 1001–1020) |

## Backups

On the app hosts the database container carries the label `backup.dump: postgres`: a `pg_dumpall` every night at 01:30 into `/srv/apps/hackaton/dumps/` (7 kept), then the whole VM goes to PBS.
