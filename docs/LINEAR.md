# Working with Linear and agents

Linear holds the work, the repo holds the rules, a human merges.

## Flow

| Status | Who | Means |
|---|---|---|
| Todo | anyone | idea or rough task |
| Ready | a human | written with the template below, small enough for one PR; agents may take it |
| In Progress | the agent / person working on it | branch exists |
| In Review | set when the PR is green | a human reviews and merges |
| Done | Linear, on merge | via `Fixes <ISSUE-ID>` in the PR |

An agent starts an issue with `/work-issue <ISSUE-ID>` (Claude Code) or "work on <ISSUE-ID>
following `.claude/skills/work-issue/SKILL.md`" (other agents). It stops at the green PR.

## Issue template

```
## Goal
<one sentence: what the user can do afterwards>

## Acceptance criteria
- [ ] <checkable: request → response, screen → state>
- [ ] ...

## Scope
<feature package / pages / tables it touches>

## Not in scope
<what someone might expect but should not be built here>

## How to check
<steps or the request to try>
```

Rule of thumb: one issue = one PR = at most half a day. Two agents never work in the same
feature package at the same time.

## Setup (once per person)

- Claude Code: `.mcp.json` lists the Linear server; run `/mcp` and authorize `linear`.
- Linear workspace: connect the GitHub integration once, so `Fixes <ISSUE-ID>` links PRs
  and moves issues.
