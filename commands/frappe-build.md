---
description: Implement Frappe tasks incrementally — slice → test → migrate → verify → commit. Add "auto" to run the whole plan in one approved pass.
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/build.md -->

Load the `frappe-incremental-implementation` skill (omp: `read skill://frappe-incremental-implementation`). Use `frappe-router` (omp: `read skill://frappe-router`) to identify any additional task-specific skills (DocType, API, Desk, frontend, etc.).

`$ARGUMENTS` selects the mode. Treat `auto` (or `all`) as autonomous mode; anything else (or empty) is single-task mode.

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

## Default: one task

Pick the next pending task from `tasks/plan.md`. Then:

1. Read the task's acceptance criteria
2. Write a failing test (RED): `bench --site <site> run-tests --app <app> --module <module>`
3. Implement the minimum code to pass (GREEN)
4. Run `bench --site <site> migrate` and `clear-cache` after any DocType or hooks change
5. Run the full suite; confirm no regressions
6. Commit with a descriptive message referencing the task; stage only that task's files
7. Mark the task complete and stop

## Autonomous: `/frappe-build auto`

1. **Require a spec.** Look for `SPEC.md` at the repo root or `docs/SPEC.md`. No spec → stop, run `/frappe-spec` first.
2. **Confirm clean baseline.** `git status --porcelain` — stop if uncommitted changes exist outside planning artifacts.
3. **Plan if needed.** If no `tasks/plan.md`, invoke `frappe-planning-and-task-breakdown` to generate one.
4. **Single checkpoint.** Present the full plan; require an unambiguous "approve" / "go" before proceeding.
5. **Execute every task in dependency order.** Each task runs the full default loop above; one commit per task.
6. **Stop and ask** when: a test cannot pass without an obvious fix; the spec is ambiguous; or a step is risky/irreversible (permission changes, patches, GL/stock postings, data migrations, anything not undoable with `git revert`) — invoke `frappe-doubt-driven-development` and get explicit sign-off.
7. **Summarize** at the end: tasks completed, tests added, commits made, anything skipped or flagged.

**Verification gate:** every task must have a passing test and a clean `bench migrate` before its commit is made.
