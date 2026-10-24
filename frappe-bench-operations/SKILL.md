---
name: frappe-bench-operations
description: "Operate a Frappe bench and its sites including install, migrate, backup, build, scheduler and worker management, and recovery from stuck migrations or stale locks. Use for bench CLI work or when a bench is broken."
---

# Frappe Bench Operations

Run and repair a bench: sites, migrations, workers, assets, backups.

## When to use

- Installing apps, creating or dropping sites
- Running migrations, builds, backups, restores
- Managing the scheduler, queues and workers
- Diagnosing a hung `migrate`, stale locks, or dead workers

## Inputs required

- Bench root path and the target site name
- Whether the bench serves live users (changes the blast radius)
- What changed since the last working state

## Procedure

### 0) Confirm bench and site

```bash
ls apps/ sites/
grep default_site sites/common_site_config.json   # set by `bench use`; currentsite.txt is ignored
bench --site <site> list-apps
```

### 1) Routine operations

```bash
bench --site <site> migrate
bench --site <site> clear-cache
bench build --app <app>
bench --site <site> backup --with-files
bench --site <site> console
```

Every command takes `--site` explicitly. Full surface:
[references/bench.md](references/bench.md).

`bench --site <site> migrate` (16.51+) automatically syncs missing `Module Def` rows for all
installed apps before running patches — apps no longer need a one-off `add_module_defs` patch.

Migrating from old workspace sidebar format: `bench --site <site> convert-sidebar-fixtures --app <app>`
converts `workspace_sidebar/*.json` fixtures to per-module `<module>/sidebar/` (dry-run with `--dry-run`).

### 2) Run the dev server under supervision

Start `bench start` as a managed background process, and check whether one is
already running before starting another — two servers on one port fail
confusingly.

### 3) Diagnose a stuck bench

```bash
bench --site <site> doctor          # scheduler + queue health
bench --site <site> show-pending-jobs
ps aux | grep -E "bench|rq|gunicorn"
```

Stale RQ workers holding old code, and stale document locks, are the two usual
causes of a hanging `migrate` or `DocumentLockedError` —
[references/bench-troubleshooting.md](references/bench-troubleshooting.md).

### 4) Clear the blockage

Kill only the stale workers (never a live web server someone is using), clear
the stale lock, then re-run the migration. Verify afterwards that the scheduler
and queues are alive again.

### 5) Recover a failed migration

Restore the pre-migration backup, fix the offending patch or DocType, and
re-run. Never leave a half-migrated site serving users.

## Verification

- [ ] `bench --site <site> migrate` completes without errors
- [ ] `bench --site <site> doctor` reports scheduler and queues healthy
- [ ] Workers are running with current code (restarted after a deploy)
- [ ] Site loads and a document saves successfully
- [ ] Backup exists and is recent before any destructive operation

## Failure modes / debugging

- **`migrate` hangs**: stale RQ worker holding a lock, or a patch waiting on input
- **`DocumentLockedError`**: stale lock from a killed process; after 30 min Desk offers Force Unlock, after 3 h it expires — see [references/bench-troubleshooting.md](references/bench-troubleshooting.md)
- **`ModuleNotFoundError` inside a job**: worker running pre-deploy code — restart workers
- **Assets not updating**: `bench build --app <app>` missing, or browser cache
- **Scheduler not firing**: disabled on the site, or the scheduler process is dead
- **Port already in use**: a `bench start` is already running
- **Site down after migrate**: restore the backup, fix, re-run

## Escalation

- Docker environment instead of a bench → [`frappe-manager`](../frappe-manager/SKILL.md)
- Job/queue design problems → [`frappe-app-development`](../frappe-app-development/SKILL.md)
- Version/compat questions → [`frappe-project-triage`](../frappe-project-triage/SKILL.md)
- Error tracing in bench logs and Error Log → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)
- Scheduler and worker health monitoring → [`frappe-observability`](../frappe-observability/SKILL.md)

## References

- [references/bench.md](references/bench.md) - Bench CLI and site management
- [references/bench-troubleshooting.md](references/bench-troubleshooting.md) - Stale workers, stuck locks, recovery

## Guardrails

- **Always `--site <site>`**: bare `bench migrate` hits the wrong site
- **Back up before destructive operations**: `--with-files` when files matter
- **Never kill a live web server** to clear workers — target the stale processes only
- **Restart workers after deploying code**: they hold the old module tree
- **Use bare `bench`**, not `./env/bin/bench` or a full path
- **Run `bench start` under a supervisor**, one per bench
- **Optional hook**: `scripts/bench-guard.sh` (Claude Code) or its omp adapter blocks `drop-site`, `reinstall` and core-app edits; see `docs/bench-guard.md`


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Bare `bench migrate` is fine, there is only one site" | `common_site_config.json` `default_site` may be absent or stale; `--site` is the only safe form. |
| "I'll back up after the migration to capture the new schema" | A failed migration has already mutated the database; a post-migration backup cannot restore the pre-migration state. |
| "I'll kill all bench processes at once — it's faster" | `bench start` includes the web server; killing it drops live user requests immediately. |
| "The scheduler restarts itself if it dies" | The scheduler process does not self-resurrect; it requires an explicit restart or a supervisor. |
| "Workers pick up new code automatically after a deploy" | Workers hold the module tree loaded at startup; only a restart loads the new code. |
| "Forgetting `clear-cache` after migrate is fine — data updates eventually" | Stale schema in Redis causes `KeyError`/`TypeError` on the very next user request. |

## Red Flags

- `bench migrate` run without `--site <site>`
- Destructive operation (migrate, restore, drop-site) with no prior `bench --site <site> backup`
- Two `bench start` processes running on the same bench
- Workers not restarted after a code deploy
- `bench --site <site> doctor` not run after a stuck-process incident
- Half-migrated site left serving live users while the patch error is investigated

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Bare `bench migrate` | Wrong or default site | Always `--site` |
| Killing all bench processes | Takes down a live server | Kill only stale workers |
| Migrating without a backup | No recovery path | Back up first |
| Forgetting `clear-cache` | Stale schema in the app | Clear after migrate |
| Two `bench start` instances | Port conflict, confusing errors | Check first |
| Deploying without restarting workers | Jobs run old code | Restart workers |
| Assuming `uninstall-app` deletes custom modules | Custom modules (Module Def rows the user placed under the app's namespace) are released, not deleted (16.51+) | Run `bench --site <site> list-apps` after uninstall; clean up custom modules manually if needed |
