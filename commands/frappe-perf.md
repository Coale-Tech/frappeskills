---
description: Measure-first performance audit for Frappe apps — query count, N+1, indexes, cache, background jobs, Desk/portal load
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/webperf.md -->

Load the `frappe-performance-optimization` skill (omp: `read skill://frappe-performance-optimization`) and follow `frappe-performance-optimization/references/performance-checklist.md` as the minimum baseline.

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

## Quick mode (no live bench artifacts provided)

Scan the target code for structural anti-patterns. Label every finding as `potential impact`, never as a measurement.

Checks: `get_all`/`get_list` in loops (N+1); missing `fields=` argument (SELECT *); no index on common filter fields; synchronous operations that should use `frappe.enqueue`; unbounded report queries with no `limit`; Desk/portal JS bundle size (estimate from imports).

## Deep mode (live bench available)

1. Count queries before and after the operation: enable query debug in `bench console` with `frappe.db.sql("SET SESSION general_log=1")`; or use `frappe.db.get_query_count()` around the call
2. Run `EXPLAIN <query>` for slow queries via `bench --site <site> mariadb`
3. Check RQ workers: `bench --site <site> show-pending-jobs`; identify tasks that should be backgrounded
4. Review `frappe-performance-optimization/references/performance-checklist.md` for each area

**Output format:** scorecard of areas checked (query count, indexes, cache usage, background jobs, asset size), findings ranked Critical/High/Medium/Low with `file:line`, positive observations.

**Verification gate:** every Critical and High finding has a concrete fix recommendation citing the specific file and the query or cache call to change. Never fabricate query times; label static-analysis findings as `potential impact`.
