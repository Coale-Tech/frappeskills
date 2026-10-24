---
name: frappe-shipping-and-launch
description: "Prepares and executes production launches for Frappe apps. Use when deploying to production for the first time, releasing a significant change, performing a staged rollout across sites, or defining a rollback procedure. Covers maintenance mode, backup verification, patch review, post-deploy smoke checks, and monitoring setup. Operational bench commands → frappe-bench-operations. Monitoring configuration details → frappe-observability."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/shipping-and-launch/SKILL.md -->

# Frappe Shipping and Launch

Deploy with confidence: backup verified, patches reviewed, maintenance window planned, rollback tested.

## When to use

- Deploying a new app or a significant release to one or more production sites
- Coordinating a staged rollout across multiple sites in a bench
- Setting maintenance mode before a migration
- Validating a rollback path before touching production
- Post-deploy smoke verification

Not for: routine bench commands → `frappe-bench-operations`. Observability config → `frappe-observability`.

## Inputs required

- A restore-tested backup of every production site being upgraded
- Git tag of the release being deployed
- List of `patches.txt` entries added since the last release
- Site names in the bench (`bench --site <site> ...`)

## Procedure

### 0) Pre-launch checklist

Work through `references/launch-checklist.md` in full before touching production.
Key gates that are non-negotiable:

1. **Backup taken AND restore tested** on an isolated bench.
2. **Patches reviewed**: every new `patches.txt` entry is idempotent and has been dry-run on the restored backup.
3. **CI is green**: lint, semgrep, tests, asset build all pass on the release tag.
4. **Maintenance mode tested**: confirm `set-maintenance-mode on` works before you need it under pressure.
5. **Scope check**: confirm the release matches its stated intent — no unrelated fixture exports, unrequested `patches.txt` additions, or hooks changes have crept in. Flag any `DRIFT DETECTED` to the team before opening the maintenance window.

### 1) Take and verify the backup

```bash
# Take a compressed backup including files
bench --site <site> backup --with-files

# Verify restore on an isolated site (staging bench)
bench --site staging_site restore /path/to/<site>-<date>.sql.gz
bench --site staging_site migrate
```

A backup that has never been restored is not a backup. The restore test also serves as the patch dry-run.

### 2) Enable maintenance mode

Maintenance mode returns an HTTP 503 to all web requests, preventing new writes during migration:

```bash
bench --site <site> set-maintenance-mode on
```

Verified command: `frappe/frappe/commands/scheduler.py`, `set-maintenance-mode` Click command with `on|off` argument. It writes `maintenance_mode: 1` to `site_config.json`.

Leave maintenance mode on for the minimum time needed. Re-enable normal operation immediately after smoke checks pass:
```bash
bench --site <site> set-maintenance-mode off
```

### 3) Deploy

**bench-managed bench:**
```bash
cd <bench>
bench update --pull --reset   # pulls latest code, runs pip install, migrate, builds assets
```

**Per-site control** (if sites run different app versions):
```bash
bench --site <site> migrate
bench build --app <app>
```

`bench update` is documented in `frappe-bench-operations`. Link there for flags (`--no-backup`, `--skip-failing-patches`). Do not use `--no-backup` unless you have already taken a separate backup in step 1.

### 4) Staged rollout across sites

Frappe benches often host multiple sites. Roll out in waves:
```
Wave 1: one low-traffic site → monitor 24 h → advance if clean
Wave 2: next N sites         → monitor 24 h → advance if clean
Wave 3: remaining sites
```

Use `--site` to target individual sites:
```bash
bench --site staging.<domain>.com migrate
bench --site <site> set-maintenance-mode off
```

If wave 1 shows errors in the Error Log, stop and roll back before touching other sites.

### 5) Post-deploy smoke checklist

Within 30 minutes of re-enabling each site:

- [ ] Home page and login load (HTTP 200)
- [ ] Key DocType list view loads without errors
- [ ] Create and save a test document of the changed DocType
- [ ] Check **Error Log** in Frappe Desk: no new error types since deploy
- [ ] Check **Scheduled Job Log**: background jobs running normally
- [ ] Check **RQ Monitor** (`/rq`): no failed jobs accumulating
- [ ] Verify patches ran: `bench --site <site> console` → `frappe.get_all("Patch Log", filters={"patch_name": ("like", "%new_patch%")})`

For observability dashboards, alert thresholds, and Sentry integration, see [`frappe-observability`](../frappe-observability/SKILL.md).

### 5a) Detailed post-deploy verification

Before advancing to the next wave, run the diagnostic commands in [`references/post-deploy-verification.md`](references/post-deploy-verification.md): Error Log diff since deploy time, Patch Log completeness check, background queue depth, scheduler and worker health (`bench doctor --site <site>`), and email queue status. The reference marks each step as 🔍 READ-ONLY (safe on production) or ⚠️ MUTATES (staging only).

### 6) Rollback procedure

**What is reversible:**
- Code: `git checkout <previous-tag>` in each app dir, then `bench --site <site> migrate` restores the old schema if the patch has a down path.
- Application state: restoring the backup returns the site to its pre-deploy state.

**What is NOT reversible:**
- A patch that dropped a column without an expand/contract strategy — the data is gone.
- Emails sent, payment gateway callbacks received, or external API calls made after deploy.
- Data inserted between the backup timestamp and the rollback moment.

**Rollback steps (code revert):**
```bash
# 1. Enable maintenance mode
bench --site <site> set-maintenance-mode on

# 2. Restore the backup (safest path)
bench --site <site> restore /path/to/pre-deploy-backup.sql.gz
bench --site <site> migrate   # re-applies patches up to the backup point

# 3. Checkout the previous git tag in the app
cd <bench>/apps/<app>
git checkout v<previous-tag>
pip install -e .

# 4. Rebuild assets for the old version
cd <bench>
bench build --app <app>

# 5. Disable maintenance mode
bench --site <site> set-maintenance-mode off
```

For benches with multiple sites, reverse the rollout order (wave 3 → wave 1).

## Verification

- [ ] Backup taken and restore-tested before any production change
- [ ] Maintenance mode confirmed working (`bench --site <site> set-maintenance-mode on`)
- [ ] All new `patches.txt` entries dry-run on the restored backup
- [ ] CI is green (lint, semgrep, tests, build) on the release tag
- [ ] Post-deploy smoke checklist completed within 30 minutes
- [ ] Error Log checked: no new error types introduced
- [ ] Rollback path documented and tested in staging

## Failure modes / debugging

- **`bench update` fails mid-migration**: site is in a partial state; restore from backup; do not retry `bench update` on a partially migrated site without inspecting the Error Log first.
- **Maintenance mode not clearing after deploy**: `bench --site <site> set-maintenance-mode off` was skipped; run it manually.
- **Patch ran on some sites but not others in a staged rollout**: check `bench --site <site> console` → `frappe.db.exists("__PatchLog", {"patch": "dotted.path"})` per site.
- **Assets serve stale JS after deploy**: `bench build --app <app>` may not have run; also clear browser cache and Nginx `proxy_cache`.
- **RQ jobs not starting after rollback**: worker processes need restart; `bench restart` or `supervisorctl restart frappe:*`.

## Escalation

- Bench operations (update, migrate, restart) → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- Patch authoring and idempotency → [`frappe-deprecation-and-migration`](../frappe-deprecation-and-migration/SKILL.md)
- Monitoring, alerting, Sentry → [`frappe-observability`](../frappe-observability/SKILL.md)
- CI/CD pipeline → [`frappe-ci-cd-automation`](../frappe-ci-cd-automation/SKILL.md)

## References

- [`references/launch-checklist.md`](references/launch-checklist.md) — Full pre-launch and post-deploy checklist for Frappe sites
- [`references/post-deploy-verification.md`](references/post-deploy-verification.md) — Diagnostic commands and frappe.qb queries for post-deploy verification; read-only production steps and staging smoke tests

## Guardrails

- **Never skip the restore test**: a backup with no restore test is not a backup.
- **Maintenance mode before migration on live sites**: prevents write conflicts during schema changes.
- **State clearly what is and is not reversible** in any rollback plan: data created after the backup timestamp cannot be recovered by a restore.
- **No `--no-backup` with `bench update`** unless a separate backup was taken and verified in step 1.
- **Staged rollout**: never update all sites in one operation until wave 1 has been monitored.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's a small change; we don't need maintenance mode." | A small migration can still lock rows. Maintenance mode costs seconds; a write conflict during migration can cost hours. |
| "The backup is from last night; it's close enough." | A restore test on last night's backup doesn't validate today's patch. Take a fresh backup. |
| "The patch ran fine in staging; we don't need a dry-run on the production backup." | Production data volume and content differ. Row counts that run in 2 seconds in staging may take 20 minutes in production. |
| "We'll roll back by reverting the code commit." | Code revert doesn't undo schema changes. Only a restore brings back dropped columns or deleted rows. |
| "Maintenance mode breaks the UX; we'll skip it." | Without maintenance mode, users write to the DB during migration; their data may not survive the schema change. |
| "We'll monitor for a week after full rollout." | Monitor at each wave before advancing. Finding a problem after full rollout means rolling back all sites. |

## Red Flags

- Deploy proceeded without a restore-tested backup
- `bench --site <site> set-maintenance-mode on` never tested before the deploy day
- Patch dry-run skipped on production backup
- Wave-1 error ignored and wave-2 deploy started anyway
- Post-deploy smoke checklist skipped ("everything looks fine")
- Rollback plan says "revert the commit" without addressing schema changes
- Error Log not checked within 30 minutes of each site re-opening

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Restoring the backup after a failed migrate | Partial migrate may have committed some patches; restore is the only clean path | Always restore first, then investigate |
| Updating all sites in one `bench update` call | One failing site blocks all others; no staged feedback | Use `--site` per site in waves |
| Disabling maintenance mode before asset build completes | Users see broken JS | Keep maintenance mode on until `bench build` exits 0 |
| No rollback plan for a patch that drops a column | Irreversible; data lost permanently | Use expand/contract from `frappe-deprecation-and-migration` before shipping |
| Relying on browser console for post-deploy smoke | JS errors may not reflect server-side failures | Check Frappe Error Log, RQ Monitor, and Scheduled Job Log in Desk |
