# Controllers & Document Lifecycle

Controllers add server-side logic to DocTypes via Python classes.

## File location

```
apps/<app>/<app>/<module>/doctype/<doctype_name>/<doctype_name>.py
```

## Basic controller

```python
import frappe
from frappe.model.document import Document

class Expense(Document):
    def validate(self):
        if self.amount <= 0:
            frappe.throw("Amount must be positive")

    def before_save(self):
        self.total = sum(item.amount for item in self.items)
```

The class name is the DocType name with spaces removed (e.g. "Expense Category" → `ExpenseCategory`).

## Document lifecycle hooks

Called in this order:

### On insert (new document)
1. `before_insert`
2. `before_naming` (before name is set)
3. `autoname` (custom naming logic — `self.name` is set after this)
4. `before_validate`
5. `validate`
6. `before_save`
7. (db insert)
8. `after_insert`
9. `on_update`
10. `after_save`
11. `on_change`

### On update (existing document)
1. `before_validate`
2. `validate`
3. `before_save`
4. (db update)
5. `on_update`
6. `after_save`
7. `on_change`

### On submit (submittable DocTypes)
1. `before_validate`
2. `validate`
3. `before_save`
4. `before_submit`
5. `on_submit`
6. `on_update`
7. `after_save`
8. `on_change`

### On cancel
1. `before_cancel`
2. `on_cancel`
3. `on_change`

### On delete
1. `on_trash`
2. `after_delete`

## Common patterns

### Set defaults before validation
```python
def before_validate(self):
    if not self.currency:
        self.currency = frappe.defaults.get_global_default("currency")
```

### Throw validation errors
```python
frappe.throw("Error message")                    # general error
frappe.throw("Message", frappe.ValidationError)  # with exception type
```

### Access current user
```python
frappe.session.user  # email of logged-in user
```

### Interact with other DocTypes
```python
def on_submit(self):
    frappe.get_doc(
        doctype="Notification Log",
        subject=f"Expense {self.name} approved"
    ).insert(ignore_permissions=True)
```

### Access flags
```python
# Set a flag to skip validation in specific cases
doc.flags.ignore_validate = True
doc.save()
```

## Anti-patterns

- **Don't use `frappe.db.set_value` for fields with validation logic.** It bypasses `validate()`, `before_save()`, and all lifecycle hooks. Never use it for status fields or state transitions. Use it only for simple counters, timestamps, or cached values.
  ```python
  # BAD — skips controller validation
  frappe.db.set_value("Expense", name, "status", "Approved")
  # GOOD
  doc = frappe.get_doc("Expense", name)
  doc.status = "Approved"
  doc.save()
  ```
- **Don't call `frappe.db.commit()` in controller methods or request handlers.** See the Transactions section in [database](./database.md) reference.
- **Put permission checks inside controller methods**, not in API wrapper helpers. This ensures enforcement regardless of call path (API, desk, background job).
  ```python
  # BAD — check in api.py wrapper
  def _get_manager_doc(name):
      if "Expense Manager" not in frappe.get_roles(): ...
  # GOOD — check in the controller method itself
  class Expense(Document):
      @frappe.whitelist()
      def approve(self):
          if "Expense Manager" not in frappe.get_roles():
              frappe.throw("Not allowed", frappe.PermissionError)
  ```
- **Be consistent with permission checks across all controller methods.** If some methods on a DocType check for a role explicitly, all mutating methods should do the same — don't rely on implicit DocType perms for some and explicit checks for others.

---

## Controller Lifecycle Hooks

### Verified Execution Order (v16, per action)

> Source-verified against `apps/frappe/frappe/model/document.py` (`insert`, `_save`,
> `run_before_save_methods`, `run_post_save_methods`) and `frappe/model/delete_doc.py`
> / `rename_doc.py`. The single most common mistake is thinking `validate` runs
> AFTER insert — it does not. On insert, `run_before_save_methods()` (which runs
> `validate`) executes BEFORE the DB write.

**INSERT (new document, `_action = "save"`)** — `Document.insert()`:
```
1.  before_insert
2.  autoname            (set_new_name -> also runs the `autoname` method if defined)
3.  before_validate
4.  validate
5.  before_save
    (internal: _validate -> mandatory, links, data-field, select validations)
6.  --- DB INSERT (db_insert / update_single for Single) + children db_insert ---
7.  after_insert
8.  on_update
9.  on_change
```

**SAVE (existing document, `_action = "save"`)** — `Document.save()` -> `_save()`:
```
1.  before_validate
2.  validate
3.  before_save
    (internal: _validate)
4.  --- DB UPDATE ---
5.  on_update
6.  on_change
```

**SUBMIT (`_action = "submit"`)** — `submit()` -> `_submit()` sets `docstatus = 1`, then `save()`:
```
1.  before_validate
2.  validate
3.  before_submit
    (internal: _validate)
4.  --- DB UPDATE (docstatus = 1) ---
5.  on_update
6.  on_submit
7.  on_change
```

**CANCEL (`_action = "cancel"`)** — `cancel()` -> `_cancel()` sets `docstatus = 2`, then `save()`:
```
1.  before_cancel        (NOTE: validate / _validate are SKIPPED on cancel)
2.  --- DB UPDATE (docstatus = 2) ---
3.  on_cancel            (+ check_no_back_links_exist)
4.  on_change
```

**UPDATE AFTER SUBMIT (`_action = "update_after_submit"`)** — save of a submitted doc
(only `allow_on_submit` fields; triggered by `db_set` on submitted docs / amend flows):
```
1.  before_update_after_submit   (before_validate is NOT run for this action)
    (internal: _validate)
2.  --- DB UPDATE ---
3.  on_update_after_submit
4.  on_change
```

**DELETE (`frappe.delete_doc`)** — `frappe/model/delete_doc.py`:
```
1.  on_trash             (skipped if ignore_on_trash=True)
2.  on_change            (with flags.in_delete = True)
3.  --- DB DELETE (delete_from_table) ---
4.  after_delete
```

**RENAME (`frappe.rename_doc`)** — `frappe/model/rename_doc.py`:
```
1.  before_rename(old, new, merge)   (may return {"new": ...} to transform the name)
2.  --- rename record + child references ---
3.  after_rename(old, new, merge)
```

**FORM LOAD (Desk):** `onload` runs when a document is loaded into a form (not on save).

Each `run_method(event)` also fires, in order: hooked `doc_events` handlers
(before/after wrappers), Notifications, Webhooks, and Server Scripts bound to that
event (`document.py:run_method` -> `run_notifications` / `run_webhooks` /
`run_server_script_for_doc_event`).

### Complete Controller Template

```python
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today, flt

class CustomerRequest(Document):

    def validate(self):
        self.validate_customer()
        self.validate_dates()
        self.calculate_totals()

    def validate_customer(self):
        if not frappe.db.exists("Customer", self.customer):
            frappe.throw(_("Customer {0} does not exist").format(self.customer))

    def validate_dates(self):
        if self.due_date and self.due_date < today():
            frappe.throw(_("Due Date cannot be in the past"))

    def calculate_totals(self):
        self.total_qty = sum(flt(item.qty) for item in self.items)
        self.total_amount = sum(flt(item.amount) for item in self.items)

    def before_submit(self):
        if not self.items:
            frappe.throw(_("Cannot submit without items"))

    def on_submit(self):
        self.update_customer_status()

    def on_cancel(self):
        self.status = "Cancelled"

    def update_customer_status(self):
        frappe.db.set_value("Customer", self.customer, "last_order_date", today())

    @frappe.whitelist()
    def get_summary(self):
        """Called from client: frm.call('get_summary')"""
        return {
            "total_items": len(self.items),
            "total_amount": self.total_amount,
            "status": self.status
        }
```

---

---

## Document API Methods

### Core Functions

```python
doc = frappe.get_doc("Customer", "CUST-001")
doc = frappe.get_doc("Customer", {"email_id": "test@example.com"})
doc = frappe.get_cached_doc("Customer", "CUST-001")
doc = frappe.get_last_doc("Sales Invoice", filters={"customer": "CUST-001"})

# Create
doc = frappe.new_doc("Customer")
doc.customer_name = "New Customer"
doc.insert()

# Alternative create
doc = frappe.get_doc({"doctype": "Customer", "customer_name": "New"}).insert()

# Delete
frappe.delete_doc("Customer", "CUST-001")
frappe.delete_doc("Customer", "CUST-001", force=True)

# Rename
frappe.rename_doc("Customer", "OLD-NAME", "NEW-NAME")
```

### Document Methods

```python
doc.insert(ignore_permissions=True, ignore_if_duplicate=True)
doc.save(ignore_permissions=True)
doc.reload()
doc.db_set("status", "Active")  # Direct DB update, bypasses controller
doc.submit()
doc.cancel()
doc.check_permission("write")  # Throws if denied
url = doc.get_url()  # /app/customer/CUST-001
doc.has_value_changed("status")  # In controller
old_doc = doc.get_doc_before_save()  # In controller

# Comments and tags
doc.add_comment("Comment", "This is a comment")
doc.add_tag("VIP")
```

---

## Sources

Verified against Frappe v16.9.0 (`frappe/__init__.py` `__version__ = "16.9.0"`):

- `apps/frappe/frappe/model/document.py` — `insert`, `save`/`_save`, `run_before_save_methods`, `run_post_save_methods`, `run_method`, `_submit`/`_cancel`, `_validate`, `Document.__init__`, `load_from_db`
- `apps/frappe/frappe/model/delete_doc.py` — `on_trash` / `on_change` / `after_delete` ordering
- `apps/frappe/frappe/model/rename_doc.py` — `before_rename` / `after_rename`
- `apps/frappe/frappe/model/base_document.py` — `get_controller`, `override_doctype_class` + `extend_doctype_class`
- `apps/frappe/frappe/core/doctype/doctype/doctype.json` — DocType-level Check flags, `naming_rule` options
- `apps/frappe/frappe/model/naming.py` — naming series / autoname tokens
- `apps/frappe/frappe/desk/doctype/todo/todo.json` — representative DocType JSON structure
