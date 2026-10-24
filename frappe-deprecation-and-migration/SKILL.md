---
name: frappe-deprecation-and-migration
description: "Manages deprecation, field renames, and data migration in Frappe apps. Use when renaming or removing fields, DocTypes, whitelisted API methods, or hooks; when writing idempotent patches; when planning a v15 → v16 upgrade; or when safely deprecating endpoints that external callers still use. Not for routine bench upgrade operations → frappe-bench-operations. Not for creating new DocTypes → frappe-doctype-development."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/deprecation-and-migration/SKILL.md -->

# Frappe Deprecation and Migration

Code is a liability. Remove deprecated fields, DocTypes, and APIs safely through idempotent patches and tested migrations.

## When to use

- Removing a Custom Field, DocType, or whitelisted API that is no longer needed
- Writing a `patches.txt` entry to migrate data before or after `bench migrate` syncs schema
- Planning or executing a v15 → v16 upgrade across sites
- Removing zombie hooks, overrides, or doc_events that nothing uses
- Announcing a breaking change to API consumers

Not for: bench upgrade mechanics → `frappe-bench-operations`. Writing new DocTypes → `frappe-doctype-development`.

## Inputs required

- The field, DocType, API, or hook being removed and its current consumers
- The target Frappe version branch (`version-15` / `version-16`)
- A restored backup of the production site for dry-run (never the live site)

## Procedure

### 0) Code-as-liability mindset

Every line maintained = tests to update, security patches to apply, and mental overhead for reviewers. Before removing anything, confirm:
1. A working replacement exists (or the behaviour is no longer needed).
2. All callers have been migrated (grep the codebase; check `doc_events` and `override_whitelisted_methods` in every app).
3. Usage metrics (Error Log, frappe.logger, or `frappe.get_all`) confirm zero active consumers.

### 1) Deprecating a field

**Compulsory** (schema must change): add a patch to `patches.txt` in the correct section.
**Advisory** (keep the column, log a warning): add `frappe.log_error` or `warnings.warn` at the read site, announce in CHANGELOG.

For compulsory field removal, use expand/contract:
1. Add the replacement field (nullable); run `bench --site <site> migrate`.
2. Dual-write both fields in the controller.
3. Backfill existing rows via a `[post_model_sync]` patch (batched).
4. Switch reads to the new field; deploy.
5. Drop the old field in a **separate, later** deploy via a `[pre_model_sync]` patch.

Never rename or drop a column in the same deploy as the code that switches to the new name.

### 2) Writing an idempotent patch

```python
# <app>/patches/v16_0/backfill_new_field.py
import frappe


def execute():
    """Backfill MyDoc.new_field from old_field for existing rows.

    Idempotent: skips rows already populated.
    """
    frappe.reload_doctype("My Doc")

    rows = frappe.get_all(
        "My Doc",
        filters={"new_field": ("is", "not set"), "old_field": ("is", "set")},
        fields=["name", "old_field"],
        order_by="creation asc",
        page_length=500,  # batch size; repeat until empty
    )
    while rows:
        for row in rows:
            frappe.db.set_value("My Doc", row.name, "new_field", row.old_field,
                                update_modified=False)
        frappe.db.commit()   # commit each batch to avoid long row-lock windows
        rows = frappe.get_all(
            "My Doc",
            filters={"new_field": ("is", "not set"), "old_field": ("is", "set")},
            fields=["name", "old_field"],
            order_by="creation asc",
            page_length=500,
        )
```

Register in `patches.txt`:
```
[post_model_sync]
<app>.patches.v16_0.backfill_new_field
```

For the destructive step (dropping the column), use `[pre_model_sync]` so the column is gone before the new JSON is loaded. See `references/patch-patterns.md` for more verified examples.

### 3) Deprecating a DocType

1. Verify zero documents in the table (`frappe.db.count("My DocType") == 0`).
2. Remove all references from `hooks.py` (`doc_events`, `fixtures`, `override_doctype_class`).
3. Add a `[pre_model_sync]` patch: `frappe.delete_doc("DocType", "My DocType", force=True, ignore_missing=True)`.
4. Delete the DocType JSON and controller file.
5. Remove the module from `<app>/modules.txt` if it was the last DocType in that module.

### 4) Deprecating a whitelisted API

Advisory path: wrap the old endpoint with a deprecation log and return the same response:
```python
@frappe.whitelist()
def old_endpoint(**kwargs):
    frappe.log_error(
        "old_endpoint is deprecated; use new_endpoint instead",
        reference_doctype="API Deprecation",
    )
    return new_endpoint(**kwargs)
```

Announce in CHANGELOG.md and, if external consumers use the endpoint, via your communication channel with a removal date.

### 5) Dry-run on a backup

**Never run migration experiments on the live site.** Restore a backup to an isolated site first:
```bash
bench --site staging_site restore /path/to/backup.sql.gz
bench --site staging_site migrate
```
Review Error Log and Scheduled Job Log on `staging_site` before applying to production.

### 6) v15 → v16 upgrade playbook

See [`../frappe-project-triage/references/v15-v16-compatibility.md`](../frappe-project-triage/references/v15-v16-compatibility.md) for the full compatibility table — not duplicated here. Key steps:
1. Run `frappe-project-triage` to identify breaking changes for your app.
2. Replace deprecated APIs (listed in the compatibility table) in your app code.
3. Run `bench --site <site> migrate` on a restored backup of the v15 site.
4. Resolve any errors before touching production.

### 7) Removing zombie code

Signs: `doc_events` key with a handler that no longer exists; `override_doctype_class` pointing to a deleted module; a hook in `hooks.py` whose target function was removed.

Process: grep every `hooks.py` key against the actual function paths, remove unreachable entries, run `bench --site <site> migrate` on staging, confirm no new errors in Error Log.

## Verification

- [ ] Replacement covers all consumer use cases; consumers migrated
- [ ] `execute()` is idempotent: runs twice on the same site without error or data corruption
- [ ] Large-table patches batch with `frappe.db.commit()` per batch
- [ ] Drop/rename patch is in a separate deploy from the code change
- [ ] Dry-run completed on a restored backup (not the live site)
- [ ] `frappe.get_all` (not `frappe.db.sql`) used in patch queries
- [ ] Zero references to the removed field/DocType/API remain in the codebase

## Failure modes / debugging

- **Patch already ran and skipped silently**: dotted path is already in `__PatchLog`; to re-run, append a dated comment to the `patches.txt` line.
- **`frappe.db.commit()` in patch causes implicit partial rollback**: ensure `frappe.db.rollback()` is in the `except` block to prevent half-applied batches persisting.
- **`bench migrate` errors on missing column after [pre_model_sync] patch**: the patch dropped a column the DocType JSON still references; move the JSON change to a separate PR first.
- **`delete_doc` fails on DocType with existing records**: data not yet migrated; add a preceding backfill patch.

## Escalation

- Bench upgrade mechanics → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- v15/v16 compatibility table → [`frappe-project-triage`](../frappe-project-triage/SKILL.md)
- Git / patches.txt discipline → [`frappe-git-workflow-and-versioning`](../frappe-git-workflow-and-versioning/SKILL.md)
- Pre-launch backup and restore → [`frappe-shipping-and-launch`](../frappe-shipping-and-launch/SKILL.md)

## References

- [`references/patch-patterns.md`](references/patch-patterns.md) — Verified patch patterns: idempotency guard, batch commit, drop column, delete DocType
- [`references/erpnext-16-50-upgrade-checklist.md`](references/erpnext-16-50-upgrade-checklist.md) — ERPNext 16.6→16.50 / HRMS 16.4→16.50 verified upgrade checklist: breaking patches, field moves, deleted DocTypes, permission changes

## Guardrails

- **Never edit a shipped patch**: Frappe's `__PatchLog` tracks execution by dotted path; editing is invisible.
- **`frappe.qb` / `frappe.get_all` in patches**: `frappe.db.sql` only for cases documented in `frappe-api-development/references/database.md`.
- **No dry-run on the live site**: always restore a backup first.
- **Compulsory deprecation requires a migration path**: do not remove without providing the replacement or the data move.
- **Drop/rename in its own deploy**: never couple schema destruction to the code switch in the same release.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just a patch; skip the dry-run on a backup." | A single bad UPDATE on a large table can lock rows for minutes on the live site. |
| "The field is unused; I'll drop it inline with the code change." | Old and new code both run during a rolling deploy; one will query a column that no longer exists. |
| "I'll add idempotency later; it's a one-off." | `bench migrate` runs on every site in a multi-tenant bench; a non-idempotent patch corrupts subsequent sites. |
| "Users can migrate themselves from the old API." | They won't. Provide the adapter or do the migration. |
| "The DocType is old; nobody uses it." | Verify with `frappe.db.count`; zero records AND zero `doc_events` references before removing. |
| "I'll add `frappe.db.commit()` if it seems slow." | Add it from the start for any patch over a few hundred rows; row locks accumulate silently. |

## Red Flags

- A `patches.txt` line that points to a non-existent module path
- `execute()` with no guard — runs destructively on every `bench migrate`
- A single UPDATE over the entire table with no batching
- `[pre_model_sync]` patch that reads a column added by the same `bench migrate`
- Removing a DocType without checking `frappe.db.count` and `doc_events` consumers
- `frappe.db.sql("ALTER TABLE ...")` in a patch
- v15 → v16 migration attempted on the live site without a prior restore-tested backup

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Putting a backfill in `[pre_model_sync]` | New column doesn't exist yet during pre-sync | Move to `[post_model_sync]` |
| Using `frappe.db.sql` in a patch | Violates skill rule and semgrep check | Use `frappe.qb` / `frappe.db.set_value` |
| Skipping `frappe.reload_doctype()` before querying | Stale meta cache; field not found | Call `frappe.reload_doctype("DocType Name")` at patch start |
| Not committing inside a loop | Entire batch held in one transaction; table lock | `frappe.db.commit()` after each batch |
| Deleting a DocType that still has records | `frappe.delete_doc` raises | Backfill/archive records first, then delete |
| `from frappe.model.db_query import mask_field_value` (frappe 16.51) | `ImportError` — moved to `frappe.model.utils.mask` | Update import to `from frappe.model.utils.mask import mask_field_value` |
| `from frappe.desk.form.assign_to import add` (frappe 16.51) | `ImportError` — renamed to `_add` (private) | Replace with `from frappe.desk.form.assign_to import _add` |
| Reading `frappe.get_single("Accounts Settings").acc_frozen_upto` after ERPNext 16.50 | Field moved to `Company` (now `accounts_frozen_till_date`) | Read from the Company document instead |
| Referencing `"Salary Slip Standard"` or `"Salary Slip with Year to Date"` after HRMS 16.50 | Print formats renamed by `delete_old_salary_slip_print_formats` patch | Use `"Salary Slip Classic"` / `"Salary Slip Detailed"` |
| Reading the `Repost Accounting Ledger Settings` singleton on ERPNext 16.50 | Merged into `Accounts Settings.repost_allowed_types` by patch | Read Accounts Settings; custom voucher doctypes also go in the `repost_allowed_doctypes` hook |
