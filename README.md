# Zweit

Zentral Hack 2026, Challenge «Bring your own challenge» (Suva).

**Fotografiere, was du verkaufen willst. Beschreibe, was du kaufen willst.** Zweit ist ein Schweizer
Secondhand-Marktplatz, auf dem die KI den mühsamen Teil übernimmt: Inserat schreiben, ehrlichen Preis
finden und unter vielen Inseraten die wenigen, die wirklich passen.

Demo: https://hackaton.absent.one/

## Das Projekt

| | |
|---|---|
| Problem | Etwas Gebrauchtes zu verkaufen dauert zu lange: genaues Modell herausfinden, Inserat schreiben, Preis schätzen. Viele lassen es bleiben, und brauchbare Dinge bleiben in der Schublade. Käufer haben das umgekehrte Problem: Die Stichwortsuche über unordentliche Inserate liefert Hüllen, Ladekabel und Defektes statt des gesuchten Geräts. |
| Zielgruppe | Privatpersonen in der Schweiz, die ab und zu etwas verkaufen, und Käufer, die ein bestimmtes Modell suchen. Start mit Elektronik: Handys, Laptops, Monitore, Konsolen, TVs. |
| Lösung | **Verkaufen per Foto:** Die KI erkennt den Artikel live, fragt nur nach, was sie auf dem Foto nicht sieht, und schlägt einen Preis mit Belegen aus vergleichbaren Inseraten vor. **Kaufen per Beschreibung:** Man schreibt in normaler Sprache, was man sucht (auch Schweizerdeutsch, Französisch, Italienisch). Der Kauf-Assistent macht daraus Anforderungen und zeigt passende Treffer, mögliche Treffer und Alternativen, jeweils mit Begründung. Dazu Festpreis-Kauf, Auktionen mit automatischem Bieten und eine Karte mit Umkreissuche nach PLZ. |
| Geschäftsmodell | **Konzept, im Prototyp noch nicht umgesetzt.** Siehe Abschnitt [Geschäftsmodell](#geschäftsmodell). |

## Geschäftsmodell

> **Noch nicht umgesetzt.** Der Prototyp verlangt heute keine Gebühren und wickelt keine Zahlung ab:
> Ein Kauf zum Festpreis oder ein Auktionszuschlag markiert das Inserat nur als verkauft, bezahlt wird
> ausserhalb der Plattform (`PurchaseController`: «no payment yet»).

Das Konzept baut auf dem auf, was heute schon funktioniert:

| Heute im Prototyp | Darauf baut das Geschäftsmodell auf |
|---|---|
| Inserieren per Foto mit KI-Entwurf und Preisvorschlag, gratis | Bleibt gratis, auch die KI-Funktionen. Gratis-Inserate bringen das Angebot, ohne das gibt es keinen Marktplatz. |
| Festpreis-Kauf und Auktionen, ohne Zahlung | **Geschützter Checkout:** Zahlung über Zweit mit Käuferschutz, das Geld wird erst nach bestätigter Übergabe freigegeben. Dafür fällt eine kleine Kommission an, deutlich tiefer als bei bestehenden Plattformen. Wer direkt bezahlt, zahlt nichts. |
| Als versendet markieren | **Abholung und Versand** als bezahlter Zusatz-Service, mit Partnern. |
| Kauf-Assistent und Suche in normaler Sprache | Bleibt für Käufer gratis. Später: **Werkzeuge für professionelle Verkäufer** (Massen-Upload, Statistiken) im Abo. |
| Firmen-Räumung im Produktplan, für die Demo entfernt (#76) | **Betreute Räumung von Firmeninventar** gegen Gebühr, später Ankauf ganzer Posten mit Weiterverkaufsmarge. |

Reihenfolge: zuerst der geschützte Checkout, weil er am heutigen Kaufablauf ansetzt und die einzige
Einnahme ist, die direkt mit jedem Verkauf wächst. Details: [`docs/PRODUCT-PLAN.md`](docs/PRODUCT-PLAN.md),
Abschnitte 12–15.

## Team

Vier Personen, keine Teamleitung: Entscheide fällen wir gemeinsam per Abstimmung, wie in einer Demokratie.
Gearbeitet wird über Linear-Issues und Pull Requests; jede Änderung kommt über einen Pull Request
auf `main`.

## Fortschritt während des Hackathons

Alles nach dem Tag `hackathon-start` ist am Event entstanden: `git diff hackathon-start..main`.
Rund 70 Pull Requests von 4 Personen, etwa 45'000 neue Zeilen (ein grosser Teil davon Demo-Daten und
der generierte API-Client). Die Nummern verweisen auf die Pull Requests in diesem Repository.

**Neu:**

- Login-Service (Better Auth, RS256-JWTs) und geschützte API (#38)
- KI-Anbindung mit strukturierten JSON-Antworten über die Anthropic-API (#28)
- Verkaufen per Foto: Live-Erkennung mit Markierungen, geführte Foto-Fragen, KI-Textverbesserung,
  Preis mit Belegen, Vorschau vor dem Veröffentlichen, Entwurf wiederherstellen
  (#39, #41, #53, #77, #78, #89, #101, #103)
- Kauf-Assistent: Suche in normaler Sprache, sortierte Treffer mit Begründung, Verfeinern per
  Nachfrage, in meiner Nähe (#41, #54, #81, #85, #98, #105, #106)
- Fotos auf S3 bei cloudscale, Metadaten werden beim Upload entfernt (#30, #47, #96)
- PLZ-Geokodierung über swisstopo und Umkreissuche (#44); OpenStreetMap-Karten auf Inseraten und
  in Discover (#46, #68, #84)
- Auktionen mit Laufzeit, automatischem Bieten und Live-Geboten (#57, #67)
- Festpreis-Kauf, als versendet markieren, meine Inserate und Käufe (#74, #83, #88, #90, #92)
- Eigenes Designsystem und Redesign (#49), Mobile-Layout mit Tab-Leiste (#87), Deutsch, Französisch,
  Italienisch und Englisch (#55)
- Demo-Daten: rund 800 erfundene, absichtlich unordentliche Inserate mit KI-generierten Fotos (#70, #94)

**Verbessert:**

- Security-Audit der ganzen App und die Fixes daraus: unveröffentlichte Fotos privat, Schutz gegen
  Prompt-Injection im Kauf-Assistenten, standardmässig alles gesperrt, CI auf GitHub-Runnern,
  gepinnte Actions ([`docs/security/2026-10-24-security-audit.md`](docs/security/2026-10-24-security-audit.md), #48)
- Content Security Policy und Caching für Staging und Prod (#50, #66, #100)

**Bewusst entfernt**, damit die Demo fokussiert bleibt: Firmen-Räumungsprojekte (#76),
Nachrichten-Platzhalter (#72), gespeicherte Suchen (#71).

## Nutzerfeedback

- **Sandra, Tele 1:** «Schönes Produkt. Intuitiv.»
- Interne Evaluation des Kauf-Assistenten: rund 50 selbst geschriebene Testfälle auf Deutsch,
  Schweizerdeutsch, Französisch und Englisch gegen die unordentlichen Demo-Daten, mit erwarteten und
  verbotenen Treffern ([`docs/testing/search-eval.md`](docs/testing/search-eval.md)).
- End-to-End-Testbefunde: [`docs/testing/2026-10-23-e2e-findings.md`](docs/testing/2026-10-23-e2e-findings.md).

## Nächste Schritte

- Chat zwischen Käufer und Verkäufer, Angebote und Kaufvereinbarung
- Geschützter Checkout mit Kommission und Bestätigung der Übergabe (erster Schritt zum Geschäftsmodell)
- Gespeicherte Suchen mit Benachrichtigung, sobald ein passendes Inserat erscheint
- Firmen-Räumung: Inventar in grossen Mengen erfassen, betreuter Verkauf, Kauf ganzer Posten
- Betrugserkennung und Verifizierung von Verkäufern
- Tests gegen Postgres in der CI (heute nur H2), damit datenbankspezifische Fehler vor Staging auffallen

## Vor dem Hackathon vorbereitet

Beim Start (Tag `hackathon-start`) gab es keinen Produktcode. Vorbereitet waren:

- Projektvorlage: Monorepo mit Spring Boot und Angular, Postgres, Docker-Images, CI, Deploys auf Staging und Prod
- Setup: Fehler als Problem Details, generierter API-Client, Tailwind, Lombok, Prettier-Check
- Arbeitsweise mit Coding-Agents: Regeln (`AGENTS.md`, `docs/LEAN-CODE.md`), Ablauf mit Linear-Issues (`docs/LINEAR.md`)
- Produktidee: `docs/PRODUCT-PLAN.md`

## KI und Open Source

KI-Werkzeuge in der Entwicklung:

| Werkzeug | Wofür |
|---|---|
| Claude Code (Anthropic) | Code, Tests und Doku schreiben, Pull Requests reviewen |
| Codex (OpenAI) | Code schreiben, Pull Requests reviewen |
| Cyrus (selbst gehostet) | lässt Claude Code Linear-Issues bearbeiten und Pull Requests öffnen |
| Google Jules | Performance-Pull-Request (#43, `.jules/`) |
| Claude Design (Anthropic) | Screen-Entwürfe für die Trefferseite (#98, `docs/design/`) |
| Gemini-Bildmodell («Nano Banana 2 Pro», Google) | die erfundenen Fotos der Demo-Inserate (`frontend/public/demo/`, Prompts in `docs/testing/demo-image-prompts.md`) |

Jede KI-Änderung lief über einen Pull Request, den ein Teammitglied geprüft und gemergt hat.

KI im Produkt selbst, alles über die Anthropic Messages API (`backend/.../ai/AiClient.java`):

| Modell | Wofür |
|---|---|
| Claude Sonnet 5.5 | Live-Erkennung des Artikels und Inserat-Entwurf, gestreamt während der Verkäufer Fotos hinzufügt |
| Claude Opus 5.5 mit Websuche | Produktfakten für den Entwurf des Verkäufers (Quellen werden im Code geprüft) |
| Claude Haiku 5.5 | Suchtext des Käufers in Anforderungen übersetzen, Treffer sortieren, Text des Verkäufers verbessern |

An Anthropic gehen: Fotos (ohne Metadaten) und Texte des Verkäufers, der Suchtext des Käufers und die
öffentlichen Felder der Kandidaten-Inserate. Keine Kontodaten. Jede Antwort wird über ein JSON-Schema
erzwungen und im Code geprüft.

Open-Source-Komponenten:

| Komponente | Lizenz |
|---|---|
| Spring Boot, Spring Data JPA, Spring Security, springdoc-openapi, Flyway | Apache-2.0 |
| AWS SDK for Java (S3-Client) | Apache-2.0 |
| RxJS, TypeScript | Apache-2.0 |
| Leaflet | BSD-2-Clause |
| OpenStreetMap-Kacheln und -Daten | ODbL (© OpenStreetMap-Mitwirkende) |
| swisstopo Geokodierungs-API | Geodaten des Bundes, Nutzungsbedingungen von swisstopo |
| Schrift Inter (@fontsource/inter) | SIL OFL-1.1 |
| node-postgres (pg), jose, tsx, jsdom, PostCSS | MIT |
| Lombok | MIT |
| PostgreSQL | PostgreSQL License |
| H2 (nur Tests) | MPL-2.0 / EPL-1.0 |
| Angular, Tailwind CSS, ng-openapi-gen, Vitest, ESLint, Prettier | MIT |
| nginx | BSD-2-Clause |
| Better Auth | MIT |
| Cyrus | MIT |
| Ponytail (Grundlage von `docs/LEAN-CODE.md`) | MIT |

## Demo-Accounts

Für Demo und Tests auf Staging und Prod (`/login`). Nur Demo-Daten, keine echten Personendaten.
Das gemeinsame Passwort liegt im Passwortmanager des Teams, nicht in diesem Repository.

| E-Mail | Anzeigename | Passwort |
|---|---|---|
| janis@hackathon.ch | Janis | siehe Passwortmanager |
| ryan@hackathon.ch | Ryan | siehe Passwortmanager |
| levin@hackathon.ch | Levin | siehe Passwortmanager |
| cyrus@hackathon.ch | Cyrus | siehe Passwortmanager |

### Bevor das Repository öffentlich wird

- [ ] Passwörter der Demo-Accounts auf Staging und Prod rotieren (das alte steht in der Git-History).
- [ ] PR-CI läuft auf GitHub-Runnern (`ci-*.yml`); nicht zurück auf die Homelab-Runner mit Docker-Socket
      verschieben, oder Freigabe für Workflows externer Mitwirkender verlangen.
- [ ] Die Platform-Workflows in `deploy.yml` auf einen Commit-SHA gepinnt lassen und den Diff beim Update prüfen.

---

_Technical documentation below is in English, like the code._

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
