# hackaton

Zentral Hack 2026, challenge "Bring your own challenge" (Suva).

## The project

_To fill in at the hackathon._

| | |
|---|---|
| Problem | _what hurts today, for whom_ |
| Target group | _who uses it_ |
| Solution | _one or two sentences_ |
| Business model | _how it earns money or sustains itself_ |
| Demo | https://hackaton-staging.absent.one |

### Demo accounts

For the demo and testing on staging and prod (`/login`). Demo data only — no real personal data, and
change the password before the repository is shared beyond the team and jury.

| Email | Display name | Password |
|---|---|---|
| janis@hackathon.ch | Janis | `SeedGenerator123!` |
| ryan@hackathon.ch | Ryan | `SeedGenerator123!` |
| levin@hackathon.ch | Levin | `SeedGenerator123!` |
| cyrus@hackathon.ch | Cyrus | `SeedGenerator123!` |

### Progress during the hackathon

Everything after the tag `hackathon-start` was built during the event: `git diff hackathon-start..main`.

- _feature, PR link_

### User feedback

- _who tried it, what they said, what we changed_

### Next steps

- _..._

## Prepared before the hackathon

No product code existed at the start (tag `hackathon-start`). Prepared in advance:

- Project template: Spring Boot + Angular monorepo, Postgres, Docker images, CI, staging and prod deploys.
- Setup: Problem Details error handling, generated API client, Tailwind, Lombok, Prettier check.
- Agent workflow: rules for coding agents (`AGENTS.md`, `docs/LEAN-CODE.md`), Linear issue flow (`docs/LINEAR.md`).
- Product idea: `docs/PRODUCT-PLAN.md`.

## AI and open source

AI tools used during development:

| Tool | Used for |
|---|---|
| Claude Code (Anthropic) | writing code, tests and docs, reviewing pull requests |
| Codex (OpenAI) | writing code, reviewing pull requests |
| Cyrus (self-hosted) | runs Claude Code on Linear issues and opens pull requests |

Every AI change went through a pull request that a team member reviewed and merged.
AI features in the product itself: _model / API, what data is sent to it_.

Open-source components:

| Component | License |
|---|---|
| Spring Boot, Spring Data JPA, springdoc-openapi, Flyway | Apache-2.0 |
| Lombok | MIT |
| PostgreSQL | PostgreSQL License |
| H2 (tests only) | MPL-2.0 / EPL-1.0 |
| Angular, Tailwind CSS, ng-openapi-gen, Vitest, ESLint, Prettier | MIT |
| nginx | BSD-2-Clause |
| Better Auth | MIT |
| Cyrus | MIT |
| Ponytail (basis of `docs/LEAN-CODE.md`) | MIT |

## Technical setup

Monorepo with a **Spring Boot** API (`backend/`), **Angular** frontend (`frontend/`) and **Better Auth** service (`auth/`).

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
| `auth/` | Node 24, Better Auth email/password sessions and RS256 JWTs; owns the Postgres `auth` schema |
| `docker-compose.yml` | Postgres for local development, started by the backend on `spring-boot:run` |
| `.github/workflows/ci-*.yml` | pull requests, only for the side they touch: `mvn verify`; `ng lint`, `ng test`, `ng build` |
| `.github/workflows/deploy.yml` | builds the images and writes the hosts' `.env` |
| `docs/DATA-MODEL.md` | tables and migration rules |

API:

| Endpoint | |
|---|---|
| `GET /api/info` | environment, release, commit |
| `GET /actuator/health` | health check |
| `/api/docs` | OpenAPI UI |

Better Auth owns `/api/auth/*`; Spring APIs stay under `/api/...`. See [authentication setup](docs/AUTH.md) for local secrets, migrations and the repeatable test account.

## Run it locally

Needs JDK 25, Node 24.15+ (or 22.22.3+) and Docker.

```bash
cd backend && ./mvnw spring-boot:run       # API on :8080, starts Postgres from docker-compose.yml
cd auth && pnpm install && pnpm setup && pnpm dev # auth on :3000, creates its own schema
cd frontend && pnpm install && pnpm start         # http://localhost:4200, /api is proxied to :8080
```

### IntelliJ

`.run/` holds shared run configurations: `backend` (Maven `spring-boot:run`), `frontend` (`pnpm start`), `dev` (both at once) and `backend tests` (`mvn verify`). They contain no machine-specific paths, so each developer sets these once in their own IDE (`.idea/` isn't committed):

- **Project SDK**: *File → Project Structure → Project → SDK* = a JDK 25. Without it `backend` fails with "Project JDK is not specified".
- **Node interpreter**: *Settings → Languages & Frameworks → Node.js* = Node 24.15+ (or 22.22.3+). `frontend` uses the project's interpreter.
- **Docker** must be running: the backend starts Postgres from `docker-compose.yml` on boot.

On a cold start the frontend is ready before the backend, so the first `/api` calls log `http proxy error ... ECONNREFUSED`. Reload the page once the backend logs `Started HackatonApplication`.

For a personal variant (other port, env vars), copy a configuration and leave *Store as project file* unchecked, so it doesn't end up in `.run/`.

Tests: `cd backend && ./mvnw verify` (H2, no Docker needed) and `cd frontend && npx ng lint && npx ng test`.

AI features need `ANTHROPIC_API_KEY=...` in `backend/.env` (gitignored, read by Spring; not a global shell variable, or Claude Code bills that key). Check it with `./mvnw test -Dtest=AiClientLiveTest -Dai.live=true`.

Reset the local database: `docker compose down -v`.

## Additions

- Tailwind CSS 4, Lombok (entities only), Spring DevTools.
- Errors are Problem Details (`application/problem+json`), shown by a global banner in the frontend.
- API client generated from OpenAPI: after an API change run `./mvnw verify` (backend) and `pnpm run api` (frontend), commit both.
- CI also checks Prettier (`pnpm run format`) and that spec and client are current.
- Root `pom.xml` so IntelliJ imports the backend as a Maven project.
- Linear + agents: [`docs/LINEAR.md`](docs/LINEAR.md), `/work-issue <ISSUE-ID>`.
- Agents: [`AGENTS.md`](AGENTS.md). Once per clone: `git config core.hooksPath .githooks` (blocks pushes to `main`).

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
| `STAGING_S3_BUCKET`, `STAGING_S3_ACCESS_KEY`, `STAGING_S3_SECRET_KEY` (same with `PROD_`) | photo bucket on cloudscale; `S3_ENDPOINT` (default Lausanne) and `S3_REGION` (`lpg`) only if they differ |

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
