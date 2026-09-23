# Background Jobs & Scheduler

Frappe uses Python RQ (Redis Queue) for background job processing.

## Enqueue a job

```python
import frappe

frappe.enqueue(
    "myapp.tasks.send_report",      # dotted path to function
    queue="default",                  # short, default, long
    timeout=300,                      # seconds
    report_name="Monthly Summary"     # kwargs passed to function
)
```

The function must be importable, for example from `apps/myapp/myapp/tasks.py`.

## Queue types

| Queue | Use for | Default timeout |
|-------|---------|----------------|
| `short` | Quick tasks < 5 min | 300s |
| `default` | Normal tasks | 300s |
| `long` | Heavy tasks (exports, bulk ops) | 1500s |

## Enqueue options

```python
frappe.enqueue(
    method="myapp.tasks.process",
    queue="long",
    timeout=1500,
    is_async=True,           # False to run synchronously (for debugging)
    now=False,               # True to run inline immediately
    at_front=False,          # True to push to front of queue
    job_id="unique_id",      # prevent duplicate jobs
    deduplicate=True,        # skip if same job_id is already queued
    enqueue_after_commit=True,  # only enqueue after DB commit
)
```

## Scheduled jobs

Define in `hooks.py`:
```python
# hooks.py
scheduler_events = {
    "daily": [
        "myapp.tasks.daily_cleanup"
    ],
    "hourly": [
        "myapp.tasks.sync_data"
    ],
    "cron": {
        "0 9 * * 1": [           # every Monday at 9 AM
            "myapp.tasks.weekly_report"
        ]
    }
}
```

Scheduler intervals: `all` (every 5 min), `hourly`, `daily`, `weekly`, `monthly`, `cron`.

## Checking job status

```python
from frappe.utils.background_jobs import get_jobs

jobs = get_jobs(site=frappe.local.site, queue="default")
```

## Common pitfalls

- Background jobs run in a separate worker process — they do NOT share state with the web request. Always pass data via arguments.
- Always specify `site` if the function needs `frappe.db` or other site context.
- Use `enqueue_after_commit=True` when the job depends on data written in the current request.

## Document-context jobs

```python
frappe.enqueue_doc(
    "Expense",                      # doctype
    "EXP-0001",                     # name
    "send_notification",            # method name on the Document class
    queue="short",
    timeout=300,
    now=False,
)
```

`enqueue_doc` loads the document and calls `doc.send_notification()` in the worker. Preferred when the job logic is a method on the Document controller.

---

## Background Jobs

### frappe.enqueue

```python
# Basic enqueue
frappe.enqueue(
    "my_app.tasks.process_data",
    queue="default",
    timeout=600,
    customer="CUST-001"
)

# v16 signature (frappe/utils/background_jobs.py):
#   enqueue(method, queue="default", timeout=None, event=None, is_async=True,
#           job_name=None, now=False, enqueue_after_commit=False, *,
#           on_success=None, on_failure=None, at_front=False, job_id=None,
#           deduplicate=False, at_front_when_starved=False, **kwargs)
#
# NOTE: `job_name` is DEPRECATED in v16 — use `job_id` (+ `deduplicate=True`) instead.
frappe.enqueue(
    "my_app.tasks.send_bulk_email",
    queue="long",
    timeout=1500,
    now=False,                    # now=True runs inline via frappe.call()
    enqueue_after_commit=True,    # enqueue only after the current txn commits
    job_id="bulk_email::campaign_42",
    deduplicate=True,             # skip if a job with this job_id is already queued/running
    on_success=my_app.tasks.notify_done,
    on_failure=my_app.tasks.notify_failed,
    recipients=recipients_list,
    template="welcome"
)

# Check if a deduplicated job is already queued
from frappe.utils.background_jobs import is_job_enqueued
if not is_job_enqueued("bulk_email::campaign_42"):
    ...
```

### Queue Types

| Queue | Timeout | Use Case |
|-------|---------|----------|
| `short` | 300s (5min) | Quick operations |
| `default` | 300s (5min) | Standard operations |
| `long` | 1500s (25min) | Heavy processing |

### Task Function

```python
# my_app/tasks.py
import frappe

def process_data(customer):
    """Background task function."""
    frappe.init(site=frappe.local.site)
    frappe.connect()

    try:
        doc = frappe.get_doc("Customer", customer)
        # Process...
    except Exception:
        frappe.db.rollback()
        frappe.log_error("process_data failed")
    finally:
        frappe.destroy()
```

### frappe.enqueue_doc

```python
# Enqueue a document method
frappe.enqueue_doc(
    "Sales Invoice", "INV-001",
    "send_notification",
    queue="short"
)
```

---

## Scheduler Events

### Configuration in hooks.py

```python
scheduler_events = {
    "all": [
        "my_app.tasks.every_minute_task"
    ],
    "daily": [
        "my_app.tasks.daily_cleanup"
    ],
    "daily_long": [
        "my_app.tasks.heavy_daily_task"
    ],
    "hourly": [
        "my_app.tasks.hourly_sync"
    ],
    "hourly_long": [
        "my_app.tasks.heavy_hourly_task"
    ],
    "weekly": [
        "my_app.tasks.weekly_report"
    ],
    "weekly_long": [
        "my_app.tasks.weekly_cleanup"
    ],
    "monthly": [
        "my_app.tasks.monthly_report"
    ],
    "cron": {
        "0 9 * * 1": [
            "my_app.tasks.monday_morning_report"
        ],
        "*/15 * * * *": [
            "my_app.tasks.every_15_minutes"
        ]
    }
}
```

### Valid Scheduler Frequency Keys (v16)

Verified against `Scheduled Job Type` frequency options
(`apps/frappe/frappe/core/doctype/scheduled_job_type/scheduled_job_type.json`) and
`frappe/hooks.py`:

| Key | Fires |
|-----|-------|
| `all` | Every scheduler tick (~every 4 min; `scheduler_tick_interval`) |
| `hourly` / `hourly_long` | Every hour (aligned to `:00`); `_long` runs on the `long` queue |
| `hourly_maintenance` | Roughly hourly, **not** wall-clock aligned (v16) |
| `daily` / `daily_long` | Once a day |
| `daily_maintenance` | Roughly daily, not wall-clock aligned (v16) |
| `weekly` / `weekly_long` | Once a week |
| `monthly` / `monthly_long` | Once a month |
| `yearly` / `annual` | Once a year |
| `cron` | Dict of crontab expressions -> handler lists |

> `*_maintenance` groups (v16) are for jobs that only need a frequency guarantee,
> deliberately offset from `:00` to spread load. `*_long` variants dispatch to the
> `long` RQ queue (1500s timeout).

### Scheduler Event Functions

```python
def daily_cleanup():
    """Run daily by scheduler."""
    old_logs = frappe.get_all("Error Log",
        filters={"creation": ["<", frappe.utils.add_days(frappe.utils.today(), -30)]},
        pluck="name"
    )
    for log in old_logs:
        frappe.delete_doc("Error Log", log, force=True)
```

---

## Sources

Verified against Frappe v16.27.1 (`frappe/__init__.py` `__version__ = "16.27.1"`):

- `apps/frappe/frappe/__init__.py` — `whitelist`, `get_list`/`get_all`/`get_value`, `delete_doc`, `rename_doc`, `get_hooks`, and the `frappe.model.document` re-exports (`get_doc`, `new_doc`, `get_cached_doc`, `get_cached_value`, `get_single_value`, `get_last_doc`, `get_single`, `get_lazy_doc`); `cache` / `client_cache` globals
- `apps/frappe/frappe/model/document.py` — `get_doc` (singledispatch), `new_doc`, `get_cached_doc`, `get_single_value`, `get_last_doc`, `db_set`
- `apps/frappe/frappe/database/database.py` — `get_value`, `set_value`, `get_single_value`, `exists`, `count`
- `apps/frappe/frappe/query_builder/` — `frappe.qb`, `DocType`, `get_query`
- `apps/frappe/frappe/utils/background_jobs.py` — `enqueue`/`enqueue_doc` signatures, `get_queues_timeout` (short/default=300s, long=1500s), `is_job_enqueued`, `job_name` deprecation
- `apps/frappe/frappe/hooks.py` — framework `doc_events`, `scheduler_events`, and hook-key surface
- `apps/frappe/frappe/utils/boilerplate.py` — `hooks_template` (canonical `bench new-app` hooks.py)
- `apps/frappe/frappe/core/doctype/scheduled_job_type/scheduled_job_type.json` — scheduler frequency options
- `apps/frappe/frappe/utils/redis_wrapper.py` + `frappe/utils/caching.py` — `frappe.cache`, `client_cache`, `request_cache`/`site_cache`/`redis_cache`
