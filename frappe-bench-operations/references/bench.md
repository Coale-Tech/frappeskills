# Bench CLI & Site Management

Every site-scoped command takes an explicit `--site <site>`. Bare `bench migrate`
is never correct on a multi-site bench.

> **Bench vs Frappe commands (v16):** `bench` proxies most site-scoped commands to
> the Frappe CLI (`apps/frappe/frappe/commands/`). Commands like `new-site`,
> `migrate`, `console`, `execute`, `install-app`, `export-fixtures`, `set-config`,
> `run-tests` are **Frappe commands** and accept `--site <site>` (or use
> `bench use <site>` once to set a default). Commands like `bench init`,
> `bench new-app`, `bench get-app`, `bench update`, `bench start`, `bench restart`,
> `bench setup ...`, and `bench build` are **bench-tool** commands — they operate on
> the whole bench, not one site, and do not take `--site`.

---

## App & site lifecycle

```bash
# New app (MUST pipe input — no heredoc, no --no-input)
printf '<title>\n<desc>\n<publisher>\n<email>\n<license>\nN\nN\nN\n' | bench new-app <app-name>

# Get an app from a repo
bench get-app <app-name> <git-url>
bench get-app <app-name> <git-url> --branch <branch>

# New site (set root_password in common_site_config first: bench set-config -g root_password '<pwd>')
bench new-site <name>.localhost --admin-password admin

# Set default site (lets you drop --site on later commands)
bench use <site>

# Install/uninstall app
bench --site <site> install-app <app-name>
bench --site <site> uninstall-app <app-name>

# List apps on a site / list sites on the bench
bench --site <site> list-apps
bench list-sites

# Migrate (apply schema + data changes)
bench --site <site> migrate

# Drop site (DESTRUCTIVE — ask the user first)
bench drop-site <site> --db-root-password '<pwd>'
```

### Finding existing sites

```bash
ls sites/
```

Ignore these entries: `assets`, `apps.txt`, `common_site_config.json`, `currentsite.txt`.
Everything else is a site directory. `bench list-sites` gives the same list.

### Matching a site to an app

Convention: site name often contains the app name (e.g. `gameplan.localhost` for
app `gameplan`). To confirm which apps are on a site:

```bash
bench --site <site> list-apps
```

If multiple sites exist, check each until you find the one with the target app
installed.

### Creating a new site

First, check if `root_password` is already set in `sites/common_site_config.json`.
If not, recommend the user set it once so future site creation doesn't require the
password each time:

```bash
bench set-config -g root_password '<pwd>'
```

Then create the site:

```bash
# If root_password is in common_site_config.json:
bench new-site <name>.localhost --admin-password admin

# Otherwise, pass it explicitly:
bench new-site <name>.localhost --db-root-password '<pwd>' --admin-password admin
```

Naming convention: `<app-name>.localhost` (e.g. `expense_tracker.localhost`).

### Site config

Per-site config lives in `sites/<site>/site_config.json`. Global config in
`sites/common_site_config.json`. `-g`/`--global` on `set-config` writes to the
latter and does not take `--site`.

---

## Development

```bash
# Start dev server (run under supervision, e.g. hub `start`, not bare background)
bench start

# Developer mode
bench set-config -g developer_mode 1

# Python console with site context
bench --site <site> console

# Execute a dotted method path with site context
bench --site <site> execute frappe.utils.get_url

# Execute with args / kwargs (Python literal or JSON)
bench --site <site> execute my_app.api.rebuild --args "['Customer']"
bench --site <site> execute my_app.api.rebuild --kwargs "{'doctype': 'Customer'}"
bench --site <site> execute my_app.api.heavy --profile

# Run tests
bench --site <site> run-tests --app <app-name>
bench --site <site> run-tests --doctype "DocType Name"
bench --site <site> run-tests --module my_app.tests.test_api
bench --site <site> run-parallel-tests --app <app-name>
bench --site <site> run-ui-tests <app-name> --headless

# Build frontend assets (bench-level, no --site)
bench build --app <app-name>
bench build --production

# Watch mode for frontend (bench-level, no --site)
bench watch
```

### Console usage example

```python
bench --site <site> console
>>> frappe.get_all("DocType", limit=5)
>>> doc = frappe.get_doc("Task", "TASK-001")
>>> doc.status = "Completed"
>>> doc.save()
>>> frappe.db.commit()  # only needed here: console runs outside the request
>>>                      # lifecycle, so nothing else commits the transaction
```

Manual `frappe.db.commit()` is otherwise an anti-pattern inside request handlers,
controller hooks, patches, or install scripts — the framework commits at the end
of the request/job. It is legitimate in `bench --site <site> console`/`bench --site <site> execute` scripts,
long background jobs committing in explicit batches, and code that documents the
anti-pattern for lint rules.

---

## Site maintenance

```bash
# Backup / restore
bench --site <site> backup
bench --site <site> backup --with-files
bench --site <site> restore <path>

# Clear cache
bench --site <site> clear-cache
bench --site <site> clear-website-cache

# Clear a log doctype's table (there is no `bench clear-logs`)
bench --site <site> clear-log-table --doctype "Error Log"
bench --site <site> clear-log-table --doctype "Error Log" --days 30

# Set site config / global config
bench --site <site> set-config <key> <value>
bench set-config -g <key> <value>

# MariaDB console (debugging only)
bench --site <site> mariadb

# Reinstall (DESTRUCTIVE — drops and recreates the site's database)
bench --site <site> reinstall --admin-password admin

# Trim orphan tables/columns not in the current schema
bench --site <site> trim-database --dry-run
```

## Configuration

```bash
# Set a site_config.json value
bench --site <site> set-config maintenance_mode 1

# Evaluate the value as a Python object (numbers, lists, dicts, bools)
bench --site <site> set-config -p max_file_size 10485760

# Set in the bench-level common_site_config.json instead of the site
bench set-config -g background_workers 4

# Show effective config
bench --site <site> show-config
```

## Data import / export

```bash
bench --site <site> data-import --file data.csv --doctype "Customer" --type Insert
bench --site <site> export-json "Customer" customers.json     # export docs to JSON
bench --site <site> export-csv "Customer" customers.csv
bench --site <site> export-doc "Item" "ITEM-001"               # export a single doc
bench --site <site> import-doc /path/to/fixture.json           # import doc/fixture JSON
bench --site <site> bulk-rename "Customer" rename-map.csv
```

## Fixtures

```bash
# Export fixtures defined in hooks.py
bench --site <site> export-fixtures --app <app-name>
```

## Schema reload (without a full migrate)

```bash
bench --site <site> reload-doc <module> <doctype-type> <name>   # e.g. reload-doc core doctype user
bench --site <site> reload-doctype "Sales Invoice"
```

---

## What `migrate` actually does (v16)

`SiteMigration.run` in `frappe/migrate.py`, per site:

1. **setUp** — clear cache, lower the DB lock timeout, set `frappe.flags.in_migrate`.
2. **pre_schema_updates** — run every app's `before_migrate` hooks.
3. **run_schema_updates** — `[pre_model_sync]` patches → `frappe.model.sync.sync_all()`
   (DocType JSON → DB tables/columns) → `[post_model_sync]` patches.
4. **post_schema_updates** (atomic) — sync scheduled jobs, recreate missing sequences,
   sync fixtures (unless `--skip-fixtures`), dashboards, customizations (Custom Fields,
   Property Setters, Custom Permissions), languages, flush deferred inserts, remove
   orphan DocTypes, then run `after_migrate` hooks.
5. **tearDown** (always, even on failure) — clear translation, website and
   notification caches; queue the website search-index rebuild on the `long` queue.

Run it after hand-editing DocType JSON, pulling app updates with schema changes, or
adding a `patches.txt` entry. A patch listed under the wrong section runs against
the wrong schema: put it in `[pre_model_sync]` only if it must run before new
columns exist.

---

## Jobs, scheduler & maintenance

```bash
# Scheduler on/off
bench --site <site> enable-scheduler
bench --site <site> disable-scheduler
bench --site <site> scheduler status        # pause | resume | disable | enable | status

# Inspect / clear the RQ queues (there is no `bench clear-scheduler-priority-jobs`)
bench --site <site> show-pending-jobs
bench --site <site> purge-jobs
bench --site <site> purge-jobs --queue default

# Run one job manually
bench --site <site> execute my_app.tasks.daily_cleanup

# Bench-level: run an RQ worker or the scheduler loop (no --site — a worker
# serves whichever site's job it dequeues)
bench worker --queue default,short,long
bench schedule

# Health check and index maintenance
bench --site <site> doctor
bench --site <site> add-database-index --doctype "Sales Invoice" --column customer

# Installed app versions (bench-level, not per site)
bench version
```

## User management

```bash
bench --site <site> set-admin-password newpassword
bench --site <site> add-system-manager user@example.com
bench --site <site> disable-user user@example.com
```

## Translations

```bash
bench --site <site> build-message-files
bench --site <site> get-untranslated <lang> untranslated.txt
bench --site <site> import-translations <lang> /path/to/translations.csv
bench --site <site> new-language <lang-code> <app-name>
```

## Production

```bash
# Setup production (nginx + supervisor) — bench-level
bench setup production <user>

# Restart all services — bench-level
bench restart

# Setup SSL — bench-level
bench setup lets-encrypt <domain>
```

## Environment variables

```bash
# Point ad hoc Python tooling at an app inside the bench
export PYTHONPATH=/path/to/frappe-bench/apps/my_app

# Alternative to --site: bench_helper falls back to $FRAPPE_SITE, then the
# bench's default_site, when no --site is given
FRAPPE_SITE=<site> bench execute my_app.utils.run_task
```

---

## Troubleshooting

| Issue | Command |
|-------|---------|
| DocType not appearing | `bench --site <site> migrate` |
| Vue changes not reflecting | `bench build --app <app>` |
| Cache issues | `bench --site <site> clear-cache` |
| Permission issues | Check Role Permission Manager |
| Scheduler not running | `bench --site <site> enable-scheduler` |
| Stale data | `bench --site <site> clear-cache && bench restart` |

Stale worker processes and stuck locks look like the same symptoms but need a
different fix — [bench-troubleshooting.md](bench-troubleshooting.md).

## Common workflows

### After creating a DocType

```bash
bench --site <site> migrate
```

### After changing Vue frontend

```bash
bench build --app <app>
# or for development:
bench watch
```

### After changing hooks.py

```bash
bench --site <site> clear-cache
bench restart  # if in production
```

### Fresh development setup

```bash
bench new-site dev.local
bench use dev.local
bench --site dev.local install-app erpnext
bench --site dev.local install-app my_app
bench start
```

### Deploy to production

```bash
git pull
bench --site <site> install-app my_app  # if new
bench --site <site> migrate
bench build --production
bench restart
```

### Export and version-control fixtures

```bash
# After configuring Custom Fields, Property Setters, etc.
bench --site <site> export-fixtures --app my_app

# Commit to git
cd apps/my_app
git add -A
git commit -m "Update fixtures"
```

---

## Sources

Frappe CLI commands verified against Frappe v16.27.1 (`bench` proxies these):

- `apps/frappe/frappe/commands/site.py` — `new-site`, `drop-site`, `use`, `install-app`,
  `uninstall-app`, `list-apps`, `list-sites`, `backup`, `restore`, `reinstall`, `migrate`,
  `reload-doc`, `reload-doctype`, `set-admin-password`, `add-system-manager`, `disable-user`,
  `add-database-index`, `describe-database-table`, `trim-database`, `trim-tables`,
  `clear-log-table`, `bulk-rename`
- `apps/frappe/frappe/commands/utils.py` — `build`, `watch`, `clear-cache`,
  `clear-website-cache`, `execute` (`--args`/`--kwargs`/`--profile`), `set-config`
  (`-g`/`-p`), `show-config`, `console`, `run-tests`, `run-parallel-tests`, `run-ui-tests`,
  `export-fixtures`, `export-json`, `export-csv`, `export-doc`, `import-doc`, `data-import`,
  `mariadb`, `version`
- `apps/frappe/frappe/commands/scheduler.py` — `enable-scheduler`, `disable-scheduler`,
  `scheduler`, `doctor`, `show-pending-jobs`, `purge-jobs`, `schedule`, `worker`, `worker-pool`
- `apps/frappe/frappe/commands/translate.py` — `build-message-files`, `new-language`,
  `get-untranslated`, `update-translations`, `import-translations`, `migrate-translations`
- `bench init`, `new-app`, `get-app`, `update`, `start`, `restart`, `setup` are
  bench-tool commands, not in Frappe's `frappe/commands/`. There is no
  `bench c`/`bench m`/`bench s` shortcut and no `bench clear-logs` or
  `bench clear-scheduler-priority-jobs` command.
