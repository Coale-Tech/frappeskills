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
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `api-development/references/permissions.md`.

```markdown
# API Permissions Reference

## Overview
API permissions in Frappe involve multiple layers: authentication, DocType permissions, document-level permissions, and custom authorization logic.

## Permission Hierarchy

```
┌─────────────────────────────────────┐
│ 1. Authentication                    │  ← Is the request authenticated?
├─────────────────────────────────────┤
│ 2. Role Permissions                  │  ← Does user's role allow this action?
├─────────────────────────────────────┤
│ 3. User Permissions                  │  ← Can user access this specific record?
├─────────────────────────────────────┤
│ 4. Document Permissions (has_perm)   │  ← Custom permission logic on document
├─────────────────────────────────────┤
│ 5. Share Permissions                 │  ← Is document shared with user?
└─────────────────────────────────────┘
```

## REST API Permissions

### Automatic Permission Checks
REST endpoints automatically enforce permissions:

```bash
### GET /api/resource/Customer/CUST-001
### → Checks: read permission on Customer DocType
### → Checks: User Permission filters

### POST /api/resource/Customer
### → Checks: create permission on Customer DocType

### PUT /api/resource/Customer/CUST-001
### → Checks: write permission on Customer DocType
### → Checks: document-level permission

### DELETE /api/resource/Customer/CUST-001
### → Checks: delete permission on Customer DocType
```

### List Permissions
```bash
### GET /api/resource/Customer?filters=[["status","=","Active"]]
### → Returns only documents user has permission to read
### → Applies User Permission filters automatically
```

## RPC Method Permissions

### Always Check Permissions!
```python
@frappe.whitelist()
def update_order_status(order_name, new_status):
    """
    CRITICAL: Whitelisted methods bypass automatic permission checks.
    You MUST check permissions explicitly.
    """
    # Step 1: Get the document
    doc = frappe.get_doc("Sales Order", order_name)
    
    # Step 2: Check document permission
    if not frappe.has_permission("Sales Order", "write", doc):
        frappe.throw(_("Permission denied"), frappe.PermissionError)
    
    # Step 3: Check role for specific action (optional)
    if new_status == "Approved" and "Approver" not in frappe.get_roles():
        frappe.throw(_("Only Approvers can approve orders"), frappe.PermissionError)
    
    # Step 4: Proceed with business logic
    doc.status = new_status
    doc.save()
    
    return doc.name
```

### Permission Check Patterns

```python
### Basic permission check
def check_basic():
    if not frappe.has_permission("DocType", "read"):
        frappe.throw(_("Permission denied"), frappe.PermissionError)

### Document-level permission
def check_document(doc):
    if not frappe.has_permission(doc.doctype, "write", doc):
        frappe.throw(_("Cannot modify this document"), frappe.PermissionError)

### Role-based check
def check_role(required_role):
    if required_role not in frappe.get_roles():
        frappe.throw(_(f"{required_role} role required"), frappe.PermissionError)

### Multiple roles (any)
def check_any_role(roles):
    user_roles = set(frappe.get_roles())
    if not user_roles.intersection(set(roles)):
        frappe.throw(_("Insufficient permissions"), frappe.PermissionError)

### Multiple roles (all)
def check_all_roles(roles):
    user_roles = set(frappe.get_roles())
    if not set(roles).issubset(user_roles):
        frappe.throw(_("Missing required roles"), frappe.PermissionError)
```

## Custom Permission Logic

### permission_query_conditions Hook
Filter list queries with custom SQL:

```python
### hooks.py
permission_query_conditions = {
    "Sales Order": "my_app.permissions.get_order_conditions"
}
```

```python
### my_app/permissions.py
def get_order_conditions(user):
    """Return SQL condition to filter Sales Orders."""
    if not user:
        user = frappe.session.user
    
    # Admin sees all
    if "System Manager" in frappe.get_roles(user):
        return ""
    
    # Sales users see their territory only
    if "Sales User" in frappe.get_roles(user):
        territory = frappe.db.get_value("User", user, "territory")
        if territory:
            return f"`tabSales Order`.territory = {frappe.db.escape(territory)}"
    
    # Default: deny access
    return "1=0"
```

### has_permission Hook
Custom document-level permission:

```python
### hooks.py
has_permission = {
    "Sales Order": "my_app.permissions.has_order_permission"
}
```

```python
### my_app/permissions.py
def has_order_permission(doc, ptype, user):
    """
    doc: The document to check
    ptype: Permission type (read, write, create, delete, submit, cancel)
    user: User to check (default: current user)
    """
    if not user:
        user = frappe.session.user
    
    # Admin can do anything
    if "System Manager" in frappe.get_roles(user):
        return True
    
    # Read: Allow if assigned or in same territory
    if ptype == "read":
        if doc.assigned_to == user:
            return True
        user_territory = frappe.db.get_value("User", user, "territory")
        return doc.territory == user_territory
    
    # Write: Only assigned user
    if ptype == "write":
        return doc.assigned_to == user
    
    # Submit/Cancel: Only managers
    if ptype in ("submit", "cancel"):
        return "Sales Manager" in frappe.get_roles(user)
    
    return False
```

## API Permission Decorator

```python
from functools import wraps

def require_permission(doctype, ptype):
    """Decorator to check DocType permission."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not frappe.has_permission(doctype, ptype):
                frappe.throw(
                    _("Permission denied: {0} {1}").format(ptype, doctype),
                    frappe.PermissionError
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator

def require_role(*roles):
    """Decorator to check user roles."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_roles = set(frappe.get_roles())
            if not user_roles.intersection(set(roles)):
                frappe.throw(
                    _("Requires role: {0}").format(", ".join(roles)),
                    frappe.PermissionError
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator


### Usage
@frappe.whitelist()
@require_permission("Sales Order", "write")
@require_role("Sales User", "Sales Manager")
def process_order(order_name):
    # Already verified permissions
    pass
```

## Debugging Permissions

### Check Current State
```python
### Current user
print(frappe.session.user)

### User's roles
print(frappe.get_roles())

### User permissions
from frappe.permissions import get_user_permissions
print(get_user_permissions("user@example.com"))

### Check specific permission
print(frappe.has_permission("Sales Order", "write"))
print(frappe.has_permission("Sales Order", "write", doc))
```

### Permission Debug Mode
```python
### In code
from frappe.permissions import has_permission
result = has_permission(
    "Sales Order",
    ptype="write",
    doc=doc,
    user="user@example.com",
    debug=True  # Prints detailed permission checks
)
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 403 on REST API | Missing DocType permission | Check Role Permission Manager |
| Can't see some records | User Permission filtering | Check User Permissions for user |
| RPC returns data it shouldn't | Missing permission check | Add explicit `has_permission` check |
| Custom logic not applying | Hook not registered | Verify `hooks.py` registration |

## Security Best Practices

### 1. Never Trust Client Data
```python
@frappe.whitelist()
def bad_example(docname, new_owner):
    # ❌ DANGEROUS: No permission check
    frappe.db.set_value("Document", docname, "owner", new_owner)

@frappe.whitelist()
def good_example(docname, new_owner):
    # ✅ SAFE: Check permissions first
    doc = frappe.get_doc("Document", docname)
    if not frappe.has_permission(doc.doctype, "write", doc):
        frappe.throw(_("Permission denied"), frappe.PermissionError)
    if "Admin" not in frappe.get_roles():
        frappe.throw(_("Only Admin can change owner"), frappe.PermissionError)
    doc.owner = new_owner
    doc.save()
```

### 2. Use Permission-Aware APIs
```python
### ❌ Bypasses permissions
all_orders = frappe.get_all("Sales Order")
frappe.db.sql("SELECT * FROM `tabSales Order`")

### ✅ Respects permissions
permitted_orders = frappe.get_list("Sales Order")
```

### 3. Validate References
```python
@frappe.whitelist()
def update_customer_order(order_name, customer):
    doc = frappe.get_doc("Sales Order", order_name)
    
    # Check permission on order
    if not frappe.has_permission("Sales Order", "write", doc):
        frappe.throw(_("Permission denied"), frappe.PermissionError)
    
    # Also check permission on referenced customer
    if not frappe.has_permission("Customer", "read", customer):
        frappe.throw(_("Cannot access customer"), frappe.PermissionError)
    
    doc.customer = customer
    doc.save()
```

Sources: Permissions, Role Permissions, User Permissions, Permission Hooks (official docs)
```

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `doctype-development/references/permissions.md`.

```markdown
# Permissions Reference

## Overview
Frappe uses a multi-layered permission system: Role permissions (DocType level), User Permissions (row level), and Share permissions (document level).

## Permission Levels

### 1. Role Permissions
Define what actions a role can perform on a DocType.

| Permission | Description |
|------------|-------------|
| Read | View documents |
| Write | Modify documents |
| Create | Create new documents |
| Delete | Delete documents |
| Submit | Submit documents (submittable) |
| Cancel | Cancel documents (submittable) |
| Amend | Amend cancelled documents |
| Report | Access reports |
| Import | Import data |
| Export | Export data |
| Print | Print documents |
| Email | Send emails |
| Share | Share with other users |

### 2. User Permissions
Filter which documents a user can access based on Link field values.

```python
### User can only see Sales Orders where customer = "ACME Corp"
frappe.permissions.add_user_permission(
    doctype="Customer",
    name="ACME Corp",
    user="sales@example.com"
)
```

### 3. Share Permissions
Grant access to specific documents.

```python
frappe.share.add(
    doctype="Project",
    name="PROJ-001",
    user="contractor@example.com",
    read=1,
    write=1
)
```

## Setting Role Permissions

### In DocType JSON
```json
{
  "permissions": [
    {
      "role": "Sales User",
      "read": 1,
      "write": 1,
      "create": 1
    },
    {
      "role": "Sales Manager",
      "read": 1,
      "write": 1,
      "create": 1,
      "delete": 1,
      "submit": 1,
      "cancel": 1
    },
    {
      "role": "Guest",
      "read": 1,
      "permlevel": 0
    }
  ]
}
```

### Via Role Permission Manager
1. Go to Setup > Role Permission Manager
2. Select DocType
3. Configure permissions per role

## Permission Levels (permlevel)

Split fields into permission groups:

```json
{
  "fieldname": "internal_notes",
  "fieldtype": "Text",
  "permlevel": 1
}
```

```json
{
  "permissions": [
    {
      "role": "Sales User",
      "read": 1,
      "write": 1,
      "permlevel": 0
    },
    {
      "role": "Sales Manager",
      "read": 1,
      "write": 1,
      "permlevel": 1
    }
  ]
}
```

- **permlevel 0**: Default, accessible by base role
- **permlevel 1+**: Restricted to higher roles

## Checking Permissions in Code

### Basic Checks
```python
### Check DocType permission
if frappe.has_permission("Sales Order", "read"):
    # User can read Sales Orders

### Check document permission
doc = frappe.get_doc("Sales Order", "SO-001")
if frappe.has_permission("Sales Order", "write", doc):
    # User can write to this specific document

### Check with user parameter
if frappe.has_permission("Sales Order", "read", user="other@example.com"):
    # That user can read
```

### Permission Queries
```python
### Get all documents user can read
orders = frappe.get_list("Sales Order")  # Applies permissions

### Bypass permissions (use carefully!)
all_orders = frappe.get_all("Sales Order")  # Ignores permissions

### Check role
if "Sales Manager" in frappe.get_roles():
    # User has Sales Manager role

### Check specific permission
if frappe.has_permission("Sales Order", "submit"):
    # User can submit Sales Orders
```

### In RPC Methods (Critical!)
```python
@frappe.whitelist()
def approve_order(order_name):
    # ALWAYS check permissions in whitelisted methods!
    doc = frappe.get_doc("Sales Order", order_name)
    
    if not frappe.has_permission("Sales Order", "write", doc):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    
    # Also check role for specific actions
    if "Sales Manager" not in frappe.get_roles():
        frappe.throw(_("Only Sales Managers can approve"))
    
    doc.status = "Approved"
    doc.save()
    return doc.name
```

## User Permissions (Row-Level Security)

### Setting User Permissions
```python
### Via code
frappe.permissions.add_user_permission(
    doctype="Company",
    name="My Company",
    user="employee@example.com",
    ignore_permissions=True
)

### Multiple values
frappe.permissions.add_user_permission("Company", "Company A", "user@example.com")
frappe.permissions.add_user_permission("Company", "Company B", "user@example.com")
```

### User Permission Behavior
```python
### User Permissions filter applied automatically
### If user has User Permission for Company = "ACME"
### Then frappe.get_list("Sales Order") only returns orders where company = "ACME"

### Check if strict user permissions apply
from frappe.permissions import get_user_permissions
user_perms = get_user_permissions("user@example.com")
```

### Apply User Permissions to Specific Links
```json
{
  "fieldname": "company",
  "fieldtype": "Link",
  "options": "Company",
  "ignore_user_permissions": 0
}
```

Set `ignore_user_permissions: 1` to bypass filtering for specific Link fields.

## Permission Queries Optimization

### Efficient Permission Checks
```python
### Bad: Check permission for each document
for name in document_names:
    if frappe.has_permission("Order", "read", name):
        process(name)

### Good: Use get_list which applies permissions
permitted_docs = frappe.get_list("Order", filters={"name": ("in", document_names)})
for doc in permitted_docs:
    process(doc.name)
```

### has_permission vs get_list
```python
### has_permission: Single document check
can_read = frappe.has_permission("Order", "read", "ORD-001")

### get_list: Filtered by permissions automatically
orders = frappe.get_list("Order", filters={"status": "Open"})
```

## Custom Permission Logic

### permission_query_conditions
Filter list queries with custom SQL:

```python
### hooks.py
permission_query_conditions = {
    "Sales Order": "my_app.permissions.sales_order_query"
}
```

```python
### my_app/permissions.py
def sales_order_query(user):
    if "Sales Manager" in frappe.get_roles(user):
        return ""  # No restriction
    
    # Restrict to user's territory
    territory = frappe.db.get_value("User", user, "territory")
    if territory:
        return f"`tabSales Order`.territory = {frappe.db.escape(territory)}"
    
    return "1=0"  # No access
```

### has_permission Hook
Custom permission checks:

```python
### hooks.py
has_permission = {
    "Sales Order": "my_app.permissions.sales_order_permission"
}
```

```python
### my_app/permissions.py
def sales_order_permission(doc, ptype, user):
    if ptype == "read":
        return True  # Allow read for all
    
    if ptype == "write":
        # Only allow write if assigned
        return doc.assigned_to == user
    
    return False
```

## Document Sharing

### Share a Document
```python
frappe.share.add(
    doctype="Project",
    name="PROJ-001",
    user="external@example.com",
    read=1,
    write=0,
    share=0
)

### With notify
frappe.share.add("Project", "PROJ-001", "user@example.com", 
    read=1, write=1, notify=1)
```

### Check Shares
```python
### Get share info
shares = frappe.share.get_users("Project", "PROJ-001")

### Check if shared with user
is_shared = frappe.share.get_shared("Project", "PROJ-001", "user@example.com")
```

### Remove Share
```python
frappe.share.remove("Project", "PROJ-001", "user@example.com")
```

## Best Practices

### Always Check Permissions
```python
@frappe.whitelist()
def my_api_method(docname):
    # Rule 1: Always check permissions in whitelisted methods
    doc = frappe.get_doc("My DocType", docname)
    if not frappe.has_permission("My DocType", "write", doc):
        frappe.throw(_("Permission denied"), frappe.PermissionError)
    
    # Rule 2: Check role for sensitive operations
    if "Manager" not in frappe.get_roles():
        frappe.throw(_("Requires Manager role"))
```

### Use Permission-Aware APIs
```python
### Use get_list (permission-aware) instead of get_all
docs = frappe.get_list("Order")  # ✅ Respects permissions
docs = frappe.get_all("Order")   # ❌ Bypasses permissions
```

### Test Permissions
```python
def test_sales_user_cannot_delete(self):
    frappe.set_user("sales@example.com")
    self.assertRaises(
        frappe.PermissionError,
        frappe.delete_doc, "Sales Order", self.order.name
    )
    frappe.set_user("Administrator")
```

Sources: Permissions, Role Permission, User Permissions, Sharing (official docs)
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
