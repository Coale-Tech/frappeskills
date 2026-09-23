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
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/bench.md`.

### Bench Commands and App Setup

#### Core Lifecycle
- `bench init <bench-path>`: create a new bench.
- `bench new-site <site>`: create a new site.
- `bench start`: run dev services (web, socketio, redis, etc.).

#### Bench and App Layout
- A Frappe app is a Python package inside `frappe-bench/apps` and should be listed in `sites/apps.txt`.
- The `frappe` app is the framework itself; custom apps live alongside it.

#### App Management
- Confirm you are in a bench directory: `bench find .`
- `bench new-app <app>`: scaffold a new app.
- `bench get-app <app> <git-url>`: fetch an app from a repo.
- `bench --site <site> install-app <app>`: install app on site.
- `bench --site <site> uninstall-app <app>`: remove app from site.

#### Assets
- `bench build`: build assets for production.
- `bench build --app <app>`: build assets for a specific app.

#### Migrations
- `bench migrate`: run migrations (schema, patches, etc.).
- Use migration patches for data fixes that must run during upgrades.
- Patches are Python functions referenced in `patches.txt` and executed by `bench migrate`.

#### Testing
- `bench --site <site> run-tests`: run tests.
- `bench --site <site> run-ui-tests <app>`: run UI tests.

#### Maintenance
- `bench clear-cache`: clear cache.
- `bench clear-website-cache`: clear website cache.
- `bench clear-logs`: clear logs.

#### Backup and Restore
- `bench --site <site> backup`: backup site.
- `bench --site <site> restore <path>`: restore site.

#### Scheduler
- `bench --site <site> enable-scheduler` / `disable-scheduler`.

Sources: Bench Commands, Install and Setup Bench, Apps, Create an App, Sites, Database Migrations, Patches (official docs)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/bench-commands.md`.

```markdown
# Bench Commands Reference

## Overview
Frappe Bench CLI commands for use inside Frappe Manager containers.

## Accessing Bench CLI

```bash
### Enter container shell
fm shell mysite

### Now bench commands are available
bench --help
```

## Site Management

```bash
### Create new site
bench new-site mysite.localhost --db-root-password root --admin-password admin

### Delete site
bench drop-site mysite.localhost --db-root-password root

### List sites
ls sites/

### Set default site
bench use mysite.localhost
```

## App Management

```bash
### Get app from frappe.cloud
bench get-app erpnext

### Get app from GitHub
bench get-app https://github.com/frappe/hrms.git

### Get specific branch
bench get-app erpnext --branch version-15

### Install app on site
bench --site mysite.localhost install-app erpnext

### Uninstall app
bench --site mysite.localhost uninstall-app erpnext

### List installed apps
bench --site mysite.localhost list-apps

### Create new custom app
bench new-app my_custom_app
```

## Database & Migrations

```bash
### Run migrations
bench --site mysite.localhost migrate

### Run all pending patches
bench --site mysite.localhost migrate --skip-failing

### Backup database
bench --site mysite.localhost backup

### Backup with files
bench --site mysite.localhost backup --with-files

### Restore from backup
bench --site mysite.localhost restore /path/to/backup.sql.gz

### Access MariaDB
bench --site mysite.localhost mariadb
```

## Development

```bash
### Enable developer mode
bench set-config -g developer_mode 1

### Disable developer mode
bench set-config -g developer_mode 0

### Build assets
bench build

### Build specific app
bench build --app my_app

### Watch mode (live rebuild)
bench watch

### Clear cache
bench --site mysite.localhost clear-cache

### Clear website cache
bench --site mysite.localhost clear-website-cache

### Console (Python REPL)
bench --site mysite.localhost console
```

## Testing

```bash
### Run all tests for app
bench --site mysite.localhost run-tests --app my_app

### Run specific doctype tests
bench --site mysite.localhost run-tests --doctype "Sales Order"

### Run specific module tests
bench --site mysite.localhost run-tests --module my_app.utils.tests

### With coverage
bench --site mysite.localhost run-tests --app my_app --coverage

### UI tests
bench --site mysite.localhost run-ui-tests my_app --headless
```

## Server Management

```bash
### Start development server
bench serve

### Start with specific settings
bench serve --port 8001

### Check service status
bench doctor

### Version info
bench version

### Update bench
bench update

### Update specific app
bench update --apps erpnext
```

## User Management

```bash
### Set admin password
bench --site mysite.localhost set-admin-password newpassword

### Add system manager
bench --site mysite.localhost add-system-manager user@example.com

### Disable user
bench --site mysite.localhost disable-user user@example.com
```

## Scheduler & Jobs

```bash
### Enable scheduler
bench --site mysite.localhost enable-scheduler

### Disable scheduler
bench --site mysite.localhost disable-scheduler

### Run scheduler manually
bench --site mysite.localhost scheduler

### Execute specific job
bench --site mysite.localhost execute my_app.tasks.daily_cleanup

### Clear failed jobs
bench --site mysite.localhost clear-scheduler-priority-jobs
```

## Configuration

```bash
### Set config value
bench --site mysite.localhost set-config key value

### Set global config
bench set-config -g key value

### Show config
bench --site mysite.localhost show-config

### Bench config file
### Located at: sites/common_site_config.json
```

## Data Management

```bash
### Export fixtures
bench --site mysite.localhost export-fixtures

### Import data
bench --site mysite.localhost import-doc /path/to/doc.json

### Export data
bench --site mysite.localhost export-doc "DocType/DocName"

### Bulk data import
bench --site mysite.localhost data-import --file /path/to/file.csv --doctype "Customer"
```

## Translations

```bash
### Update translations
bench update-translations

### Build translations
bench build-message-files

### Get untranslated
bench --site mysite.localhost get-untranslated
```

## Useful Shortcuts

```bash
### Quick site console
bench c

### Quick mariadb
bench m

### Quick serve
bench s
```

## Environment Variables

```bash
### Set Python path
export PYTHONPATH=/workspace/frappe-bench/apps/my_app

### Run with specific site
FRAPPE_SITE=mysite.localhost bench execute my_app.utils.run_task
```

Sources: Bench CLI, Frappe Commands (official docs)
```

---

## Sources

Frappe CLI commands verified against Frappe v16.9.0 (`bench` proxies these):

- `apps/frappe/frappe/commands/site.py` — `new-site`, `drop-site`, `use`, `install-app`, `uninstall-app`, `list-apps`, `backup`, `restore`, `migrate`, `reload-doc`, `reload-doctype`, `set-admin-password`, `add-database-index`, `trim-database`, `trim-tables`
- `apps/frappe/frappe/commands/utils.py` — `build`, `watch`, `clear-cache`, `clear-website-cache`, `execute` (`--args`/`--kwargs`/`--profile`), `set-config` (`-g`/`-p`), `show-config`, `console`, `run-tests`, `run-parallel-tests`, `export-fixtures`, `export-json`, `export-csv`, `export-doc`, `import-doc`, `data-import`, `doctor`, `show-pending-jobs`, `purge-jobs`, `schedule`, `scheduler`, `worker`, `serve`, `version`, `enable-scheduler`, `disable-scheduler`, `rebuild-global-search`, `build-search-index`
- `bench init`, `new-app`, `get-app`, `update`, `start`, `restart`, `setup`, `mariadb` are bench-tool commands (not in Frappe's `frappe/commands/`).
