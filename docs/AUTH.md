# Better Auth and API identity

Better Auth 1.7.12 runs in `auth/` on Node 24. It owns email/password accounts and sessions in the Postgres `auth` schema. The Java backend never stores account passwords or sessions.

## Local setup

Start the existing local Postgres service (`docker compose up -d db`). In `auth/`:

```sh
pnpm install
pnpm setup
pnpm dev
```

`pnpm setup` creates a gitignored `.env` with a random secret, without printing it. It preserves an existing file. Configuration:

| Variable | Local value |
|---|---|
| `BETTER_AUTH_SECRET` | Generated locally; at least 32 random characters |
| `BETTER_AUTH_URL` | `http://localhost:4200`, the public frontend origin |
| `DATABASE_URL` | `postgres://hackaton:hackaton@localhost:5432/hackaton` |
| `PORT` | `3000` |

The service creates schema `auth` and applies Better Auth's own migrations before listening. `pnpm migrate` applies the same migrations explicitly. An advisory lock serializes concurrent startup migrations. Flyway continues to manage only the backend's public schema.

Start the backend and Angular as described in the README. Angular proxies `/api/auth` to Node before the broader `/api` rule.

`pnpm seed` creates `test@example.com` / `LocalTest123!` with the name Local Test User, only against loopback development origins/databases. It preserves existing users and never runs automatically. Better Auth uses its built-in salted scrypt password hashing.

The older experimental session PR used a different Flyway V4. Do not delete or rewrite an existing database to switch branches. Use a fresh development database/volume for this implementation if V4 from PR #29 was applied, and point both services at that database.

## Contract

- `POST /api/auth/sign-up/email`: JSON `{name,email,password}`.
- `POST /api/auth/sign-in/email`: JSON `{email,password}`.
- `GET /api/auth/get-session`: current session, using the HttpOnly auth cookie.
- `GET /api/auth/token`: a short-lived API JWT for an authenticated session.
- `GET /api/auth/jwks`: public verification keys.
- `POST /api/auth/sign-out`: revoke the auth session.

Cookie sessions stay inside Better Auth, with origin/CSRF checks enabled. API JWTs use RS256, public origin as issuer, `hackaton-api` as audience, five-minute expiry, and `sub`, `name`, `email` identity claims. Private signing keys remain encrypted in Better Auth's schema. Rate limits use the database.

Passwords are 12–128 characters. Email verification, password reset and social login are outside the current HAC-32 scope, so no mail server is required.
