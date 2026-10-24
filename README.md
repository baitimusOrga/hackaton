# Zweit

Zentral Hack 2026, challenge "Bring your own challenge" (Suva).

**Photograph what you want to sell. Describe what you want to buy.** Zweit is a free Swiss
second-hand marketplace where AI does the tedious part of a trade: writing the listing, pricing it
honestly and finding the few listings that really match.

## The project

| | |
|---|---|
| Problem | Selling a used item takes too long: identify the exact model, write an advert, guess a price. Many people give up, so usable things stay in drawers. Buyers face the opposite: keyword search over messy listings returns cases, chargers and defective items instead of the device they want. |
| Target group | Private people in Switzerland who sell something occasionally, and buyers looking for a specific model (electronics first: phones, laptops, monitors, consoles, TVs). |
| Solution | Sell from a photo: the AI recognises the item live, asks only for what it can't see and proposes a price with evidence from comparable listings. Buy by describing what you want in plain language (also Swiss German, French, Italian): the buying assistant turns it into requirements and shows confirmed matches, possible matches and alternatives, each with a reason. Plus fixed-price purchase, timed auctions with proxy bidding, and a map with postcode radius search. |
| Business model | Listing and selling stay free, no commission (the main difference to existing platforms). Revenue from optional services: protected checkout, pickup/delivery, professional seller tools and, later, managed clearance of company equipment. Details: [`docs/PRODUCT-PLAN.md`](docs/PRODUCT-PLAN.md), sections 12–15. |
| Demo | https://hackaton-staging.absent.one |

### Demo accounts

For the demo and testing on staging and prod (`/login`). Demo data only — no real personal data.
The shared password is in the team password manager, not in this repository. It must be rotated
on prod (and staging) before the repository is shared beyond the team and jury.

| Email | Display name | Password |
|---|---|---|
| janis@hackathon.ch | Janis | see team password manager |
| ryan@hackathon.ch | Ryan | see team password manager |
| levin@hackathon.ch | Levin | see team password manager |
| cyrus@hackathon.ch | Cyrus | see team password manager |

### Before making the repository public

- [ ] Rotate the demo account passwords on staging and prod (the old one is in git history).
- [ ] PR CI runs on GitHub-hosted runners (`ci-*.yml`); do not move it back to the Docker-socket
      homelab runners, or require approval for workflows from outside collaborators.
- [ ] Keep the platform workflows in `deploy.yml` pinned to a commit SHA, and review the diff when bumping.

### Progress during the hackathon

Everything after the tag `hackathon-start` was built during the event: `git diff hackathon-start..main`.

About 70 pull requests, 4 people, roughly 45,000 added lines (much of it demo data and generated
API client). PR numbers refer to this repository.

**New:**

- Authentication service (Better Auth, RS256 JWTs) and protected API (#38)
- AI client with structured JSON answers on the Anthropic API (#28)
- Sell from a photo: live detection with boxes, guided photo questions, AI rewrite, price with
  evidence, preview before publishing, draft restore (#39, #41, #53, #77, #78, #89, #101, #103)
- Buying assistant: plain-language search, ranked confirmed/possible matches with reasons, refine
  by follow-up, near me (#41, #54, #81, #85, #98, #105, #106)
- Photo storage on S3 at cloudscale, metadata stripped on upload (#30, #47, #96)
- Postcode geocoding via swisstopo and radius search (#44); OpenStreetMap maps on listings and
  Discover (#46, #68, #84)
- Timed auctions with proxy bidding and live bidding (#57, #67)
- Fixed-price purchase, mark as shipped, my listings and trades (#74, #83, #88, #90, #92)
- Zweit design system and redesign (#49), mobile layout with tab bar (#87), DE/FR/IT/EN (#55)
- Demo data: 800 fictional, intentionally messy listings with AI-generated photos (#70, #94)

**Improved:**

- Security audit of the whole app and its fixes: unpublished photos private, prompt-injection
  guard in the buying assistant, deny-by-default authorization, CI on GitHub-hosted runners, pinned
  actions ([`docs/security/2026-10-24-security-audit.md`](docs/security/2026-10-24-security-audit.md), #48)
- Content Security Policy and caching for staging/prod (#50, #66, #100)

**Removed on purpose** to focus the demo: business clearance projects (#76), messages
placeholder (#72), saved searches (#71).

### User feedback

- Internal evaluation of the buying assistant: about 50 hand-written cases in German, Swiss German,
  French and English against the messy demo data, with expected and forbidden matches
  ([`docs/testing/search-eval.md`](docs/testing/search-eval.md)).
- End-to-end test findings: [`docs/testing/2026-10-23-e2e-findings.md`](docs/testing/2026-10-23-e2e-findings.md).
- _Hallway tests at the hackathon: who tried it, what they said, what we changed._

### Next steps

- Chat between buyer and seller, offers and sale agreements.
- Protected checkout and handover confirmation.
- Saved searches with notifications when a new listing matches.
- Business clearance: bulk intake of company equipment, managed selling, lot purchase.
- Fraud detection and seller verification.
- Tests against Postgres in CI (today only H2), so database-specific bugs show up before staging.

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
| Google Jules | performance pull request (#43, `.jules/`) |
| Claude Design (Anthropic) | screen designs for the find results page (#98, `docs/design/`) |
| Gemini image model ("Nano Banana 2 Pro", Google) | the fictional demo listing photos (`frontend/public/demo/`, prompts in `docs/testing/demo-image-prompts.md`) |

Every AI change went through a pull request that a team member reviewed and merged.

AI features in the product itself, all through the Anthropic Messages API (`backend/.../ai/AiClient.java`):

| Model | Used for |
|---|---|
| Claude Sonnet 5.5 | live item detection and listing draft, streamed while the seller adds photos |
| Claude Opus 5.5 with the web search tool | product facts for the seller's draft (sources checked in code) |
| Claude Haiku 5.5 | turning a buyer's search text into requirements, ranking matches, rewriting the seller's text |

Sent to Anthropic: the seller's photos (metadata stripped) and texts, the buyer's search text and the
candidate listings' public fields. No account data. Every answer is forced through a JSON schema and
checked in code.

Open-source components:

| Component | License |
|---|---|
| Spring Boot, Spring Data JPA, Spring Security, springdoc-openapi, Flyway | Apache-2.0 |
| AWS SDK for Java (S3 client) | Apache-2.0 |
| RxJS, TypeScript | Apache-2.0 |
| Leaflet | BSD-2-Clause |
| OpenStreetMap map tiles and data | ODbL (© OpenStreetMap contributors) |
| swisstopo geocoding API | free federal geodata service, terms of swisstopo |
| Inter font (@fontsource/inter) | SIL OFL-1.1 |
| node-postgres (pg), jose, tsx, jsdom, PostCSS | MIT |
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

Tests: `cd backend && ./mvnw verify` (H2, no Docker needed) and `cd frontend && pnpm exec ng lint && pnpm exec ng test --watch=false`.

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
