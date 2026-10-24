# Patch Patterns

Verified patch patterns for Frappe apps, derived from installed framework source.
All examples use `frappe.qb` / `frappe.get_all` / `frappe.db.set_value`; never raw SQL.

---

## 1. Idempotency guard — exists check

Use before inserting or renaming a document:

```python
# <app>/patches/v16_0/create_default_config.py
import frappe


def execute():
    if frappe.db.exists("My Config", "Default"):
        return  # already applied

    frappe.get_doc({
        "doctype": "My Config",
        "name": "Default",
        "enabled": 1,
    }).insert(ignore_permissions=True)
    frappe.db.commit()
```

Pattern: early return on `frappe.db.exists()` keeps the patch safe across
multi-tenant benches and re-runs (re-run line in `patches.txt` requires a
dated comment: `my_patch #2025-06-01 re-run`).

---

## 2. Batch backfill with commit

For large tables, batch rows and commit each batch to release row locks:

```python
# <app>/patches/v16_0/backfill_status_field.py
import frappe


def execute():
    """Set status = 'Active' for rows where status is blank.

    Batched: 500 rows per transaction to avoid long row-lock windows.
    """
    frappe.reload_doctype("My Doc")

    while True:
        batch = frappe.get_all(
            "My Doc",
            filters={"status": ("is", "not set")},
            fields=["name"],
            limit=500,
            order_by="creation asc",
        )
        if not batch:
            break
        for row in batch:
            frappe.db.set_value("My Doc", row.name, "status", "Active",
                                update_modified=False)
        frappe.db.commit()
```

Verified pattern: `frappe/frappe/patches/v15_0/validate_newsletter_recipients.py`
and `frappe/frappe/patches/v16_0/backfill_notification_log_app.py` both call
`frappe.db.set_value` in a loop followed by `frappe.db.commit()`.

---

## 3. Drop a column (pre_model_sync)

Column removal must run **before** `bench migrate` loads the new DocType JSON
(which no longer references the column). Place in `[pre_model_sync]`:

```python
# <app>/patches/v16_0/drop_old_field.py
import frappe
from frappe.model.db_schema import DbManager


def execute():
    if not frappe.db.has_column("My Doc", "old_field"):
        return  # already dropped or never existed

    frappe.db.sql("ALTER TABLE `tabMy Doc` DROP COLUMN `old_field`")  # nosemgrep
    frappe.db.commit()
```

`ALTER TABLE` is the only acceptable `frappe.db.sql` use in patches; annotate
with `# nosemgrep` as Frappe itself does (see
`frappe/patches/v12_0/set_primary_key_in_series.py`). This is the one
exception documented in `frappe-api-development/references/database.md`.

`patches.txt` entry:
```
[pre_model_sync]
<app>.patches.v16_0.drop_old_field
```

---

## 4. Delete a DocType

```python
# <app>/patches/v16_0/remove_legacy_doctype.py
import frappe


def execute():
    if not frappe.db.exists("DocType", "Legacy DocType"):
        return

    if frappe.db.count("Legacy DocType") > 0:
        frappe.throw(
            "Legacy DocType has data; cannot remove. Archive first."
        )

    frappe.delete_doc("DocType", "Legacy DocType", force=True,
                      ignore_missing=True)
    frappe.db.commit()
```

Run count check before delete; a `frappe.throw` stops the migration cleanly
rather than silently deleting occupied tables.

---

## 5. Reload a DocType after schema change

Always call `frappe.reload_doctype` at patch start when the patch reads or
writes to a field that was added in this release cycle:

```python
def execute():
    frappe.reload_doctype("Sales Invoice")
    # now meta cache reflects new fields
    frappe.get_all("Sales Invoice", fields=["new_field"])
```

Verified in `frappe/patches/v16_0/enable_setup_complete.py`:
```python
frappe.reload_doc("core", "doctype", "installed_application")
```
`reload_doctype(dt)` is equivalent to `reload_doc(module, "doctype", dt_snake)`
and is the preferred single-call form.

---

## 6. Rename a document (advisory: keep old name as alias)

```python
# <app>/patches/v16_0/rename_workspace.py
import frappe


def execute():
    if not frappe.db.exists("Workspace", "Old Name"):
        return

    frappe.rename_doc("Workspace", "Old Name", "New Name",
                      merge=False, ignore_permissions=True)
    frappe.db.commit()
```

`frappe.rename_doc` is the idiomatic call; it updates all Link fields pointing
to the renamed document via `frappe/model/rename_doc.py`.

---

## Sources

- `apps/frappe/frappe/patches.txt` — `[pre_model_sync]` / `[post_model_sync]` section markers verified at lines 1 and 200
- `apps/frappe/frappe/patches/v16_0/backfill_notification_log_app.py` — batch `set_value` + `db.commit()` loop pattern
- `apps/frappe/frappe/patches/v15_0/validate_newsletter_recipients.py` — per-row `db.commit()` in a for loop
- `apps/frappe/frappe/patches/v16_0/enable_setup_complete.py` — `frappe.reload_doc` before reads; `frappe.get_all` with `pluck`
- `apps/frappe/frappe/patches/v15_0/sanitize_workspace_titles.py` — try/except with `db.rollback()` per iteration
- `apps/frappe/frappe/commands/utils.py` lines 405-416 — `export-fixtures --app` option verified
- `apps/frappe/frappe/commands/scheduler.py` lines 111-124 — `set-maintenance-mode on|off` command
