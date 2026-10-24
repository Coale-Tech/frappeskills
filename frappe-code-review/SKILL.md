---
name: frappe-code-review
description: "Per-change code review for Frappe/ERPNext apps. Use when reviewing a PR or change set before merging it or change set. Reviews five axes (correctness, readability, architecture, security, performance) plus a Frappe-specific checklist covering permissions on whitelisted methods, SQL via frappe.qb, hooks and doc_events side effects, patch idempotency, fixtures scope, translatable strings, v15/v16 compatibility, and change sizing (~100 lines). Not for whole-app sweeps — use frappe-app-audit for that."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/code-review-and-quality/SKILL.md -->

# Frappe Code Review

Per-change review: five axes + Frappe checklist. Approve what improves the codebase; block what harms it.

## When to use

- Before merging any PR or change against a Frappe app
- After implementing a feature or bug fix to self-review
- When reviewing code produced by another agent or model
- After any patch, fixture export, or permissions change
- When the change size exceeds ~300 lines and needs splitting advice

Not for whole-app quality sweeps → [`frappe-app-audit`](../frappe-app-audit/SKILL.md).

## Inputs required

- The diff or change set (files changed, lines added/removed)
- The spec, task, or issue the change addresses
- The target app and site Frappe version (v15 or v16)

## Procedure

### 0) Scope-drift check

Before reviewing code quality, check whether the diff matches its stated intent.

```
Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]
Intent: <what the task/spec requested>
Delivered: <what the diff actually does>
[Drift: list each out-of-scope change]
[Missing: list each unaddressed requirement]
```

Frappe drift signals: unrelated fixture exports, `patches.txt` additions not mentioned in the task, `hooks.py` edits outside the feature scope, schema JSON churn from a stray `bench export-fixtures`, Custom Field JSON not listed in the spec.

This is **informational** — does not block the review.

### 1) Understand intent before looking at code

- What is this change trying to accomplish?
- Which DocType, controller, API, hook, patch, or fixture does it touch?
- What is the expected behaviour change?

### 2) Review tests first

Before reading implementation code, check whether tests exist:
- Do tests cover the new or changed behaviour?
- Would they catch a regression if the code reverted?
- Do they test behaviour (observable outcome), not implementation internals?

Mutation check: invert one condition the change adds (drop a negation, swap `and` for `or`), run the suite, then restore. A mutation that stays green means a test case is missing. If the changed behaviour has no tests at all (common in whitelisted API layers), skip the mutation check and raise a Required finding: no regression guard.

### 3) Apply the five-axis review

For each file changed:

**Correctness** — Does the code match the spec? Edge cases handled? Error paths (not just the happy path)?

**Readability** — Can a new team member understand it without explanation? Names clear? No nested ternaries or magic numbers?

**Architecture** — Follows existing patterns? Does this DocType extension belong in `doc_events` or a controller override? Does the refactor reduce concepts or just relocate them?

**Security** — See the Frappe checklist below. Permissions verified, no raw SQL, no untrusted data in Jinja `|safe`.

**Performance** — No N+1 queries (`frappe.get_doc` inside a loop)? `frappe.get_all` uses `filters` and `fields` to limit result sets? Missing index on a frequently-filtered field?

### 4) Apply the Frappe-specific checklist

See [references/frappe-review-checklist.md](references/frappe-review-checklist.md) for the full checklist. Key items:

- **Permissions on whitelisted methods**: a `@frappe.whitelist()` method must reach a permission check before touching data. The Document API (`new_doc().insert()`, `save()`, `submit()`, `frappe.get_list`) enforces DocPerm itself, so it is not a finding unless `ignore_permissions` is set. `frappe.get_all`, `frappe.db.*` and `frappe.get_doc(...).as_dict()` do not check; those need an explicit `frappe.has_permission()` or `frappe.only_for()`. `allow_guest=True` requires explicit justification.
- **SQL via `frappe.qb`**: never `frappe.db.sql()` raw strings; use `frappe.qb` or `frappe.get_all()`.
- **Hooks and doc_events side effects**: a `before_save` hook that calls `frappe.enqueue` is fine; one that calls `frappe.db.commit()` is not. Check for implicit commits.
- **v15/v16 compatibility**: `from frappe.tests.utils import FrappeTestCase` is a deprecated shim removed in v17; use `from frappe.tests import IntegrationTestCase`.
- **Type annotations on whitelisted methods**: apps that declare `require_type_annotated_api_methods = True` in `hooks.py` (including CRM 2.x and HRMS 16.50+) require ALL `@frappe.whitelist()` functions to carry Python type annotations. Frappe validates annotated parameters via Pydantic (`frappe.utils.typing_validations`); unannotated params are passed through as strings. Flag any `def my_fn(doctype, name):` without annotations in such apps.
- **Migration needed?**: any change to a DocType JSON (fields, permissions) requires `bench --site <site> migrate`; note it in the PR description.
- **Change size ~100 lines**: changes over ~300 lines need splitting (see below).

### 5) Categorise findings

Use format `[SEVERITY] (confidence: N/10) file:line — description`. See [references/finding-format-and-gates.md](references/finding-format-and-gates.md) for the severity table, confidence scoring, pre-emit verification gate, and a worked false-positive rejection.

Lead with what matters: correctness and security first, then architecture, then nits.

Severity needs evidence: **Critical** names the attacker (anonymous / any logged-in user / role) and what they gain. Reachable only by a trusted role or admin-editable data → downgrade to Required.

### 6) Review-your-own-changes procedure

Before submitting:
1. `git diff --stat` — is the total under 300 lines? If not, split.
2. Read the diff as if you wrote none of it.
3. Run the Frappe checklist against your own change.
4. Run `bench --site <site> run-tests --module <app>.tests.<module>` and confirm green.

### 7) Reviewing agent-generated code

Agent output needs more scrutiny, not less. It is confident and plausible even when wrong. Check:
- Did the agent use `frappe.db.sql()` anywhere? (Flag it.)
- Did the agent add `ignore_permissions=True` silently? (Flag it.)
- Are all user-visible strings wrapped in `_()`?
- Did the agent export a fixture that overwrites a system DocType permission?
- Does every `frappe.<name>(...)` it calls exist in the installed `frappe/__init__.py` (`grep -n "def <name>" apps/frappe/frappe/__init__.py`)? Invented helpers such as `frappe.msginfo` only fail at runtime.
- Is any registered `doc_events` handler or scheduler entry a `pass` stub, or a name that does not resolve?

### 8) Splitting oversized changes

Target sizes:
```
~100 lines changed → Good; reviewable in one sitting
~300 lines changed → Acceptable for a single logical change
~1000 lines changed → Too large; split it
```

Splitting strategies:
| Strategy | When |
|----------|------|
| **Horizontal** — shared helpers/stubs first, then consumers | Layered architecture |
| **Vertical** — one DocType at a time | Multi-model feature work |
| **Refactoring separate from feature** | Always — never mix in a Frappe patch |

## Verification

- [ ] All Critical and Required findings resolved
- [ ] Tests pass on a fresh site (not just locally)
- [ ] `bench --site <site> migrate` run if DocType JSON changed
- [ ] No `frappe.db.sql()` raw strings in the diff
- [ ] Every `@frappe.whitelist()` method has a permission check
- [ ] Patches are idempotent and listed in `patches.txt`
- [ ] All user-visible strings use `_()` / `__()`

## Failure modes / debugging

- **Review finds `frappe.db.sql()`**: raise as Required; rewrite with `frappe.qb`
- **Patch not in `patches.txt`**: the patch will never run on existing sites; add it in the correct position
- **`ignore_permissions=True` without comment**: raise as Critical if the justification is unclear
- **Missing `bench migrate` note**: DocType field additions silently fail until migration; add to PR checklist

## Escalation

- Whole-app quality sweep → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Security-focused review → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Performance-focused review → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)
- Patch or migration strategy → [`frappe-deprecation-and-migration`](../frappe-deprecation-and-migration/SKILL.md)

## References

- [references/frappe-review-checklist.md](references/frappe-review-checklist.md) — Full Frappe review checklist with severity labels
- [references/finding-format-and-gates.md](references/finding-format-and-gates.md) — Confidence-calibrated format, pre-emit verification gate, worked false-positive rejection
- [references/specialist-passes.md](references/specialist-passes.md) — Specialist review passes (created by peer worker)

## Guardrails

- **Approve what improves overall code health**, even if imperfect — the standard is improvement, not perfection
- **Never rubber-stamp** — "LGTM" without evidence of review helps no one
- **Don't soften real issues** — a security bug is Critical, not "something to consider"
- **Comment on code, not people** — "this method bypasses permissions" not "you bypassed permissions"
- **Don't accept "I'll fix it later"** — fix it before merge or file a tracked issue with self-assignment

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working but insecure or unreadable code creates debt that compounds every sprint. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |
| "Agent-generated code is probably fine" | Agent code needs more scrutiny, not less. It confidently uses `frappe.db.sql` and `ignore_permissions=True`. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch permission bypasses or unidiomatic Frappe patterns. |
| "It's just a small patch, skip the idempotency check" | Patches that are not idempotent corrupt data on re-migration. Always check. |
| "We'll clean up the `frappe.db.sql` later" | It will be copy-pasted into three more places by then. Fix now. |
| "The fixture export is harmless" | A fixture that exports a core DocType's permissions can overwrite site customisations on every deploy. Scope it. |

## Red Flags

- PRs merged without any review
- `frappe.db.sql()` raw strings in new code
- `ignore_permissions=True` without an inline justification comment
- `@frappe.whitelist()` methods with no `has_permission()` check
- Patches missing from `patches.txt` or not idempotent
- User-visible strings hard-coded in English without `_()`
- Change over 300 lines with no split proposed
- `from frappe.tests.utils import FrappeTestCase` (deprecated; removed in v17)
- Fixture export scoped to core DocTypes rather than app-owned ones

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Using `frappe.db.sql()` for a simple filter | Bypasses query builder; SQL injection risk | Use `frappe.qb` or `frappe.get_all()` |
| Adding a `doc_event` that commits inside `before_save` | Frappe wraps saves in a transaction; an explicit commit in a hook corrupts it | Never call `frappe.db.commit()` inside a hook; remove it |
| Exporting a fixture for `DocType` permissions without scoping | Overwrites site customisations on every `bench migrate` | Export only your app's own DocType fixtures |
| `ignore_permissions=True` to silence a PermissionError | Hides a real access control bug | Fix the permission, not the check |
| Non-idempotent patch (creates a record without checking existence) | Running migrate twice duplicates the record | Guard with `if not frappe.db.exists(...)` |
