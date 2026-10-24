# <Bench Name> — Agent Context

<!-- Machine-agnostic template. Replace all <placeholders>. No absolute paths.
     Place this file at the bench root (same level as apps/, sites/, Procfile).
     Regenerate after any app upgrade (versions come from apps/<app>/<app>/__init__.py). -->

## Bench layout

| App | Version | Role |
|---|---|---|
| frappe | `<read from apps/frappe/frappe/__init__.py>` | Framework |
| erpnext | `<read from apps/erpnext/erpnext/__init__.py>` | ERP core (if installed) |
| hrms | `<read from apps/hrms/hrms/__init__.py>` | HR/Payroll (if installed) |
| `<app>` | `<read from apps/<app>/<app>/__init__.py>` | Custom app |

**Default site:** `<site>`
**developer_mode:** `<1 or 0 — check sites/<site>/site_config.json>`

## Commands

```bash
# Schema changes
bench --site <site> migrate

# Python / hooks changes only
bench --site <site> clear-cache

# JS / CSS / Vue changes
bench build --app <app>

# Run tests (requires allow_tests = true)
bench --site <site> set-config allow_tests true
bench --site <site> run-tests --app <app> --module <app>.<module>

# Interactive console
bench --site <site> console

# Set a site_config key (feature flags, etc.)
bench --site <site> set-config <key> <value>

# Re-run a single patch
bench --site <site> run-patch <app>.<module>.<patch> --force
```

## Skills

Load `frappe-router/SKILL.md` first. It routes you to the correct skill for each task type.
Load only the skill relevant to the current task — do not load all skills at once.

Skills are located at: `<path to skills repo or bench-local skills directory>`.

## Code conventions

- Use `frappe.qb` / `frappe.get_all` / `frappe.get_list` for all queries. Never `frappe.db.sql` unless documented in `frappe-api-development/references/database.md`.
- Never edit core Frappe or ERPNext DocTypes. Extend via Custom Fields, `doc_events`, `override_doctype_class`, patches.
- Always use `bench --site <site> ...`; never bare `bench migrate` (ambiguous on multi-site benches).
- Translate every user-facing string: `frappe.throw(_("..."))`, never a bare string.
- Wrap controller validation errors in `frappe.throw(_("..."))` with `frappe.ValidationError` where appropriate.

## Boundaries — ask a human before doing

- Any DocType JSON schema change on a table that has live data
- Dropping or renaming a column (requires a pre_model_sync patch)
- Changing a role permission or adding `has_permission` / `permission_query_conditions`
- Any direct GL Entry, Stock Ledger Entry, or Payment Entry creation outside a normal submit flow
- Deleting or bulk-updating records that are not reversible from the UI

## Hooks reference

Valid controller hooks (verify in `apps/frappe/frappe/model/document.py`):
`validate`, `before_save`, `after_insert`, `on_update`, `before_submit`, `on_submit`,
`before_cancel`, `on_cancel`, `before_trash`, `on_trash`, `after_delete`,
`before_discard` / `on_discard` (v16 draft discard).

**`after_save` is NOT a valid hook in Frappe v16.** Use `after_insert` (new) or `on_update` (any save).

## patches.txt format

```
[pre_model_sync]
<app>.patches.v1_0.destructive_column_op   # runs BEFORE schema sync

[post_model_sync]
<app>.patches.v1_0.backfill_new_column     # runs AFTER schema sync
```

## Context hygiene

- Load only the spec section relevant to the current task.
- Drop tracebacks and failed-attempt logs once the issue is resolved (keep the one-line conclusion).
- Put the current file and active error **last** in context, not first.
- If output quality degrades: stop, stash work, start a fresh session, re-read this file + active spec + `git status`.
