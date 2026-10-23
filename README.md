# hackaton

Monorepo with two images: a **Spring Boot** API (`backend/`) and an **Angular** app (`frontend/`).

| | Staging | Prod |
|---|---|---|
| URL | https://hackaton-staging.absent.one | https://hackaton.absent.one |
| Deploys | every push to `main` | every tag `v*` |
| Settings | repo secrets/variables `STAGING_*` | `PROD_*` |

Both run on one hostname each: `/api/*` and `/actuator/*` go to the backend, everything else to the frontend. The frontend calls `/api/...` on its own origin, so there is no CORS setup.

## What's there

| Path | Contents |
|---|---|
| `backend/` | Java 21, Spring Boot 4.1, Maven. Postgres via Spring Data JPA, Flyway migrations, Spring Security with JWT |
| `frontend/` | Angular 22, served by nginx. Reads `/config.json` at start, so one image runs in every environment |
| `docker-compose.yml` | Postgres for local development |
| `.github/workflows/ci.yml` | every pull request: `mvn verify`, `ng lint`, `ng test`, `ng build` |
| `.github/workflows/deploy.yml` | builds the images and writes the hosts' `.env` |
| `docs/DATA-MODEL.md` | tables and migration rules |

API:

| Endpoint | Auth | |
|---|---|---|
| `POST /api/auth/register` | — | `{email, password, displayName}` → `{token, user}` |
| `POST /api/auth/login` | — | `{email, password}` → `{token, user}` |
| `GET /api/auth/me` | token | the logged-in user |
| `GET /api/info` | — | environment, release, commit |
| `GET /actuator/health` | — | health check |
| `/api/docs` | — | OpenAPI UI |

Every other `/api` route requires `Authorization: Bearer <token>` by default (`config/SecurityConfig.java`). The frontend stores the token after login and adds the header to its API calls (`auth.ts`); `authGuard` protects routes.

## Run it locally

Needs JDK 21, Node 24.15+ (or 22.22.3+) and Docker.

```bash
docker compose up -d                       # Postgres on localhost:5432
cd backend && ./mvnw spring-boot:run       # API on :8080
cd frontend && npm ci && npm start         # http://localhost:4200, /api is proxied to :8080
```

Tests: `cd backend && ./mvnw verify` (H2, no Docker needed) and `cd frontend && npx ng lint && npx ng test`.

Reset the local database: `docker compose down -v`.

## Workflow

1. Branch from `main`, open a pull request, wait for CI to pass.
2. Squash merge (the only merge type enabled). The branch is deleted afterwards.
3. `main` is on staging about two minutes later.
4. Release: `git tag v0.2.0 && git push origin v0.2.0` → prod within a minute, same image as staging.
5. Rollback: *Actions → deploy → Run workflow*, `promote` = an older tag.

Database change: new file `backend/src/main/resources/db/migration/V<next>__<what>.sql`, never edit an old one.

## Secrets and settings

Staging and prod get their environment from this repo's *Settings → Secrets and variables → Actions*. Every `STAGING_<NAME>` / `PROD_<NAME>` secret or variable becomes `<NAME>` in that host's `.env`:

| Name | Used for |
|---|---|
| `STAGING_POSTGRES_PASSWORD`, `PROD_POSTGRES_PASSWORD` | database |
| `STAGING_JWT_SECRET`, `PROD_JWT_SECRET` | signing login tokens |

Add or change one (the value is read from the terminal):

```bash
gh secret set STAGING_MY_KEY --repo baitimusOrga/hackaton
```

Then run *Actions → deploy → Run workflow* with `sync` = `staging` (or `prod`): GitHub doesn't run anything when only a secret changes. The backend restarts with the new value within a minute. Spring reads `MY_KEY` as `${MY_KEY}` in `application.yml`.

- Values must not contain `'` or line breaks.
- Don't change `*_POSTGRES_PASSWORD` once an environment runs: Postgres only reads it when the database is created.

## Where things run

- Images: `registry.srv.home.arpa/hackaton-backend` and `hackaton-frontend`.
- Compose files: `baitimusOrga/deployments` → `apps-staging/hackaton/`, `apps-prod/hackaton/`.
- Postgres runs next to the app on each host, with a nightly dump.
