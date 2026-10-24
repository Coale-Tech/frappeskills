---
name: frappe-git-workflow-and-versioning
description: "Structures git workflow for Frappe app development. Use when making any code change, committing, branching, tagging a release, or versioning a Frappe app. Use when splitting work across parallel agent worktrees, choosing a branch name, writing patches.txt, bumping __version__, exporting fixtures and Custom Fields in the right step order, or wiring pre-commit hooks. Not for CI pipeline setup → frappe-ci-cd-automation. Not for bench upgrade operations → frappe-bench-operations."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/git-workflow-and-versioning/SKILL.md -->

# Frappe Git Workflow and Versioning

Atomic commits, Frappe branch conventions, patch discipline, version bumps.

## When to use

- Any change to an app under source control
- Branching, tagging, or releasing a Frappe app version
- Adding a row to `patches.txt` after a schema change
- Bumping `__version__` in `<app>/<app>/__init__.py`
- Scoping `bench export-fixtures` to avoid noisy diffs
- Setting up pre-commit hooks for a Frappe app
- Running multiple agent worktrees for parallel feature work

Not for: CI pipeline design → `frappe-ci-cd-automation`. Bench upgrade (`bench update`) → `frappe-bench-operations`.

## Inputs required

- App name and bench path (`<bench>/apps/<app>`)
- Target Frappe branch (e.g. `version-16`)
- Nature of the change (feature / fix / schema / fixture / patch)

## Procedure

### 0) Understand Frappe's branch model

Frappe maintains two live branch families:
- `develop` — active development, HEAD of the next release; **never deploy this to production clients**.
- `version-NN` — stable release branch (e.g. `version-15`, `version-16`); ship from here.

Install an app from a specific branch:
```bash
bench get-app https://github.com/<org>/<app> --branch version-16
```

Your app should mirror this: keep a `version-16` branch in sync with the Frappe release you target.
Parallel development work lives in short-lived feature branches that merge into `develop` (or your app's equivalent default branch).

### 1) Use Conventional Commits (Frappe style)

Frappe enforces `@commitlint/config-conventional` in CI (`.github/workflows/linters.yml`). Use these prefixes:

| Prefix | When |
|--------|------|
| `feat:` | new user-visible feature |
| `fix:` | bug fix |
| `refactor:` | behaviour-preserving restructure |
| `test:` | test-only change |
| `docs:` | documentation only |
| `chore:` | tooling, deps, config |
| `perf:` | performance improvement |
| `ci:` | CI/CD pipeline change |

Commit message body: explain *why*, not the diff. One logical change per commit (~100 lines). Over ~300 lines → split the PR.

### 2) Patches.txt discipline

Every schema migration needs a patch. Add **one line** per migration to `<app>/patches.txt`.
```
# <app>/patches.txt
[pre_model_sync]
<app>.patches.v16_0.rename_old_field

[post_model_sync]
<app>.patches.v16_0.backfill_new_field
```

Rules:
- `[pre_model_sync]` patches run before `bench migrate` syncs DocType JSON — safe for destructive column ops.
- `[post_model_sync]` patches run after sync — use for backfills that need the new schema in place.
- **Never edit a shipped patch** (one that has run on any site). Frappe records executed patches by their dotted path; re-running silently skips them unless you add a date comment: `my_patch #2025-05-01 re-run`.
- Make every `execute()` idempotent: guard with `frappe.db.exists()` or `frappe.get_all()` before writes.
- Batch large-table updates and call `frappe.db.commit()` inside the loop to avoid row-level locks.

### 3) Version bump

Bump `__version__` in `<app>/<app>/__init__.py`:
```python
__version__ = "1.3.0"
```
Use `MAJOR.MINOR.PATCH` semantics. Tag the release to match:
```bash
git tag -a v1.3.0 -m "Release 1.3.0"
git push origin v1.3.0
```

**Frappe Cloud compatibility (`pyproject.toml`):** Frappe Cloud reads `[tool.bench.frappe-dependencies]`
to verify compatibility. Use `<17.0.0` as the upper bound — `<=X.0.0-dev` is rejected by Frappe Cloud:
```toml
[tool.bench.frappe-dependencies]
frappe = ">=16.0.0-dev,<17.0.0"
```
Keep `required_apps` in `hooks.py` for runtime dependency enforcement; `frappe-dependencies` is a
Cloud deploy-time check only.

### 4) Fixture export hygiene

`bench --site <site> export-fixtures` dumps every DocType listed in `hooks.py` `fixtures`. Scope it to avoid noisy diffs:
```bash
bench --site <site> export-fixtures --app <app>
```

In `hooks.py`, filter precisely to reduce churn:
```python
fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "<Module>"]]},
    {"dt": "Property Setter", "filters": [["doc_type", "in", ["Sales Invoice"]]}},
]
```
Commit fixture JSON only when intentionally updating shipped configuration; never let CI auto-commit fixture exports.

### 5) Pre-commit hooks

Frappe uses ruff, ruff-format, and prettier (`.pre-commit-config.yaml`). For a new app:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.14.10
    hooks:
      - id: ruff
        args: ["--select=I", "--fix"]
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: check-merge-conflict
      - id: check-json
      - id: check-yaml
      - id: debug-statements
```
Install: `pre-commit install && pre-commit install --hook-type commit-msg`.

### 6) Worktrees for parallel agent work

```bash
# From inside the app repo
git worktree add ../../<app>-feat-a feature/my-feature-a
git worktree add ../../<app>-feat-b feature/my-feature-b
# Each directory has its own branch; agents work without interfering
git worktree remove ../../<app>-feat-a   # after merge
```

## Verification

- [ ] `git log --oneline` shows one logical change per commit
- [ ] Commit messages use a recognised Conventional Commit prefix
- [ ] New `patches.txt` entry is in the correct section (`[pre_model_sync]` or `[post_model_sync]`)
- [ ] `execute()` is idempotent; no shipped patch was edited
- [ ] `__version__` matches the git tag
- [ ] `bench --site <site> export-fixtures --app <app>` produces a tidy, scoped diff
- [ ] Pre-commit hooks installed; `pre-commit run --all-files` is clean

## Failure modes / debugging

- **Patch already ran but needs re-run**: append a dated comment `# 2025-06-01 re-run` to the patches.txt line.
- **Fixture diff is huge**: missing filter in `hooks.py` fixtures list; add `dt` + `filters`.
- **Commitlint rejects message in CI**: message format wrong — must start with a recognised type followed by `: `.
- **Worktree checkout fails**: branch already checked out in another worktree; create a new branch first.
- **Patch skipped silently**: dotted import path wrong or the module is missing `execute()`; check with `bench --site <site> run-patch <dotted.path>`.

## Escalation

- CI pipeline wiring → [`frappe-ci-cd-automation`](../frappe-ci-cd-automation/SKILL.md)
- Removing deprecated fields/DocTypes → [`frappe-deprecation-and-migration`](../frappe-deprecation-and-migration/SKILL.md)
- Bench upgrade across versions → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- Whole-app quality sweep → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)

## References

*(No dedicated reference files — procedure and commands are self-contained above.)*

## Guardrails

- **Never edit a shipped patch**: add a new patch instead.
- **No absolute paths or client names** in commits, patches, or fixtures.
- **`frappe.qb` / `frappe.get_all`** in patches; `frappe.db.sql` only for operations documented in `frappe-api-development/references/database.md`.
- **`develop` is not production**: never deploy from `develop` to live sites.
- **No fixture commit without scope filter**: unscoped exports bloat version history.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just a one-liner patch, I'll skip the idempotency guard." | A second `bench migrate` on any site will re-run it and fail or corrupt data. |
| "I'll fix the shipped patch in place." | Frappe's patch tracker skips it by dotted path; the fix never runs. Add a new patch. |
| "The fixture diff is big but correct." | Missing filter in hooks.py; a big fixture diff hides real schema changes in review. |
| "I'll bump the version when I remember." | A tag without a version bump means artifacts, the changelog, and the tag disagree. |
| "Feature flags are extra complexity." | A long-lived branch is more complex and accumulates merge debt every day it lives. |
| "pre-commit is overhead." | It catches ruff and debug-statement issues before CI, not after a push+wait cycle. |

## Red Flags

- `patches.txt` entry without a corresponding `patches/vNN_0/` Python file
- Patch file with no `execute()` function or no idempotency guard
- `__version__` in `__init__.py` doesn't match the latest git tag
- `bench export-fixtures` with no `--app` flag committed to the branch
- `develop` branch deployed to a client site
- Commit touching schema AND fixing a bug AND reformatting code (mixed concerns)
- `git log` shows "WIP", "temp", or "fix fix fix" messages

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Editing a shipped patch | Frappe skips it by path; fix never runs | Add a new patch with a dated re-run comment |
| Using `frappe.db.sql` in a patch | Fails SQL injection check; violates skill rule | Use `frappe.qb` / `frappe.db.set_value` |
| Exporting fixtures without `--app` | All installed apps' fixtures exported; noisy diff | Pass `--app <app>` and scope `hooks.py` filters |
| Putting post-schema backfill in `[pre_model_sync]` | New columns don't exist yet; KeyError | Move to `[post_model_sync]` |
| One giant commit per PR | Unreviewable; hard to revert a single change | One logical unit per commit, ~100 lines |
