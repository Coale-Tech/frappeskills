# Database & ORM

## Reading data

```python
# Get single document
doc = frappe.get_doc("Expense", "EXP-0001")

# Get single value
amount = frappe.db.get_value("Expense", "EXP-0001", "amount")

# Get multiple fields
name, amount = frappe.db.get_value("Expense", "EXP-0001", ["name", "amount"])

# Get all matching records
expenses = frappe.db.get_all("Expense",
    filters={"status": "Draft"},
    fields=["name", "title", "amount", "link_field.field"],
    order_by="creation desc",
    limit=20
)

# Get list (same as get_all but respects permissions)
expenses = frappe.db.get_list("Expense", filters={"status": "Draft"}, fields=["*"])

# Count
count = frappe.db.count("Expense", {"status": "Draft"})

# Check existence
exists = frappe.db.exists("Expense", "EXP-0001")
exists = frappe.db.exists("Expense", {"title": "Lunch", "status": "Draft"})
```

## `get_all` vs `get_list`

- `frappe.db.get_all` — ignores permissions, returns all matching records
- `frappe.db.get_list` — respects user permissions, applies filters based on role

Use `get_all` for server-side logic. Use `get_list` in user-facing APIs.

## Writing data

```python
# Create
doc = frappe.get_doc({"doctype": "Expense", "title": "Lunch", "amount": 50})
doc.insert()

# Update via doc
doc = frappe.get_doc("Expense", "EXP-0001")
doc.amount = 75
doc.save()

# Quick update (single field, skips controller hooks)
# Use for derived/cached fields, counters, timestamps — NOT for fields with validation logic or status transitions
frappe.db.set_value("Expense", "EXP-0001", "amount", 75)

# Bulk update
frappe.db.set_value("Expense", {"status": "Draft"}, "status", "Cancelled")
```

## Filters syntax

```python
# Dict style (simple equality)
filters = {"status": "Draft", "amount": 100}

# List style (operators)
filters = [
    ["status", "=", "Draft"],
    ["amount", ">", 50],
    ["title", "like", "%lunch%"],
    ["creation", "between", ["2024-01-01", "2024-12-31"]]
]

# Supported operators: =, !=, >, <, >=, <=, like, not like, in, not in, between, is (for NULL)
```

## `frappe.qb.get_query` (preferred for complex queries)

Use instead of `get_all` when you need: joins via linked/child fields, aggregations, OR conditions, subqueries, or record locking. Docs: https://docs.frappe.io/framework/get_query

```python
# Basic usage
query = frappe.qb.get_query("User", fields=["name", "email"], filters={"enabled": 1})
users = query.run(as_dict=True)

# Linked document fields (auto-joins via dot notation)
query = frappe.qb.get_query("Sales Order",
    fields=["name", "customer.customer_name as customer_name"],
    filters={"customer.territory": "North America"}
)

# Child table fields
query = frappe.qb.get_query("Sales Order",
    fields=["name", {"items": ["item_code", "qty", "rate"]}],
    filters={"items.item_code": "Item A"},
    distinct=True
)

# Aggregations
query = frappe.qb.get_query("Expense",
    fields=["category", {"SUM": "amount", "as": "total"}],
    group_by="category"
)

# OR conditions
query = frappe.qb.get_query("User", filters=[
    ["first_name", "=", "Admin"],
    "or",
    ["first_name", "=", "Guest"],
])

# Pagination
query = frappe.qb.get_query("User", fields=["name"], limit=20, offset=40)

# Permission-aware (default is ignore_permissions=True)
query = frappe.qb.get_query("Expense", ignore_permissions=False)

# Record locking
query = frappe.qb.get_query("Stock Entry", filters={"name": "SE-001"}, for_update=True)

# Large datasets — iterate without loading all into memory
with frappe.db.unbuffered_cursor():
    for row in query.run(as_iterator=True, as_dict=True):
        process(row)
```

### When to use what

| Need | Use |
|------|-----|
| Simple CRUD, single doc | `frappe.get_doc`, `frappe.db.get_value`, `frappe.db.set_value` |
| List with simple filters | `frappe.db.get_all` / `frappe.db.get_list` |
| Joins, aggregations, OR logic, child table queries | `frappe.qb.get_query` |
| Composable query — pass query object to other functions to add clauses | `frappe.qb.get_query` |

## Transactions

Frappe manages transactions automatically. You almost never need `frappe.db.commit()` or `frappe.db.rollback()`.

- **POST/PUT web requests**: auto-commit after successful completion. GET requests do NOT commit.
- **Background/scheduled jobs**: auto-commit after successful completion.
- **Patches**: auto-commit after successful `execute()`.
- **Uncaught exceptions**: auto-rollback in all contexts (web requests, background jobs, patches).

`frappe.db.commit()` is only needed in rare cases like flushing writes mid-script so a subsequent `frappe.enqueue` call can read them.

```python
# Use savepoints for partial rollback within a transaction
frappe.db.savepoint("before_risky_op")
try:
    ...
except Exception:
    frappe.db.rollback(save_point="before_risky_op")
```

## PyPika query builder (`frappe.qb`)

You may encounter `frappe.qb.DocType("...")` in existing codebases — this is the lower-level PyPika builder. Prefer `frappe.qb.get_query` (documented above) for new code, but recognize and maintain this style when editing existing code:

```python
Expense = frappe.qb.DocType("Expense")
query = (
    frappe.qb.from_(Expense)
    .select(Expense.name, Expense.amount)
    .where(Expense.status == "Draft")
    .orderby(Expense.creation, order=frappe.qb.desc)
    .limit(20)
)
results = query.run(as_dict=True)
```

## Anti-patterns

- **Don't use raw SQL when `frappe.qb` works.** Prefer the query builder for UPDATE/INSERT. Use `frappe.db.sql` only for queries `frappe.qb` cannot express (CTEs, etc.).
  ```python
  # BAD
  frappe.db.sql("UPDATE `tabExpense` SET `amount` = `amount` + 1 WHERE name = %s", (name,))
  # GOOD
  Expense = frappe.qb.DocType("Expense")
  frappe.qb.update(Expense).set(Expense.amount, Expense.amount + 1).where(Expense.name == name).run()
  ```
- **Don't make multiple queries when one will do.** Use OR filters via `frappe.qb.get_query` instead of chaining `frappe.db.get_value(...) or frappe.db.get_value(...)`.
- **Use `frappe.db.delete` for bulk deletion when the DocType has no `on_trash`/`after_delete` hooks.** It runs a single DELETE query. Use `frappe.delete_doc` in a loop only when controller trash hooks need to fire.
- **Batch-fetch related records instead of querying in a loop.**
  ```python
  # BAD — N+1
  for exp in expenses:
      exp.category_label = frappe.db.get_value("Expense Category", exp.category, "label")
  # GOOD
  cat_ids = {e.category for e in expenses if e.category}
  cat_map = {c.name: c.label for c in frappe.get_all("Expense Category", filters={"name": ["in", list(cat_ids)]}, fields=["name", "label"])}
  for exp in expenses:
      exp.category_label = cat_map.get(exp.category)
  ```

---

## Database API

### Get Values

```python
# Single value
name = frappe.db.get_value("Customer", {"email": "test@example.com"}, "name")

# Multiple values
name, email = frappe.db.get_value("Customer", "CUST-001", ["name", "email_id"])

# As dict
data = frappe.db.get_value("Customer", "CUST-001",
    ["name", "email_id", "territory"], as_dict=True)
```

### Get List

```python
# Get all (respects permissions)
docs = frappe.get_all("Customer",
    fields=["name", "customer_name", "territory"],
    filters={"status": "Active"},
    order_by="creation desc",
    limit_start=0,
    limit_page_length=20
)

# Get list (same as get_all but ignores permissions by default)
docs = frappe.get_list("Customer",
    fields=["name", "customer_name"],
    filters={"disabled": 0}
)
```

### Set Value

```python
# Set single field
frappe.db.set_value("Customer", "CUST-001", "status", "Active")

# Set multiple fields
frappe.db.set_value("Customer", "CUST-001", {
    "status": "Active",
    "territory": "Kenya"
})
```

### Existence & Count

```python
# Check existence
exists = frappe.db.exists("Customer", "CUST-001")
exists = frappe.db.exists("Customer", {"email_id": "test@example.com"})

# Count
count = frappe.db.count("Customer", {"status": "Active"})
```

### Single DocType Values

```python
# frappe.db.* form (always hits/refreshes via DB layer)
value = frappe.db.get_single_value("My Settings", "enable_feature")
frappe.db.set_single_value("My Settings", "enable_feature", 1)

# v16: top-level cached getter (frappe.get_single_value -> get_cached_value)
# Prefer this for reads; it is cache-backed.
value = frappe.get_single_value("My Settings", "enable_feature")

# Full single document
settings = frappe.get_single("My Settings")   # == frappe.get_doc("My Settings", "My Settings")
settings.enable_feature = 1
settings.save()
```

### Cached Reads (v16)

```python
# Cached full document (1h TTL, invalidated on save)
doc = frappe.get_cached_doc("Customer", "CUST-001")

# Cached field(s) without materializing the whole doc
name = frappe.get_cached_value("Customer", "CUST-001", "customer_name")
row  = frappe.get_cached_value("Customer", "CUST-001",
    ["customer_name", "territory"], as_dict=True)

# Lazy-loaded doc: defers load_from_db until a field is accessed
doc = frappe.get_lazy_doc("Customer", "CUST-001")
```

### Raw SQL

```python
# Parameterized (ALWAYS use %s for security)
results = frappe.db.sql("""
    SELECT name, status
    FROM `tabCustomer`
    WHERE territory = %s AND status = %s
    ORDER BY creation DESC
""", ("Kenya", "Active"), as_dict=True)

# Single value
value = frappe.db.sql("SELECT COUNT(*) FROM `tabCustomer`")[0][0]
```

### Transaction Management

```python
try:
    doc1.save()
    doc2.save()
    frappe.db.commit()
except Exception as e:
    frappe.db.rollback()
    frappe.log_error(f"Error: {str(e)}")
    frappe.throw(str(e))
```

---

## Query Builder (PyPika)

Type-safe queries using the PyPika library. Preferred over raw SQL.

### Basic Queries

```python
from frappe.query_builder import DocType

Customer = DocType("Customer")

# Simple select
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name, Customer.customer_name, Customer.territory)
    .where(Customer.status == "Active")
    .orderby(Customer.creation, order=frappe.qb.desc)
    .limit(20)
)
results = query.run(as_dict=True)
```

### Filters and Conditions

```python
from frappe.query_builder.functions import Count, Sum, IfNull

# Multiple conditions
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(Customer.status == "Active")
    .where(Customer.territory == "Kenya")
    .where(Customer.creation >= "2024-01-01")
)

# OR conditions
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(
        (Customer.territory == "Kenya") | (Customer.territory == "Uganda")
    )
)

# IN operator
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(Customer.status.isin(["Active", "Lead"]))
)

# LIKE
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(Customer.customer_name.like("%Corp%"))
)

# IS NULL / IS NOT NULL
query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(Customer.phone.isnotnull())
)
```

### Joins

```python
Customer = DocType("Customer")
SalesInvoice = DocType("Sales Invoice")

# Inner join
query = (
    frappe.qb.from_(Customer)
    .join(SalesInvoice)
    .on(Customer.name == SalesInvoice.customer)
    .select(Customer.name, SalesInvoice.grand_total)
    .where(SalesInvoice.docstatus == 1)
)

# Left join
query = (
    frappe.qb.from_(Customer)
    .left_join(SalesInvoice)
    .on(Customer.name == SalesInvoice.customer)
    .select(Customer.name, Count(SalesInvoice.name).as_("invoice_count"))
    .groupby(Customer.name)
)
```

### Aggregations

```python
from frappe.query_builder.functions import Count, Sum, Avg, Max, Min

SalesInvoice = DocType("Sales Invoice")

query = (
    frappe.qb.from_(SalesInvoice)
    .select(
        SalesInvoice.customer,
        Count(SalesInvoice.name).as_("total_invoices"),
        Sum(SalesInvoice.grand_total).as_("total_amount"),
        Avg(SalesInvoice.grand_total).as_("avg_amount"),
    )
    .where(SalesInvoice.docstatus == 1)
    .groupby(SalesInvoice.customer)
    .having(Sum(SalesInvoice.grand_total) > 100000)
    .orderby(Sum(SalesInvoice.grand_total), order=frappe.qb.desc)
)
```

### Subqueries

```python
# Subquery
subquery = (
    frappe.qb.from_(SalesInvoice)
    .select(SalesInvoice.customer)
    .where(SalesInvoice.docstatus == 1)
    .distinct()
)

query = (
    frappe.qb.from_(Customer)
    .select(Customer.name)
    .where(Customer.name.isin(subquery))
)
```

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
