# Permissions

## DocType-level permissions

Define in the DocType JSON under `permissions`:

```json
{
    "permissions": [
        {
            "role": "System Manager",
            "read": 1, "write": 1, "create": 1, "delete": 1, "submit": 0, "cancel": 0
        },
        {
            "role": "Expense User",
            "read": 1, "write": 1, "create": 1, "delete": 0
        }
    ]
}
```

Permission levels: `read`, `write`, `create`, `delete`, `submit`, `cancel`, `amend`, `print`, `email`, `share`, `export`, `import`, `report`.

## Custom roles

Create a Role DocType JSON:
```json
{
    "name": "Expense User",
    "doctype": "Role",
    "desk_access": 1,
    "is_custom": 0
}
```

Place at: `apps/<app>/<app>/<module>/role/expense_user/expense_user.json`

Or use fixtures in `hooks.py`:
```python
fixtures = [
    {"dt": "Role", "filters": [["name", "in", ["Expense User", "Expense Manager"]]]}
]
```

## Programmatic permission checks

```python
# Check if current user has permission
frappe.has_permission("Expense", "read")
frappe.has_permission("Expense", "write", doc="EXP-0001")

# Throw if no permission
frappe.has_permission("Expense", "write", throw=True)

# Check for specific user
frappe.has_permission("Expense", "read", user="john@example.com")
```

## Bypassing permissions

```python
# Insert without permission checks
doc.insert(ignore_permissions=True)

# flags approach
doc.flags.ignore_permissions = True
doc.save()

# Run as Administrator
frappe.set_user("Administrator")
# ... do work ...
frappe.set_user(original_user)
```

Use `ignore_permissions` only in server-side background logic, never in user-facing APIs.

## User-based filtering (owner permissions)

Add `"if_owner": 1` to a permission rule to restrict users to their own documents:
```json
{
    "role": "Expense User",
    "read": 1, "write": 1,
    "if_owner": 1
}
```

## `has_permission` controller hook

```python
class Expense(Document):
    def has_permission(self, permtype, user=None):
        if permtype == "read" and self.department == get_user_department(user):
            return True
        return False
```

## Row-level filtering on list views (`get_query_conditions`)

To restrict which records appear in list views and `get_list` calls, define `permission_query_conditions` in `hooks.py`:

```python
# hooks.py
permission_query_conditions = {
    "Expense": "myapp.permissions.expense_query_conditions",
}
```

```python
# myapp/permissions.py
import frappe

def expense_query_conditions(user=None):
    if not user:
        user = frappe.session.user
    if "Expense Manager" in frappe.get_roles(user):
        return ""  # no restriction
    return f"`tabExpense`.`owner` = {frappe.db.escape(user)}"
```

Return a SQL WHERE clause fragment (string), or `""` for no restriction. Return `False` to deny all access.

Pair with `has_permission` for complete coverage — `permission_query_conditions` filters lists, `has_permission` guards individual documents.

---

## Permissions & Security

### DocType-Level Permissions

```yaml
permissions:
  - role: "System Manager"
    read: 1
    write: 1
    create: 1
    delete: 1
    submit: 1
    cancel: 1
    amend: 1
  - role: "Sales User"
    read: 1
    write: 1
    create: 1
    if_owner: 1  # Only own documents
```

### Permission Actions

| Action | Description |
|--------|-------------|
| `read` | View document |
| `write` | Edit document |
| `create` | Create new |
| `delete` | Delete document |
| `submit` | Submit document |
| `cancel` | Cancel document |
| `amend` | Amend cancelled |
| `report` | Access reports |
| `export` | Export data |
| `import` | Import data |
| `share` | Share with others |
| `print` | Print document |
| `email` | Email document |

### Permission Levels (Field Groups)

```yaml
# Field with permission level
- fieldname: "cost_price"
  fieldtype: "Currency"
  permlevel: 1

# Permission for level
permissions:
  - role: "Accounts Manager"
    read: 1
    write: 1
    permlevel: 1  # Can access level 1 fields
```

### Custom Permission Queries

```python
# hooks.py
permission_query_conditions = {
    "Sales Invoice": "my_app.permissions.sales_invoice_query"
}

has_permission = {
    "Sales Invoice": "my_app.permissions.has_permission"
}
```

```python
# my_app/permissions.py
def sales_invoice_query(user):
    if "Sales Manager" in frappe.get_roles(user):
        return ""  # No restriction
    return f"`tabSales Invoice`.owner = '{user}'"

def has_si_permission(doc, user, permission_type):
    if permission_type == "read":
        return True
    return doc.owner == user
```

### Check Permissions in Code

```python
# Check permission
if frappe.has_permission("Sales Invoice", "write", doc):
    doc.save()

# Throw if no permission
frappe.has_permission("Sales Invoice", "submit", throw=True)

# Check role
if "System Manager" in frappe.get_roles():
    pass

# Get permissions dict
perms = frappe.permissions.get_doc_permissions(doc)
```

---

---

## Permissions API

### Check Permissions

```python
# Basic check
frappe.has_permission("Customer", "read")
frappe.has_permission("Customer", "read", "CUST-001")
frappe.has_permission("Customer", "write", throw=True)

# Check role
if "System Manager" in frappe.get_roles():
    pass

# Get users with role
users = frappe.get_users_with_role("System Manager")

# Get all permissions for doc
perms = frappe.permissions.get_doc_permissions(doc)

# User permissions (restrict by Link value)
frappe.permissions.add_user_permission("Company", "My Co", "user@example.com")
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
