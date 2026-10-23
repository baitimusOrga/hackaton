# hackaton

Monorepo, two images: a **Spring Boot** API (`backend/`) and an **Angular** app (`frontend/`), deployed on the homelab app platform.

| | Staging | Prod |
|---|---|---|
| URL | https://hackaton-staging.absent.one (not indexed) | https://hackaton.absent.one |
| Deploys | every push to `main` | every tag `v*` (the image that ran on staging, not rebuilt) |
| Settings | repo secrets/variables `STAGING_*` | `PROD_*` |

One hostname per environment: `/api/*` and `/actuator/*` go to the backend, everything else to the frontend. So the frontend calls `/api/...` on its own origin: no CORS, no second hostname.

## Stack

| Part | What |
|---|---|
| `backend/` | Java 21, Spring Boot 4.1 (Maven), Spring Data JPA + Postgres 16, Flyway migrations, Spring Security with JWT (email + password), OpenAPI UI, Anthropic Java SDK |
| `frontend/` | Angular 22 (standalone components, signals), served by nginx; runtime `config.json` so one image runs everywhere |
| `docker-compose.yml` | local Postgres |
| `.github/workflows/ci.yml` | every PR: `mvn verify`, `ng lint`, `ng test`, `ng build` on the homelab runners |
| `.github/workflows/deploy.yml` | images + `.env` for staging/prod (platform workflows) |
| `docs/DATA-MODEL.md` | tables and migration rules |

What's in the skeleton: register / login, listings with image upload, list and detail pages, demo seed data, and one AI endpoint (`POST /api/ai/describe`: Claude writes a listing description; the key stays on the server).

## Run it locally

Needs JDK 21, Node 24.15+ (or 22.22.3+) and Docker.

```bash
docker compose up -d                       # Postgres on localhost:5432
cd backend && ./mvnw spring-boot:run       # API on :8080, migrations + demo data on first start
cd frontend && npm ci && npm start         # http://localhost:4200, proxies /api to :8080
```

- Log in as `demo@example.com` / `demo12345`, or register.
- API docs: http://localhost:8080/api/docs (Authorize with the token from `/api/auth/login`).
- AI features locally: `export ANTHROPIC_API_KEY=...` before starting the backend (see `.env.example`). Without a key they answer 503 and the rest works.
- Reset the database: `docker compose down -v`.

Tests: `cd backend && ./mvnw verify` (H2, no Docker needed) and `cd frontend && npx ng lint && npx ng test`.

## Working together

1. Branch from `main`, open a pull request. CI must be green.
2. **Squash merge** (the only merge type enabled). The branch is deleted after the merge.
3. `main` is on staging about two minutes later. Check it there.
4. Release: `git tag v0.2.0 && git push origin v0.2.0` → prod within a minute.
5. Rollback: *Actions → deploy → Run workflow*, `promote` = an older tag.

Database change? New file `backend/src/main/resources/db/migration/V<next>__<what>.sql`, never edit an old one (see `docs/DATA-MODEL.md`).

## Secrets and settings

Everything the containers need on staging/prod lives in this repo's **Settings → Secrets and variables → Actions**, prefixed with the environment. The deploy workflow turns them into the host's `.env` (encrypted with the host's key on the way, platform `env-sync.yml`):

| Name in GitHub | Becomes | Kind |
|---|---|---|
| `STAGING_POSTGRES_PASSWORD`, `PROD_POSTGRES_PASSWORD` | `POSTGRES_PASSWORD` | secret |
| `STAGING_JWT_SECRET`, `PROD_JWT_SECRET` | `JWT_SECRET` | secret |
| `STAGING_ANTHROPIC_API_KEY`, `PROD_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | secret (optional) |
| `STAGING_APP_SEED_DEMO_PASSWORD` | `APP_SEED_DEMO_PASSWORD` | secret |
| `STAGING_APP_SEED_DEMO` = `true`, `PROD_APP_SEED_DEMO` = `false` | `APP_SEED_DEMO` | variable |
| `STAGING_LLM_MODEL`, `PROD_LLM_MODEL` | `LLM_MODEL` | variable (optional) |

Add or change one (the value is read from the terminal, never shown):

```bash
gh secret set STAGING_MY_KEY --repo baitimusOrga/hackaton
```

Then *Actions → deploy → Run workflow* with `sync` = `staging` (or `prod`), or just push. GitHub doesn't run anything when only a secret changes. The backend sees new values after its container is recreated, which deploy-sync does by itself when the `.env` changed. A new name also has to be read somewhere: Spring maps `MY_KEY` to `my.key` / `${MY_KEY}` in `application.yml`.

Values must not contain `'` or line breaks. Use the same name with both prefixes when staging and prod need it.

Don't change `*_POSTGRES_PASSWORD` once the environment runs: Postgres only reads it when the database is first created, so the backend would lose its connection. Rotating it needs an `ALTER USER` in the database first.

## Adding an AI feature

Copy `backend/.../ai/AiController.java`: it builds the Anthropic client from `ANTHROPIC_API_KEY`, calls Claude (`LLM_MODEL`, default `claude-opus-5-5`) and maps errors to HTTP codes. Keep keys and prompts on the server; the frontend only calls `/api/ai/...`.

## Where things run

- Images: `registry.srv.home.arpa/hackaton-backend` and `hackaton-frontend`, built by `baitimusOrga/platform` `docker-app.yml`.
- Compose files: `baitimusOrga/deployments` → `apps-staging/hackaton/`, `apps-prod/hackaton/`.
- Postgres runs next to the app on each host (private network, nightly dump). Uploaded images: volume `uploads`.
- Health: `/actuator/health`. Running release: `/api/info`.
