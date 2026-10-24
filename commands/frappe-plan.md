---
description: Break an approved Frappe spec into small ordered tasks with acceptance criteria and dependency ordering
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/plan.md -->

Load the `frappe-planning-and-task-breakdown` skill (omp: `read skill://frappe-planning-and-task-breakdown`).

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Read `SPEC.md` (or the path in `$ARGUMENTS`) and the relevant app code. Enter plan mode — read only, no code changes.

1. Identify the dependency graph: DocType model first, then controllers, permissions, APIs, UI, patches, fixtures
2. Slice work into thin vertical tasks (one complete path per task; not horizontal layers)
3. Write each task with acceptance criteria and a concrete `bench --site <site>` verification command
4. Mark tasks that are parallel-safe vs those that must be sequential
5. Add human checkpoints between lifecycle phases (DEFINE → BUILD, BUILD → VERIFY)
6. Present the full plan for human review before any code is written

Save the task plan to `tasks/plan.md` and the task list to `tasks/todo.md`. If either already exists with unchecked tasks for different work, stop and ask before overwriting.

**Verification gate:** `tasks/plan.md` and `tasks/todo.md` exist, the plan is approved, and no implementation code has been written.
