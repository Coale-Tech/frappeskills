---
name: frappe-devex-review
description: "Scores the integrator experience of an already-shipped Frappe API surface by executing every documented step as a new caller — curl with token auth against a dev site, timed, with verbatim response evidence — then produces a six-dimension DX scorecard. Use when a whitelisted endpoint, REST resource, webhook, or app onboarding path is live and you need to measure how long a new integrator takes to succeed and where they get stuck — not for pre-build API design (frappe-plan-review) and not for reading source code (frappe-code-review)."
---

# Frappe DevEx Review

Evidence-backed audit of the developer experience of a built surface: time every step, score six dimensions, fix only on request.

<!-- Adapted from gstack devex-review, plan-devex-review (MIT) — methodology rewritten for Frappe/ERPNext; no gstack prose copied verbatim -->

## When to use

- A whitelisted API (`@frappe.whitelist()`), `/api/resource/` endpoint, or webhook is live on a dev/staging site and integrators will consume it
- A custom app's install path (`bench get-app`, `install-app`, `migrate`, README) needs onboarding verification before sharing
- Error messages and docs accuracy need a scored audit before the surface reaches external integrators
- Post-refactor or post-upgrade DX regression: "does this API still feel the same to a new caller?"

Not for plan-time DX scoring → Mode C in [`frappe-plan-review`](../frappe-plan-review/SKILL.md).  
Not for source-code quality → [`frappe-code-review`](../frappe-code-review/SKILL.md).  
Not for whole-app assessment → [`frappe-app-audit`](../frappe-app-audit/SKILL.md).

## Inputs required

- Target surface: URL path(s), DocType name, or app name
- Dev/staging site base URL (non-production; confirmed below)
- Integrator persona: assumed tech level and starting knowledge
- API key/secret OR permission to generate via `generate_keys` (step 3)
- Docs or README path to test for accuracy (if one exists)

## Procedure

### 1. Define persona and TTFS target

State who the integrator is (e.g. "Python developer, new to Frappe, has API key in hand") and the target time-to-first-success (TTFS). Default target: ≤10 min from reading docs to a successful response, no Desk session required.

### 2. Confirm dev/staging site

```bash
bench --site <site> execute frappe.get_conf --kwargs '{"key":"developer_mode"}'
```

Stop and report `BLOCKED` if `developer_mode` is not `1`. Never run mutating calls on an unconfirmed site.

### 3. Set up token auth

```bash
bench --site <site> execute frappe.core.doctype.user.user.generate_keys --args '["<test_user>"]'
# copy api_key and api_secret from output
TOKEN="<api_key>:<api_secret>"
BASE="http://localhost:8000"
```

Token auth: `Authorization: token <api_key>:<api_secret>` — validated in `frappe/auth.py:validate_auth_via_api_keys`. Never use session cookies or the Administrator password in evidence logs.

### 4. Execute the documented path literally

Run every step exactly as a new integrator would using only the provided docs. Time each call. Log command and trimmed response. See [`references/api-surface-checklist.md`](references/api-surface-checklist.md) for per-surface curl templates (RPC method, REST resource, webhook, install path).

```bash
time curl -s -H "Authorization: token $TOKEN" -H "Accept: application/json" \
  "$BASE/api/resource/<DocType>?limit=1" | python3 -m json.tool
```

### 5. Score six dimensions (0–10)

| # | Dimension | 10 looks like |
|---|-----------|---------------|
| 1 | Getting started | First success ≤10 min using docs + curl; no Desk session or source reading |
| 2 | API ergonomics | Consistent naming, predictable payload shape, minimal required fields |
| 3 | Error clarity | Every error names the record and the fix; `frappe.throw` with `exc_type` in body |
| 4 | Docs accuracy | Every example in README/docs runs verbatim against the live site |
| 5 | Upgrade/migration safety | Patches idempotent; `pre_model_sync`/`post_model_sync` order correct; no silent breaking changes |
| 6 | Observability | Every slow or failed call produces a structured log entry; `frappe.log_error` used in handlers |

### 6. Verify error response shapes

Trigger at least: one `PermissionError`, one missing-field `ValidationError`, one `DoesNotExistError`. Check against source:

- V1 (`/api/method/`, `/api/resource/`): `exc_type` present on error; traceback in `exception` only when `allow_error_traceback` is on in System Settings OR `frappe._dev_server` true (`response.py:is_traceback_allowed`)
- Exception → HTTP status: `PermissionError`→403, `DoesNotExistError`→404, `AuthenticationError`→401, `ValidationError`→417, `TooManyRequestsError`→429 (`frappe/exceptions.py`)
- Rate-limit 429 carries `X-RateLimit-Reset`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`; `Retry-After` only when the request is rejected (`rate_limiter.py:headers`)

Use finding format from [`frappe-code-review/references/finding-format-and-gates.md`](../frappe-code-review/references/finding-format-and-gates.md):  
`[SEVERITY] (confidence: N/10) endpoint:step — description`

### 7. Produce the DX report

```
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Persona: <who>  TTFS actual: <Xm Ys>  (target ≤10 min)
Scores: Getting-started N/10 | Ergonomics N/10 | Error-clarity N/10
        Docs-accuracy N/10 | Upgrade-safety N/10 | Observability N/10
Overall: <average>/10

Findings:
[SEVERITY] (confidence: N/10) endpoint:step — description

Evidence log:
$ <command>  →  <trimmed response>  [<elapsed>]
```

### 8. Fix loop (only on explicit request)

One `git commit` per finding: `devex: fix <id> — <description>`. Never batch two findings. Default is read-only.

## Verification

- [ ] Site confirmed non-production before any mutating call
- [ ] Token auth used; no session cookies or Administrator password in logs
- [ ] Every documented step executed and timed
- [ ] All six dimensions scored (0–10) with curl evidence
- [ ] At least three error types triggered and response shapes verified against source
- [ ] Each finding follows `[SEVERITY] (confidence: N/10) endpoint:step — description`
- [ ] Status line (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT) present in report

## Failure modes / debugging

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` on every call | Wrong token format | Use `Authorization: token <key>:<secret>` (space after `token`) |
| `403` with no body message | User lacks role or `allow_guest=False` with no token | Check `@frappe.whitelist()` decorator; add role permission for the test user |
| 500 returns HTML | Missing `Accept: application/json` header | Add `-H "Accept: application/json"` to every curl call |
| Traceback absent on dev site | `allow_error_traceback` off or `developer_mode` not set | Enable in System Settings; note: prod sites won't show it — audit what prod will expose |
| 429 with no `Retry-After` | Request not flagged as rejected by `RateLimiter` | Check `site_config.json` for `rate_limit`; absent config means no 429 — mark dimension N/A |

## Escalation

- Build or fix the API → [`frappe-api-development`](../frappe-api-development/SKILL.md)
- Plan-time API DX scoring → Mode C in [`frappe-plan-review`](../frappe-plan-review/SKILL.md)
- Source code quality and security → [`frappe-code-review`](../frappe-code-review/SKILL.md)
- Write tests for the surface → [`frappe-testing`](../frappe-testing/SKILL.md)
- Full app assessment → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)

## References

- [references/api-surface-checklist.md](references/api-surface-checklist.md) — curl templates for RPC method, REST resource, webhook, and app install-path audits; verified error-shape test cases with source citations

## Guardrails

- **Never run mutating calls on a prod site** — verify `developer_mode` first; refuse with BLOCKED if unconfirmed
- **Token auth only** — no session cookies, no Administrator password in any evidence log
- **Read-only by default** — no edits, no commits unless `--fix` explicitly requested
- **Confidence ≥ 7** before filing a finding — quote the actual curl response as evidence
- **One commit per finding** in fix loop; never batch

## Common Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "This is the same as code review" | Code review audits source quality; devex review audits the friction a new integrator hits — TTFS, error messages, and docs accuracy are invisible in source |
| "The API works, so DX is fine" | A call that works for the author after 30 min of trial-and-error fails the 10-minute TTFS target |
| "Docs can be fixed later" | A broken example ships as a broken example; the audit forces a score, which forces a fix before integrators are blocked |
| "Error messages are internal" | Integrators are developers; a bare 500 or an `exc_type`-only response with no message leaves them at step 1 indefinitely |
| "Rate limit headers are optional" | Integrators building retry logic depend on `X-RateLimit-Remaining` and `Retry-After`; absent headers produce blind retries and self-inflicted 429 storms |
| "We tested it manually so docs must be right" | Docs accuracy requires running every example verbatim from a clean slate; manual tests skip the step-by-step gaps that block a first-timer |
| "Dev site differences don't matter" | `allow_error_traceback` and `developer_mode` change error shapes; note these in the evidence log so integrators know what prod will expose |

## Red Flags

- Audit run on a production site or site with unconfirmed `developer_mode`
- Session cookies or passwords appear in the evidence log
- Fewer than six dimensions scored; partial scorecard filed as complete
- Findings cite source-code patterns instead of quoting actual curl responses
- TTFS measured from the auditor's own memory rather than a doc-only walk
- Fix commits batch two findings into one commit
- "DONE" status filed with no evidence log

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Measuring TTFS with prior knowledge | Familiarity bias hides doc gaps | Execute every step using only the provided docs; note every gap that required prior knowledge |
| Testing only the success path | Error paths are where integrators get stuck longest | Deliberately trigger `PermissionError`, `ValidationError`, and `DoesNotExistError`; verify each response shape |
| Filing an error-clarity finding without quoting the response | Unverifiable; confidence must drop to ≤4 | Quote verbatim JSON response body as evidence |
| Assuming rate limiting is active | Requires `rate_limit` key in `site_config.json`; absent means no 429 | Check config first; mark Observability dimension N/A for rate limits if not configured |
| Using `frappe.get_all` in fix code | `frappe.get_all` ignores permissions | Replace with `frappe.get_list` or add explicit `frappe.has_permission()` guard |
