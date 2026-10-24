<!-- Adapted from addyosmani/agent-skills (MIT): references/performance-checklist.md -->
# Frappe Performance Checklist

Measurement targets and verification steps for Frappe backend, frontend, and infrastructure. Use alongside [`frappe-performance-optimization`](../SKILL.md).

## Table of Contents

- [Targets](#targets)
- [Backend Checklist](#backend-checklist)
- [Query Plans and Indexes](#query-plans-and-indexes)
- [Caching Checklist](#caching-checklist)
- [Background Jobs Checklist](#background-jobs-checklist)
- [Frontend / Asset Checklist](#frontend--asset-checklist)
- [Measurement Commands](#measurement-commands)
- [Regression Guard](#regression-guard)
- [Attempt Log Template](#attempt-log-template)

## Targets

| Metric | Target | Measure with |
|---|---|---|
| API endpoint (p95 response time) | < 200 ms | Request Log DocType / `frappe.monitor` |
| List view page load (Desk) | < 1 s | Browser Network tab |
| `frappe.boot` payload size | < 200 KB | `frappe.local.boot` in bench console |
| JS bundle per entry point (gzipped) | < 200 KB | esbuild metafile |
| Background job (short queue) | < 5 min | Scheduled Job Log |
| Background job (long queue) | < 60 min | RQ dashboard / `bench doctor` |

## Backend Checklist

### Query count

- [ ] No `frappe.get_doc` or `frappe.db.get_value` inside a loop over list results
- [ ] All needed fields fetched in one `frappe.get_all(fields=[...])` call
- [ ] `assertQueryCount(N)` test exists for critical paths and is in CI
- [ ] `limit_page_length` set on every `frappe.get_all` / `frappe.get_list` in user-triggered paths

### Pagination

- [ ] Every list API accepts and respects `limit_page_length` and `limit_start`
- [ ] `limit_page_length=None` / `limit_page_length=0` only in controlled background jobs with bounded datasets
- [ ] Reports with large data use `frappe.db.get_all` with pagination or stream via `yield_per`

## Query Plans and Indexes

Before adding or removing an index, capture `EXPLAIN` output:

```bash
bench --site <site> mariadb
> EXPLAIN SELECT name, status FROM `tabSales Order` WHERE status='Draft' AND transaction_date > '2024-01-01' \G
```

| Plan signal | Meaning | Action |
|---|---|---|
| `type: ALL` (full scan) | No usable index | Add index if column is selective |
| `key: NULL` | Index exists but optimizer skipped it | Check column selectivity; may need composite or partial index |
| `rows=` >> actual rows | Stale statistics | Run `ANALYZE TABLE \`tab<DocType>\`;` before adding an index |
| `Extra: Using filesort` | Sort not covered by index | Add sort column as trailing key in a composite index |

- [ ] `EXPLAIN` captured **before** the fix to establish baseline
- [ ] `EXPLAIN` recaptured after adding index — plan has changed (`key:` shows the index)
- [ ] Index column order: equality columns first, then range or sort column
- [ ] `search_index: 1` set on DocType field JSON for new fields; patch adds `frappe.db.add_index` for existing tables
- [ ] Partial index considered for low-selectivity dominant value (e.g., `WHERE status='Failed'`)
- [ ] Write-heavy tables: write cost considered; every index adds latency to `INSERT`/`UPDATE`
- [ ] Unused indexes audited: `SELECT * FROM information_schema.INDEX_STATISTICS WHERE TABLE_SCHEMA = DATABASE();`

## Caching Checklist

- [ ] Decorated function was measured as slow before adding `@frappe.request_cache`
- [ ] Cache key includes every input the result varies on: site, user, locale, date, filters
- [ ] `frappe.cache.set_value(key, value, expires_in_sec=N)` has an explicit TTL; no unbounded cache
- [ ] Nothing cached that must be fresh: permissions, financial balances, inventory levels at point of transaction
- [ ] `frappe.cache.get_value(key)` returns `None` on miss; code handles miss without crashing
- [ ] Invalidation strategy chosen and documented: TTL, document event hook (`on_update`), or versioned key

## Background Jobs Checklist

- [ ] Queue selected by expected duration: `short` (< 5 min), `default` (< 30 min), `long` (< hours)
- [ ] `enqueue_after_commit=True` when the job reads data the triggering transaction just wrote
- [ ] `job_id` set for deduplication of recurring jobs
- [ ] `timeout` set on `frappe.enqueue` for long jobs to prevent zombie workers
- [ ] Failed jobs visible in RQ dashboard or via `bench --site <site> doctor`
- [ ] Scheduled jobs use `frappe.utils.background_jobs.enqueue_doc` for DocType-scoped work

```python
frappe.enqueue(
    "myapp.tasks.generate_report",
    queue="long",
    timeout=3600,
    job_id=f"generate-report-{year}-{month}",
    enqueue_after_commit=True,
    year=year, month=month,
)
```

## Frontend / Asset Checklist

- [ ] esbuild metafile generated and reviewed when bundle size grows: `bench build --app <app> --save-metafiles`
- [ ] Large or rarely-used JS dependencies lazy-loaded where frappe-ui / Vue 3 supports dynamic import
- [ ] `frappe.boot` additions minimal: serialized on every Desk page load for every user
- [ ] Custom `boot_session` hook contribution measured: `sys.getsizeof(json.dumps(frappe.local.boot))` in bench console
- [ ] Static assets served with long `Cache-Control` max-age (handled by Nginx config from `bench setup nginx`)

## Measurement Commands

```bash
# Interactive MariaDB for EXPLAIN / slow query analysis
bench --site <site> mariadb

# Enable slow query log (add to MariaDB config, then restart)
# [mysqld]
# slow_query_log = 1
# slow_query_log_file = /var/log/mysql/mysql-slow.log
# long_query_time = 1

# View slow query log
sudo tail -n 50 /var/log/mysql/mysql-slow.log

# Check worker queues and health
bench --site <site> doctor

# RQ job count by queue (bench console)
from rq import Queue
from redis import Redis
r = Redis.from_url(frappe.conf.redis_queue)
for q in ["short", "default", "long"]:
    print(q, Queue(q, connection=r).count)

# Run a perf test module
bench --site <site> run-tests --module myapp.tests.test_perf

# Check boot payload size (bench console)
import json, sys
frappe.init(site="<site>")
frappe.connect()
frappe.local.lang = "en"
from frappe.boot import get_bootinfo
boot = get_bootinfo()
print(f"boot size: {sys.getsizeof(json.dumps(boot.__dict__)) / 1024:.1f} KB")
```

## Regression Guard

Add an `assertQueryCount` test for every path that was just optimized:

```python
from frappe.tests import IntegrationTestCase

class TestMyDocPerf(IntegrationTestCase):
    def test_list_query_count(self):
        # baseline measured at the time of optimization
        with self.assertQueryCount(2):
            frappe.get_all("My DocType", fields=["name", "status"], limit_page_length=20)
```

`assertQueryCount` and `assertRowsRead` are available on all Frappe test base classes (`frappe.tests.classes`). Wire the test module in CI so regressions break the build before merge.

## Attempt Log Template

Record every attempt in the PR description so a discarded idea doesn't get re-tried:

| Idea | Baseline → Result | Verdict | Why |
|---|---|---|---|
| Add composite index on (status, date) | 45 queries → 3 queries | Kept | Plan changed from ALL to ref; 93% reduction |
| Cache `get_exchange_rate` result | 12 ms → 11 ms | Reverted | Within noise (±2 ms); already fast |
| Move report aggregation to background | 8 s timeout → queued | Kept | User experience improved; long-queue job completes in 40 s |

## Sources

- `apps/frappe/frappe/tests/classes/integration_test_case.py` — `assertQueryCount`, `assertRowsRead`, `assertRedisCallCounts`
- `apps/frappe/frappe/tests/test_perf.py` — usage examples of `assertQueryCount` in context managers
- `apps/frappe/frappe/database/mariadb/database.py` — `add_index(doctype, fields, index_name)` implementation
- `apps/frappe/frappe/database/database.py` — `add_index` base class method
- `apps/frappe/frappe/utils/caching.py` — `request_cache` decorator (line 26), per-request memoization via `frappe.local`
- `apps/frappe/frappe/utils/background_jobs.py` — `enqueue(queue, timeout, job_id, enqueue_after_commit)`, queue names `short/default/long`
- `apps/frappe/frappe/commands/utils.py` — `bench build --save-metafiles` flag, esbuild integration
- `apps/frappe/frappe/boot.py` — `get_bootinfo()`, `boot_session` hook
- `apps/frappe/frappe/commands/scheduler.py` — `bench --site <site> doctor` command
- `apps/frappe/frappe/utils/doctor.py` — `doctor(site)` implementation
