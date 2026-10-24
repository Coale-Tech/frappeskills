---
name: frappe-performance-optimization
description: "Optimizes Frappe app performance by measuring first. Covers query-count and N+1 detection (frappe.get_all in loops, get_value vs get_doc), assertQueryCount regression tests, MariaDB indexes (search_index, frappe.db.add_index), EXPLAIN via bench mariadb, slow query log, frappe.cache and @frappe.request_cache, background jobs (frappe.enqueue queues short/default/long), report tuning, gunicorn/worker sizing, asset bundle size via esbuild metafile, Desk boot payload, and limit_page_length. Use when a list view or report is slow to load with many records, profiling reveals a bottleneck, or a change introduces query-count regression. Not for premature optimization."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/performance-optimization/SKILL.md -->

# Frappe Performance Optimization

Measure → Identify → Fix → Verify → Guard. In that order, every time.

## When to use

- Profiling shows a slow endpoint, list view, or report
- A review reveals N+1 patterns or missing pagination
- Adding a query-count regression test for a critical path
- Tuning worker counts, queue routing, or cache strategy before a go-live
- Bundle size has grown significantly after a JS dependency change

Not before you have evidence of a problem. Premature optimization adds complexity that costs more than the performance it gains.

## Inputs required

- The slow feature and its measured baseline (query count, wall time, or bundle size)
- Site name and app name for bench commands
- Whether the bottleneck is backend (queries, jobs) or frontend (assets, boot payload)

## Procedure

No bench to run against (static review)? Skip the baseline, tag every finding `potential impact`, and name the exact measurement that would confirm it.

### 0) Establish a baseline before changing anything

```bash
# Count queries for a Frappe controller method in a test
# uses assertQueryCount from frappe.tests.classes.IntegrationTestCase
with self.assertQueryCount(N):
    doc = frappe.get_doc("Sales Order", name)

# Check slow query log (requires slow_query_log enabled in MariaDB config)
bench --site <site> mariadb --execute "SHOW VARIABLES LIKE 'slow_query_log%';"

# EXPLAIN a query interactively
bench --site <site> mariadb
> EXPLAIN SELECT * FROM `tabSales Order` WHERE status='Draft' \G
```

Record the number before touching any code. A fix is a hypothesis until re-measured against the same baseline.

### 1) Identify the bottleneck

**N+1 queries — the most common Frappe backend bottleneck:**

```python
# WRONG: one frappe.get_doc call per row = N+1
for order in frappe.get_all("Sales Order", fields=["name"]):
    doc = frappe.get_doc("Sales Order", order.name)   # N queries

# CORRECT: fetch needed fields in a single get_all call
orders = frappe.get_all("Sales Order", fields=["name", "customer", "grand_total"])
```

**`frappe.db.get_value` vs `frappe.get_doc`:** use `get_value` when you need one or two fields; `get_doc` loads all fields and child tables — cache-busting overhead for 20 fields when you need 1.

**Unbounded queries — always paginate:**

```python
# CORRECT: always supply limit_page_length
rows = frappe.get_all("GL Entry", filters=filters, fields=fields, limit_page_length=500)
```

`limit_page_length=None` or `limit_page_length=0` fetches all rows — safe only for controlled background jobs with known small datasets.

### 2) Add indexes for filtered/sorted columns

**In DocType JSON** (preferred for new fields): set `"search_index": 1` on the field definition.

**Via patch for existing tables:**

```python
# patches/fix_sales_order_index.py
import frappe

def execute():
    frappe.db.add_index("Sales Order", ["status", "transaction_date"])
```

After adding, re-run `EXPLAIN` and confirm the plan uses the new index. If the plan is unchanged, revert the index — every index taxes every `INSERT`/`UPDATE`.

### 3) Use caching correctly

`@frappe.request_cache` memoizes the decorated function for the duration of one request (stored in `frappe.local`). Use it for repeated, pure lookups within a request:

```python
from frappe.utils.caching import request_cache

@request_cache
def get_exchange_rate(from_currency, to_currency, date):
    ...
```

`frappe.cache` is the Redis-backed wrapper (e.g., `frappe.cache.get_value(key)`, `frappe.cache.set_value(key, value, expires_in_sec=300)`). Cache what is expensive to recompute and read far more often than it changes. Every input that changes the response belongs in the cache key (site, user, locale, date).

### 4) Route work to background jobs

```python
frappe.enqueue(
    "myapp.tasks.send_digest",
    queue="long",        # short (<5 min), default (<30 min), long (up to hours)
    job_id="digest-daily",
    enqueue_after_commit=True,
)
```

Never block a web request with heavy computation. `enqueue_after_commit=True` prevents the job from starting before the triggering transaction commits. Jobs in `scheduler_events` are dispatched by the scheduler, not `frappe.enqueue`: there is no `job_id`/`timeout` to set there, so check batch size and commit behaviour inside the function instead.

### 5) Measure asset bundle size

```bash
# Build with esbuild metafile for analysis
bench build --app <app> --save-metafiles

# Inspect the generated metafile (written to assets/<app>/js/<bundle>.meta.json)
# Use https://bundle-buddy.com or esbuild's bundle analyzer to identify large deps
```

Desk boot payload: the `frappe.boot` object is serialized to every page load. Keep custom boot data minimal; add to it only via the `boot_session` hook and only what the client needs on every page.

### 6) Verify — keep or revert

Re-measure the same way as the baseline (same command, same data, same cache state). If the improvement is within run-to-run noise, revert. Neutral changes are a revert, not a keep.

```bash
# Re-run the assertQueryCount test after the fix
bench --site <site> run-tests --module myapp.tests.test_sales_order_perf
```

Log the attempt in the PR description: `Idea | Before | After | Verdict | Why`.

### 7) Guard against regression

Add an `assertQueryCount` test for critical paths so a future change can't silently reintroduce the N+1:

```python
from frappe.tests import IntegrationTestCase

class TestSalesOrderPerf(IntegrationTestCase):
    def test_load_order_query_count(self):
        name = frappe.db.get_value("Sales Order", {"status": "Draft"}, "name")
        with self.assertQueryCount(3):          # baseline measured above
            frappe.get_doc("Sales Order", name)
```

`assertQueryCount` is available on `IntegrationTestCase` (and `UnitTestCase`) from `frappe.tests.classes`.

## Verification

Walk [`references/performance-checklist.md`](references/performance-checklist.md) before merging.

- [ ] Baseline query count or response time measured before the change
- [ ] N+1 patterns eliminated in any new list-loading code
- [ ] All `frappe.get_all` calls have an explicit `limit_page_length`
- [ ] Any new index justified by `EXPLAIN` output before and after; plan changed
- [ ] Cache key includes every input the cached result varies on
- [ ] Background jobs use the appropriate queue (`short`/`default`/`long`)
- [ ] `assertQueryCount` test added for the optimized critical path
- [ ] Bundle size not regressed (esbuild metafile checked if JS changed)
- [ ] Re-measurement confirms improvement exceeds run-to-run variance

## Failure modes / debugging

- **`assertQueryCount` fails in CI but not locally**: cached values warm locally; wrap with `frappe.clear_cache()` or use `frappe.tests.classes.context_managers` to isolate
- **EXPLAIN shows index not used**: column has low selectivity or an implicit type cast; inspect `key` column in the plan output
- **`enqueue` job never runs**: worker not started for the queue; run `bench worker --queue <queue>` or check `bench doctor` output
- **Boot payload too large**: inspect `frappe.local.boot` in `bench --site <site> console`; reduce `boot_session` hook contributions

## Escalation

- Query plan questions or slow-log analysis → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)
- Whole-app quality sweep including performance patterns → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Background job architecture → [`frappe-app-development`](../frappe-app-development/SKILL.md)

## References

- [references/performance-checklist.md](references/performance-checklist.md) - Measurement targets, MariaDB index strategy, cache checklist, and bench commands

## Guardrails

- **Always** establish a numeric baseline before optimizing; log every attempt (kept and reverted)
- **Never** add an index without reading the query plan before and after; never keep a change that didn't beat the baseline
- **Never** use `limit_page_length=None` in a user-triggered path; paginate every list query

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize after launch" | Performance debt compounds. N+1 patterns that cost 50 ms with 100 rows cost 5 s with 10 000. |
| "It's fast on my machine" | Developer machines have warm caches, small datasets, and local DB. Measure on realistic data. |
| "Add an index, it can only help" | Every index taxes every write. Read the `EXPLAIN` plan before and after; revert if the plan doesn't change. |
| "Just cache the query" | Caching an already-fast query adds a Redis round-trip and a staleness bug. Cache only what's expensive to recompute. |
| "The improvement is obvious, no need to measure" | Then re-measuring is cheap and proves it. Unmeasured wins are how neutral complexity lands. |
| "It didn't help much but it doesn't hurt" | Neutral changes are a revert. You maintain them forever and got nothing in return. |
| "`frappe.get_doc` in a loop is fine for small lists" | "Small" is today. In six months it's `assertQueryCount` red in CI and a 2 s page load. |

## Red Flags

- `frappe.get_doc` or `frappe.db.get_value` inside a `for` loop over a list result
- `frappe.get_all` with no `limit_page_length` in a user-triggered path
- A new index added without showing `EXPLAIN` output before and after in the PR
- `@frappe.request_cache` on a function whose result varies by user but the cache key omits the user
- `frappe.enqueue` with `queue="long"` for a job expected to complete in seconds (wastes long-queue workers)
- `frappe.boot` additions that serialize large datasets on every Desk page load
- No `assertQueryCount` test for a path that was just optimized

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Fetching full `frappe.get_doc` for one field | Loads all fields + child tables unnecessarily | Use `frappe.db.get_value(doctype, name, fieldname)` |
| `limit_page_length=0` in a list API | Returns all rows; causes timeout on large tables | Set an explicit page size and handle pagination |
| Cache key without site or user | Returns one user's data to another user | Include `frappe.local.site`, `frappe.session.user`, and any filter values in the key |
| Adding `search_index` without a patch | Index not created on existing tables | Add `frappe.db.add_index` call in a patch alongside the field change |
| Using `queue="short"` for multi-minute jobs | Job killed by queue timeout | Use `queue="long"` and set an appropriate `timeout` in `frappe.enqueue` |
