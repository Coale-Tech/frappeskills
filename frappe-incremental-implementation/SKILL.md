---
name: frappe-incremental-implementation
description: "Delivers Frappe changes in thin vertical slices: implement one piece, run the applicable bench command (migrate / clear-cache / build), test, verify, then commit. Use when implementing any task from a plan, when a change touches more than one Frappe layer, or when rolling incomplete work behind a feature flag. Not for single-function changes with trivial scope."
---

# Frappe Incremental Implementation

Build in thin slices — one working path at a time, each leaving the site in a testable state.

## When to use

- Implementing any task from a `frappe-planning-and-task-breakdown` plan
- A change touches more than one Frappe layer (schema + controller, API + UI, etc.)
- Rolling a feature behind a flag before it is complete enough for users
- You are about to write more than ~80 lines without running a bench command

Not for a single-function fix with trivial scope.
For the plan that precedes this, see [`frappe-planning-and-task-breakdown`](../frappe-planning-and-task-breakdown/SKILL.md).

## Inputs required

- Task card from `tasks/todo.md` (acceptance criteria, verification command, files, dependencies)
- Site name and app name for bench commands
- Whether a feature flag is needed (incomplete work merging to a shared branch)

## Procedure

### 0) Scope discipline

Read the task card. Touch only what the task requires.

Note unrelated findings; **do NOT fix them**:

```
NOTICED BUT NOT TOUCHING:
- hooks.py has a misspelled function name (unrelated to this task)
- An unused import in utils.py
→ Added to tasks/todo.md for a future task.
```

### 1) Implement the smallest complete piece

Choose the right slice:
- **Vertical** (preferred): one working path through schema → controller → API → UI
- **Risk-first**: implement the highest-uncertainty piece first; fail fast before building on it

One slice = one logical thing. Do not mix a DocType schema change with an unrelated refactor.

### 2) Run the applicable bench command

Choose by what changed (details and flags → [references/bench-commands.md](references/bench-commands.md)):

| Change made | Command |
|---|---|
| DocType JSON added or modified (any field or setting) | `bench --site <site> migrate` |
| Python only — controller, hooks.py, utils | `bench --site <site> clear-cache` |
| JS, Vue, or CSS files modified | `bench build --app <app>` |
| Fixtures exported or modified | `bench --site <site> clear-cache` |
| Schema + data backfill in same slice | `bench --site <site> migrate` (patch in `patches.txt [post_model_sync]`) |

**One schema change per slice.** `bench migrate` must succeed before the next slice begins.

### 3) Test

```bash
bench --site <site> run-tests --app <app> --module <app>.<module>
# or narrower:
bench --site <site> run-tests --doctype "My DocType"
```

`run-tests` requires `allow_tests = true` in `site_config.json`. If missing:
```bash
bench --site <site> set-config allow_tests true
```

For UI changes: open the Desk form, confirm field/button existence, verify a low-privilege role is blocked.

### 4) Verify and commit

- [ ] The bench command from step 2 exited 0
- [ ] Tests pass
- [ ] Slice works end-to-end per the task's acceptance criteria
- [ ] No unrelated files are staged

Commit with a descriptive message, then move to the next slice.

### 5) Feature flags for incomplete work

When a slice must merge before the feature is user-ready:

**Option A — site_config key** (simplest; per-site; no schema change):
```python
if frappe.conf.get("enable_new_approval_flow"):
    # new path
```
Set/unset: `bench --site <site> set-config enable_new_approval_flow 1`

**Option B — System Settings Check field** (UI-visible; per-site):
Add a Check field to System Settings via fixture or UI, then read:
```python
frappe.get_system_settings("enable_new_approval_flow")
```

**Option C — Single DocType config** (app-owned; UI-visible):
Add a Check field to an app-owned Single DocType (e.g. `<App> Settings`).

Safe defaults: new Check fields default to 0; new permissions not granted; new required fields need defaults for existing records.

### 6) Rollback-friendly changes

- Additive changes (new fields, new files, new methods) are independently revertable
- Dropping a column: write a reverse data-safety patch; never batch with schema addition
- Separate deletion from replacement across two slices — each independently revertable

## Verification

- [ ] Each slice individually migrated/cleared/built and tested before the next started
- [ ] `bench --site <site> migrate` succeeded after every DocType JSON change
- [ ] `bench build --app <app>` ran after every JS/CSS/Vue change
- [ ] Feature flag in place for any user-visible incomplete work
- [ ] No unrelated files in the commit
- [ ] Full test suite passes at the end of the task

## Failure modes / debugging

- **migrate fails**: a patch is missing or references a column that does not exist yet — add the patch to `patches.txt [pre_model_sync]` or fix the column dependency
- **clear-cache does not fix a Python error**: file was not saved, or there is a syntax error — check `bench --site <site> console` for the import traceback
- **build fails**: esbuild error in JS — run `bench build --app <app> --verbose` for the full error
- **run-tests: "Testing is disabled"**: `bench --site <site> set-config allow_tests true`
- **Accidental scope creep**: check `git diff` before committing; if unrelated files appear, stop and split

## Escalation

- Planning task order → [`frappe-planning-and-task-breakdown`](../frappe-planning-and-task-breakdown/SKILL.md)
- Non-trivial in-flight decision → [`frappe-doubt-driven-development`](../frappe-doubt-driven-development/SKILL.md)
- Test patterns and fixtures → [`frappe-testing`](../frappe-testing/SKILL.md)
- DocType schema design → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Bench broken after a failed migrate → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)

## References

- [references/bench-commands.md](references/bench-commands.md) — when to use migrate vs clear-cache vs build, verified flags and patches.txt format

## Guardrails

- **Never batch two schema changes into one slice**: each must be independently migratable
- **Never skip the bench command step**: migrate and clear-cache are not optional after their trigger
- **Safe defaults always**: new flags default off; new permissions not granted; new required fields have defaults for existing records
- **One `patches.txt` entry per schema slice**: never batch unrelated patch entries in one task
- **Do not touch files outside task scope**: note findings; do not fix them mid-task

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll run migrate after all DocType changes are done" | Each slice must migrate cleanly; a broken intermediate state is hard to unwind across multiple JSON changes |
| "clear-cache is enough after a schema change" | `clear-cache` does not apply pending migrations to MariaDB; `migrate` does both |
| "I'll add the feature flag later" | Once incomplete work is user-visible, a flag becomes a hotfix, not a plan |
| "This small refactor is safe to include in the slice" | Mixed commits make rollback ambiguous — separate them |
| "bench build is slow; I'll skip it for this JS change" | The stale bundle stays cached; users see old behavior; skipping causes hard-to-diagnose regressions |
| "Let me re-run the tests to be sure" | After a successful run, repeat only if code changed; re-running unchanged code adds no information |

## Red Flags

- DocType JSON changed but `bench migrate` not run before the next slice
- JS / Vue / CSS changed but `bench build` not run
- Incomplete feature is user-visible with no flag controlling it
- Unrelated files appear in `git diff` alongside task files
- More than one DocType schema change in a single slice
- `bench migrate` fails but implementation continues anyway
- "While I'm in this file..." scope creep in the reasoning

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Using `clear-cache` after a DocType JSON change | Schema never applied to MariaDB; new fields throw `OperationalError` | `bench --site <site> migrate` after every DocType JSON change |
| `bench build` without `--app` when only one app changed | Rebuilds all apps — slow and unnecessary | `bench build --app <app>` |
| Feature flag in `frappe.conf` without set-config doc | Next agent does not know how to enable it | Document in the task card: `bench --site <site> set-config key 1` |
| Dropping a field and adding a replacement in the same slice | Both changes roll back together; migration is riskier | Separate into two slices: deprecate first, remove second |
| Committing with unrelated staged files | Hides the real diff; makes review and rollback painful | Stage only task files; use `git add -p` |
