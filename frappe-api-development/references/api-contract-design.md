<!-- Adapted from addyosmani/agent-skills (MIT): skills/api-and-interface-design/SKILL.md -->
# API Contract Design for Frappe Whitelisted Methods

Contract-first principles for `@frappe.whitelist()` RPC methods and the Frappe REST resource API.

## Hyrum's Law in Frappe APIs

> With a sufficient number of users of an API, all observable behaviors of your system will be depended
> on by somebody, regardless of what you promise in the contract.

Every dict key name, null value, result ordering, and error message text in a whitelisted method's
response becomes a de facto contract once callers depend on it. Design implications:

- **Return a stable dict shape from day one.** Adding optional keys is safe; removing or renaming
  breaks callers silently (`useCall` surfaces `undefined`).
- **Error message text is observable.** Do not have callers parse `frappe.throw()` messages; use
  exception types and HTTP codes for machine-readable error classification.
- **Treat every public method as a versioned contract.** Deprecate instead of delete.

## Consistent Error Shapes via Frappe Exceptions

Frappe maps exception subclasses to HTTP status codes in `frappe/exceptions.py` (v16):

| Exception | HTTP | Use when |
|---|---|---|
| `frappe.ValidationError` | 417 | Invalid business data (default for `frappe.throw()`) |
| `frappe.MandatoryError` | 417 | Required field missing (subclass of `ValidationError`) |
| `frappe.PermissionError` | 403 | User lacks permission |
| `frappe.AuthenticationError` | 401 | Not authenticated |
| `frappe.DoesNotExistError` | 404 | Record not found (subclass of `ValidationError`) |
| `frappe.DuplicateEntryError` | 409 | Naming collision (subclass of `NameError`) |
| `frappe.TooManyRequestsError` | 429 | Rate limit exceeded |

Use the most specific subclass so the caller receives the right status code:

```python
if not frappe.db.exists("Customer", customer):
    frappe.throw(_("Customer {0} not found").format(customer), frappe.DoesNotExistError)
```

Note: Frappe uses **417** (Expectation Failed) for `ValidationError` — a non-standard choice.
Do not rely on client libraries that expect 422 for validation failures.

The client receives the exception's string representation in `exc`; the HTTP status drives branching,
not the message text.

## Response Shape

Always return a plain `dict` or `list`. A `frappe.Response` object produces `undefined` in
`useCall` / `createResource`:

```python
@frappe.whitelist()
def get_order_summary(order: str) -> dict:
    frappe.has_permission("Sales Order", "read", doc=order, throw=True)
    doc = frappe.get_doc("Sales Order", order)
    return {
        "name": doc.name,
        "customer": doc.customer,
        "total": doc.grand_total,
        "status": doc.status,
    }
```

Return shape is a contract. Once shipped, removing a key breaks callers.

## Versioning Whitelisted Methods

Frappe has no versioning decorator. The only versioning mechanism is the Python **module path**:

```
POST /api/method/my_app.api.v1.orders.create_order   ← stable
POST /api/method/my_app.api.v2.orders.create_order   ← new incompatible shape
```

When the contract changes incompatibly:

1. Create `<app>/api/v2/<module>.py` with the new signature.
2. Keep `api/v1/` working until all callers migrate.
3. Add a deprecation comment and a `frappe.msgprint(indicator="orange")` to the v1 method.
4. Remove v1 only after confirming no callers remain (Error Log, nginx access log, network tab).

Do not change the argument list or return shape of a live method without versioning it.

## Input Validation at the Boundary

All whitelisted arguments arrive as strings, dicts, or lists. Frappe JSON-decodes list/dict args
automatically, but types must be checked before use in queries:

```python
@frappe.whitelist()
def bulk_approve(orders: list | str, note: str | None = None) -> dict:
    if isinstance(orders, str):
        import json
        orders = json.loads(orders)
    if not isinstance(orders, list) or not all(isinstance(o, str) for o in orders):
        frappe.throw(_("orders must be a list of document names"), frappe.ValidationError)
    # safe to use orders in filters now
```

Never pass an unvalidated argument directly into `filters=` — a crafted list bypasses field checks.

## Idempotency for POST Mutations and Webhooks

Use `frappe.enqueue`'s `job_id` for idempotency on background operations:

```python
frappe.enqueue(
    "my_app.tasks.sync_order",
    queue="long",
    job_id=f"sync_order::{order}",   # same key deduplicates on the RQ side
    timeout=900,
    order=order,
)
```

For inbound webhooks, store the vendor-supplied event ID before processing:

```python
if frappe.db.exists("Webhook Log", {"external_id": event_id}):
    return {"status": "duplicate"}
frappe.get_doc({"doctype": "Webhook Log", "external_id": event_id}).insert(ignore_permissions=True)
```

For synchronous mutations where the same call can arrive twice, use a unique constraint or a
`docstatus` guard as the idempotency mechanism — a check-then-act sequence is a race.

## Pagination

Use `limit_start` and `limit_page_length` (Frappe conventions; default page size is 20):

```python
@frappe.whitelist()
def list_open_orders(company: str, start: int = 0, limit: int = 20) -> dict:
    frappe.has_permission("Sales Order", "read", throw=True)
    start = max(0, int(start))
    limit = min(max(1, int(limit)), 100)
    rows = frappe.get_all(
        "Sales Order",
        filters={"company": company, "status": "To Deliver", "docstatus": 1},
        fields=["name", "customer", "grand_total"],
        limit_start=start,
        limit_page_length=limit,
        order_by="creation desc",
    )
    return {"data": rows, "start": start, "limit": limit}
```

The REST resource API (`/api/v2/document/`) uses the same `limit_start` / `limit_page_length`
query parameters.

## Deprecating an Endpoint

1. **Announce** in the method body: `frappe.msgprint(_("Deprecated: migrate to v2"), indicator="orange")`.
2. **Version**: ship v2 at a new module path.
3. **Sunset**: after the agreed window, `frappe.throw(_("This endpoint is removed; use v2"), frappe.ValidationError)`.
4. **Remove**: delete the file after confirming no callers remain.

Never silently change a live method's return shape.

## Sources

- `apps/frappe/frappe/exceptions.py` — exception hierarchy with `http_status_code` attributes
- `apps/frappe/frappe/app.py` — `handle_exception`: exception-to-HTTP-status dispatch (v16)
- `apps/frappe/frappe/client.py` — `get_list` signature: `limit_start`, `limit_page_length`
- `apps/frappe/frappe/handler.py` — `@frappe.whitelist()` resolution and `method_not_found`
- `apps/frappe/frappe/api/__init__.py` — `/api/method/` and `/api/v2/` route handling
