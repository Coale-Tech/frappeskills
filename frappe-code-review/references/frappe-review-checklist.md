# Frappe Review Checklist

Use this checklist for every per-change code review of a Frappe/ERPNext app.
Generic five-axis review is in the parent SKILL.md; this file adds Frappe-specific items.

## Quick reference: severity labels

| Prefix | Meaning |
|--------|---------|
| **Critical:** | Blocks merge — security, data loss, broken functionality |
| *(no prefix)* | Required — must address before merge |
| **Nit:** | Minor, optional |
| **Optional:** | Suggestion, not required |
| **FYI** | Informational, no action needed |

---

## Frappe-specific checklist

### Permissions

- [ ] Every `@frappe.whitelist()` method calls `frappe.has_permission()` or checks `frappe.session.user` before reading/writing data
- [ ] `allow_guest=True` on a whitelist method has a written justification in the PR
- [ ] `ignore_permissions=True` is either absent or has an inline comment explaining why it is safe
- [ ] Permission changes (Custom DocType Permissions, `has_permission` hooks) are tested with a user in the target role

**Critical if:** A `@frappe.whitelist()` method reads or writes documents without any permission check — any authenticated user can call it.

### SQL and queries

- [ ] No `frappe.db.sql()` raw strings in new or changed code
- [ ] All queries use `frappe.qb`, `frappe.get_all()`, or `frappe.get_list()`
- [ ] `frappe.get_all()` / `frappe.get_list()` calls specify `fields` (not `fields=["*"]`) and `filters`
- [ ] No N+1 pattern: `frappe.get_doc()` is not called inside a loop over a list

**Required if:** Raw SQL is present. Exception: `frappe-api-development/references/database.md` documents an accepted exception for this repo — check there first.

### Hooks and doc_events

- [ ] `before_save`, `after_insert`, `on_submit`, etc. hooks do not call `frappe.db.commit()`
- [ ] Hooks that enqueue background jobs (`frappe.enqueue`) use `queue="long"` for heavy work
- [ ] New `doc_events` entries in `hooks.py` are the least invasive hook for the need (e.g. `validate` not `before_save` if no DB access is needed)
- [ ] Hooks that may run thousands of times (e.g. on bulk import) are guarded with `frappe.flags` to short-circuit when `in_import` is set

### Patches

- [ ] Patch module is listed in `patches.txt` in the correct position (after the last applied patch for the app)
- [ ] Patch is idempotent: running it twice leaves the database unchanged
- [ ] Patch uses `frappe.db.exists()` / `frappe.db.count()` before creating or renaming records
- [ ] Patch does not use `frappe.db.sql()` raw strings
- [ ] Patch has been dry-run on a restored backup before the PR (note it in the PR description)

**Critical if:** Patch is not idempotent — re-migration corrupts data.

### Fixtures

- [ ] Fixtures are exported only for DocTypes owned by the app (not core Frappe/ERPNext DocTypes)
- [ ] If core DocType fixtures are intentional (e.g. Custom Fields, Property Setters), they are exported via `bench export-fixtures` and scoped with `"doctype"` field in the fixture JSON
- [ ] Fixture export was run with `bench --site <site> export-fixtures --app <app>` — no hand-edited JSON

### Translations (i18n)

- [ ] Every user-visible string on the server uses `frappe._("...")` (aliased as `_()` in controllers)
- [ ] Every user-visible string in client scripts uses `__("...")`
- [ ] Dynamic values are interpolated via format: `_("Hello {0}").format(name)`, not f-strings inside `_()`

### v15/v16 compatibility

- [ ] `from frappe.tests.utils import FrappeTestCase` replaced with `from frappe.tests import IntegrationTestCase` (the old import is a deprecated shim, removed in v17)
- [ ] Any v16-only API (noted `(v16)` in frappe-* skill references) has a fallback or a version guard if the app targets v15 sites
- [ ] `frappe.__version__` is not hard-coded anywhere in the app; use `frappe.utils.version.get_version()` if a version check is genuinely needed

### Migration

- [ ] If any DocType JSON (field list, permissions, naming series) changed, the PR description says "`bench --site <site> migrate` required"
- [ ] New or changed fields in DocType JSON are also present in any related fixture JSON (if fixtures are used)
- [ ] `bench --site <site> migrate` was run locally and produced no errors

### Change sizing

- [ ] Change is ~100 lines (good) or ~300 lines (acceptable for one logical change)
- [ ] Changes over 300 lines have a splitting strategy proposed (horizontal / vertical / refactor-then-feature)
- [ ] Refactoring and feature work are in separate commits (or separate PRs)

---

## Reviewing agent output: extra checks

When the diff was produced by an AI agent:

- [ ] No `frappe.db.sql()` anywhere in the diff
- [ ] No `ignore_permissions=True` added silently
- [ ] No new `allow_guest=True` without explicit justification
- [ ] All user-visible strings use `_()` / `__()`
- [ ] Patch (if any) was explicitly tested for idempotency

---

## Sources

Verified against Frappe v16.35.0:

- `apps/frappe/frappe/client.py` — `@frappe.whitelist()` decorator with `allow_guest` parameter (lines 26–259)
- `apps/frappe/frappe/permissions.py` — `has_permission()` signature (line 81)
- `apps/frappe/frappe/__init__.py` — `frappe.flags` (line 115), `frappe.local` (line 76)
- `apps/frappe/frappe/exceptions.py` — exception classes including `PermissionError`, `ValidationError`
- `apps/frappe/frappe/deprecation_dumpster.py` — `FrappeTestCase` deprecated compatibility shim
- `apps/frappe/frappe/tests/__init__.py` — `IntegrationTestCase` canonical import
- `apps/frappe/frappe/patches.txt` — patches.txt format and ordering convention
- `apps/frappe/frappe/query_builder/` — `frappe.qb` namespace; imported in `frappe/__init__.py` line 37
