---
name: work-issue
description: Use when asked to work on a Linear issue in the hackaton repo — "/work-issue HAC-12", "mach HAC-12", "nimm das nächste Todo-Issue", or a pasted Linear issue link. Drives one issue from Todo (released) to an open, green pull request linked to Linear, then stops; merging stays with a human.
---

# work-issue — one Linear issue → one green PR

The job ends at an **open PR with green CI, linked to the issue, issue in "In Review"**.
Never merge, never push to `main`, never take a second issue in the same run.

## 1. Read the issue

Fetch it through the Linear MCP server (`linear`): title, description, acceptance criteria,
comments, labels, status. If the Linear tools are missing, ask the user to authorize the
`linear` server (`/mcp`) or to paste the issue; don't guess its content.

## 2. Readiness check — stop here if any of these fails

- Status is **Todo** (a human released it; **Backlog** means not written up yet). Backlog or
  anything else → ask, don't start.
- It has **acceptance criteria you can check** (a request, a screen state, a test). Vague
  ("make it nicer") → comment on the issue with the concrete questions, tell the user, stop.
- It fits **one PR** (roughly half a day). Bigger → propose a split as a comment, stop.
- Nobody else works on it (no assignee other than the user, no open PR referencing it).

Then set the issue to **In Progress** and assign it to the user.

## 3. Branch

Start from a clean state: staged or uncommitted changes survive `git switch` and would end up
in this PR. If `git status --porcelain` prints anything that isn't yours for this issue, don't
stash or discard it — work in a separate worktree instead:

```bash
git fetch origin
git status --porcelain                                              # empty → switch here
git switch -c <issue-id-lowercase>-<short-slug> origin/main         # e.g. hac-12-team-list
# not empty → own worktree, the user's changes stay untouched:
git worktree add -b <issue-id-lowercase>-<short-slug> ../hackaton-<issue-id-lowercase> origin/main
```

Use Linear's suggested branch name if the issue shows one. One issue, one branch.

## 4. Build

- Follow `AGENTS.md` and the `hackaton-architecture` skill (feature package, migration →
  entity → controller → spec → generated client → page).
- Do what the acceptance criteria ask, nothing more. Things noticed on the way go into a
  comment on the issue as follow-up ideas, not into this PR.
- A new migration takes the next free number on `origin/main` at the time of the PR.
- Every acceptance criterion gets a test where it can be tested (MockMvc for the backend,
  Vitest for the frontend).

## 5. Verify

Compare with `origin/main` (`git fetch && git diff origin/main...HEAD`), never with a local
`main`: it can be stale, and resetting onto it throws away what others merged meanwhile.

Run the checks from `AGENTS.md` for every side you touched and read the output. Then go
through the acceptance criteria one by one and note how each is met (test name, request,
or what the page shows). A criterion you could not verify is named as such in the PR.

## 6. Pull request

Stage files by name. Commit message and PR text in English, **no `Co-Authored-By` and no
"Generated with" line**.

```bash
git push -u origin <branch>
gh pr create --title "<what changed>" --body "<body>"
```

Body:

```
Fixes <ISSUE-ID>

## What
<the change in two to five bullets>

## Acceptance criteria
- [x] <criterion> — <how it was verified>
- [ ] <criterion> — not verified because <reason>

## Not in this PR
<follow-ups, or "nothing">
```

`Fixes <ISSUE-ID>` lets Linear link the PR and move the issue when it is merged.

## 7. Hand over

- Wait for CI; red → read the failing log (`gh run view <id> --log-failed`), fix in the
  branch, push again.
- Green → set the issue to **In Review**, comment the PR link and anything a reviewer should
  look at, and tell the user. Stop.
