# FM Development & Agent Workflow

Part of [frappe-manager.md](frappe-manager.md). Site creation and management
commands: [fm-sites-and-installation.md](fm-sites-and-installation.md).

## Shell access

```bash
fm shell <site>              # interactive shell inside the container
fm shell <site> -c "<cmd>"   # run one command inside the container, non-interactively

# Inside the container, ordinary bench commands apply — always with --site:
bench new-app my_app
bench --site <site> install-app my_app
bench --site <site> migrate
bench build --app my_app
```

`fm shell <site> -c "..."` is the non-interactive equivalent of entering the
shell, running one command, and exiting — useful for scripts and CI.

## fmx (internal service management)

Inside the container, `fmx` controls Frappe's own services:

```bash
fm shell <site>
fmx status      # check service status
fmx restart     # restart Frappe services
fmx start
fmx stop
```

## VSCode integration

```bash
fm code <site>              # open the site in VSCode
fm code <site> --debugger   # open with the debugger attached
```

## Standard development cycle

```bash
# 1. Create and start
fm create devsite --apps erpnext:version-15 --environment dev
fm start devsite

# 2. Enter the shell, create or modify an app
fm shell devsite
bench new-app my_app
bench --site devsite install-app my_app
# ... make code changes on the host; they're mounted into the container ...
exit

# 3. Test
fm shell devsite -c "bench --site devsite run-tests --app my_app"

# 4. Check logs
fm logs devsite -f

# 5. Reset if the site gets into a bad state — cheaper than debugging
fm stop devsite
fm delete devsite
fm create devsite --apps erpnext:version-15 --environment dev
```

Treat dev sites as disposable: export fixtures/code you need first, then
recreate rather than repair a corrupted one.

## Why FM for agent-driven development

- **Isolated environments** — each site runs in Docker containers, no host pollution
- **Quick reset** — delete and recreate to test from a clean state
- **Minimal host dependencies** — only Docker is required
- **Shell access** — agents run commands via `fm shell`
- **Reproducible** — same environment across machines

### Key commands for agents

| Task | Command |
|------|---------|
| Create environment | `fm create <site> --apps erpnext:version-15 --environment dev` |
| Start / stop | `fm start <site>` / `fm stop <site>` |
| Run a shell command | `fm shell <site> -c "<cmd>"` |
| View logs | `fm logs <site> -f` |
| Check site info | `fm info <site>` |
| List all sites | `fm list` |
| Delete environment | `fm delete <site>` |
| Restart Frappe services | `fm shell <site> -c "fmx restart"` |

## Testing strategies

```bash
# All tests for an app
fm shell devsite -c "bench --site devsite run-tests --app my_app"

# Specific module
fm shell devsite -c "bench --site devsite run-tests --module my_app.tests.test_feature"

# Specific DocType
fm shell devsite -c "bench --site devsite run-tests --doctype 'My DocType'"

# Verbose
fm shell devsite -c "bench --site devsite run-tests --app my_app -v"
```

Run `bench --site devsite migrate` after schema changes and
`bench --site devsite clear-cache` after Python changes, before re-running tests.

## Debugging workflow

```bash
fm shell devsite
bench set-config -g developer_mode 1   # bench-level: -g writes common_site_config.json,
exit                                    # no --site needed here

fm code devsite --debugger
```

```bash
# Recent errors from the container logs
fm logs devsite | grep -i error | tail -20
fm logs devsite -f
```

```bash
# Console debugging
fm shell devsite
bench --site devsite console
>>> doc = frappe.get_doc("My DocType", "XYZ")
>>> doc.status
>>> exit()
```

## Database operations

```bash
# Quick DB access
fm shell devsite -c "bench --site devsite mariadb -e 'SHOW TABLES;'"

# Backup before risky changes
fm shell devsite -c "bench --site devsite backup"

# Reset the database (wipes data, keeps installed apps)
fm shell devsite
bench --site devsite reinstall --yes
exit
```

## Multi-app development

```bash
fm create multiapp --apps erpnext:version-15 --apps hrms:version-15
fm shell multiapp
bench new-app app_one
bench new-app app_two
bench --site multiapp install-app app_one
bench --site multiapp install-app app_two
exit
```

## Editing app code

Files are bind-mounted from the host — edit directly there, no need to edit
inside the container:

```bash
code ~/frappe-manager/<site>/workspace/frappe-bench/apps/my_app/
# or
fm code <site>
```

After editing:

```bash
fm shell <site>
bench build --app my_app          # JS/CSS changes
bench --site <site> migrate       # schema changes
bench --site <site> clear-cache   # Python changes
exit
```

### Directory layout inside a site

```
~/frappe-manager/
└── devsite/                            # FM site directory
    ├── workspace/
    │   └── frappe-bench/
    │       ├── apps/
    │       │   ├── frappe/
    │       │   ├── erpnext/
    │       │   └── my_custom_app/      # your app code
    │       └── sites/
    │           └── devsite/
    │               └── site_config.json
    └── docker-compose.yml
```

## CI/CD integration

```yaml
- name: Setup FM
  run: pipx install frappe-manager
- name: Create test site
  run: |
    fm create testsite --apps erpnext:version-15
    fm shell testsite -c "bench --site testsite install-app ${{ github.workspace }}"
- name: Run tests
  run: fm shell testsite -c "bench --site testsite run-tests --app my_app"
```

## Cleanup

```bash
# Remove stopped containers / stale images
fm clean --containers
docker image prune -f

# Full reset — remove every FM site, then prune Docker
fm list | xargs -I {} fm delete {} --force
docker system prune -af
```
