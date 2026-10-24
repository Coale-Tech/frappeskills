<!-- Adapted from addyosmani/agent-skills (MIT): references/security-checklist.md -->
# Frappe Security Checklist

Pre-commit and pre-merge gate for Frappe app security. Use alongside [`frappe-security-hardening`](../SKILL.md).

## Table of Contents

- [Threat Model (Start Here)](#threat-model-start-here)
- [Pre-Commit Checks](#pre-commit-checks)
- [Permission Model](#permission-model)
- [Whitelisted Endpoints](#whitelisted-endpoints)
- [SQL / Injection](#sql--injection)
- [XSS and Template Rendering](#xss-and-template-rendering)
- [CSRF and Sessions](#csrf-and-sessions)
- [File Privacy](#file-privacy)
- [Secrets and Configuration](#secrets-and-configuration)
- [Rate Limiting](#rate-limiting)
- [Dependency Audit](#dependency-audit)
- [OWASP Top 10 — Frappe Mapping](#owasp-top-10--frappe-mapping)

## Threat Model (Start Here)

Before reaching for controls, spend five minutes thinking like an attacker:

- [ ] Trust boundaries mapped: HTTP inputs, webhook payloads, file upload content, Jinja context variables, background job payloads
- [ ] Assets named: credentials, PII, financial records, admin actions, irreversible operations
- [ ] STRIDE run per boundary (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation)
- [ ] Abuse cases written next to use cases ("how would I misuse this feature?")

## Pre-Commit Checks

```bash
# Check staged diff for secrets
git diff --cached | grep -iE "password|secret|api_key|token|db_password" | grep -v "site_config\|frappe.conf\|get_password\|Password\b"

# Confirm site_config.json is in .gitignore
grep "site_config.json" .gitignore
```

- [ ] No secrets in source code or git history
- [ ] `site_config.json` and `*.pem` / `*.key` files gitignored
- [ ] Example config committed with placeholder values only

## Permission Model

- [ ] `frappe.has_permission(doctype, ptype, doc, user)` called before reading/writing documents outside controller lifecycle hooks
- [ ] `permission_query_conditions` registered in `hooks.py` for every DocType requiring row-level isolation
- [ ] `has_permission` hook registered in `hooks.py` where per-document logic is needed
- [ ] `frappe.only_for(roles)` used for role-gating inside whitelisted methods
- [ ] `ignore_permissions=True` justified with a comment and absent from user-facing HTTP paths
- [ ] `doc.flags.ignore_permissions = True` never set inside a `validate` or `before_save` hook without explicit justification

```python
# hooks.py example
permission_query_conditions = {
    "Project Task": "myapp.perms.get_task_query_conditions",
}
has_permission = {
    "Project Task": "myapp.perms.has_task_permission",
}
```

## Whitelisted Endpoints

- [ ] Every `@frappe.whitelist` method validates input types, lengths, and allowed values
- [ ] `allow_guest=True` endpoints treat all input as untrusted; no document mutations without additional identity checks
- [ ] `methods=["POST"]` or `methods=["GET"]` set to restrict HTTP verbs where appropriate
- [ ] No sensitive data returned to guest callers
- [ ] No `doc.update(<request dict>)`: copy an explicit allowlist of fields (blocks setting `owner`, `docstatus`, `workflow_state`)

```python
@frappe.whitelist(allow_guest=True, methods=["POST"])
def contact_form(name, email, message):
    frappe.utils.validate_email_address(email, throw=True)
    if len(message) > 2000:
        frappe.throw("Message too long")
    # safe to proceed
```

## SQL / Injection

- [ ] No `frappe.db.sql` calls with f-strings, `%` formatting, or `.format()` on user-supplied values, nor on DB-sourced values users can edit (Department/Customer names, etc.)
- [ ] All list queries use `frappe.get_all` / `frappe.get_list` with `filters=` parameter
- [ ] Custom `frappe.qb` queries use field comparisons, not string concatenation
- [ ] `permission_query_conditions` fragment built with `frappe.qb`, not hand-rolled SQL

```python
# CORRECT
SalesOrder = frappe.qb.DocType("Sales Order")
q = frappe.qb.from_(SalesOrder).select(SalesOrder.name).where(SalesOrder.status == status)

# ANTI-PATTERN: never concatenate user values into a raw SQL string
# (frappe.db.sql with user input = SQL injection; use frappe.qb or frappe.get_all)
```

## XSS and Template Rendering

- [ ] No `{{ value | safe }}` in Jinja templates where `value` originates from a form, user record, or webhook payload
- [ ] HTML built in Python (email bodies, `msgprint`) escapes every interpolated value with `frappe.utils.escape_html`
- [ ] `frappe.utils.sanitize_html(html)` called before rendering user-supplied HTML
- [ ] Server Scripts and Print Formats use `frappe.render_template` — confirm `disable_render_safe_exec` is not set to `1` in `common_site_config.json` (disabling the RestrictedPython sandbox)
- [ ] JavaScript from user input never inserted via `innerHTML` in custom JS; use `textContent` or `frappe.utils.sanitize_html` first

## CSRF and Sessions

- [ ] Custom AJAX calls include `frappe.csrf_token` in the request header (`X-Frappe-CSRF-Token`) or body (`csrf_token`)
- [ ] No code bypasses `frappe.auth.validate_csrf_token`
- [ ] Auth state is not stored in `localStorage` (session cookies are `httpOnly`)
- [ ] `frappe.session.user` is not treated as an authorization check on its own — ownership/role still must be verified

## File Privacy

- [ ] Files containing PII or confidential content have `is_private = 1`
- [ ] File paths derived from user input are resolved with `os.path.realpath` and checked against the expected root before use
- [ ] Public file restrictions enforced if `only_allow_system_managers_to_upload_public_files` is enabled in System Settings
- [ ] No direct filesystem paths constructed by concatenating user-supplied filenames

## Secrets and Configuration

- [ ] All secrets read from `frappe.conf.get("key")` (merges `site_config.json` + `common_site_config.json`) or environment variables
- [ ] Password fields use the `Password` fieldtype; retrieved with `doc.get_password(fieldname)` — never stored or logged as plaintext
- [ ] `frappe.conf` values never written to logs, Error Log, or API responses
- [ ] No hardcoded credentials in fixtures, patches, or test setup files committed to the repository

## Rate Limiting

- [ ] Guest-accessible endpoints that create records or send emails have rate limiting applied
- [ ] Per-endpoint limits use `@frappe.rate_limiter.rate_limit(...)` under `@frappe.whitelist()` (see `frappe-api-development/references/rate-limiting.md`); no module-level dict counters
- [ ] Site-wide cap, if wanted, via `rate_limit` in `site_config.json` (keys: `limit`, `window`); `apply()`/`respond()` are framework-internal, apps do not call them
- [ ] Redis reachable; verified with `frappe.cache.ping()` in `bench --site <site> console`

## Dependency Audit

```bash
# Python
pip-audit -r requirements.txt

# JavaScript (from app root)
npm audit --audit-level=high

# Or for yarn-based apps
yarn npm audit --recursive --environment production
```

- [ ] `pip-audit` returns no unmitigated critical or high findings
- [ ] `npm audit` / `yarn npm audit` returns no unmitigated critical or high findings
- [ ] Each deferred finding has a documented reason and a review date in the PR description
- [ ] Forced remediation (`--fix --force`) never applied without reviewing changelogs and testing

## OWASP Top 10 — Frappe Mapping

| # | OWASP Risk | Frappe Control |
|---|---|---|
| A01 | Broken Access Control | `frappe.has_permission`, `permission_query_conditions`, `frappe.only_for` |
| A02 | Cryptographic Failures | `Password` fieldtype + `doc.get_password`; secrets in `site_config.json`; HTTPS via proxy |
| A03 | Injection | `frappe.qb` / `frappe.get_all(filters=)`; `sanitize_html`; no `| safe` on user input |
| A04 | Insecure Design | Threat model before coding; spec-driven permissions matrix |
| A05 | Security Misconfiguration | `disable_render_safe_exec` absent/false; `is_private` on sensitive files; no debug in production |
| A06 | Vulnerable Components | `pip-audit` + `npm audit` before every release |
| A07 | Auth and Session Failures | CSRF token; `httpOnly` session cookies; rate-limit on login |
| A08 | Software Integrity Failures | Lockfiles committed; `pip-audit` checks package signatures |
| A09 | Logging and Monitoring Failures | Error Log, `frappe.logger`; never log passwords or tokens |
| A10 | SSRF | Allowlist outbound URLs; validate webhook and import-from-URL inputs |

## Sources

- `apps/frappe/frappe/__init__.py` — `whitelist(allow_guest, methods)`, `only_for(roles)`, `has_permission`, `ignore_permissions` parameter, `ping()` whitelisted endpoint
- `apps/frappe/frappe/auth.py` — `validate_csrf_token`, `X-Frappe-CSRF-Token` header, `frappe.CSRFTokenError`, login-failed count via `frappe.cache.hset`
- `apps/frappe/frappe/hooks.py` — `permission_query_conditions`, `has_permission` hook dictionaries
- `apps/frappe/frappe/utils/html_utils.py` — `sanitize_html(html, linkify, always_sanitize, disallowed_tags)`
- `apps/frappe/frappe/utils/safe_exec.py` — `safe_exec` (RestrictedPython sandbox), `RENDER_EXEC_CONFIG_KEY = "disable_render_safe_exec"`
- `apps/frappe/frappe/rate_limiter.py` — `RateLimiter` class, `apply()`, `respond()` functions
- `apps/frappe/frappe/core/doctype/file/file.py` — `is_private` field, `enforce_public_file_restrictions`, `validate_private_file_access`
- `apps/frappe/frappe/model/base_document.py` — `BaseDocument.get_password(fieldname)`
- `apps/frappe/frappe/client.py` — `get_password(doctype, name, fieldname)` whitelisted API
- `apps/frappe/frappe/config/__init__.py` — `get_site_config`, `get_conf` merging `site_config.json` + `common_site_config.json`
