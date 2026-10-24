---
name: frappe-security-hardening
description: "Hardens Frappe apps at build time: permission model (frappe.has_permission, permission_query_conditions, ignore_permissions), @frappe.whitelist allow_guest, SQL injection via frappe.qb, XSS and Jinja |safe, CSRF, private file access, API keys and credentials stored in site_config.json rather than DocType fields, rate limiting, dependency audit, and three-tier security boundaries mapped to OWASP Top 10. Use when implementing any endpoint, permission guard, file handler, or user-input path. Use when wiring row-level access control for a new DocType. Not for whole-app sweeps — use frappe-app-audit for those."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/security-and-hardening/SKILL.md -->

# Frappe Security Hardening

Build security in; retrofitting it costs ten times more.

## When to use

- Adding a `@frappe.whitelist` endpoint or `allow_guest=True` route
- Writing or reviewing permission guards (`has_permission`, `frappe.only_for`)
- Any code that touches user input, file uploads, or renders Jinja templates
- Wiring `permission_query_conditions` or the `has_permission` hook for a DocType
- Pre-release dependency audit (`pip-audit`, `npm audit`)

Not for whole-app sweeps or semgrep rule catalogs → [`frappe-app-audit`](../frappe-app-audit/SKILL.md).

## Inputs required

- DocType(s) and roles involved
- Endpoint(s) being added or changed
- Whether guest access is required; whether file uploads are involved

## Procedure

### 0) Threat-model the boundary

Before writing a control, name: the trust boundary (form field, webhook, RPC, file upload, Jinja context), the asset (PII, money, admin action), and worst-case abuse. STRIDE in five minutes catches design flaws no control can patch later (OWASP A04 Insecure Design).

### 1) Apply the Frappe permission model

`frappe.has_permission(doctype, ptype, doc, user)` is the guard for programmatic checks.
For read-list isolation, register `permission_query_conditions` in `hooks.py` — the value is a dotted path to a function that returns a SQL fragment built with `frappe.qb`, never string-interpolated:

```python
# hooks.py
permission_query_conditions = {
    "Sales Order": "myapp.overrides.sales_order.get_perm_conditions",
}
has_permission = {
    "Sales Order": "myapp.overrides.sales_order.has_permission",
}
```

`frappe.only_for(["System Manager"])` raises `PermissionError` immediately for callers outside the list. `doc.flags.ignore_permissions = True` / `ignore_permissions=True` in `frappe.get_all` bypass all checks — require explicit sign-off; never use in user-facing paths.

### 2) Lock down whitelisted endpoints

```python
@frappe.whitelist(allow_guest=True, methods=["POST"])
def public_submit(payload):
    # validate every field; treat all input as hostile
    ...

@frappe.whitelist(methods=["GET"])
def admin_read():
    frappe.only_for(["System Manager"])
    ...
`allow_guest=True` exposes the method to unauthenticated callers. `methods` restricts HTTP verbs (`["GET"]`, `["POST"]`, `["POST","PUT"]`); omit only for idempotent read-only calls that still require login.

(16.51) `is_whitelisted()` raises `frappe.SessionExpired` — not a generic PermissionError — when the request session has expired and the caller is Guest. Clients should catch this and redirect to login.

(16.51) The forced-password-reset flow runs 2FA **before** sending the reset link; `response["redirect_to"]` no longer carries the raw reset key. Custom integrations that parsed that field will silently stop receiving it.

Mass assignment: never `doc.update(data)` with a caller-supplied dict. It lets the caller set `owner`, `docstatus`, `workflow_state`, `naming_series` or any hidden field. Copy an explicit allowlist of keys. (`doc.submit()` itself still enforces the `submit` permission.)

### 3) Prevent SQL injection (OWASP A03)

Use `frappe.qb` or `frappe.get_all(filters=[...])`. Never concatenate user values into SQL strings. Before rating an interpolated query, trace each value to its origin (grep every caller): request input is Critical/High; a DB value only an admin role can edit (Department name, Item Group) is Medium; a code constant is a style fix. Fix all three the same way: bind with `%s` or `frappe.qb`.

```python
# CORRECT
rows = frappe.get_all("Sales Order", filters={"status": status}, fields=["name"])

# CORRECT — frappe.qb
SO = frappe.qb.DocType("Sales Order")
rows = frappe.qb.from_(SO).select(SO.name).where(SO.status == status).run()

# ANTI-PATTERN: never build SQL by concatenating user values into a string
# (string-interpolated frappe.db.sql with user input = SQL injection)
```

### 4) Prevent XSS in Jinja templates and Python-built HTML (OWASP A03)

Never use `{{ value | safe }}` with user-supplied data. Call `frappe.utils.sanitize_html(html)` (allowlist-based, backed by `bleach`) before rendering untrusted HTML. HTML assembled in Python (email bodies, `msgprint`, `frappe.render_template` strings) must pass every DB or request value through `frappe.utils.escape_html()` first. Server Scripts and Print Format Jinja contexts run through `frappe.utils.safe_exec.safe_exec` (RestrictedPython sandbox); the sandbox is enabled when `disable_render_safe_exec` is absent/falsy in `common_site_config.json`.

### 5) CSRF and sessions

Frappe validates `X-Frappe-CSRF-Token` (or `csrf_token` form field) on every non-GET mutation for logged-in users (`frappe.auth.validate_csrf_token`). Do not bypass it. Session cookies are `httpOnly`; never store auth tokens in `localStorage`.

### 6) File privacy

`is_private = 1` on a File record routes it to `<bench>/sites/<site>/private/files/`, accessible only to authenticated sessions. `is_private = 0` routes to `<bench>/sites/<site>/public/files/` — world-readable. Never derive a file path from user input without resolving symlinks and verifying the result is under the expected root.

(16.51) `check_write_permission(doctype, name)` is enforced at the HTTP upload handler — before any file bytes are written — and again at `File.validate()` when attaching to a parent document (unless `flags.ignore_permissions`). Use `ignore_permissions=True` only intentionally, with a comment.

(16.51) For outbound fetch of user-supplied URLs, call `frappe.utils.data.validate_egress_url(url)` (raises `ValueError` for loopback/private/link-local IPs including `169.254.169.254`) or use `frappe.utils.safe_exec.get_safe_request_session()`. Server Scripts automatically route POST/PUT/PATCH/DELETE through `SSRFGuardedAdapter` with socket-level DNS-rebinding protection; `BlockedRequest` (a `frappe.ValidationError`) is raised on refusal.


### 7) Secrets

Secrets live in `site_config.json` (read via `frappe.conf.get("key")`) or environment variables — never committed to source. Password fields use Frappe's encrypted `Password` field type; read with `doc.get_password(fieldname)`. Never log `frappe.conf` values or request payloads that may contain passwords.

### 8) Rate limiting

Use the decorator on the endpoint, under `@frappe.whitelist()`: `@frappe.rate_limiter.rate_limit(limit=10, seconds=3600, key="<form_dict key>", ip_based=True)`. It is Redis-backed and shared across workers; never use a module-level dict (per-process, resets on worker restart). `frappe.rate_limiter.apply()` / `respond()` are framework request-lifecycle hooks driven by the site-wide `rate_limit` key in `site_config.json`; apps do not call them.

### 9) Dependency audit

Run `pip-audit` against `requirements.txt` and `npm audit` against the app's JS lockfile before every release. Triage critical/high by reachability. Never auto-apply `pip-audit --fix` or `npm audit fix --force` without reviewing changelogs and testing the upgrade.

## Verification

Walk [`references/security-checklist.md`](references/security-checklist.md) as a pre-commit/pre-merge gate.

- [ ] Every `@frappe.whitelist` endpoint validates all inputs; `allow_guest=True` routes treat all input as hostile
- [ ] `frappe.has_permission` or `frappe.only_for` called before reading/writing sensitive documents
- [ ] `permission_query_conditions` registered for DocTypes requiring row-level isolation
- [ ] `ignore_permissions=True` justified in comments and absent from user-facing paths
- [ ] No `frappe.db.sql` with string-interpolated user input anywhere in the changeset
- [ ] No `| safe` on user-supplied values in Jinja templates
- [ ] Confidential file records have `is_private = 1`; upload endpoints do not bypass `check_write_permission`
- [ ] Outbound calls to user-supplied URLs guarded by `validate_egress_url` or `get_safe_request_session()`
- [ ] Secrets read from `frappe.conf` or environment, not hardcoded
- [ ] `pip-audit` and `npm audit` pass with no unmitigated critical/high findings


## Failure modes / debugging

- **`frappe.PermissionError` on unexpected documents**: check `ignore_permissions` flag leaking from a background-job context into a user-facing path
- **`frappe.CSRFTokenError` on POST**: client missing `X-Frappe-CSRF-Token`; obtain from `frappe.csrf_token` in the boot object (`/api/method/frappe.auth.get_logged_user` response headers also carry it)
- **`sanitize_html` strips legitimate tags**: default allowlist is tight; pass explicit `disallowed_tags=[]` and broaden carefully
- **Rate limiter has no effect**: Redis unreachable; verify with `frappe.cache.ping()` in `bench --site <site> console`
- **Guest endpoint returns 403**: confirm `allow_guest=True` is set and the URL is in `app_include_js` or `website_route_rules` if it is a web page

## Escalation

- Whole-app security sweep + semgrep rules → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Per-change five-axis review including security → [`frappe-code-review`](../frappe-code-review/SKILL.md)
- Logging sensitive-data hygiene → [`frappe-observability`](../frappe-observability/SKILL.md)

## References

- [references/security-checklist.md](references/security-checklist.md) - Pre-commit/pre-merge Frappe security gate and OWASP mapping

## Guardrails

- **Always**: call `frappe.has_permission` before reading/mutating documents outside a controller `validate`/`on_submit`; use `frappe.qb` for any query with variable values; sanitize before rendering user HTML
- **Ask first**: before adding `allow_guest=True`, uploading public files, or changing rate-limit configuration
- **Never**: use `ignore_permissions=True` in a user-facing path; concatenate user input into SQL; log `frappe.conf` values or raw form payloads containing credentials

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's an internal endpoint, `has_permission` is overkill" | Internal endpoints are reachable from any browser tab; IDOR does not require external exposure. |
| "I'll add permission checks after the prototype works" | Prototypes become production. Indirect call paths through hooks are missed when permissions are bolted on later. |
| "DocType role permissions are set — that's enough" | Role-level DocType perms don't check ownership. `permission_query_conditions` or `has_permission` hook is required for row-level isolation. |
| "`ignore_permissions=True` is fine for background jobs" | Jobs triggered by document events still act on user-owned data; the flag must be explicit and reviewed, never a silent default. |
| "`\| safe` in Jinja is for content I control" | Admins store values users supplied earlier. "Controlled at render time" is not the same as "trusted at origin." |
| "We use `frappe.qb` everywhere, this one `db.sql` is fine" | The one exception is where the injection lives. Eliminate the exception class. |
| "Secrets in env vars are visible to all processes anyway" | They are isolated from version control and log pipelines. `site_config.json` and env vars are vastly safer than source code. |
| "`pip-audit` has false positives, we'll review before launch" | Findings compound. A pinned dependency may have a patch today; deferred, you now need to test a larger upgrade jump under launch pressure. |

## Red Flags

- `@frappe.whitelist(allow_guest=True)` on a method that creates, updates, or deletes records without caller identity verification
- `ignore_permissions=True` in a path reachable from an HTTP request
- `frappe.db.sql` with an f-string or `%` format containing a variable
- `{{ field | safe }}` in a Jinja template where `field` originates from a form or user record
- `is_private = 0` on File records holding PII or confidential attachments
- `doc.update(<request data>)` with no key allowlist, or a module-level dict used as a rate limiter
- `frappe.conf` values or full request payloads written to logs or Error Log
- A new DocType with no `permission_query_conditions` hook when rows must be isolated by owner or team
- `pip-audit` or `npm audit` not in the release checklist
- Outbound HTTP to a user-supplied URL with `frappe.integrations.utils.make_post_request` (unguarded outside safe-exec — use `get_safe_request_session()`)


## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Checking `frappe.session.user` instead of `frappe.has_permission` | Session user ≠ authorization; role and ownership are not verified | Call `frappe.has_permission(doctype, "read", doc)` and throw if it returns `False` |
| Building `permission_query_conditions` with string concat | Injects SQL via the condition itself | Use `frappe.qb` to build the fragment |
| Marking every upload `is_private = 0` for convenience | Files become world-readable URLs | Set `is_private = 1`; serve with `frappe.utils.file_manager.get_file_url` |
| Reading secrets with `os.environ` directly | Bypasses `site_config.json` per-site overrides | Use `frappe.conf.get("key")` which merges site and common config |
| Relying on client-side JS validation only | Any HTTP client bypasses it | Validate field types, ranges, and formats in the Python controller |
| Calling `make_post_request` with a user-supplied URL outside safe-exec (16.51) | No SSRF guard; attacker can reach internal services | Use `get_safe_request_session()` or validate with `validate_egress_url` first |
