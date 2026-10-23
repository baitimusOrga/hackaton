---
name: create-tickets
description: Use when asked to write or plan Linear issues for the hackaton repo — "erstelle Tickets für X", "plane das Feature", "teile das in Issues auf", "mach daraus Linear-Issues". Turns an idea or feature into small, checkable issues (one PR each) in team HAC, with labels and blocking relations, after the user approved the list. Writes no code.
---

# create-tickets — idea → Linear issues an agent can finish

The job ends at **issues in Linear, approved by the user**. No code, no branch, no delegation
to Cyrus: a human releases an issue by moving it to Todo or delegating it.

## 1. Understand

- Read what the request points to: the conversation, `docs/PRODUCT-PLAN.md` (only the section
  that matters), and the code in scope (`AGENTS.md`, the `hackaton-architecture` skill).
- Unclear goal, data or behaviour → ask the user before writing issues. Don't fill gaps with
  guesses; an agent will build exactly what the issue says.

## 2. Slice

- **One issue = one PR = at most half a day.** Size S (< 1 h) or M (1–3 h); an L gets split.
- **Shared base first:** layout, navigation, a common entity everything needs. Features that
  depend on it are `blockedBy` it.
- **A feature that needs a new endpoint** becomes a parent issue (label `Feature`) with
  sub-issues:
  1. **API contract** (`Backend`, `API Contract`): DTO records, controller returning fixed
     sample data, `openapi.json` + generated client. Small and merged first.
  2. **Backend** (`Backend`): migration, entity, repository, real logic, tests. `blockedBy` 1.
  3. **Frontend** (`Frontend`): page against the generated client. `blockedBy` 1, not 2.
- Two issues in flight never touch the same feature package or page.
- Migrations: no reserved numbers; the PR takes the next free `V<n>` on `origin/main`.

## 3. Write each issue

Title in English, imperative, what the user gets ("Show listing detail page"). Description
with the template from `docs/LINEAR.md` (Goal, Acceptance criteria, Scope, Not in scope,
How to check). For an API contract issue, put the endpoint, request and response records
and the Problem Details errors under Scope; the backend and frontend issues link to it.

Acceptance criteria are checkable: a request and its response, a screen and its state, a
test. "Works well" or "looks nice" is not a criterion.

Labels: one Area (`Backend`, `Frontend`, `Shared`, `Infra/CI`, `Docs`), one Size, plus
`Feature` / `Bug` / `Improvement` and `API Contract` where they fit. Model for Cyrus: add
`[model=haiku]` to the description for mechanical S issues, `[model=opus]` for tricky logic;
otherwise nothing (Sonnet).

## 4. Show, then create

Show the plan as one table and wait for the user's OK:

| # | Title | Area | Size | Blocked by | Parent | Model |
|---|---|---|---|---|---|---|

On OK, create with the Linear MCP (`save_issue`, team `HAC`), state **Backlog** unless the
user says Todo. Create parents and blockers first so later issues can reference their IDs
(`parentId`, `blockedBy`). Then list the created IDs with their links.

## Rules

- Nothing the user didn't approve goes into Linear.
- Scope only what was asked; ideas noticed on the way go into a separate Backlog issue or
  the reply, not into the acceptance criteria.
- Never set an assignee or delegate unless the user asks.
