# Row-Level and Document-Level Permissions

Split out of [permissions.md](permissions.md). Covers the layers below plain
role permissions: the `has_permission` controller hook, list-level SQL
filtering, User Permissions, and Document Sharing.

## Permission layers

For a given request, Frappe evaluates permissions in this order:

1. **Authentication** — is the request authenticated?
2. **Role permissions** — does the user's role allow this action on the DocType?
3. **User Permissions** — can the user access this specific linked record?
4. **`has_permission`** — custom permission logic on the document (controller method or hooks.py override)
5. **Share permissions** — is the document explicitly shared with the user?

REST endpoints enforce this automatically:

```bash
GET /api/resource/Customer/CUST-001
# checks read permission on Customer, then User Permission filters

POST /api/resource/Customer
# checks create permission on Customer

PUT /api/resource/Customer/CUST-001
# checks write permission on Customer, then document-level permission

DELETE /api/resource/Customer/CUST-001
# checks delete permission on Customer

GET /api/resource/Customer?filters=[["status","=","Active"]]
# applies User Permission filters automatically to the list
```

Whitelisted RPC methods (`@frappe.whitelist()`) do **not** get these checks for
free — see [permissions-checks.md](permissions-checks.md) for enforcing them
explicitly.

## `has_permission` controller hook

```python
class Expense(Document):
    def has_permission(self, permtype, user=None):
        if permtype == "read" and self.department == get_user_department(user):
            return True
        return False
```

## `has_permission` hooks.py override

An alternative to the controller method — register a module-level function per
DocType instead (`frappe.get_hooks("has_permission")`, `frappe/permissions.py`):

```python
# hooks.py
has_permission = {
    "Sales Order": "my_app.permissions.sales_order_permission"
}
```

```python
# my_app/permissions.py
def sales_order_permission(doc, ptype, user):
    if not user:
        user = frappe.session.user
    if "System Manager" in frappe.get_roles(user):
        return True
    if ptype == "read":
        return doc.assigned_to == user
    if ptype == "write":
        return doc.assigned_to == user
    if ptype in ("submit", "cancel"):
        return "Sales Manager" in frappe.get_roles(user)
    return False
```

## Row-level filtering on list views (`permission_query_conditions`)

To restrict which records appear in list views and `get_list` calls, define
`permission_query_conditions` in `hooks.py`:

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

Return a SQL WHERE clause fragment (string), `""` for no restriction, or a
falsy value like `"1=0"` to deny all access.

Pair with `has_permission` for complete coverage — `permission_query_conditions`
filters lists, `has_permission` guards individual documents.

## User Permissions (row-level security by Link value)

Filter which documents a user can access based on a Link field's value:

```python
frappe.permissions.add_user_permission(
    doctype="Company",
    name="My Company",
    user="employee@example.com",
    ignore_permissions=True,  # trusted setup script provisioning a new employee's access
)
```

```python
# Multiple values
frappe.permissions.add_user_permission("Company", "Company A", "user@example.com")
frappe.permissions.add_user_permission("Company", "Company B", "user@example.com")
```

Once set, `frappe.get_list()` automatically filters by the user's permitted
values (e.g. a user with a User Permission for Company = "ACME" only sees
Sales Orders where `company = "ACME"`).

```python
from frappe.permissions import get_user_permissions
user_perms = get_user_permissions("user@example.com")
```

Bypass User Permission filtering for a specific Link field:
```json
{
    "fieldname": "company",
    "fieldtype": "Link",
    "options": "Company",
    "ignore_user_permissions": 1
}
```

## Document Sharing

```python
frappe.share.add(
    doctype="Project",
    name="PROJ-001",
    user="contractor@example.com",
    read=1,
    write=1,
    notify=1,
)
```

```python
# Who a document is shared with
shares = frappe.share.get_users("Project", "PROJ-001")

# Is it shared with a specific user
is_shared = "PROJ-001" in frappe.share.get_shared("Project", user="contractor@example.com")

# Remove
frappe.share.remove("Project", "PROJ-001", "contractor@example.com")
```
