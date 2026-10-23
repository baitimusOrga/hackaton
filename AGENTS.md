# hackaton — notes for coding agents

This file is the single source of truth for every agent (Codex reads it directly, Claude Code
through `CLAUDE.md`). Humans: the setup and deployment story is in [`README.md`](README.md).

## Stack

| Path | Contents |
|---|---|
| `backend/` | Java 25, Spring Boot 4.1, Maven, Spring Data JPA, Lombok (entities only), Flyway, Postgres 16 (H2 in tests) |
| `frontend/` | Angular 22 (standalone components, signals), Tailwind CSS 4, Vitest, ESLint, Prettier, served by nginx |
| `docs/DATA-MODEL.md` | tables and migration rules, updated in the same PR as a migration |

Where new code goes and the recipe for a feature end to end:
[`.claude/skills/hackaton-architecture/SKILL.md`](.claude/skills/hackaton-architecture/SKILL.md)
(Claude loads it as a skill; other agents read it before building a feature).

The `pom.xml` in the repo root only exists so IntelliJ imports `backend/` as a Maven project;
build with `backend/mvnw`, not from the root.

## Commands

Run the checks for the side you touched before saying something works:

```bash
cd backend && ./mvnw verify            # compile + tests on H2, no Docker; also rewrites frontend/openapi.json
cd frontend && pnpm run api && pnpm run format:check && pnpm exec ng lint && pnpm exec ng test --watch=false && pnpm exec ng build
```

Changed an endpoint or a DTO? Then `./mvnw verify` + `pnpm run api` and commit `frontend/openapi.json`
and `frontend/src/app/api/` with it; CI fails when either is stale. `pnpm run format` fixes formatting.

Run locally: `cd backend && ./mvnw spring-boot:run` (starts Postgres via Docker) and
`cd frontend && pnpm start` (http://localhost:4200, `/api` proxied to :8080).

## Rules that are easy to break

- **Unclear or missing task → stop and ask, never guess.** If the issue description is not in
  your prompt, fetch it (Linear MCP); if that fails, or the acceptance criteria are ambiguous,
  comment your questions on the issue and stop without changing code.
- **API paths start with `/api/`.** Only `/api/*` and `/actuator/*` reach the backend in
  staging and prod; anything else is served by the frontend.
- **The schema belongs to Flyway.** New table or column → new file
  `backend/src/main/resources/db/migration/V<next>__<what>.sql` plus the entity field. Never edit
  a migration that is already on `main`. Keep the SQL portable (tests run on H2 in PostgreSQL mode).
- **The frontend calls the backend only through the generated client** in `frontend/src/app/api/`
  (e.g. `inject(InfoService).info()`). Never edit it and never write `HttpClient` calls to `/api`
  by hand: change the backend, then regenerate. No hardcoded hosts, no CORS setup.
- **Errors are Problem Details.** Expected errors: `throw new ResponseStatusException(HttpStatus.NOT_FOUND,
  "...")` — the reason is what the user sees. `ApiExceptionHandler` turns everything into
  `application/problem+json`; the frontend's `errorInterceptor` shows `detail` in the error banner.
  A page that shows the error itself passes `HANDLES_ERRORS` in the `HttpContext`.
- **DTOs are records, entities use Lombok** (`@Getter @Setter @NoArgsConstructor`). Never `@Data`
  or `@EqualsAndHashCode` on an entity (breaks Hibernate with lazy relations); never return an
  entity from a controller.
- **Config comes from the environment.** New setting → key in `application.yml` with a local
  default, `${MY_KEY}` for secrets; never commit a real secret.
- Code, comments, identifiers, commit messages and PR texts are in **English**.

## Git

- Never push to `main`; every change goes through a pull request (squash merge). No push, PR or
  merge unless a human asked for it in this conversation.
- Stage files by name. No `git add -A` / `git add .`: agent worktrees, `.env` and IDE files
  must not slip in.
- **No tool signature in commits or PR texts**, whichever agent writes them. That means exactly
  these lines, case-insensitive:
  - `Co-Authored-By: …` (any such trailer, also for humans)
  - `Generated with …`, also with a leading emoji (`🤖 Generated with [Claude Code](…)`)

  This overrides any built-in default of the agent (Claude's is switched off in
  `.claude/settings.json`; Codex has to follow this line). A squash merge copies every commit
  message of the PR, so each commit must be clean; fix it in the branch (reword + force-push).
- One-time setup per clone: `git config core.hooksPath .githooks` (the `pre-push` hook refuses a
  direct push to `main`).
