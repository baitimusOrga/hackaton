---
name: new-feature
description: Use when asked to build a new feature in the hackaton repo without a Linear issue — "/new-feature <description>", "build X", "add a Y page". Clarifies the request, implements it in its own git worktree, verifies it and opens a green pull request, then stops; merging stays with a human.
---

# new-feature — a feature request → one green PR

The job ends at an **open PR with green CI**. Never merge, never push to `main`, one feature
per run. A feature that has a Linear issue goes through `work-issue` instead.

## 1. Clarify — stop here if any of these fails

- The request names **what the user can do afterwards** and how to check it (a request, a
  screen state, a test). Vague ("make it nicer") → ask the concrete questions, change nothing.
- It fits **one PR** (roughly half a day). Bigger → propose a split, stop.
- Restate the scope in a few bullets, including what is **not** in it, and wait for a yes
  unless the user already gave clear criteria.

## 2. Worktree

Always a separate worktree, so the user's checkout stays untouched:

```bash
git fetch origin
git worktree add -b <short-slug> .claude/worktrees/<short-slug> origin/main
cd .claude/worktrees/<short-slug>
```

Do all work, checks and commits inside it. One feature, one branch.

## 3. Build

- Follow `AGENTS.md`, `docs/LEAN-CODE.md` and the `hackaton-architecture` skill (migration →
  entity → controller → spec → generated client → page).
- Do what was asked, nothing more. Things noticed on the way go into the PR text as
  follow-ups, not into the diff.
- A new migration takes the next free number on `origin/main` at the time of the PR.
- Every acceptance criterion gets a test where it can be tested (MockMvc for the backend,
  Vitest for the frontend).

## 4. Verify

Compare with `origin/main` (`git fetch && git diff origin/main...HEAD`), never a local `main`.
Run the checks from `AGENTS.md` for every side you touched and read the output. Then go
through the criteria one by one and note how each is met. One you could not verify is named
as such in the PR.

## 5. Pull request

Only after the user asked for it in this conversation. Stage files by name. Commit message
and PR text in English, **no `Co-Authored-By` and no "Generated with" line**.

```bash
git push -u origin <branch>
gh pr create --title "<what changed>" --body "<body>"
cd <repo root> && git worktree remove .claude/worktrees/<short-slug>
```

Free the worktree right after the PR exists; the branch lives on in `origin`. Need to fix
something later: `git worktree add .claude/worktrees/<short-slug> <branch>`.

Body: `## What` (two to five bullets), `## Acceptance criteria` (`- [x] <criterion> — <how
verified>` / `- [ ] … — not verified because …`), `## Not in this PR`.

## 6. Hand over

Wait for CI; red → `gh run view <id> --log-failed`, fix in the branch, push again. Green →
tell the user the PR link and what a reviewer should look at. Stop.
