---
name: frappe-observability
description: "Instruments Frappe apps so production behaviour is visible and diagnosable. Covers frappe.logger and frappe.log_error, Error Log / Scheduled Job Log / Activity Log / Access Log / API Request Log DocTypes, Sentry via FRAPPE_SENTRY_DSN env var, bench doctor, RQ queue and worker monitoring, structured logging fields with frappe.monitor trace IDs, health-check endpoint /api/method/frappe.ping, symptom-based alerting (RED metrics), what NOT to log (PII/passwords), and log rotation via Log Settings. Use when adding any feature that runs in production. Not for diagnosing a failure in progress — use frappe-debugging-and-error-recovery for that."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/observability-and-instrumentation/SKILL.md -->

# Frappe Observability

Instrument as you build. The first user-reported bug becomes archaeology if there is no telemetry.

## When to use

- Shipping a new endpoint, background job, or external integration to production
- A production incident took too long to diagnose ("we couldn't tell what happened")
- Reviewing a PR that adds jobs, retries, or external API calls with zero new logging
- Setting up Sentry, structured logging, or alerting for a new app or site

Not for diagnosing an active failure → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md).
Not for performance profiling → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md).

## Inputs required

- Feature name and the 2–4 on-call questions it must answer
- Site name for bench commands and for checking built-in log DocTypes
- Whether Sentry is configured (`FRAPPE_SENTRY_DSN` env var set)

## Procedure

### 0) Write the on-call questions before instrumenting

Telemetry without a question is noise. Before adding any log or metric, write down the two to four questions an on-call engineer will ask about this feature:

```
FEATURE: payment webhook processor
QUESTIONS:
1. Did the webhook arrive, and did we process it successfully?
2. When processing fails, what's the provider error code?
3. Are webhooks backing up (queue depth growing)?
→ Every log line below must help answer one of these.
```

If you cannot name the questions, you are not ready to instrument.

### 1) Log with frappe.logger

`frappe.logger(module)` returns a Python `Logger` writing to `<bench>/sites/<site>/logs/<module>.log`. Use it for structured, level-annotated output:

```python
logger = frappe.logger("payment_webhook", with_more_info=True)

logger.info("Webhook received", extra={"event": "webhook_received", "provider": provider, "ref": ref})
logger.warning("Retry attempt", extra={"event": "webhook_retry", "attempt": n, "error_code": code})
logger.error("Permanent failure", extra={"event": "webhook_failed", "provider": provider, "ref": ref})
```

| Level | Use | On-call action |
|---|---|---|
| `error` | Invariant broken; data may be lost | Investigate now |
| `warning` | Degraded but handled (retry, fallback) | Watch trend |
| `info` | Significant business event | None |
| `debug` | Diagnostic detail; off in production | None |

### 2) Write errors to Error Log

`frappe.log_error(title, message)` persists to the **Error Log** DocType, visible in Desk under Logs → Error Log. Use it for exceptions and invariant violations that need a paper trail:

```python
try:
    process_payment(ref)
except Exception:
    frappe.log_error(
        title=f"Payment webhook failed: {ref}",
        message=frappe.get_traceback(),
    )
```

`frappe.log_error` also calls `frappe.utils.sentry.capture_exception()` when Sentry is configured,
so you get both Error Log and Sentry from one call.

(16.51) `frappe.get_traceback(with_context=True)` — which includes local variable values in the
traceback — is silently disabled outside `developer_mode`. On production sites it returns a plain
traceback regardless of the flag. Do not rely on `with_context=True` for production diagnostics;
use structured `frappe.logger` fields instead.


### 3) Use the built-in log DocTypes

Frappe maintains purpose-built log DocTypes — query them from Desk or via `frappe.get_all` for triage:

| DocType | What it records |
|---|---|
| **Error Log** | Python exceptions logged with `frappe.log_error`; traceback, site, user |
| **Scheduled Job Log** | Each scheduled job run: status (Complete/Failed), start/end time, job name |
| **Activity Log** | Login, logout, authentication events per user |
| **Access Log** | DocType open/print/export events (enabled in System Settings) |
| **API Request Log** | Inbound API calls when `frappe.conf.monitor = 1` in `site_config.json`; includes method, time, response status |

Purge schedules for all logs are managed in **Log Settings** (Desk → Log Settings). Set retention periods — Error Log default is 30 days.

### 4) Attach trace IDs

`frappe.monitor.get_trace_id()` returns the `X-Frappe-Request-ID` for the current request (set in `frappe.monitor.Monitor`). Include it in structured log lines so you can correlate log entries with the API Request Log:

```python
from frappe.monitor import get_trace_id

logger.info(
    "Processing payment",
    extra={"trace_id": get_trace_id(), "ref": ref, "amount": amount},
)
```

Never log passwords, tokens, full credit card numbers, or raw request/response bodies that may contain PII. Log metadata only: status codes, identifiers, latencies, error codes. An IP address next to a user id is PII under many privacy regimes; do not write both to Error Log on routine reads.

### 5) Configure Sentry

Set `FRAPPE_SENTRY_DSN` as an environment variable (e.g., in `supervisor.conf` or via your hosting provider). Frappe's `FrappeIntegration` (in `frappe.utils.sentry`) hooks into SQL execution, request handling, and background jobs automatically. Performance tracing and profiling are opt-in via `SENTRY_TRACING_SAMPLE_RATE` and `SENTRY_PROFILING_SAMPLE_RATE` env vars; `ENABLE_SENTRY_DB_MONITORING` adds DB query spans. Telemetry must also be enabled in **System Settings → Enable Telemetry**.

### 6) Monitor queue health with bench doctor

```bash
bench --site <site> doctor
```

Outputs: scheduler status, worker count per queue, pending/failed job count, Redis connectivity. Run this when jobs are delayed or not executing.

### 7) Health-check endpoint

`/api/method/frappe.ping` returns `"pong"` with no authentication required (`allow_guest=True`). Use it as the load-balancer health-check endpoint and for uptime monitors:

```bash
curl https://<site>/api/method/frappe.ping
# {"message":"pong"}
```

### 8) Symptom-based alerting (RED metrics)

Alert on symptoms users feel, not on causes:

```
PAGE-WORTHY (symptom):            DASHBOARD ONLY (cause):
Error Log count > 20 in 5 min     CPU at 85%
Scheduled Job Log failures > 3    Disk at 70%
RQ queue depth > 50 jobs          One worker restarted
```

Every alert must be actionable, link to a runbook, and have a threshold justified by historical data or SLO — not a guess.

## Verification

Walk [`references/observability-checklist.md`](references/observability-checklist.md) before shipping.

- [ ] On-call questions written down; every log line maps to one question
- [ ] `frappe.logger(module)` used for structured per-module output; no bare `print` statements in production paths
- [ ] `frappe.log_error(title, message)` used for exceptions that need a Desk-visible paper trail
- [ ] No passwords, tokens, or unredacted PII in any log line (spot-check actual `<bench>/sites/<site>/logs/` output)
- [ ] Trace ID from `frappe.monitor.get_trace_id()` included in structured log entries for request-correlated paths
- [ ] API Request Log enabled via `frappe.conf.monitor = 1` when request-level tracing is needed
- [ ] Scheduled Job Log shows `Complete` status for all new scheduled jobs after a test run
- [ ] `bench --site <site> doctor` shows all workers healthy and scheduler running
- [ ] `/api/method/frappe.ping` returns `{"message":"pong"}` from the load balancer health check
- [ ] At least one symptom-based alert configured for the new feature

## Failure modes / debugging

- **Error Log is empty but exceptions occur**: `frappe.log_error` not called in the `except` block; confirm it wraps the entire processing body
- **Scheduled Job Log shows `Failed` with no traceback**: exception raised before `frappe.log_error`; wrap job body in `try/except` and call `frappe.log_error` in the handler
- **API Request Log empty even with `monitor = 1`**: Redis must be reachable and `frappe.monitor.flush` hook must be wired (check `hooks.py` for `after_request` entries); flush is scheduled every 60 s
- **Sentry not receiving events**: confirm `FRAPPE_SENTRY_DSN` is set in the worker environment (supervisor env), not just the web process; and `enable_telemetry = 1` in System Settings
- **`bench doctor` shows workers down**: restart with `bench start` or `supervisorctl restart frappe-<site>-worker-*`

## Escalation

- Active failure triage → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)
- Slow-query or job-throughput investigation → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)
- Pre-launch monitoring and rollback triggers → [`frappe-shipping-and-launch`](../frappe-shipping-and-launch/SKILL.md)

## References

- [references/observability-checklist.md](references/observability-checklist.md) - Structured logging, alerting, pre-launch gate, and on-call runbook template

## Guardrails

- **Always** instrument before shipping: Error Log coverage for exceptions, `frappe.logger` for significant business events, Scheduled Job Log for every new scheduler entry
- **Never** log passwords, tokens, session IDs, or raw request/response bodies that contain PII; allowlist fields, don't log whole payloads
- **Never** add an alert that fires daily and gets acknowledged without action — delete noisy alerts; a tuned pager is a trusted pager

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add logging after it works" | "After" becomes "after the first incident" — the most expensive moment to discover you're blind. |
| "More logs = more observability" | Unstructured noise makes incidents slower. Three queryable events beat three hundred prose lines. |
| "The Error Log is noisy already; I won't add to it" | A noisy Error Log needs a retention policy (Log Settings), not fewer error records. Fix the noise, not the visibility. |
| "We can just look at the Scheduled Job Log when something breaks" | Built-in logs show what ran; they don't show why a retry loop is growing or what the provider said. Add structured detail now. |
| "Alert on everything important, we'll tune later" | A noisy pager trains people to ignore it. The tuning never happens; the missed real alert does. |
| "`frappe.log_error` is enough, no need for `frappe.logger`" | Error Log captures exceptions. `frappe.logger` captures the flow leading up to them — that context is what makes triage fast. |
| "Sentry is overkill for an internal app" | Sentry aggregates, deduplicates, and surfaces the highest-frequency errors. Error Log shows the same data per-row with no aggregation. Both earn their place. |

## Red Flags

- A new background job, webhook handler, or external API call with zero `frappe.log_error` or `frappe.logger` calls
- `print()` statements used for production diagnostics instead of `frappe.logger`
- Log lines built by string interpolation (unqueryable) rather than structured `extra={}` fields
- Passwords, tokens, or full PII visible in `<bench>/sites/<site>/logs/` or Error Log
- Scheduled Job Log never checked after wiring a new `ScheduledJobType`
- Alerts configured on causes (CPU, worker count) with no symptom-based (error rate, queue depth) alert
- `FRAPPE_SENTRY_DSN` set but `enable_telemetry` off in System Settings — events silently dropped

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| `frappe.log_error(traceback, title)` (args swapped) | Title and message parameter order is easy to swap; the API accepts both orders but the stored title becomes a traceback | Use `frappe.log_error(title="...", message=frappe.get_traceback())` with keyword args |
| Logging inside a finally block without re-raising | Swallows exceptions silently | Log in `except`, then `raise` or handle explicitly |
| `frappe.conf.monitor = 1` set but Redis queue missing `frappe.monitor.flush` hook | API Request Log never populated | Confirm `after_request` hook in `frappe/hooks.py` includes `frappe.monitor.flush` (it does by default) |
| Using activity_log for application events | Activity Log is for auth events; custom events clutter security audit trail | Use `frappe.logger(module)` for application events |
| No log retention policy set | Error Log grows unbounded; older entries obscure active issues | Set retention in Log Settings (Desk → Log Settings) |
