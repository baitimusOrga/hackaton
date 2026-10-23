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

## Angular

The injectable Better Auth client uses the page's own origin. Login/registration return to a validated internal `returnUrl` (default `/`), and `/sell` checks the server session before entry. The API interceptor fetches `/api/auth/token`, shares concurrent requests and caches the JWT in memory until 30 seconds before expiry. It never attaches tokens to auth endpoints or external URLs.

A backend 401 clears local auth state and redirects to login without the global error banner. Logout clears the in-memory JWT and revokes the Better Auth session. As with other stateless JWT setups, a previously issued token remains cryptographically valid until its five-minute expiry; it is not persisted in browser storage.

## Spring resource server

`AUTH_JWKS_URI` defaults to `http://localhost:3000/api/auth/jwks`; `AUTH_ISSUER` defaults to `http://localhost:4200`. Set the issuer to the exact public auth origin in staging and in custom local setups. The audience is `hackaton-api`, and the accepted signing algorithm is pinned to RS256. Signature, issuer, audience, subject and token times are checked.

API authentication is stateless. Reads stay public; listing/draft creation requires a verified bearer token. Missing/invalid tokens return 401 Problem Details with “Please log in.” Controllers receive a `CurrentUser` record resolved from the verified JWT. No auth service is needed to run normal backend tests; JWKS is fetched lazily when a real bearer token is received.

## Staging rollout (HAC-34)

The auth deploy job builds `hackaton-auth:staging` on main pushes only. Auth CI runs the build and integration suite against an isolated Postgres service. Production auth promotion is a separate rollout.

Merge the auth service and deployment workflow first, wait for the auth image, then sync staging environment secrets and merge deployments PR #2. `STAGING_BETTER_AUTH_SECRET` is configured in the application repository; its value must remain stable after rollout. The shared environment sync removes the `STAGING_` prefix. Compose requires `BETTER_AUTH_SECRET` and routes `/api/auth` to auth at priority 200, ahead of Spring's `/api` route at 100. Spring reads JWKS internally from `http://auth:3000/api/auth/jwks` and validates the public staging origin as issuer.

Deploy the login UI before JWT-protected writes. Verify signup, signin, `/api/auth/token`, `/api/auth/jwks`, anonymous write 401, authenticated publication and seller detail on staging. PRs being green does not confirm this live acceptance check.
