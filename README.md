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
| `backend/` | Java 25, Spring Boot 4.1, Maven. Postgres via Spring Data JPA, Flyway migrations |
| `frontend/` | Angular 22, served by nginx. Reads `/config.json` at start, so one image runs in every environment |
| `docker-compose.yml` | Postgres for local development, started by the backend on `spring-boot:run` |
| `.github/workflows/ci.yml` | every pull request: `mvn verify`, `ng lint`, `ng test`, `ng build` |
| `.github/workflows/deploy.yml` | builds the images and writes the hosts' `.env` |
| `docs/DATA-MODEL.md` | tables and migration rules |

API:

| Endpoint | |
|---|---|
| `GET /api/info` | environment, release, commit |
| `GET /actuator/health` | health check |
| `/api/docs` | OpenAPI UI |

There is no login: every endpoint is public. New controllers go under `/api/...` so they reach the backend.

## Run it locally

Needs JDK 25, Node 24.15+ (or 22.22.3+) and Docker.

```bash
cd backend && ./mvnw spring-boot:run       # API on :8080, starts Postgres from docker-compose.yml
cd frontend && pnpm install && pnpm start         # http://localhost:4200, /api is proxied to :8080
```

### IntelliJ

`.run/` holds shared run configurations: `backend` (Maven `spring-boot:run`), `frontend` (`pnpm start`) and `dev` (both at once). They contain no machine-specific paths, so each developer sets these once in their own IDE (`.idea/` isn't committed):

- **Project SDK**: *File → Project Structure → Project → SDK* = a JDK 25. Without it `backend` fails with "Project JDK is not specified".
- **Node interpreter**: *Settings → Languages & Frameworks → Node.js* = Node 24.15+ (or 22.22.3+). `frontend` uses the project's interpreter.
- **Docker** must be running: the backend starts Postgres from `docker-compose.yml` on boot.
- Optional: right-click `backend/pom.xml` → *Add as Maven Project* for Java code completion.

On a cold start the frontend is ready before the backend, so the first `/api` calls log `http proxy error ... ECONNREFUSED`. Reload the page once the backend logs `Started HackatonApplication`.

For a personal variant (other port, env vars), copy a configuration and leave *Store as project file* unchecked, so it doesn't end up in `.run/`.

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
