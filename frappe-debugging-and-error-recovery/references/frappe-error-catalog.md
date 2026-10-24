# Frappe Error Catalog

Common exceptions raised by Frappe v16, with cause and fix. All classes live in
`apps/frappe/frappe/exceptions.py`.

## ValidationError

Base class for all document validation failures. Subclasses below are thrown by
the framework; you may also throw it directly: `frappe.throw(_("msg"), frappe.ValidationError)`.

**Cause:** Any `validate()` or `before_save()` check that calls `frappe.throw()`.  
**Fix:** Read the message in the Error Log; trace the hook that threw it.

---

## MandatoryError

**Cause:** A `reqd = 1` field is blank when the document is saved.  
**Fix:** Populate the required field. If the field should not be required in this context, check `depends_on` / `mandatory_depends_on` on the field definition.

---

## LinkValidationError

**Cause:** A Link field value does not exist in the linked DocType, or is filtered out by `link_filters`.  
**Fix:** Ensure the linked record exists and is not draft/cancelled. Check `on_trash` hooks that delete parent records before children.

---

## CancelledLinkError (subclass of LinkValidationError)

**Cause:** A Link field points to a cancelled document.  
**Fix:** Amend or reopen the linked document, or clear the field.

---

## TimestampMismatchError

**Cause:** Two users (or two processes) loaded the same document and one saved after the other. Frappe detects the `modified` timestamp mismatch and rejects the second save.  
**Fix:** Instruct the user to reload the document. For programmatic saves in a loop, re-fetch the doc before each save: `doc.reload()` before `doc.save()`.

---

## DoesNotExistError (subclass of ValidationError)

**Cause:** `frappe.get_doc()` or `frappe.get_value()` called for a name that does not exist in the database.  
**Fix:** Guard with `if frappe.db.exists("DocType", name):` before fetching. Check whether the record was deleted by an `on_trash` hook.

---

## CharacterLengthExceededError

**Cause:** A field value exceeds the column's `length` (default 140 for Data fields).  
**Fix:** Increase the field length via Custom Field or DocType definition and run `bench --site <site> migrate`.

---

## QueryDeadlockError

**Cause:** Two concurrent transactions attempt to lock the same rows in opposite order. MariaDB raises error 1213; Frappe wraps it as `QueryDeadlockError`.  
**Fix:** Move the heavy write operation to a background job (`frappe.enqueue`) so it runs outside the web request transaction. If the deadlock is between two background jobs, serialise them with a mutex or stagger their schedules.

---

## PermissionError

**Cause:** `frappe.has_permission()` returned `False`, or the user lacks the required role in Permission Manager.  
**Fix:** Grant the role in Permission Manager, or add a `has_permission` hook in `hooks.py` to extend permissions programmatically. Never use `ignore_permissions=True` to silence the error without understanding why.

---

## DuplicateEntryError (subclass of NameError)

**Cause:** A unique constraint (naming series or explicit `unique=1` field) was violated on `INSERT`.  
**Fix:** Check for an existing record before inserting. If the naming series collided, check `tabSeries` for corruption.

---

## DocumentLockedError (subclass of ValidationError)

**Cause:** The document is locked by another user (edit lock). Frappe uses a Redis key to track who is editing.  
**Fix:** Wait for the lock to expire (default 5 minutes), or the other user to close the form. For bulk operations, use `ignore_version=True` on trusted programmatic saves.

---

## Deadlock / Lock Wait Timeout (MariaDB-level)

Not a Python class — a MariaDB error (1205 lock wait timeout, 1213 deadlock) caught by `frappe.database.mariadb.database.MariaDBExceptionUtil.is_deadlocked()` and re-raised as `QueryDeadlockError`.

**Cause:** Long-running transactions, `ALTER TABLE` holding a metadata lock, or batch inserts fighting each other.  
**Fix:** Run schema changes during low-traffic windows. Use `bench --site <site> mariadb` to inspect `SHOW ENGINE INNODB STATUS\G` for the lock holder.

---

## Sources

Verified against Frappe v16.35.0:

- `apps/frappe/frappe/exceptions.py` — all exception class definitions
- `apps/frappe/frappe/database/database.py` — `QueryDeadlockError` raised at line 278
- `apps/frappe/frappe/database/mariadb/database.py` — `is_deadlocked()` (error codes 1213, snapshot isolation)
- `apps/frappe/frappe/database/mariadb/mysqlclient.py` — `is_deadlocked()` for MySQLdb driver
- `apps/frappe/frappe/permissions.py` — `has_permission()` definition (line 81)
- `apps/frappe/frappe/utils/error.py` — `log_error()` definition (line 44)
- `apps/frappe/frappe/__init__.py` — `log_error` re-exported (line 1609), `frappe.local` (line 76), `frappe.flags` (line 115)
- `apps/frappe/frappe/commands/scheduler.py` — `bench doctor` command (line 133)
- `apps/frappe/frappe/commands/utils.py` — `bench console` (line 652), `bench mariadb` (line 519)
- `<bench>/logs/` — actual log files observed: `frappe.log`, `worker.error.log`, `worker.log`, `scheduler.log`
