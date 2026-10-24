# Definition of Done — Frappe Apps

Two distinct concepts that are often conflated:

- **Standing bar (CONSTRAINTS.md):** The project-wide quality gate that every change must clear, always. Set once; enforced forever. Changing it requires an explicit decision with an owner and expiry.
- **Per-task acceptance criteria:** What "done" means for this specific work package. Written in the spec or task description. Consumed when the task closes; never used to weaken the standing bar.

---

## Standing bar (from CONSTRAINTS.md)

These apply to every merged change, regardless of who wrote the task or which sprint it landed in.

| Check | Command | Must pass |
|-------|---------|-----------|
| Ruff lint | `ruff check <app>/` | always |
| Ruff format | `ruff format --check <app>/` | always |
| Test suite | `bench --site <site> run-tests --app <app>` | always |
| Migration (fresh site) | `bench --site <site> migrate` | always |
| Semgrep (high findings) | `semgrep scan --config p/python <app>/` | always |
| Floor rules | `git diff` review (no noqa, no frappe.db.sql, no skipped tests) | always |

*A change that passes per-task criteria but fails the standing bar is not done.*

---

## Per-task acceptance criteria

Written in the spec (`assets/spec-template.md → ## Success criteria`) or in the task card. Examples:

- [ ] Employee role can create and submit a Salary Advance; HR Manager can approve or reject it
- [ ] `bench --site <site> run-tests --app <app> --doctype "Salary Advance"` exits 0
- [ ] Print format renders without Jinja errors for a submitted record
- [ ] Patch `add_advance_balance` is idempotent (safe to run twice on the test site)
- [ ] All user-facing strings translatable (no bare English literals outside `_()`)

Acceptance criteria are specific to the task. They are **not** a lower bar than CONSTRAINTS.md; they are an additional bar on top of it.

---

## The key rule

> An agent may not silence a check, skip a test, or loosen a threshold in CONSTRAINTS.md to satisfy per-task acceptance criteria. If the two are in conflict, the standing bar wins. Open an exception row (with owner and expiry) or fix the code.

---

## Writing good per-task acceptance criteria

**Good (testable):**
- `bench --site <site> run-tests --app <app> --doctype "Salary Advance"` exits 0
- HR Manager role cannot read Draft advances created by other employees
- `bench --site <site> migrate` passes on a freshly created site

**Bad (not testable):**
- "The feature works correctly"
- "Performance is acceptable"
- "Code is clean"

Each criterion must be verifiable with a command, a screenshot, or an observable outcome. If you cannot write the verification command, the criterion is incomplete.

---

## Relationship to the spec lifecycle

```
frappe-requirements-interview  →  requirements brief
frappe-spec-driven-development →  spec (includes success criteria)
frappe-constraint-driven-development → CONSTRAINTS.md (standing bar)
frappe-planning-and-task-breakdown → per-task acceptance criteria
```

The standing bar is set once at project or sprint start. Per-task criteria are written for each work package. Both must be satisfied before a change is considered done.

---

## Sources

- `apps/frappe/frappe/commands/testing.py` — `bench --site <site> run-tests` flags (`--app`, `--coverage`, `--doctype`); `allow_tests` site config requirement
- `apps/frappe/.pre-commit-config.yaml` — ruff hooks (lint, format), trailing-whitespace hook; confirmed present in v16 source
- `apps/frappe/pyproject.toml` — `[tool.ruff]` config: `line-length = 110`, `select`, `ignore`, `indent-style = "tab"`; `[test]` optional dependencies (`coverage~=7.10.0`)
- `apps/frappe/frappe/permissions.py` — `has_permission` checks referenced in whitelisted-method constraint
