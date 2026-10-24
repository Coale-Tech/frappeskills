<!-- Adapted from addyosmani/agent-skills (MIT): references/observability-checklist.md -->
# Frappe Observability Checklist

Pre-launch and pre-PR gate for instrumentation of Frappe apps. Use alongside [`frappe-observability`](../SKILL.md).

## Table of Contents

- [On-Call Questions (Start Here)](#on-call-questions-start-here)
- [Structured Logging](#structured-logging)
- [Error Log Coverage](#error-log-coverage)
- [Built-in Log DocTypes](#built-in-log-doctypes)
- [Sentry Setup](#sentry-setup)
- [RQ and Worker Health](#rq-and-worker-health)
- [Health-Check Endpoint](#health-check-endpoint)
- [Alerting](#alerting)
- [What NOT to Log](#what-not-to-log)
- [Verify the Telemetry](#verify-the-telemetry)
- [Pre-Launch Gate](#pre-launch-gate)
- [On-Call Runbook Template](#on-call-runbook-template)

## On-Call Questions (Start Here)

- [ ] 2–4 questions an on-call engineer will ask about this feature are written down
- [ ] Every log line, Error Log entry, and alert maps to at least one of those questions
- [ ] Signal type matched to question: logs say **why**, Scheduled Job Log says **what ran**, alerts say **that something is wrong**

## Structured Logging

- [ ] `frappe.logger(module)` used (not `print`) for production diagnostic output
- [ ] Log level used consistently: `error` = invariant broken; `warning` = degraded but handled; `info` = significant business event; `debug` = off in production by default
- [ ] Log entries use `extra={...}` with named fields, not free-form string interpolation
- [ ] Trace ID from `frappe.monitor.get_trace_id()` included in log entries for request-correlated paths
- [ ] Log files land in `<bench>/sites/<site>/logs/<module>.log`; module name matches the feature area
- [ ] Actual log output spot-checked: structured fields present, no `[object Object]` equivalents

```python
# CORRECT
logger = frappe.logger("payment_webhook")
logger.info("Webhook received", extra={
    "event": "webhook_received",
    "provider": provider,
    "ref": ref,
    "trace_id": frappe.monitor.get_trace_id(),
})

# WRONG — unqueryable, inconsistent
logger.info(f"Webhook from {provider} ref {ref} received")
```

## Error Log Coverage

- [ ] Every `except` block in background jobs, webhook handlers, and external API calls calls `frappe.log_error(title=..., message=frappe.get_traceback())`
- [ ] Error Log entries have descriptive titles (not "Error"); include entity identifiers (DocType + name)
- [ ] `frappe.log_error` keyword args used to avoid title/message swap (`title=..., message=...`)
- [ ] Log retention set in **Log Settings** (Desk → Log Settings); default 30-day retention is a starting point, not a ceiling

```python
try:
    process_webhook(payload)
except Exception:
    frappe.log_error(
        title=f"Webhook processing failed: {payload.get('ref')}",
        message=frappe.get_traceback(),
    )
```

## Built-in Log DocTypes

| DocType | How to query | Useful fields |
|---|---|---|
| Error Log | Desk → Logs → Error Log | `title`, `error`, `method`, `seen` |
| Scheduled Job Log | Desk → Logs → Scheduled Job Log | `scheduled_job_type`, `status`, `details`, `start_time` |
| Activity Log | Desk → Logs → Activity Log | `user`, `operation`, `subject`, `full_name` |
| Access Log | Desk → Logs → Access Log (enable in System Settings) | `export_from`, `file_type`, `user` |
| API Request Log | `frappe.conf.monitor = 1` required; shows method, time, status | `request_id`, `cmd`, `time` |

- [ ] Scheduled Job Log checked after every new `ScheduledJobType` entry to confirm `Complete` status
- [ ] Error Log retention period set and known; old entries not obscuring active issues
- [ ] `frappe.conf.monitor = 1` in `site_config.json` when API Request Log is needed for debugging

## Sentry Setup

```bash
# Set in supervisor.conf or hosting provider env (applies to web + worker processes)
FRAPPE_SENTRY_DSN=https://<key>@sentry.io/<project>

# Optional performance monitoring
SENTRY_TRACING_SAMPLE_RATE=0.1        # 10% of transactions
SENTRY_PROFILING_SAMPLE_RATE=0.05     # 5% profiling
ENABLE_SENTRY_DB_MONITORING=1         # Add DB query spans to traces
```

- [ ] `FRAPPE_SENTRY_DSN` set in **all process environments** (web + workers; not just web)
- [ ] **System Settings → Enable Telemetry** is checked (Sentry events are silently dropped when this is off)
- [ ] Sentry project DSN uses HTTPS; key material not committed to source
- [ ] Optional tracing/profiling env vars set only if Sentry plan supports them
- [ ] Verified: trigger a test exception in staging; confirm it appears in Sentry

## RQ and Worker Health

```bash
# Check worker and scheduler status
bench --site <site> doctor

# Check queue depth (bench --site <site> console)
from rq import Queue
from redis import Redis
r = Redis.from_url(frappe.conf.redis_queue)
for q in ["short", "default", "long"]:
    print(q, Queue(q, connection=r).count)
```

- [ ] `bench doctor` shows all workers running and scheduler active
- [ ] Failed jobs in RQ inspected after any new background task deployment
- [ ] Queue depth monitored for long-running jobs; alert if `long` queue depth exceeds threshold
- [ ] Workers for each queue (`short`, `default`, `long`) sized appropriately in `supervisor.conf`

## Health-Check Endpoint

```bash
curl https://<site>/api/method/frappe.ping
# Expected: {"message":"pong"}
```

- [ ] Load balancer health check points to `/api/method/frappe.ping`
- [ ] Uptime monitor confirms endpoint returns 200 with `{"message":"pong"}`
- [ ] No auth required on this endpoint (`allow_guest=True` in Frappe core)

## Alerting

Alert on symptoms, not causes:

| ✅ Page-worthy (symptom) | ❌ Dashboard only (cause) |
|---|---|
| Error Log count > 20 in 5 minutes | CPU at 85% |
| Scheduled Job Log failures > 3 consecutive | Disk at 70% |
| `/api/method/frappe.ping` returns non-200 | One worker process restarted |
| RQ `long` queue depth > 100 for 10 minutes | Redis memory at 80% |

- [ ] Every alert is symptom-based; cause-based alerts moved to dashboards
- [ ] Every alert is actionable; "it self-heals" alerts are deleted
- [ ] Every alert links to a runbook (minimum three lines; see template below)
- [ ] Alert threshold justified by SLO or historical data, not a round number guess
- [ ] Each new alert test-fired once; confirmed it reached the right channel

## What NOT to Log

- **Passwords and tokens**: never log `frappe.conf` values, session tokens, API keys, `Authorization` headers
- **Raw request/response bodies**: may contain credentials or PII; log metadata only (status code, latency, sanitized ID)
- **Credit card numbers, bank accounts**: even partially — log last 4 digits if needed for correlation
- **Full user payloads**: allowlist the fields you log; do not log entire `frappe.form_dict`
- **Stack traces in user-facing error messages**: goes to Error Log; user sees a generic message

```python
# WRONG
logger.info(f"API call: {json.dumps(frappe.form_dict)}")  # may contain passwords

# CORRECT
logger.info("API call", extra={"method": frappe.form_dict.cmd, "user": frappe.session.user})
```

## Verify the Telemetry

Instrumentation is code; it can be wrong. Trigger the paths and look at actual output:

- [ ] Forced an exception in staging → found it in Error Log with correct title and traceback
- [ ] Found the corresponding log entry in `<bench>/sites/<site>/logs/<module>.log` by trace ID
- [ ] Sent test traffic → API Request Log shows the request (when `monitor = 1`)
- [ ] Scheduled job ran in staging → Scheduled Job Log shows `Complete` or `Failed` with detail
- [ ] Induced failure diagnosed from logs/Error Log alone, without reading the source code

## Pre-Launch Gate

All of the following must be true before the feature ships to production:

- [ ] On-call questions written; each signal maps to a question
- [ ] `frappe.log_error` wraps every exception path in background jobs and external integrations
- [ ] `frappe.logger(module)` used for significant events; `debug` level used for verbose detail (off in production)
- [ ] No PII or credentials in any log line (spot-checked actual output)
- [ ] Scheduled Job Log confirmed `Complete` for all new jobs after a staging test run
- [ ] `bench --site <site> doctor` output is clean
- [ ] `/api/method/frappe.ping` reachable and returning 200
- [ ] At least one symptom-based alert configured with a runbook link

## On-Call Runbook Template

Store runbooks in `docs/runbooks/` named after the alert. Minimum three lines:

```markdown
# Runbook: Error Log Spike in <feature>

**Means:** Payment webhook processor is failing; likely provider timeout or schema mismatch.

**First check:**
bench --site <site> console
> frappe.get_all("Error Log", filters={"method": ("like", "%payment_webhook%")},
...   fields=["title", "error"], order_by="creation desc", limit=5)

**Escalate to:** #payments-engineering or on-call rotation.
```

Update the runbook whenever an incident reveals a missing step.

## Sources

- `apps/frappe/frappe/__init__.py` — `frappe.logger(module, with_more_info, max_size, file_count)` (line 1479), `frappe.ping()` whitelisted with `allow_guest=True` (line 1553)
- `apps/frappe/frappe/utils/error.py` — `log_error(title, message, reference_doctype, reference_name, defer_insert)` (line 44)
- `apps/frappe/frappe/monitor.py` — `get_trace_id()`, `MONITOR_REDIS_KEY`, `frappe.conf.monitor` config key, `Monitor.dump(response)`
- `apps/frappe/frappe/utils/sentry.py` — `FrappeIntegration`, `capture_exception`, `set_scope`; hooks DB execution, request handling, RQ jobs
- `apps/frappe/frappe/hooks.py` — Sentry activated by `FRAPPE_SENTRY_DSN` env var (line 471); `SENTRY_TRACING_SAMPLE_RATE`, `SENTRY_PROFILING_SAMPLE_RATE`, `ENABLE_SENTRY_DB_MONITORING` env vars
- `apps/frappe/frappe/boot.py` — `get_sentry_dsn()` reads `FRAPPE_SENTRY_DSN` env var (line 439); requires `enable_telemetry` System Setting
- `apps/frappe/frappe/core/doctype/error_log/` — Error Log DocType
- `apps/frappe/frappe/core/doctype/scheduled_job_log/` — Scheduled Job Log DocType
- `apps/frappe/frappe/core/doctype/activity_log/` — Activity Log DocType (auth events)
- `apps/frappe/frappe/core/doctype/access_log/` — Access Log DocType
- `apps/frappe/frappe/core/doctype/api_request_log/` — API Request Log DocType
- `apps/frappe/frappe/core/doctype/log_settings/` — Log Settings DocType (retention periods)
- `apps/frappe/frappe/commands/scheduler.py` — `bench --site <site> doctor` command
- `apps/frappe/frappe/utils/doctor.py` — `doctor(site)` implementation: worker/scheduler/Redis health
- `apps/frappe/frappe/utils/background_jobs.py` — `enqueue` queues `short`, `default`, `long`
