## Goal
<!-- User-visible outcome in one sentence. -->

## Scope
- In:
- Out:

## API contract (label `API Contract` if backend + frontend both touch it)
- Endpoint: `METHOD /api/...`
- Request:
- Response:
- Errors (Problem Details):

## Backend tasks
- [ ] Flyway migration / entity
- [ ] Repository, service, controller under `/api/...`
- [ ] Tests (`mvn verify`)

## Frontend tasks
- [ ] Service + types matching the contract
- [ ] Component / route
- [ ] Tests (`ng test`), lint (`ng lint`)

## Split for parallel work
Pair: `Pair-A` / `Pair-B` (same label on both sub-issues)

| Sub-issue | Area | Size | Flyway range | Depends on |
|---|---|---|---|---|
| Backend | Backend | | V1xx (A) / V2xx (B) | |
| Frontend | Frontend | | n/a | |

## Acceptance criteria
- [ ]
