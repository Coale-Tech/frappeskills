# API Surface Checklist

curl templates and error-shape verification cases for each surface type. Run these during step 4 of the devex-review procedure.

Set these before any block:

```bash
TOKEN="<api_key>:<api_secret>"
BASE="http://localhost:8000"
H='-H "Authorization: token $TOKEN" -H "Accept: application/json"'
```

---

## RPC method (`/api/method/`)

```bash
# happy path
time curl -s $H "$BASE/api/method/<app>.<module>.<method>" | python3 -m json.tool

# with POST body
time curl -s -X POST $H \
  -H "Content-Type: application/json" \
  -d '{"<param>": "<value>"}' \
  "$BASE/api/method/<app>.<module>.<method>" | python3 -m json.tool
```

**Check:** `{"message": ...}` wrapper present in V1 response; no bare value.

**Auth guard test** — call without token; expect 401:
```bash
curl -s -H "Accept: application/json" "$BASE/api/method/<app>.<module>.<method>"
# expected: {"exc_type": "AuthenticationError", ...}, HTTP 401
```

**Permission test** — use a user without the required role; expect 403:
```bash
curl -s -H "Authorization: token $LOWPERM_TOKEN" -H "Accept: application/json" \
  "$BASE/api/method/<app>.<module>.<method>"
# expected: {"exc_type": "PermissionError", ...}, HTTP 403
```

---

## REST resource (`/api/resource/`)

```bash
# list
time curl -s $H "$BASE/api/resource/<DocType>?limit=5&fields=[\"name\",\"<field>\"]" \
  | python3 -m json.tool

# single record
time curl -s $H "$BASE/api/resource/<DocType>/<name>" | python3 -m json.tool

# create (only on confirmed dev site)
time curl -s -X POST $H \
  -H "Content-Type: application/json" \
  -d '{"<mandatory_field>": "<value>"}' \
  "$BASE/api/resource/<DocType>" | python3 -m json.tool
```

**Missing mandatory field test** — expect 417:
```bash
curl -s -X POST $H -H "Content-Type: application/json" \
  -d '{}' "$BASE/api/resource/<DocType>"
# expected: {"exc_type": "MandatoryError", ...}, HTTP 417
```

**Non-existent record test** — expect 404:
```bash
curl -s $H "$BASE/api/resource/<DocType>/DOES-NOT-EXIST"
# expected: {"exc_type": "DoesNotExistError", ...}, HTTP 404
```

---

## Webhook (outbound from Frappe)

Frappe sends webhook payloads on document events (configured via Webhook DocType). To audit the outbound shape:

1. Stand up a local request catcher (e.g. `python3 -m http.server 9000 --bind 127.0.0.1`) or use a tunnel.
2. Set the webhook URL to your catcher.
3. Trigger the document event (create/save/submit the target DocType via curl).
4. Inspect the received payload for: `event`, `doctype`, `doc` object, and any configured `request_headers`.

**Check:** webhook payload is valid JSON; `Content-Type: application/json` header present; secret header (if configured) matches.

**Error case:** if the catcher returns a non-200, check `frappe.log_error` on the site for the retry/failure record.

---

## App install path

Steps to audit in order:

```bash
# 1. Install
bench get-app <app> <git-url>
# note: time from git clone start to "App <app> installed" message

# 2. Site install
bench --site <site> install-app <app>
# note: any migration errors or missing fixtures

# 3. Migrate
bench --site <site> migrate
# note: patch order (pre_model_sync → post_model_sync), any FAILED patches

# 4. Verify fixtures
bench --site <site> execute frappe.get_all --args '["<DocType>"]' \
  --kwargs '{"filters":{"name":["like","<fixture_prefix>%"]}}'
```

**README accuracy check:** run every command in the README verbatim; record any command that fails or requires knowledge not in the README.

**Patch idempotency check:** run `bench --site <site> migrate` a second time; all patches should be skipped (not re-executed).

---

## Error response shapes (verified against installed source)

| Exception class | HTTP | `exc_type` field value | Source |
|----------------|------|------------------------|--------|
| `AuthenticationError` | 401 | `"AuthenticationError"` | `frappe/exceptions.py:27` |
| `PermissionError` | 403 | `"PermissionError"` | `frappe/exceptions.py:35` |
| `DoesNotExistError` | 404 | `"DoesNotExistError"` | `frappe/exceptions.py:39` |
| `ValidationError` | 417 | `"ValidationError"` | `frappe/exceptions.py:19` |
| `MandatoryError` | 417 | `"MandatoryError"` | `frappe/exceptions.py:117` |
| `TooManyRequestsError` | 429 | `"TooManyRequestsError"` | `frappe/exceptions.py:80` |
| `RateLimitExceededError` | 429 | `"RateLimitExceededError"` | `frappe/exceptions.py:129` |

**V1 response envelope** (`/api/method/`, `/api/resource/`):
```json
{
  "exc_type": "<ClassName>",
  "exception": "<last traceback line>",   // only if allow_error_traceback=1
  "__server_messages": "[{\"message\": \"<user-facing text>\"}]"
}
```

**V2 response envelope** (`/api/v2/`):
```json
{
  "errors": [{"type": "<ClassName>", "exception": "<traceback>"}]
}
```

Traceback appears only when `frappe.get_system_settings("allow_error_traceback")` is truthy AND `frappe.local.flags.disable_traceback` is false OR `frappe._dev_server` is true. Source: `frappe/utils/response.py:is_traceback_allowed` (lines 60–65).

---

## Rate limit headers

Present on every response when `rate_limit` is configured in `site_config.json`:

| Header | Value |
|--------|-------|
| `X-RateLimit-Limit` | configured limit (in microseconds internally; surface as a count) |
| `X-RateLimit-Remaining` | remaining budget this window |
| `X-RateLimit-Reset` | Unix timestamp of window reset |
| `Retry-After` | same as Reset — only when the request was rejected (429) |

Source: `frappe/rate_limiter.py:RateLimiter.headers` (lines 82–92). If `rate_limit` key is absent from `site_config.json`, no rate limiting is active; mark the Observability rate-limit sub-dimension as N/A.

---

## Sources

- `apps/frappe/frappe/utils/response.py` lines 32–65 — `report_error`, `is_traceback_allowed`; V1/V2 response branching
- `apps/frappe/frappe/exceptions.py` lines 19–129 — exception classes with `http_status_code` attributes
- `apps/frappe/frappe/rate_limiter.py` lines 82–103 — `headers()` and `respond()` with 429 body
- `apps/frappe/frappe/auth.py` lines 614–707 — `validate_auth_via_api_keys`, `validate_api_key_secret`
- `apps/frappe/frappe/core/doctype/user/user.py` lines 1280–1296 — `generate_keys(user)` returning `api_key` and `api_secret`
- `apps/frappe/frappe/__init__.py` lines 813–855 — `whitelist(allow_guest, xss_safe, methods)` decorator
- `apps/frappe/frappe/api/__init__.py` lines 15–80 — `ApiVersion` enum, `get_api_version()`, V1/V2 routing
- Verified against Frappe 16.51.1 (installed bench source)
