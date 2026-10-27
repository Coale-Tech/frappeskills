---
name: frappe-planning-and-task-breakdown
description: "Breaks a Frappe spec into small, ordered, verifiable tasks before any code is written. Use when a spec or change is ready and the implementation sequence is unclear, when work spans multiple agents or sessions, or when a task feels too large to start in one step. Not for open requirements — use frappe-requirements-interview; not for whole-app scope — use frappe-app-audit."
---

# Frappe Planning and Task Breakdown

Translate a completed spec into an ordered, agent-executable task list.

## When to use

- Spec from `frappe-spec-driven-development` is complete and ready to implement
- Change touches multiple Frappe layers (DocType + controller + API + UI + test)
- Work needs to run across agents or sessions with clear handoffs
- Implementation order or dependency graph is unclear

Not for open requirements → [`frappe-requirements-interview`](../frappe-requirements-interview/SKILL.md).
Not for whole-app scope review → [`frappe-app-audit`](../frappe-app-audit/SKILL.md).

## Inputs required

- Completed spec (DocType model, permissions matrix, API surface, workflow, test plan)
- Target app, module, and site name
- Whether an external task tracker is designated (GitHub Issues, Linear, etc.)
- Number of concurrent agents available (for parallel-safe slicing)

## Procedure

### 0) Enter read-only planning mode

Read before writing anything:

- App directory layout, existing DocTypes, and `hooks.py`
- `patches.txt` to understand existing patch sequence
- `tasks/plan.md` and `tasks/todo.md` — if unchecked tasks exist for *different* work, stop and ask the human before overwriting

**Do NOT write code.** Output is `tasks/plan.md` + `tasks/todo.md` (or tracker items if designated).

### 1) Build the Frappe dependency graph

Frappe has a fixed implementation layer order — foundations must exist before dependents:

```
DocType JSON + patches.txt entry  (schema)
      │
      ├── Controller / validation  (Python)
      │         │
      │         └── Permissions  (roles, permlevel, user perms)
      │                   │
      │                   └── Whitelisted API methods
      │                             │
      │                             ├── Desk UI / form scripts / workspace tiles
      │                             │
      │                             └── Reports / print formats
      │
      └── Tests  (unit + integration)
                │
                └── Fixtures / documentation
```

Rules:
- **One DocType schema change per task.**
- **Every schema task on a populated table**: add the `patches.txt` entry in the **same task** (pre_model_sync for destructive ops, post_model_sync for backfills).
- Permissions cannot be verified until the DocType and controller exist.

### 2) Slice vertically

Build one complete working path per slice — not one layer across all paths.

**Bad (horizontal):** Task 1: all DocTypes; Task 2: all controllers; Task 3: all API endpoints.

**Good (vertical):** Task 1: Invoice DocType + validate + submit permission + migrate + test.
Task 2: Invoice approval API endpoint + Desk action button + test.

### 3) Write tasks

Use the template in `assets/task-template.md`. Required fields per task:
- **Acceptance criteria**: specific and testable (≤ 3 bullets; more means split the task)
- **Verification commands**: `bench --site <site> run-tests --module <module>` or console assertion
- **Files likely touched**: list `.json`, `.py`, `patches.txt`, `test_*.py` explicitly
- **Size**: S (1-2 files), M (3-5 files), L (5-8 files) — L must be split further
- **Dependencies**: list prior task numbers; schema precedes controller precedes permissions

### 4) Identify parallel-safe slices

| Safe to parallelize | Must be sequential | Coordinate first |
|---|---|---|
| Controllers for independent DocTypes | DocType JSON edits (file conflict) | Shared DocType JSON → define schema contract, then split |
| Independent API modules | `patches.txt` entries (ordering) | Shared `hooks.py` entries |
| Separate report / print files | `bench --site <site> migrate` runs | Shared fixtures file |
| Tests for already-landed slices | | |

### 5) Add checkpoints

After every 2-3 tasks:

```markdown
## Checkpoint: after Tasks N-M
- [ ] `bench --site <site> migrate` exits 0
- [ ] `bench --site <site> run-tests --app <app>` passes
- [ ] `bench --site <site> console` opens without import errors
- [ ] Human review before proceeding
```

### 6) Readiness check — zero decisions left to the implementer

Before handing a task to `frappe-dev`, read it as the person who must write the code. The task fails if they would have to choose any of: a field's type, options or link target; the naming rule; whether a data change belongs in `pre_model_sync` or `post_model_sync`; a hook name or event; an API method path or signature; how to handle an edge case. Each choice must already be written in the task or the spec it cites. Check that every task lists its files, has a test for the happy path and one rejection path, and leaves `migrate` and the tests passing. For tasks that carry real risk, have a fresh read-only subagent try to list exactly what to change from the task text alone; whatever it cannot list is a gap.

## Verification

- [ ] Every task has acceptance criteria with at least one runnable verification command
- [ ] Frappe dependency order respected (schema before controller before permissions)
- [ ] Every schema-change task includes a `patches.txt` entry for populated tables
- [ ] L-sized tasks decomposed; no XL tasks remain
- [ ] Parallel-safe tasks identified; file-conflict tasks serialized
- [ ] Checkpoints every 2-3 tasks
- [ ] Every task passes the readiness check (step 6): no field type, patch phase, hook or signature left for the implementer to choose
- [ ] No pre-existing `tasks/plan.md` overwritten without user confirmation
- [ ] Human has reviewed and approved the plan before implementation starts

## Failure modes / debugging

- **Plan overwritten mid-build**: check `tasks/plan.md` for unchecked items before planning new work
- **Parallel agents conflict on DocType JSON**: one agent owns the JSON; others consume the contract, not the file
- **Schema task causes migration failure**: patch was missing or targeted the wrong table — add the patch, re-run migrate
- **Task ordering wrong**: controller references a field that does not exist yet — move the schema task earlier

## Escalation

- Requirements still open → [`frappe-requirements-interview`](../frappe-requirements-interview/SKILL.md)
- Definition of done / constraints → [`frappe-constraint-driven-development`](../frappe-constraint-driven-development/SKILL.md)
- Executing the plan slice-by-slice → [`frappe-incremental-implementation`](../frappe-incremental-implementation/SKILL.md)
- DocType design questions → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Scope / architecture quality gate before task breakdown → [`frappe-plan-review`](../frappe-plan-review/SKILL.md)

## References

- [assets/task-template.md](assets/task-template.md) — per-task markdown template with all required fields

## Guardrails

- **Never write code during planning**: output is `tasks/plan.md` and `tasks/todo.md` only
- **Never overwrite** an in-progress plan without explicit user confirmation
- **One schema change per task**: mixing multiple DocType changes makes rollback ambiguous
- **Every schema task needs a `patches.txt` entry** when the table has data
- **Parallel file conflict = must serialize**: two agents writing the same JSON simultaneously lose each other's changes

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The order is obvious, I'll just start coding" | Frappe's dependency graph has non-obvious rules — a missed patch corrupts a live site on migrate |
| "I'll add the patch when I get to migrations" | If the schema task ships without the patch, the next migrate on a populated site corrupts or drops data |
| "Two DocType changes can share one task" | They cannot be independently rolled back; a bad field drops both |
| "The plan is overhead" | Long sessions lose track; a written plan survives compaction and session boundaries |
| "Parallel is always faster" | Agents writing the same DocType JSON produce merge conflicts; define the shared contract first |
| "L tasks are fine if I'm careful" | Agents perform best on S/M tasks; L tasks accumulate partial state that is hard to debug |
| "I'll plan after some exploration" | Exploration belongs in step 0 (read-only); planning happens after reading, not after coding |

## Red Flags

- Coding starts before `tasks/plan.md` exists
- Tasks lack a runnable verification command
- A schema-change task has no corresponding `patches.txt` entry for a populated table
- Multiple DocType JSON changes in a single task
- Parallel tasks both touching `hooks.py` with no coordination plan
- All tasks are size L or larger; no checkpoints between phases
- `tasks/plan.md` overwritten while its checklist still has unchecked items for different work

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Schema task without `bench --site <site> migrate` in verification | Migration never runs; subsequent task fails at runtime | Add migrate to every schema task's verification checklist |
| Parallel agents assigned to the same DocType JSON | Silently drops fields on merge | One agent owns the JSON; others wait for the schema contract |
| "Files touched" lists only Python | Misses `.json` export, `patches.txt`, fixture JSON | List all file types touched for every task |
| No explicit dependency numbers on tasks | Agent skips a foundation task | Add `Dependencies:` to each task card |
| Single task for "all permissions" | Order matters; depends on which DocTypes are ready | One permission task per DocType, placed after its controller task |
