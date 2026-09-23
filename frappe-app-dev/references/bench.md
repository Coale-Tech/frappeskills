# Bench CLI & Site Management

Every command takes an explicit `--site <site>`. Bare `bench migrate` is never correct.

---

## App & site lifecycle

```bash
# New app (MUST pipe input — no heredoc, no --no-input)
printf '<title>\n<desc>\n<publisher>\n<email>\n<license>\nN\nN\nN\n' | bench new-app <app-name>

# New site (set root_password in common_site_config first: bench set-config -g root_password '<pwd>')
bench new-site <name>.localhost --admin-password admin

# Install/uninstall app
bench --site <site> install-app <app-name>
bench --site <site> uninstall-app <app-name>

# List apps on site
bench --site <site> list-apps

# Migrate (apply schema + data changes)
bench --site <site> migrate

# Set default site
bench use <site>
```

## Development

```bash
# Start dev server (run in BACKGROUND)
bench start

# Developer mode
bench set-config -g developer_mode 1

# Python console with site context
bench --site <site> console

# Execute a Python expression
bench --site <site> execute frappe.utils.get_url

# Execute with args and kwargs
bench --site <site> execute path.to.function arg1 arg2 --kwarg1 hello

# Run tests
bench --site <site> run-tests --app <app-name>
bench --site <site> run-tests --doctype "DocType Name"

# Build frontend assets
bench build --app <app-name>

# Watch mode for frontend
bench watch
```

## Site maintenance

```bash
# Backup
bench --site <site> backup

# Restore
bench --site <site> restore <path>

# Clear cache
bench --site <site> clear-cache
bench --site <site> clear-website-cache

# Set site config
bench --site <site> set-config <key> <value>

# Global config
bench set-config -g <key> <value>

# MariaDB console (debugging only)
bench --site <site> mariadb

# Drop site (DESTRUCTIVE)
bench drop-site <site> --db-root-password '<pwd>'
```

## Fixtures

```bash
# Export fixtures defined in hooks.py
bench --site <site> export-fixtures --app <app-name>
```

---

## Site Lifecycle

## Finding existing sites

```bash
ls sites/
```

Ignore these entries: `assets`, `apps.txt`, `common_site_config.json`, `currentsite.txt`. Everything else is a site directory.

## Matching a site to an app

Convention: site name often contains the app name (e.g. `gameplan.localhost` for app `gameplan`).

To confirm which apps are on a site:
```bash
bench --site <site> list-apps
```

If multiple sites exist, check each until you find the one with the target app installed.

## Creating a new site

First, check if `root_password` is already set in `sites/common_site_config.json`. If not, recommend the user set it once so future site creation doesn't require the password each time:

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

## Other site commands

Ask the user before you drop a site.

## Site config

Per-site config lives in `sites/<site>/site_config.json`. Global config in `sites/common_site_config.json`.

---

---

> **Bench vs Frappe commands (v16):** `bench` proxies most site-scoped commands to
> the Frappe CLI (`apps/frappe/frappe/commands/`). Commands like `new-site`, `migrate`,
> `console`, `execute`, `build`, `clear-cache`, `install-app`, `export-fixtures`,
> `set-config`, `run-tests` are **Frappe commands**. Commands like `bench init`,
> `bench new-app`, `bench get-app`, `bench update`, `bench start`, `bench restart`,
> `bench setup ...`, and `bench mariadb` are **bench-level** (provided by the `bench`
> tool itself, not Frappe). Site-scoped Frappe commands accept `--site <site>` (or use
> `bench use <site>` once).

## Site Management

```bash
# Set default site (run once)
bench use site_name

# Create new site
bench new-site site_name

# Drop site
bench drop-site site_name

# List sites
bench list-sites
```

## App Management

```bash
# Create new app
bench new-app app_name

# Get app from GitHub
bench get-app https://github.com/user/app

# Install app on site
bench install-app app_name

# Uninstall app
bench uninstall-app app_name

# List installed apps
bench list-apps
```

## Database Operations

```bash
# Run migrations (ALWAYS after DocType changes)
bench migrate

# Backup database
bench backup

# Restore from backup
bench restore /path/to/backup.sql

# Open MariaDB console
bench mariadb
```

## Development

```bash
# Build frontend assets
bench build

# Build specific app
bench build --app app_name

# Watch for changes (auto-rebuild)
bench watch

# Clear server cache
bench clear-cache

# Clear website cache
bench clear-website-cache
```

## Console & Debugging

```bash
# Python console with Frappe context
bench console

# Example console usage:
# >>> frappe.get_all("DocType", limit=5)
# >>> doc = frappe.get_doc("Task", "TASK-001")
# >>> doc.status = "Completed"
# >>> doc.save()
# >>> frappe.db.commit()
```

## Testing

```bash
# Run all tests for app
bench run-tests --app app_name

# Run tests for specific DocType
bench run-tests --doctype "Customer Request"

# Run specific test file
bench run-tests --module my_app.tests.test_api

# Run with verbose output
bench run-tests --app app_name -v
```

## Production

```bash
# Setup production (nginx + supervisor)
bench setup production

# Restart all services
bench restart

# Setup SSL
bench setup lets-encrypt your-domain.com
```

## Scheduler

```bash
# Enable scheduler
bench enable-scheduler

# Disable scheduler
bench disable-scheduler

# Run specific task manually
bench execute myapp.tasks.daily_cleanup

# Run scheduler manually (for testing)
bench execute frappe.utils.scheduler.trigger_scheduler_events
```

## Fixtures

```bash
# Export fixtures (based on hooks.py fixtures list)
bench export-fixtures --app app_name

# Import fixtures
bench import-doc /path/to/fixture.json
```

## User Management

```bash
# Set admin password
bench set-admin-password new_password
```

## Configuration

```bash
# Set a site_config.json value (JSON site config)
bench set-config maintenance_mode 1

# Evaluate the value as a Python object (numbers, lists, dicts, bools)
bench set-config -p max_file_size 10485760

# Set in the bench-level common_site_config.json instead of the site
bench set-config -g background_workers 4

# Show effective config
bench show-config
```

## Execute Python

```bash
# Call a dotted method path with the site context
bench execute frappe.utils.scheduler.enqueue_scheduler_events

# Pass positional / keyword args (as Python literals / JSON)
bench execute my_app.api.rebuild --args "['Customer']"
bench execute my_app.api.rebuild --kwargs "{'doctype': 'Customer'}"

# Profile the call
bench execute my_app.api.heavy --profile
```

## Data Import / Export

```bash
bench data-import --file data.csv --doctype "Customer" --type Insert   # or Update
bench export-json "Customer" customers.json          # export docs to JSON
bench export-csv "Customer" customers.csv
bench export-doc "Item" "ITEM-001"                   # export a single doc as fixture
bench import-doc /path/to/fixture.json               # import doc/fixture JSON
```

## Schema Reload (without full migrate)

```bash
bench reload-doc <module> <doctype-type> <name>   # e.g. bench reload-doc core doctype user
bench reload-doctype "Sales Invoice"
```

## Jobs & Maintenance

```bash
bench show-pending-jobs          # inspect the RQ queues
bench purge-jobs                 # clear queued/failed jobs
bench worker --queue default,short,long   # run an RQ worker
bench schedule                   # run the scheduler loop
bench trim-database --dry-run    # drop orphan tables/columns not in schema
bench add-database-index --doctype "Sales Invoice" --column customer
bench doctor                     # scheduler / queue health check
bench version                    # installed app versions
```

---

## Troubleshooting

| Issue | Command |
|-------|---------|
| DocType not appearing | `bench migrate` |
| Vue changes not reflecting | `bench build --app my_app` |
| Cache issues | `bench clear-cache` |
| Permission issues | Check Role Permission Manager |
| Scheduler not running | `bench enable-scheduler` |
| Stale data | `bench clear-cache && bench restart` |

---

## Common Workflows

### After Creating a DocType

```bash
bench migrate
```

### After Changing Vue Frontend

```bash
bench build --app my_app
# or for development:
bench watch
```

### After Changing hooks.py

```bash
bench clear-cache
bench restart  # if in production
```

### Fresh Development Setup

```bash
bench new-site dev.local
bench use dev.local
bench install-app erpnext
bench install-app my_app
bench start
```

### Deploy to Production

```bash
git pull
bench install-app my_app  # if new
bench migrate
bench build --production
bench restart
```

### Export and Version Control Fixtures

```bash
# After configuring Custom Fields, Property Setters, etc.
bench export-fixtures --app my_app

# Commit to git
cd apps/my_app
git add -A
git commit -m "Update fixtures"
```

---

## Sources

Frappe CLI commands verified against Frappe v16.9.0 (`bench` proxies these):

- `apps/frappe/frappe/commands/site.py` — `new-site`, `drop-site`, `use`, `install-app`, `uninstall-app`, `list-apps`, `backup`, `restore`, `migrate`, `reload-doc`, `reload-doctype`, `set-admin-password`, `add-database-index`, `trim-database`, `trim-tables`
- `apps/frappe/frappe/commands/utils.py` — `build`, `watch`, `clear-cache`, `clear-website-cache`, `execute` (`--args`/`--kwargs`/`--profile`), `set-config` (`-g`/`-p`), `show-config`, `console`, `run-tests`, `run-parallel-tests`, `export-fixtures`, `export-json`, `export-csv`, `export-doc`, `import-doc`, `data-import`, `doctor`, `show-pending-jobs`, `purge-jobs`, `schedule`, `scheduler`, `worker`, `serve`, `version`, `enable-scheduler`, `disable-scheduler`, `rebuild-global-search`, `build-search-index`
- `bench init`, `new-app`, `get-app`, `update`, `start`, `restart`, `setup`, `mariadb` are bench-tool commands (not in Frappe's `frappe/commands/`).
