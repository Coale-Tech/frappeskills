# New App Workflow

Follow these steps in order.

## Step 1: Confirm bench root

```bash
ls apps/ sites/ Procfile
```
If it succeeds, bench is valid. Do not run anything else to verify.

## Step 2: Enable developer mode

```bash
bench set-config -g developer_mode 1
```

## Step 3: Pick or create site

See [bench.md](../../frappe-bench-operations/references/bench.md) for finding or creating a site. A working site is a prerequisite for the next steps.

## Step 4: Create app

The `bench new-app` command MUST use piped `printf`. No heredoc (`<<EOF`). No `--no-input`. No `--no-git`. No bare `bench new-app <name>` without pipe.

Ask user for: app name, title, description, publisher, email, license.

```bash
printf '<title>\n<description>\n<publisher>\n<email>\n<license>\nN\nN\nN\n' | bench new-app <app-name>
```

Example:
```bash
printf 'Expense Tracker\nTrack expenses\nJohn\njohn@example.com\nmit\nN\nN\nN\n' | bench new-app expense_tracker
```

## Step 5: Install app on site

```bash
bench --site <site> install-app <app-name>
```

## Step 6: Build features

Write DocTypes, controllers, hooks, permissions, UI directly in the app module directory created in step 4.

The app structure after `bench new-app myapp`:
```
apps/myapp/
  myapp/
    myapp/          ← module directory (same name as app)
      __init__.py
    hooks.py
    __init__.py
  setup.py
```

Load the relevant feature references from the main SKILL.md table as needed.

## Step 7: Migrate and verify

```bash
bench --site <site> migrate
```

**Rules:**
- After migration succeeds, do NOT query the database directly to verify schema changes. The migrate output is the source of truth.

Start bench in background if not already running:
```bash
bench start
```

Get URL:
```bash
bench --site <site> execute frappe.utils.get_url
```


---

## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `app-development/SKILL.md`.

### Frappe App Development

Scaffold, structure, and architect custom Frappe applications with production-grade patterns.

#### When to use

- Creating a new custom Frappe app from scratch
- Setting up app architecture (modules, services, utils)
- Configuring `hooks.py` for events, scheduler, overrides
- Implementing background jobs and async processing
- Building service layers and domain logic patterns
- Adding caching, logging, error handling utilities
- Preparing apps for production deployment
- Managing translations, versioning, and packaging

#### Inputs required

- App name and purpose
- Target Frappe version (v13+, v15+, v16+)
- Module structure (which DocTypes, APIs, services)
- Whether hooks/overrides of other apps are needed
- Background job requirements
- Production readiness needs

#### Procedure

##### 0) Scaffold the app

```bash
# Create the app
bench new-app my_app

# Install on site
bench --site mysite.local install-app my_app

# Verify developer mode
bench --site mysite.local console
>>> frappe.conf.developer_mode  # Must be True
```

##### 1) Plan app structure

Follow the domain architecture pattern — keep DocType controllers thin and business logic in service modules:

```
my_app/
├── my_app/
│   ├── __init__.py
│   ├── hooks.py              # App hooks and configuration
│   ├── api.py                # Public API surface (RPC endpoints)
│   ├── services/             # Business logic modules
│   │   └── billing.py
│   ├── utils/                # Cross-cutting utilities
│   │   ├── cache.py
│   │   ├── errors.py
│   │   ├── logging.py
│   │   ├── permissions.py
│   │   └── validation.py
│   ├── background_jobs/      # Async job handlers
│   │   └── export_job.py
│   ├── integrations/         # External system connectors
│   │   └── payment_gateway.py
│   ├── my_module/
│   │   ├── doctype/
│   │   │   └── my_doc/
│   │   │       ├── my_doc.json
│   │   │       ├── my_doc.py
│   │   │       ├── my_doc.js
│   │   │       └── test_my_doc.py
│   │   ├── report/
│   │   └── dashboard/
│   └── translations/
│       ├── en.csv
│       └── fr.csv
├── setup.py
└── README.md
```

Use the mini-app-template in `assets/mini-app-template/` as a starting scaffold.

##### 2) Configure hooks.py

```python
# hooks.py

app_name = "my_app"
app_title = "My App"
app_publisher = "My Company"

# DocType lifecycle events
doc_events = {
    "Sales Order": {
        "on_submit": "my_app.services.billing.on_order_submit",
        "on_cancel": "my_app.services.billing.on_order_cancel",
    },
    "*": {
        "after_insert": "my_app.utils.logging.log_creation",
    }
}

# Scheduled tasks
scheduler_events = {
    "daily": [
        "my_app.background_jobs.cleanup.run_daily_cleanup"
    ],
    "cron": {
        "0 */6 * * *": [
            "my_app.background_jobs.sync.sync_external_data"
        ]
    }
}

# Client-side script injection
doctype_js = {
    "Sales Order": "public/js/sales_order.js"
}

doctype_list_js = {
    "Sales Order": "public/js/sales_order_list.js"
}

# Override another app's controller (use sparingly)
# override_doctype_class = {
#     "ToDo": "my_app.overrides.custom_todo.CustomToDo"
# }

# Extend controller without full replacement (v16+, preferred)
# extend_doctype_class = {
#     "ToDo": "my_app.overrides.todo_extension.TodoExtension"
# }

# Override whitelisted methods
# override_whitelisted_methods = {
#     "frappe.client.get_list": "my_app.overrides.custom_get_list"
# }
```

##### 3) Implement service layer

Keep DocType controllers thin — delegate business logic to services:

```python
# my_app/services/billing.py
import frappe

def on_order_submit(doc, method):
    """Handle order submission — called via doc_events hook."""
    if doc.grand_total > 10000:
        create_approval_request(doc)
    generate_invoice(doc)

def generate_invoice(order):
    """Create invoice from submitted order."""
    invoice = frappe.get_doc({
        "doctype": "Sales Invoice",
        "customer": order.customer,
        "items": [
            {"item_code": i.item_code, "qty": i.qty, "rate": i.rate}
            for i in order.items
        ]
    })
    invoice.insert()
    invoice.submit()
    return invoice
```

##### 4) Set up background jobs

```python
# my_app/background_jobs/export_job.py
import frappe

def enqueue_export(filters):
    """Enqueue a long-running export job."""
    frappe.enqueue(
        "my_app.background_jobs.export_job.run_export",
        filters=filters,
        queue="long",
        timeout=600,
        is_async=True
    )

def run_export(filters):
    """Execute the export — runs in background worker."""
    data = frappe.get_all("Sales Order", filters=filters, fields=["*"])
    # Process data...
    frappe.publish_realtime("export_complete", {"count": len(data)})
```

##### 5) Add cross-cutting utilities

```python
# my_app/utils/cache.py
import frappe

def get_cached_settings(key):
    """Cache expensive settings lookups."""
    value = frappe.cache().get_value(f"my_app:{key}")
    if value is None:
        value = frappe.db.get_single_value("My Settings", key)
        frappe.cache().set_value(f"my_app:{key}", value)
    return value

def invalidate_cache(key):
    frappe.cache().delete_value(f"my_app:{key}")
```

```python
# my_app/utils/errors.py
import frappe

def api_error(message, status_code=400, exc=None):
    """Consistent error response for API endpoints."""
    frappe.local.response["http_status_code"] = status_code
    frappe.throw(message, exc or frappe.ValidationError)
```

##### 6) Handle translations

```python
# In Python code
frappe._("Hello World")   # Mark string for translation

# In JavaScript
__("Hello World")         # Mark string for translation
```

```bash
# Translation CSV files go in my_app/translations/
# e.g., my_app/translations/fr.csv:
# Hello World,Bonjour le monde
```

##### 7) Version compatibility

| Feature | Minimum Version |
|---------|----------------|
| `extend_doctype_class` | Frappe v16+ |
| REST API v2 (`/api/v2/`) | Frappe v15+ |
| Token-based auth | Frappe v11.0.3+ |

When targeting multiple versions, guard version-specific features:

```python
import frappe

if hasattr(frappe, 'extend_doctype_class'):
    # v16+ pattern
    pass
else:
    # Fallback for older versions
    pass
```

#### Verification

- [ ] App installs without errors: `bench --site <site> install-app my_app`
- [ ] Hooks fire correctly (check scheduler logs, doc events)
- [ ] Background jobs enqueue and complete
- [ ] `bench --site <site> migrate` succeeds
- [ ] Tests pass: `bench --site <site> run-tests --app my_app`

#### Failure modes / debugging

- **App not found**: Check `apps.txt` and `sites/<site>/site_config.json`
- **Hooks not firing**: Verify `hooks.py` syntax; restart bench
- **Background jobs stuck**: Check worker status with `bench doctor`; verify Redis
- **Import errors**: Ensure module paths in hooks match actual Python paths
- **Developer mode off**: DocType changes won't export to files

#### Escalation

- For DocType creation details → `frappe-doctype-development`
- For API endpoint patterns → `frappe-api-development`
- For Desk UI customization → `frappe-desk-customization`
- For Frappe UI frontends → `frappe-frontend-development`
- For print formats and Jinja → `frappe-printing-templates`
- For reports → `frappe-reports`
- For web forms → `frappe-web-forms`
- For testing → `frappe-testing`
- For enterprise architecture → `frappe-enterprise-patterns`
- For Docker/FM environments → `frappe-manager`

#### References

- [references/app-development.md](new-app.md) — End-to-end app architecture
- [references/version-compat.md](../../frappe-project-triage/references/v15-v16-compatibility.md) — Version compatibility notes
- [references/translations.md](translations.md) — Multi-language support

##### Cross-references (owned by specialized skills)

- hooks.py and extension points → `frappe-doctype-development` ([hooks-extensions.md](hooks.md))
- Python API reference → `frappe-api-development` ([python-api.md](../../frappe-api-development/references/rest-api.md))

#### Guardrails

- **Use Frappe UI for custom frontends**: Never use vanilla JS, jQuery, or custom frameworks. Frappe UI (Vue 3 + TailwindCSS) is the ecosystem standard. See `frappe-frontend-development` for setup.
- **Follow CRM/Helpdesk patterns for CRUD apps**: Follow `frappe-ui-patterns` skill for app shell, navigation, list views, and form layouts derived from official Frappe apps.
- **Follow naming conventions**: App name must be lowercase with underscores, valid Python identifier
- **Use hooks.py for integrations**: Never monkey-patch; use doc_events, scheduler_events, boot_session hooks
- **Keep hooks.py clean**: Only configuration, no logic; import from modules
- **Maintain backwards compatibility**: Use `frappe.version` checks for cross-version support
- **Export fixtures properly**: Use `fixtures` in hooks.py for data that should sync with app

#### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| App not in `installed_apps` | App code not loaded | Run `bench --site <site> install-app my_app` |
| Wrong module path in hooks | Events don't fire | Verify path matches actual `my_app/module/file.py` structure |
| Duplicate hook registrations | Events fire multiple times | Check hooks.py for duplicates; use list not repeated keys |
| Editing hooks.py without restart | Changes not picked up | Run `bench restart` after hooks.py changes |
| Missing `__init__.py` files | Module import errors | Ensure every directory has `__init__.py` |
| Logic in hooks.py | Hard to test, import errors | Move logic to separate modules, import in hooks |
| Building frontend with vanilla JS/jQuery | Inconsistent with ecosystem | Use Frappe UI (Vue 3); see `frappe-frontend-development` |
| Custom app shell for CRUD apps | Inconsistent UX | Follow CRM/Helpdesk patterns for navigation and layouts |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `app-development/references/app-development.md`.

### App development (end-to-end)

#### Typical app structure
- App modules live under `<app>/<app_module>/`.
- Keep domain logic in dedicated modules (e.g., `services/`, `utils/`, `api/`) instead of bloating DocType controllers.
- Use `doctype/<doctype_name>/` for DocType controllers, tests, and UI assets.

#### Scaffolding workflow
- Create app with `bench new-app` and install on site.
- Create DocTypes in developer mode to export them into app files.
- Add form scripts and list/report scripts in the app for reusable UI behavior.

#### Domain architecture patterns
- Keep DocType controllers thin; treat them as validation + orchestration.
- Move complex business logic into service modules (e.g., `your_app/services/billing.py`).
- Encapsulate integrations in `integrations/` or `connectors/` modules.
- Expose public APIs via a single `api.py` or `api/` package to control surface area.

#### Background jobs
- Use background jobs for long-running tasks; avoid blocking request/submit handlers.
- Keep jobs idempotent and retry-safe; accept a job key and guard duplicate work.

#### Event-driven patterns
- Prefer `doc_events` in hooks for cross-cutting behavior.
- Avoid deep override chains; keep event handlers small and delegate to services.

#### Permissions and roles
- Define DocType permissions per role.
- Re-check permissions in RPC methods before acting on documents.

#### API design
- Use REST endpoints for DocType CRUD; use RPC for workflows and custom actions.
- Validate user permissions and input payloads in all RPC methods.
- Return structured responses and handle errors consistently.

#### Performance and scale
- Prefer `frappe.get_list` or Query Builder for efficient reads.
- Avoid N+1 queries by loading related data in bulk.
- Cache expensive reads when safe and invalidate on writes.

#### Testing and CI
- Write unit tests for DocType logic and services.
- Add integration tests for workflows and API endpoints.
- Run tests in CI with a clean site and minimal fixtures.

#### Packaging and release
- Commit exported DocType JSON and scripts to version control.
- Use patches for data changes and `bench migrate` on upgrade.
- Document breaking changes and provide migration notes.

#### Production hardening
- Validate permissions at every boundary.
- Avoid direct SQL unless necessary; keep queries parameterized.
- Use background jobs for heavy tasks and set reasonable timeouts.

#### Production-grade checklist
- **Security**: enforce permissions in server APIs; validate inputs; avoid unsafe SQL.
- **Reliability**: idempotent jobs, retries, clear error handling.
- **Observability**: structured logging, error capture, key events in logs.
- **Performance**: query builder, pagination, caching for hot paths.
- **Maintainability**: thin controllers, service modules, consistent API envelopes.
- **Upgrade safety**: use patches and keep schema changes versioned.

#### Templates
- Service layer example: `/assets/mini-app-template/your_app/services/sample_service.py`
- Background job stub: `/assets/mini-app-template/your_app/background_jobs/sample_job.py`
- API response envelope example: `/assets/mini-app-template/your_app/api.py`
- Integration connector stub: `/assets/mini-app-template/your_app/integrations/sample_connector.py`
- Cache helper: `/assets/mini-app-template/your_app/utils/cache.py`
- Permission helper: `/assets/mini-app-template/your_app/utils/permissions.py`
- Error response helper: `/assets/mini-app-template/your_app/utils/errors.py`
- Logging helper: `/assets/mini-app-template/your_app/utils/logging.py`
- Validation helper: `/assets/mini-app-template/your_app/utils/validation.py`

Sources: Apps, Developer Mode, Background Jobs, Hooks, Permissions, REST/RPC API, Query Builder, Tests, Migrations (official docs)
