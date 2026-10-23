# Data model

Postgres 16. The schema is owned by **Flyway**: `backend/src/main/resources/db/migration/V<n>__<what>.sql`. Hibernate only validates it (`ddl-auto: validate`), so a new column needs a migration and a corresponding change to its entity.

Rules:

- Never edit a migration that has run somewhere (staging counts). Add the next number instead.
- Keep the SQL portable: tests run on H2 in PostgreSQL mode (`application-test.yml`).
- Update this file in the same pull request.

## Tables

| Table | Purpose |
|---|---|
| `app_user` | Identity ID, unique normalized email, PBKDF2 password hash, display name, optional location/canton, private contact preference and creation timestamp |
| `spring_session` | Spring Session JDBC metadata, principal email and idle expiry |
| `spring_session_attributes` | Serialized security context and CSRF state; cascades when a session is deleted |

`app_user.reset_token_hash` stores only the SHA-256 digest of a cryptographically random recovery token. `reset_expires_at` limits it to 30 minutes. A newer request replaces the previous token; successful recovery clears both fields and revokes all sessions. Tokens are consumed under a row lock.

Contact preferences are `IN_APP` and `EMAIL`; canton is null or one of the 26 canonical two-letter codes. Email/password fields are excluded from public profile serialization except the account email on the authenticated `/me` endpoint. There is no public user directory.

Accounts use the `Account` JPA entity and Spring Data repository. Future listings should reference `app_user.id` and derive ownership from the authenticated principal, never from a submitted owner ID. Authenticated access alone does not authorize editing another user's listing.

Spring Session's schema initialization is disabled: its tables are also managed by Flyway. The next migration after this branch is V5; coordinate numbering with other feature branches before merging.

## Migrations so far

| Version | What |
|---|---|
| V1 | `app_user`, plus an example table `listing` |
| V2 | drops `listing` again |
| V3 | drops `app_user` (login removed) |
| V4 | real accounts, recovery tokens, private profiles and persistent Spring Session tables |

## Backups

On the app hosts the database container carries the label `backup.dump: postgres`: a `pg_dumpall` every night at 01:30 into `/srv/apps/hackaton/dumps/` (7 kept), then the whole VM goes to PBS.
