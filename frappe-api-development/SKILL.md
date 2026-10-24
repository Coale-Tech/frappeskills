---
name: frappe-api-development
description: "Build REST and RPC Python endpoints in Frappe — @frappe.whitelist methods callable by mobile apps or web clients, the resource API, authentication, webhooks, OAuth, rate limiting, and fetching records. Use when creating endpoints for external callers, integrating third-party systems, or exposing business logic via API."
---

# Frappe API Development

Expose business logic over HTTP safely, and read/write data efficiently behind it.

## When to use

- Writing `@frappe.whitelist()` endpoints for a frontend or an integration
- Consuming or exposing the REST resource API
- Wiring webhooks, OAuth, token auth, or rate limits
- Writing efficient `frappe.db` / `frappe.qb` queries behind an endpoint

## Inputs required

- Endpoint contract: inputs, output shape, who may call it
- Auth model: session cookie, API key/secret, or OAuth token
- Whether the call mutates state (decides the permission gate)
- Expected volume (decides rate limiting and queueing)

## Procedure

### 0) Choose the surface

| Need | Surface |
|---|---|
| CRUD on a DocType | REST resource API — no code |
| Business operation | `@frappe.whitelist()` RPC method |
| Read-only list for a frontend | `frappe.client.get_list` or a whitelisted method |
| Outbound notification | Webhook |

### 1) Write the method

```python
import frappe
from frappe import _

@frappe.whitelist()
def approve_order(order: str, note: str | None = None):
    if not isinstance(order, str):
        frappe.throw(_("Invalid order"))

    frappe.has_permission("Sales Order", "submit", doc=order, throw=True)

    doc = frappe.get_doc("Sales Order", order)
    doc.add_comment("Comment", note or _("Approved"))
    doc.submit()
    return {"name": doc.name, "status": doc.status}
```

Type annotations on `@frappe.whitelist()` parameters are validated/coerced via Pydantic when the
request arrives (`frappe.utils.typing_validations.validate_argument_types`). Apps that declare
`require_type_annotated_api_methods = True` in `hooks.py` (CRM 2.x, HRMS 16.50+, frappe itself)
commit all their whitelisted methods to carry annotations. Unannotated parameters are passed through
as strings (no coercion); annotated parameters are coerced and raise `FrappeTypeError` on mismatch.


Return plain dicts — a `Response` object breaks `createResource` on the frontend.
Full contract: [references/api.md](references/api.md), template in
`assets/api.py.template`.

### 2) Gate permissions explicitly

`@frappe.whitelist()` does **not** inherit DocType permissions. Every
state-changing method calls `frappe.has_permission(..., throw=True)`. Read-only
methods still filter by permission, never by trust in the caller's arguments.

`allow_guest=True` means *the public internet* — justify it in a comment.

### 3) Validate input types, not just presence

A whitelisted argument arrives as a string, list or dict of the caller's
choosing. Check `isinstance` before passing anything into filters, or a crafted
filter list bypasses your checks.

### 4) Query efficiently

```python
rows = frappe.get_all(
    "Sales Order",
    filters={"status": "To Deliver", "company": company},
    fields=["name", "customer", "grand_total"],
    limit=100,
)

from frappe.query_builder import DocType
SO = DocType("Sales Order")
q = frappe.qb.from_(SO).select(SO.name, SO.grand_total).where(SO.docstatus == 1)
```

Always use `frappe.get_all`/`frappe.get_list` or `frappe.qb` — never
`frappe.db.sql`, even parameterized, for a query they can express. The one
exception is an operator `frappe.qb` genuinely can't expose (e.g. `REGEXP`);
see [references/database.md](references/database.md#never-use-frappedbsql-by-default).

(16.51) Filters on `_assign` and `_liked_by` with `=` / `!=` are automatically
rewritten to `like` / `not like` because both fields store JSON arrays. A filter
`filters={"_assign": "user@example.com"}` becomes `LIKE %user@example.com%`.


### 5) Wire external access

- REST resource API, v1 vs v2: [references/rest-api.md](references/rest-api.md)
- Outbound webhooks: [references/webhooks.md](references/webhooks.md)
- OAuth 2.0 and social login: [references/oauth.md](references/oauth.md)
- Token/session mechanics: [references/authentication.md](references/authentication.md)
- Throttling: `@rate_limit` per request rate; `@concurrent_limit` (v16) caps in-flight calls — [references/rate-limiting.md](references/rate-limiting.md)

### 6) Connect a frontend

End-to-end DocType → API → page wiring:
[references/integration-quickstart.md](references/integration-quickstart.md).
Third-party sync shapes: [references/integration-patterns.md](references/integration-patterns.md).

## Verification

- [ ] Endpoint returns the documented shape for a valid call
- [ ] A user lacking the role receives 403, not data
- [ ] Malformed input (wrong type, injected filter) is rejected, not executed
- [ ] No string-interpolated SQL anywhere in the path
- [ ] Guest-accessible methods are intentional and documented
- [ ] Rate limit applies where the endpoint is publicly reachable
- [ ] Response consumed successfully by the real caller (curl or the frontend)

## Failure modes / debugging

- **403 for a legitimate user**: role permission vs. User Permission — [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md) → `advanced-permissions.md`
- **Works for everyone**: no permission gate; `@frappe.whitelist()` does not inherit any
- **`Invalid method`**: method not whitelisted, wrong dotted path, or cache not cleared
- **CSRF errors from an external client**: use API key/secret headers, not session cookies
- **Frontend gets `undefined`**: method returned a `Response` object instead of a dict
- **Slow endpoint**: N+1 `frappe.get_doc` in a loop — batch with `frappe.get_all`
- **Timeouts under load**: move the work to `frappe.enqueue` — [`frappe-app-development`](../frappe-app-development/SKILL.md)
- **`SessionExpired` error (16.51)**: `is_whitelisted()` now raises `frappe.SessionExpired` instead of a generic PermissionError when the guest session has expired; the client should redirect to login
- **`FrappeTypeError` on a `@frappe.whitelist()` call**: parameter type annotation mismatch; the argument value does not coerce to the declared type


## Escalation

- Security review of the endpoint → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Heavy or long-running work → [`frappe-app-development`](../frappe-app-development/SKILL.md) → `queue-patterns.md`
- Consuming the API from Vue → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Unclear framework behaviour → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Per-endpoint security hardening → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Query performance and N+1 analysis → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)

## References

- [references/api.md](references/api.md) - Whitelisted methods, arguments, responses
- [references/rest-api.md](references/rest-api.md) - REST resource API: v1 vs v2 routes, envelopes, query params
- [references/database.md](references/database.md) - `frappe.db`, `frappe.qb`, transactions, performance
- [references/authentication.md](references/authentication.md) - Sessions, API keys, tokens (index)
- [references/authentication-server.md](references/authentication-server.md) - Server-side permission model, rate limiting, CSRF
- [references/authentication-client.md](references/authentication-client.md) - frappe-ui client auth, route guards, session timeout
- [references/authentication-api-keys.md](references/authentication-api-keys.md) - Issuing and validating API keys
- [references/oauth.md](references/oauth.md) - OAuth 2.0 flows and social login
- [references/webhooks.md](references/webhooks.md) - Outbound event delivery
- [references/rate-limiting.md](references/rate-limiting.md) - Throttling configuration
- [references/integration-patterns.md](references/integration-patterns.md) - Third-party sync and connectors
- [references/integration-quickstart.md](references/integration-quickstart.md) - DocType → API → frontend
- `assets/api.py.template`
- [references/api-contract-design.md](references/api-contract-design.md) - Contract-first design: Hyrum's Law, error shapes, versioning, idempotency, pagination, deprecation

## Guardrails

- **Explicit permission check on every state-changing method**: `frappe.has_permission(..., throw=True)`
- **Never trust argument types**: validate with `isinstance` before using them in filters
- **`frappe.qb`/`frappe.get_all`/`frappe.get_list` always — never `frappe.db.sql`** for a query they can express; see [references/database.md](references/database.md)
- **Return dicts, not `Response` objects**
- **`allow_guest=True` is a public endpoint**: justify, rate-limit, and validate hard
- **Translate user-facing errors**: `frappe.throw(_("…"))`
- **Never log secrets**: API keys and tokens stay out of error messages

<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`allow_guest=True` is fine, the data is not sensitive" | Any data reachable by the public internet is sensitive; justify it, rate-limit it, and validate all inputs. |
| "The permission check happens in the controller, the API inherits it" | `@frappe.whitelist()` enforces no DocType permissions; the method must call `frappe.has_permission` itself. |
| "I'll validate inputs more carefully next iteration" | An unvalidated argument is a crafted-filter injection; validate types at the boundary on day one. |
| "`frappe.db.sql` is fine here, it's only a read" | Raw SQL bypasses `frappe.qb`'s dialect safety; one edit later it becomes an injection point. |
| "It's an internal API, rate limiting is overkill" | An unthrottled internal caller under load starves gunicorn workers for every other request. |
| "Returning a `Response` object gives me more control" | `useCall`/`createResource` expect a plain dict; a `Response` object produces `undefined` on the client. |

## Red Flags

- `@frappe.whitelist()` method with no `frappe.has_permission` call inside it
- `allow_guest=True` without a comment explaining the public need
- `frappe.db.sql(...)` for a query that `frappe.qb` can express
- Argument passed directly into `filters=` without an `isinstance` check
- No rate limit on an endpoint reachable without authentication
- Method returns `frappe.local.response` or a `Response` object instead of a dict
- Filter `{"_assign": "..."}` with `=` operator expecting an exact match (returns wrong results — auto-rewritten to `LIKE` in 16.51)

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| No `has_permission` call | Silent security bypass | `throw=True` gate |
| Ignoring `has_permission()`'s return value | Check does nothing | Pass `throw=True` or branch on it |
| `frappe.db.sql(...)` for a query `frappe.qb` can express | Bypasses qb's dialect handling; one edit from SQL injection | Rewrite with `frappe.qb` |
| Trusting a filter argument's type | Crafted filters bypass checks | `isinstance` validation |
| Returning a `Response` object | Breaks `createResource` | Return a dict |
| `allow_guest=True` by reflex | Public write endpoint | Remove it unless required |
| `frappe.get_doc` inside a loop | N+1 queries | Batch via `frappe.get_all` |
| Long work in the request | Gateway timeout | `frappe.enqueue` |
| Client Credentials / password grant against Frappe OAuth | Only `authorization_code` + `refresh_token` supported | Auth Code (+PKCE) or API key/secret |
| `from frappe.model.db_query import mask_field_value` (16.51) | `ImportError` — function moved | Import from `frappe.model.utils.mask` |
| `from frappe.desk.form.assign_to import add` (16.51) | `ImportError` — function is now private | Use `from frappe.desk.form.assign_to import _add` |
