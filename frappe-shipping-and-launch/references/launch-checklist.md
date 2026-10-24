# Launch Checklist

Pre-launch and post-deploy checklist for Frappe site deployments.
Work through every section in order. Do not mark a gate passed until the
command or check has been run and the output confirms it.

---

## 1. Code Readiness

- [ ] CI is green (lint, semgrep, tests, asset build) on the release **tag**, not just the branch tip
- [ ] `CHANGELOG.md` updated with human-readable entries for all changes in this release
- [ ] No `TODO`, `FIXME`, or `frappe.log_error("debug ...")` statements in committed code
- [ ] All new `@frappe.whitelist()` APIs have docstrings
- [ ] ADR written for any significant architectural decision introduced in this release
- [ ] `__version__` in `<app>/<app>/__init__.py` matches the release tag
- [ ] **Frappe Cloud apps only:** `pyproject.toml` declares `[tool.bench.frappe-dependencies]` with
  `frappe = ">=16.0.0-dev,<17.0.0"` (upper bound `<17.0.0`; `<=X.0.0-dev` form is rejected by Cloud deploy)

## 2. Backup Verification

- [ ] Fresh backup taken from the live site immediately before the deploy window opens:
  ```bash
  bench --site <site> backup --with-files
  ```
- [ ] Backup restore tested on an isolated staging bench:
  ```bash
  bench --site staging_site restore /path/to/<site>-<date>.sql.gz
  bench --site staging_site migrate
  ```
- [ ] No errors in the staging Error Log after restore + migrate

## 3. Patch Review

For every new `patches.txt` entry since the last release:
- [ ] Module path resolves to an existing `execute()` function
- [ ] `execute()` has an idempotency guard (early return or skip condition)
- [ ] Large-table patches batch with `frappe.db.commit()` per batch
- [ ] Drop/rename patches are in `[pre_model_sync]` and tested on the staging restore
- [ ] Patch dry-run result on staging backup reviewed — no errors, row counts plausible

## 4. Maintenance Mode Test (do this before the deploy window)

- [ ] Confirm the command works on the target site:
  ```bash
  bench --site <site> set-maintenance-mode on
  # Verify: curl -s -o /dev/null -w "%{http_code}" https://<site>/ → 503
  bench --site <site> set-maintenance-mode off
  ```
- [ ] 503 page content is acceptable to users (Frappe default: "Under Maintenance")

## 5. Deploy Steps

Execute in this order per site:

```bash
# 1. Enable maintenance mode
bench --site <site> set-maintenance-mode on

# 2. Pull and install updated code
cd <bench>/apps/<app> && git fetch --tags && git checkout v<release-tag>
cd <bench> && pip install -e apps/<app>

# 3. Run migrations
bench --site <site> migrate

# 4. Build assets
bench build --app <app>

# 5. Restart workers
bench restart   # or: supervisorctl restart frappe:*

# 6. Disable maintenance mode
bench --site <site> set-maintenance-mode off
```

`bench update --pull --reset` covers steps 2-5 when all sites in the bench
run the same version. Use per-site commands for staged rollouts.

## 6. Staged Rollout Gates

| Wave | Sites | Monitor window | Advance condition |
|------|-------|----------------|-------------------|
| 1 | Lowest-traffic site | 24 h | Zero new error types in Error Log |
| 2 | Next N sites | 24 h | Same |
| 3 | Remaining sites | 24 h | Same |

Stop and roll back the current wave before advancing if any gate fails.

## 7. Post-Deploy Smoke (within 30 min of each site re-opening)

- [ ] Login page loads (HTTP 200): `curl -s -o /dev/null -w "%{http_code}" https://<site>/`
- [ ] Key DocType list view loads without JavaScript errors
- [ ] Create and save a test document for each changed DocType
- [ ] **Error Log** (Frappe Desk → Tools → Error Log): no new error types
- [ ] **Scheduled Job Log** (Frappe Desk → Tools → Scheduled Job Log): no failed jobs
- [ ] **RQ Monitor** (`https://<site>/rq`): queue depths normal, no failed jobs
- [ ] Patch confirmed applied:
  ```python
  # bench --site <site> console
  frappe.db.exists("__PatchLog", {"patch": "<app>.patches.v16_0.my_patch"})
  # → "v16_0.my_patch" (truthy)
  ```

## 8. Monitoring and Alerting

- [ ] Frappe Error Log alert configured (see [`frappe-observability`](../../frappe-observability/SKILL.md))
- [ ] Background job failure alert in place
- [ ] Response-time baseline established before deploy; compare after
- [ ] Sentry DSN set in `site_config.json` if error tracking is configured:
  `bench --site <site> set-config sentry_dsn "<dsn>"`

## 9. Rollback Readiness

Confirm before the deploy window:
- [ ] Rollback path documented: restore backup + checkout previous tag + `bench migrate`
- [ ] Previous release tag exists and is reachable: `git tag -l "v*" | tail -5`
- [ ] Time-to-rollback estimated per site (restore time depends on DB size)
- [ ] Non-reversible operations documented:
  - Data written between backup timestamp and rollback moment is **not** recovered
  - Emails sent, webhook callbacks received, payment gateway events are **not** reversible
  - Columns dropped without expand/contract are **not** recoverable from code revert alone

## 10. Communication

- [ ] Maintenance window communicated to users (if site is user-facing)
- [ ] Team notified of deploy start and end
- [ ] On-call contact confirmed for the 24-hour monitoring window

---

## Sources

- `apps/frappe/frappe/commands/scheduler.py` lines 111-124 — `set-maintenance-mode on|off` command; writes `maintenance_mode` to `site_config.json`
- `apps/frappe/frappe/patches.txt` lines 1 and 200 — `[pre_model_sync]` and `[post_model_sync]` section markers
- `apps/frappe/frappe/commands/utils.py` — `backup --with-files` and `restore` command signatures
- `apps/frappe/.github/workflows/_base-server-tests.yml` — Frappe CI reference for green-gate definition
