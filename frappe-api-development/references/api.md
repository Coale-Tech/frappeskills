# Whitelisted APIs

## Preferred: Methods in DocType controllers

Place whitelisted methods in the controller file — either as Document class methods (doc-level) or as module-level functions (doctype-level). This avoids needing full dotted paths to call them.

### Doc-level methods (on a specific document)

```python
# apps/<app>/<app>/<module>/doctype/expense/expense.py

import frappe
from frappe.model.document import Document

class Expense(Document):
    @frappe.whitelist()
    def approve(self):
        self.status = "Approved"
        self.save()
        return self.status
```

Call from client JS:
```javascript
frappe.call({
    method: "approve",       // just the method name
    doc: frm.doc,
    callback(r) { console.log(r.message); }
});
// or
frm.call("approve");
```

Call from HTTP (v2 API):
```
POST /api/v2/document/Expense/EXP-0001/method/approve
```

### DocType-level functions (module root)

```python
# apps/<app>/<app>/<module>/doctype/expense/expense.py

import frappe

@frappe.whitelist()
def get_expense_summary(status=None):
    filters = {"status": status} if status else {}
    return frappe.db.get_all("Expense", filters=filters, fields=["name", "title", "amount"])
```

Call from client JS:
```javascript
frappe.call({
    method: "myapp.mymodule.doctype.expense.expense.get_expense_summary",
    args: { status: "Draft" },
    callback(r) { console.log(r.message); }
});
```

Call from HTTP:
```
POST /api/v2/method/Expense/get_expense_summary
```

## Standalone API files (for non-DocType logic)

Use only when logic doesn't belong to any DocType:

```python
# apps/<app>/<app>/api.py
import frappe

@frappe.whitelist()
def get_dashboard_data():
    return {"total": frappe.db.count("Expense")}
```

For larger apps, organize by feature:
```
apps/<app>/<app>/api/
    __init__.py
    expenses.py
    reports.py
```

## Allow guest access

```python
@frappe.whitelist(allow_guest=True)
def public_endpoint():
    return {"message": "Hello"}
```

## Argument handling

- **Always add type hints** to whitelisted method parameters. Frappe validates and casts arguments based on type hints, preventing type-confusion attacks:
```python
@frappe.whitelist()
def create_expense(title: str, amount: float, tags: list | None = None):
    # title is guaranteed to be str, amount is cast to float
    # Without type hints, all args arrive as untrusted strings
    ...
```

- Use `frappe.form_dict` for raw request data:
```python
data = frappe.form_dict
```

## Return values

- Return a dict/list → auto-serialized to JSON under `{"message": <return_value>}`
- For custom HTTP responses:
```python
frappe.response["meta"] = meta
```

## Built-in document APIs (v2)

Frappe provides CRUD APIs automatically via `/api/v2/document/` — no need to write them. Requires **Frappe v15+**.

```
GET    /api/v2/document/<DocType>                          # list (with filters, fields, order_by, limit)
POST   /api/v2/document/<DocType>                          # create
GET    /api/v2/document/<DocType>/<name>/                  # read
PUT    /api/v2/document/<DocType>/<name>/                  # update
DELETE /api/v2/document/<DocType>/<name>/                  # delete
GET    /api/v2/document/<DocType>/<name>/copy              # copy doc
POST   /api/v2/document/<DocType>/<name>/method/<method>/  # call doc method
POST   /api/v2/method/<DocType>/<method>                   # call doctype level method
GET    /api/v2/doctype/<DocType>/meta                      # get DocType meta
GET    /api/v2/doctype/<DocType>/count                     # count records
```

### List query params
`fields` (JSON list), `filters` (JSON dict/list), `order_by`, `start`, `limit` (default 20), `group_by`.

Response includes `has_next_page` boolean for pagination.

### Bulk operations
```
POST /api/v2/document/<DocType>/bulk_delete   # body: {"names": [...]}
POST /api/v2/document/<DocType>/bulk_update   # body: {"docs": [{"name": "...", ...fields}]}
```

Large bulk operations (>20 items by default) are automatically enqueued as background jobs.

Only create custom `@frappe.whitelist()` endpoints for logic that goes beyond CRUD.

## Specify HTTP methods

Always declare allowed HTTP methods explicitly. Frappe auto-commits only for POST/PUT — GET requests do not commit.

```python
@frappe.whitelist(methods=["GET"])
def get_dashboard_data(): ...

@frappe.whitelist(methods=["POST"])
def submit_entry(name: str): ...

@frappe.whitelist(methods=["GET", "POST"])
def get_or_create_token(): ...
```

## Anti-patterns

- **Don't wrap doc methods in standalone APIs.** If the controller has `@frappe.whitelist()` on a method, clients call it directly via `frm.call("approve")` or `POST /api/v2/document/Expense/EXP-001/method/approve`. Don't create a separate `api.py` function that just fetches the doc and calls the same method.
- **Don't put doc-scoped logic in standalone APIs.** If the function fetches one doc, validates the caller, and acts on that doc — it belongs as a doc-level `@frappe.whitelist()` method, not in `api/`. Reserve standalone APIs for cross-document operations, aggregations, or endpoints with no document context.
- **Don't leak sensitive fields in guest APIs.** With `allow_guest=True`, only return fields guests need. Never expose `user` (email), internal IDs, or permission-sensitive data.

---

## Whitelisted Methods

### Basic Pattern

```python
import frappe
from frappe import _

@frappe.whitelist()
def get_customer_data(customer, include_invoices=False):
    """Get customer info. Requires login."""
    if not frappe.has_permission("Customer", "read", customer):
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    data = frappe.get_doc("Customer", customer).as_dict()

    if include_invoices:
        data["invoices"] = frappe.get_all("Sales Invoice",
            filters={"customer": customer, "docstatus": 1},
            fields=["name", "grand_total", "posting_date"]
        )

    return data
```

### Guest Access

```python
@frappe.whitelist(allow_guest=True)
def get_public_info():
    """Accessible without login."""
    return {"company": frappe.db.get_single_value("Website Settings", "company")}
```

### Input Validation

```python
@frappe.whitelist()
def create_order(customer, items):
    # frappe.whitelist auto-deserializes JSON strings
    if isinstance(items, str):
        items = frappe.parse_json(items)

    # Validate
    if not customer:
        frappe.throw(_("Customer is required"))

    if not items or len(items) == 0:
        frappe.throw(_("At least one item is required"))

    # Create
    doc = frappe.new_doc("Sales Order")
    doc.customer = customer
    for item in items:
        doc.append("items", item)
    doc.insert()
    return doc.as_dict()
```

---

## REST API

Frappe auto-generates RESTful APIs for all DocTypes.

### Authentication Methods

#### Token-Based (Recommended)

```bash
# Generate API keys in User > API Access
curl -X GET "https://site.com/api/resource/Customer" \
  -H "Authorization: token api_key:api_secret"
```

#### OAuth 2.0

```bash
curl -X GET "https://site.com/api/resource/Customer" \
  -H "Authorization: Bearer access_token"
```

#### Session-Based

```bash
curl -X POST "https://site.com/api/method/login" \
  -H "Content-Type: application/json" \
  -d '{"usr": "username", "pwd": "password"}'
```

### Resource Endpoints (CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resource/:doctype` | List documents |
| GET | `/api/resource/:doctype/:name` | Get single document |
| POST | `/api/resource/:doctype` | Create document |
| PUT | `/api/resource/:doctype/:name` | Update document |
| DELETE | `/api/resource/:doctype/:name` | Delete document |

### List Query Parameters

```bash
# With fields
GET /api/resource/Customer?fields=["name","customer_name","territory"]

# With filters (AND)
GET /api/resource/Customer?filters=[["territory","=","Kenya"]]

# With OR filters
GET /api/resource/Customer?or_filters=[["territory","=","Kenya"],["territory","=","Uganda"]]

# Pagination
GET /api/resource/Customer?limit_start=0&limit_page_length=20

# Sorting
GET /api/resource/Customer?order_by=creation desc

# With child table fields
GET /api/resource/Sales Invoice?fields=["name","items.item_code","items.qty"]

# Group by
GET /api/resource/Customer?group_by=territory&fields=["territory","count(name) as count"]
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `["status","=","Active"]` |
| `!=` | Not equals | `["status","!=","Closed"]` |
| `>` | Greater than | `["amount",">",1000]` |
| `<` | Less than | `["amount","<",5000]` |
| `>=` | Greater or equal | `["qty",">=",10]` |
| `<=` | Less or equal | `["qty","<=",100]` |
| `like` | Pattern match | `["name","like","%INV%"]` |
| `not like` | Not matching | `["name","not like","%TEST%"]` |
| `in` | In list | `["status","in",["Open","Active"]]` |
| `not in` | Not in list | `["status","not in",["Closed"]]` |
| `is` | Is set/not set | `["phone","is","set"]` |
| `between` | Range | `["date","between",["2024-01-01","2024-12-31"]]` |

### Method Endpoints

```bash
# Call whitelisted method
POST /api/method/my_app.api.get_items
Content-Type: application/json
{"filters": {"status": "Active"}}

# Response format
{
  "message": { ... }  # Return value from method
}
```

---

## Document API

### Get Document

```python
# By name
doc = frappe.get_doc("Customer", "CUST-001")

# By filters
doc = frappe.get_doc("Customer", {"email_id": "test@example.com"})

# As dict
data = frappe.get_doc("Customer", "CUST-001").as_dict()

# Cached (faster for repeated reads)
doc = frappe.get_cached_doc("Customer", "CUST-001")

# Last document
doc = frappe.get_last_doc("Sales Invoice",
    filters={"customer": "CUST-001"},
    order_by="creation desc"
)
```

### Create Document

```python
# Method 1: new_doc
doc = frappe.new_doc("Customer")
doc.customer_name = "New Customer"
doc.customer_type = "Company"
doc.insert()

# Method 2: get_doc with dict
doc = frappe.get_doc({
    "doctype": "Customer",
    "customer_name": "New Customer",
    "customer_type": "Company"
}).insert()
```

### Update Document

```python
# Full update
doc = frappe.get_doc("Customer", "CUST-001")
doc.customer_name = "Updated Name"
doc.save()

# Direct DB update (bypasses controller)
doc.db_set("status", "Active")
doc.db_set({"status": "Active", "modified_by": frappe.session.user})
```

### Submit / Cancel / Delete

```python
doc.submit()
doc.cancel()

# Amend cancelled
amended = frappe.copy_doc(doc)
amended.amended_from = doc.name
amended.insert()

# Delete
frappe.delete_doc("Customer", "CUST-001")
frappe.delete_doc("Customer", "CUST-001", force=True)

# Rename
frappe.rename_doc("Customer", "OLD-NAME", "NEW-NAME")
```

### Insert Options

```python
doc.insert(
    ignore_permissions=True,
    ignore_links=True,
    ignore_if_duplicate=True,
    ignore_mandatory=True
)

doc.save(
    ignore_permissions=True,
    ignore_version=True
)
```

### Child Table Operations

```python
# Append row
doc.append("items", {"item_code": "ITEM-001", "qty": 10})

# Set entire table
doc.set("items", [
    {"item_code": "ITEM-001", "qty": 10},
    {"item_code": "ITEM-002", "qty": 5}
])

# Iterate
for item in doc.get("items"):
    print(item.item_code)
```

---

## Jinja API

### Custom Jinja Methods

```python
# hooks.py
jinja = {
    "methods": ["my_app.utils.get_company_logo"],
    "filters": ["my_app.utils.format_currency"]
}
```

```python
# my_app/utils.py
def get_company_logo(company):
    return frappe.db.get_value("Company", company, "company_logo")

def format_currency(value, currency="USD"):
    return f"{currency} {value:,.2f}"
```

### Usage in Print Formats / Email Templates

```html
{{ get_company_logo(doc.company) }}
{{ doc.grand_total | format_currency("KES") }}
```

---

## Utilities

### Common Utility Functions

```python
from frappe.utils import (
    today, now, nowdate, nowtime,
    add_days, add_months, add_years, date_diff,
    flt, cint, cstr,
    fmt_money, format_date,
    get_url, get_fullname,
    random_string, get_datetime
)

# Date/Time
today()                          # "2024-01-15"
now()                            # "2024-01-15 10:30:00.000000"
add_days(today(), 7)             # 7 days from now
add_months(today(), 3)           # 3 months from now
date_diff(end_date, start_date)  # Days between

# Type casting (safe)
flt(value, precision=2)   # Float with precision
cint(value)               # Integer
cstr(value)               # String

# Formatting
fmt_money(1234.56, currency="USD")  # "$1,234.56"
format_date("2024-01-15")          # "Jan 15, 2024"

# URLs
get_url()              # Site URL
get_url("/app/customer")  # Full URL

# Misc
random_string(10)      # Random alphanumeric
get_fullname()         # Current user's full name
```

### Email

```python
frappe.sendmail(
    recipients=["user@example.com"],
    subject="Notification",
    message="Hello from Frappe",
    template="my_template",
    args={"customer": "CUST-001"},
    attachments=[{"fname": "report.pdf", "fcontent": pdf_content}]
)
```

### Logging

```python
frappe.log_error("Error message", "Error Title")
frappe.log_error(frappe.get_traceback(), "My Error")
frappe.logger().info("Info message")
frappe.logger().debug("Debug message")
```

### Realtime

```python
# Server -> Client
frappe.publish_realtime("task_progress", {"percent": 50}, user=frappe.session.user)
frappe.publish_realtime("order_updated", {"name": doc.name}, doctype=doc.doctype)
```

---

## Best Practices

1. **Always use `@frappe.whitelist()`** for public API methods
2. **Always check permissions** in API endpoints
3. **Use parameterized SQL** (`%s` placeholders) - never f-strings
4. **Prefer Query Builder** over raw SQL for complex queries
5. **Return dicts** from whitelisted methods (not Response objects)
6. **Validate all inputs** before processing
7. **Use `frappe.throw()`** for user-facing errors
8. **Use `frappe.log_error()`** for debugging
9. **Use `frappe.enqueue()`** for long-running tasks
10. **Commit explicitly** in background jobs
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `api-development/SKILL.md`.

### Frappe API Development

Build secure, well-designed APIs using Frappe's REST and RPC patterns.

#### When to use

- Creating custom RPC endpoints (`@frappe.whitelist`)
- Building REST API integrations
- Implementing webhooks for external systems
- Setting up API authentication (token, OAuth)
- Exposing business logic to frontends

#### Inputs required

- API purpose (CRUD, action, integration)
- Authentication requirements (public, user, API key)
- Permission requirements per endpoint
- Request/response format expectations

#### Procedure

##### 0) Choose API pattern

| Need | Pattern |
|------|---------|
| DocType CRUD | Use built-in REST API |
| Custom action | RPC with `@frappe.whitelist` |
| External callback | Webhook DocType |
| Batch operations | Background job + status endpoint |

##### 1) Built-in REST API (DocType CRUD)

Frappe provides automatic REST endpoints for all DocTypes:

```bash
# Create
POST /api/resource/Customer
{"customer_name": "Acme Corp"}

# Read
GET /api/resource/Customer/CUST-001

# Update
PUT /api/resource/Customer/CUST-001
{"customer_name": "Acme Corporation"}

# Delete
DELETE /api/resource/Customer/CUST-001

# List with filters
GET /api/resource/Customer?filters=[["status","=","Active"]]
```

##### 2) Custom RPC endpoints

Create whitelisted methods in your app:

```python
# my_app/api.py
import frappe

@frappe.whitelist()
def process_order(order_id, action):
    """Process an order with the given action."""
    # Always verify permissions
    doc = frappe.get_doc("Sales Order", order_id)
    if not frappe.has_permission("Sales Order", "write", doc):
        frappe.throw("Not permitted", frappe.PermissionError)
    
    # Business logic
    if action == "approve":
        doc.status = "Approved"
        doc.save()
    
    return {"status": "success", "order": doc.name}

@frappe.whitelist(allow_guest=True)
def public_endpoint():
    """Public endpoint - no auth required."""
    return {"message": "Hello, World!"}
```

Call via:
```bash
POST /api/method/my_app.api.process_order
{"order_id": "SO-001", "action": "approve"}
```

##### 3) Implement authentication

**API Key + Secret (recommended for integrations):**
```bash
# Header format
Authorization: token api_key:api_secret
```

**Bearer Token:**
```bash
Authorization: Bearer <token>
```

**Session (for logged-in users):**
Automatic via cookies.

##### 4) Permission checks

**ALWAYS check permissions in RPC methods:**

```python
@frappe.whitelist()
def sensitive_action(docname):
    doc = frappe.get_doc("My DocType", docname)
    
    # Check document-level permission
    if not frappe.has_permission("My DocType", "write", doc):
        frappe.throw("Not permitted", frappe.PermissionError)
    
    # Check role-based permission
    if "Manager" not in frappe.get_roles():
        frappe.throw("Manager role required")
    
    # Proceed with action
    ...
```

##### 5) Input validation

```python
@frappe.whitelist()
def create_item(name, qty, price):
    # Validate required fields
    if not name:
        frappe.throw("Name is required")
    
    # Validate types
    qty = frappe.utils.cint(qty)
    price = frappe.utils.flt(price)
    
    # Validate ranges
    if qty <= 0:
        frappe.throw("Quantity must be positive")
    
    # Proceed
    ...
```

##### 6) Response format

**Success response:**
```python
return {
    "status": "success",
    "data": {...}
}
```

**Error handling:**
```python
# User-facing error
frappe.throw("Validation failed", title="Error")

# Permission error
frappe.throw("Not allowed", frappe.PermissionError)

# Standard exceptions become {"exc_type": "...", "exc": "..."}
```

##### 7) Background jobs for long operations

```python
@frappe.whitelist()
def start_export(filters):
    job = frappe.enqueue(
        "my_app.jobs.run_export",
        filters=filters,
        queue="long",
        timeout=600
    )
    return {"job_id": job.id}

@frappe.whitelist()
def check_job_status(job_id):
    from frappe.utils.background_jobs import get_job
    job = get_job(job_id)
    return {"status": job.get_status()}
```

#### Verification

- [ ] Endpoint responds correctly to valid requests
- [ ] Permission errors returned for unauthorized access
- [ ] Input validation rejects invalid data
- [ ] Error responses are structured and helpful
- [ ] Run: `bench --site <site> console` → test endpoint manually

#### Failure modes / debugging

- **Method not found**: Check module path in URL matches Python path
- **Permission denied**: Verify `@frappe.whitelist()` decorator and user permissions
- **CSRF error**: Use proper auth headers for API calls
- **500 error**: Check error logs: `bench --site <site> show-log`

#### Escalation

- For OAuth integration, see [references/oauth.md](oauth.md)
- For webhook patterns, see [references/webhooks.md](webhooks.md)
- For rate limiting, see [references/rate-limiting.md](rate-limiting.md)

#### References

- [references/rest-api.md](rest-api.md) - REST API details
- [references/authentication.md](authentication.md) - Auth patterns
- [references/permissions.md](../../frappe-doctype-development/references/permissions.md) - Permission system
- [references/webhooks.md](webhooks.md) - Outbound webhooks

#### Guardrails

- **Always validate input**: Never trust client data; validate type, length, and format server-side
- **Use permission callbacks**: Check `frappe.has_permission()` explicitly in whitelisted methods
- **Sanitize user input**: Use `frappe.db.escape()` for SQL, avoid `eval()` and dynamic code execution
- **Handle rate limiting**: Implement rate limits for public APIs to prevent abuse
- **Return structured errors**: Use `frappe.throw()` with proper HTTP status codes

#### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Missing `@frappe.whitelist()` | Method returns "Method not found" error | Add decorator to expose method via API |
| Using GET for mutations | Violates REST conventions, CSRF issues | Use POST/PUT/DELETE for data changes |
| Not handling errors | 500 errors expose stack traces | Wrap in try/except, use `frappe.throw()` |
| Exposing sensitive data | Security breach | Filter response fields, check permissions |
| Missing `allow_guest=True` | Public endpoints return 403 | Add `@frappe.whitelist(allow_guest=True)` for unauthenticated access |
| SQL injection in queries | Database compromise | Use Query Builder or `frappe.db.escape()` |

---

## Sources

Verified against Frappe v16.9.0 (`frappe/__init__.py` `__version__ = "16.9.0"`):

- `apps/frappe/frappe/__init__.py` — `whitelist`, `get_list`/`get_all`/`get_value`, `delete_doc`, `rename_doc`, `get_hooks`, and the `frappe.model.document` re-exports (`get_doc`, `new_doc`, `get_cached_doc`, `get_cached_value`, `get_single_value`, `get_last_doc`, `get_single`, `get_lazy_doc`); `cache` / `client_cache` globals
- `apps/frappe/frappe/model/document.py` — `get_doc` (singledispatch), `new_doc`, `get_cached_doc`, `get_single_value`, `get_last_doc`, `db_set`
- `apps/frappe/frappe/database/database.py` — `get_value`, `set_value`, `get_single_value`, `exists`, `count`
- `apps/frappe/frappe/query_builder/` — `frappe.qb`, `DocType`, `get_query`
- `apps/frappe/frappe/utils/background_jobs.py` — `enqueue`/`enqueue_doc` signatures, `get_queues_timeout` (short/default=300s, long=1500s), `is_job_enqueued`, `job_name` deprecation
- `apps/frappe/frappe/hooks.py` — framework `doc_events`, `scheduler_events`, and hook-key surface
- `apps/frappe/frappe/utils/boilerplate.py` — `hooks_template` (canonical `bench new-app` hooks.py)
- `apps/frappe/frappe/core/doctype/scheduled_job_type/scheduled_job_type.json` — scheduler frequency options
- `apps/frappe/frappe/utils/redis_wrapper.py` + `frappe/utils/caching.py` — `frappe.cache`, `client_cache`, `request_cache`/`site_cache`/`redis_cache`
