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
- **Don't call `frappe.db.commit()` in controller methods or request handlers.** See the Transactions section in [database](../../frappe-api-development/references/database.md) reference.
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
- **Don't import another controller at module level if it can import back.** Circular imports between controllers surface as `ImportError`/`AttributeError` at boot. Import inside the method body instead.
- **Don't add fields by editing the controller or its type hints.** The DocType JSON is the schema. Edit the JSON (or the Desk form, which writes it), then `bench --site <site> migrate`.

## Type hints — `frappe.types.DF`

Saving a standard DocType regenerates a `TYPE_CHECKING` block in its controller that declares every field with a `DF` alias — only when `developer_mode` is on **and** the app's `hooks.py` sets `export_python_type_annotations = True` (`DocType.export_types_to_controller`, `frappe/types/exporter.py`). These are static hints only and change nothing at runtime. Aliases in `frappe/types/DF.py`:

`Data`, `Text`, `SmallText`, `LongText`, `Code`, `TextEditor`, `MarkdownEditor`, `HTMLEditor`, `JSON`, `Int`, `Float`, `Currency`, `Percent`, `Rating`, `Check` (`bool | int`), `Select` (`Literal[...]`), `Link`, `DynamicLink`, `Date`, `Datetime`, `Time`, `Duration`, `Attach`, `AttachImage`, `Password`, `Phone`, `Color`, `Barcode`, `Autocomplete`, `ReadOnly`, `Table` / `TableMultiSelect` (`list[ChildDoc]`).

```python
class Expense(Document):
	# begin: auto-generated types
	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amount: DF.Currency
		status: DF.Literal["Draft", "Approved"]
	# end: auto-generated types
```

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
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `doctype-development/references/controllers.md`.

```markdown
# Controller Lifecycle Hooks Reference

## Overview
Controllers are Python classes that handle document lifecycle events. Each DocType can have a controller that extends `frappe.model.document.Document`.

## Controller Structure

```python
### my_app/doctype/my_doc/my_doc.py
import frappe
from frappe import _
from frappe.model.document import Document

class MyDoc(Document):
    def validate(self):
        """Called during save, before database write."""
        pass
    
    def before_save(self):
        """Called after validate, before database write."""
        pass
    
    def after_insert(self):
        """Called after first save (insert only)."""
        pass
```

## Lifecycle Hook Order

### On Insert (New Document)
```
1. __init__
2. before_insert
3. validate
4. before_save
5. before_naming (if autoname)
6. autoname
7. [Database INSERT]
8. after_insert
9. after_save
10. on_change
```

### On Update (Existing Document)
```
1. __init__
2. validate
3. before_save
4. [Database UPDATE]
5. on_update
6. after_save
7. on_change
```

### On Submit (Submittable DocTypes)
```
1. validate
2. before_save
3. before_submit
4. [Database UPDATE - docstatus=1]
5. on_submit
6. after_save
7. on_change
```

### On Cancel
```
1. before_cancel
2. [Database UPDATE - docstatus=2]
3. on_cancel
4. on_change
```

### On Delete
```
1. before_delete (v16+) / on_trash
2. [Database DELETE]
3. after_delete
```

## Hook Reference

### Validation Hooks

#### validate
Called on every save. Use for data validation and lightweight normalization.

```python
def validate(self):
    if self.end_date and self.start_date:
        if self.end_date < self.start_date:
            frappe.throw(_("End Date cannot be before Start Date"))
    
    # Normalize data
    if self.email:
        self.email = self.email.lower().strip()
```

**Best Practices:**
- Keep lightweight - runs on every save
- Raise `frappe.throw()` for validation errors
- Don't make external API calls
- Don't create/modify other documents

#### before_validate
Called before `validate`. Use for pre-validation setup.

```python
def before_validate(self):
    # Set computed fields that validation depends on
    self.total = sum(item.amount for item in self.items)
```

### Save Hooks

#### before_save
Called after validation, before database write. Use for final data normalization.

```python
def before_save(self):
    self.full_name = f"{self.first_name} {self.last_name}".strip()
    self.modified_by_script = True
```

#### after_save
Called after database write. Use for post-save actions that need the saved state.

```python
def after_save(self):
    # Update related documents
    if self.has_value_changed("status"):
        self.update_related_records()
    
    # Clear caches
    frappe.cache().delete_key(f"my_doc:{self.name}")
```

### Insert/Creation Hooks

#### before_insert
Called only on new document creation, before any validation.

```python
def before_insert(self):
    # Set defaults that depend on other field values
    if not self.assigned_to:
        self.assigned_to = self.get_default_assignee()
```

#### after_insert
Called only after first save. Use for post-creation side effects.

```python
def after_insert(self):
    # Create related documents
    self.create_initial_task()
    
    # Send notifications
    frappe.publish_realtime("new_document", {
        "doctype": self.doctype,
        "name": self.name
    })
```

### Update Hooks

#### on_update
Called after save of existing document (not on insert).

```python
def on_update(self):
    # Sync with external systems
    if self.has_value_changed("status"):
        self.sync_to_external_system()
```

### Submit/Cancel Hooks (Submittable DocTypes)

#### before_submit
Called before docstatus changes to 1.

```python
def before_submit(self):
    # Final validation before locking
    if not self.items:
        frappe.throw(_("Cannot submit without items"))
    
    # Set submission timestamp
    self.submitted_at = frappe.utils.now()
```

#### on_submit
Called after docstatus changes to 1.

```python
def on_submit(self):
    # Create downstream documents
    self.create_invoice()
    
    # Update stock
    self.update_stock_ledger()
```

#### before_cancel
Called before docstatus changes to 2.

```python
def before_cancel(self):
    # Check if cancellation is allowed
    if self.has_linked_invoices():
        frappe.throw(_("Cancel linked invoices first"))
```

#### on_cancel
Called after docstatus changes to 2.

```python
def on_cancel(self):
    # Reverse downstream effects
    self.reverse_stock_entries()
    self.cancel_linked_documents()
```

### Update After Submit

#### before_update_after_submit
For fields with `allow_on_submit = 1`.

```python
def before_update_after_submit(self):
    # Validate changes to submitted document
    if self.has_value_changed("critical_field"):
        frappe.throw(_("Cannot change critical field after submit"))
```

#### on_update_after_submit
Called after update to submitted document.

```python
def on_update_after_submit(self):
    # Handle allowed post-submit changes
    self.recalculate_totals()
```

### Delete Hooks

#### on_trash
Called before document deletion.

```python
def on_trash(self):
    # Clean up related records
    frappe.delete_doc("Comment", {"reference_doctype": self.doctype, "reference_name": self.name})
    
    # Clear files
    self.delete_attachments()
```

#### after_delete
Called after document deletion.

```python
def after_delete(self):
    # Clear caches
    frappe.cache().delete_key(f"my_doc_list")
```

### Change Detection Hook

#### on_change
Called whenever document state changes (save, submit, cancel).

```python
def on_change(self):
    # Audit logging
    if self.has_value_changed("status"):
        self.log_status_change()
```

## Utility Methods

### has_value_changed
Check if a field changed during this save.

```python
def on_update(self):
    if self.has_value_changed("status"):
        old_status = self.get_doc_before_save().status
        new_status = self.status
        frappe.log(f"Status changed: {old_status} → {new_status}")
```

### get_doc_before_save
Access the document state before current changes.

```python
def validate(self):
    old_doc = self.get_doc_before_save()
    if old_doc and old_doc.submitted:
        frappe.throw(_("Cannot modify submitted document"))
```

### db_set
Update single field without triggering hooks.

```python
def after_save(self):
    # Update counter without triggering another save
    self.db_set("view_count", self.view_count + 1)
```

### run_method
Call a method if it exists.

```python
def after_save(self):
    self.run_method("custom_after_save")  # Calls if defined
```

## Best Practices

### Keep Controllers Thin
```python
### ❌ Bad: Business logic in controller
def on_submit(self):
    # 50 lines of invoice creation logic...

### ✅ Good: Delegate to service layer
def on_submit(self):
    from my_app.services.invoicing import create_invoice_from_order
    create_invoice_from_order(self)
```

### Use Appropriate Hooks
| Task | Recommended Hook |
|------|------------------|
| Data validation | `validate` |
| Computed fields | `before_save` |
| Send notifications | `after_insert`, `after_save` |
| Create related docs | `after_insert`, `on_submit` |
| External sync | `on_update`, `on_submit` |
| Cleanup on delete | `on_trash` |

### Avoid Common Mistakes
```python
### ❌ Don't: Create documents in validate (may not save)
def validate(self):
    frappe.get_doc({"doctype": "Log"}).insert()

### ✅ Do: Create in after_save
def after_save(self):
    frappe.get_doc({"doctype": "Log"}).insert()

### ❌ Don't: Long operations in hooks
def on_submit(self):
    sync_to_100_external_systems()  # Blocks request

### ✅ Do: Background jobs for long operations
def on_submit(self):
    frappe.enqueue("my_app.jobs.sync_external", doc_name=self.name)
```

Sources: Controller Methods, Document API, Lifecycle Hooks (official docs)
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
