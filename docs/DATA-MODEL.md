# Data model

Postgres 16. The schema is owned by **Flyway**: `backend/src/main/resources/db/migration/V<n>__<what>.sql`. Hibernate only validates it (`ddl-auto: validate`), so a new column needs a migration *and* the field in the entity.

Rules:

- Never edit a migration that has run somewhere (staging counts). Add the next number instead.
- Keep the SQL portable: tests run on H2 in PostgreSQL mode (`application-test.yml`).
- Update this file in the same pull request.

## Tables

| Table | Entity | Columns |
|---|---|---|
| `app_user` | `user/User.java` | `id` (identity), `email` (unique, stored lower-case), `password_hash` (bcrypt, never returned by the API), `display_name`, `created_at` |

`user` is a reserved word in Postgres, hence `app_user`.

## Migrations so far

| Version | What |
|---|---|
| V1 | `app_user`, plus an example table `listing` |
| V2 | drops `listing` again |

## Backups

On the app hosts the database container carries the label `backup.dump: postgres`: a `pg_dumpall` every night at 01:30 into `/srv/apps/hackaton/dumps/` (7 kept), then the whole VM goes to PBS.
