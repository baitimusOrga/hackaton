---
name: linear-split-work
description: Read the Linear board (team HAC, Hackaton-zentralhack) and split open work per feature across two pairs (Pair-A, Pair-B), each running a backend and a frontend agent. Use when asked to plan the sprint, pick up work, distribute issues, or run several agents on the backlog.
---

# Split Linear work per feature

Team: **Hackaton-zentralhack** (key `HAC`), 4 people = 2 pairs. Each pair owns **whole features** (database to screen).
- `Pair-A` = backend person 1 + frontend person 1
- `Pair-B` = backend person 2 + frontend person 2

Labels: Area (Backend, Frontend, Infra/CI, Docs, Shared), Lane (Pair-A, Pair-B), Size (S/M/L), Blocked, API Contract.

## Issue structure
Each feature is a **parent issue** (template `docs/linear-templates/feature.md`) with sub-issues:
- one `Backend` sub-issue and one `Frontend` sub-issue, both carrying the parent's Pair label,
- the frontend sub-issue is `blockedBy` nothing but must follow the API contract written in the parent.

## Steps

1. **Read the board.** `mcp__linear-server__list_issues` for team HAC, states Backlog/Todo/In Progress, with labels and relations. Load tools via ToolSearch if deferred.
2. **Drop what is not startable:** `Blocked` issues, unfinished blockers, issues already In Progress.
3. **Shared first.** Issues labelled `Shared` (layout, error banner, base config, common DTOs) get one owner and run before any feature that depends on them.
4. **Normalize features.** Every feature needs: a parent issue, an API contract (endpoint, DTOs, Problem Details errors) in the parent, BE and FE sub-issues, and Size labels. Split any `L` into S/M.
5. **Assign pairs per feature**, not per layer. Both sub-issues of a feature get the same `Pair-*` label. Balance by Size (S=1, M=2, L=4) so pairs are within ~1 point.
6. **Flyway versions.** Reserve ranges to avoid collisions: Pair-A uses `V1xx`, Pair-B `V2xx`, Shared `V0xx`. Put the range in each backend sub-issue.
7. **Present the plan** (Pair | Feature | BE sub-issue | FE sub-issue | Size | Depends on | Order) and wait for confirmation before spawning agents.
8. **Run agents** after confirmation: per pair, one backend agent and one frontend agent, all launched in parallel in one message, each with `isolation: "worktree"`. Each prompt contains: its sub-issue list with full descriptions and the API contract, `gitBranchName` from Linear, checks (backend `cd backend && ./mvnw verify`; frontend `cd frontend && pnpm lint && pnpm test`), instruction to edit only its own area (backend agent never touches `frontend/` and vice versa), one PR per sub-issue, move issue to In Progress then In Review.
9. **Report:** per pair, features done, PR links, blockers. Update Linear states.

## Rules
- Never start `Blocked` issues.
- Backend and frontend agents of a pair work against the written contract; if it must change, update the parent issue first, then tell both.
- Shared files (layout, error banner, config) are only edited via `Shared` issues.
- Linear is the source of truth: every plan change is reflected in labels/relations.
