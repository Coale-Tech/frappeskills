# Frappe v15 vs v16 Compatibility Guide

This guide covers the key differences between Frappe v15 and v16 and how to write code that works on both versions.

## Overview

| Area | v15 | v16 | Compatible Approach |
|------|-----|-----|-------------------|
| **Workspace** | Page-based HTML | EditorJS JSON blocks | Conditional or page-based |
| **Sidebar** | Menu items in hooks | Workspace Sidebar DocType | Use hooks, create sidebar via setup |
| **Routing** | `/app/{workspace}` (canonical) | `/desk/{workspace}` (canonical; `/app/*` redirects) | Link with `/desk/...` on v16; `/app/...` still resolves via redirect |
| **API Calls** | `frappe.call()` + `frappe.xcall()` | `frappe.call()` + `frappe.xcall()` (both exist) | Use `createResource` from frappe-ui |
| **Page Load** | `frappe.pages[name].on_page_load` | Via workspace links | Use v15 pattern, v16 links to it |
| **Menus** | `app_header_menu` hooks | Workspace shortcuts | Register via hooks + setup script |

## API Compatibility

### Server-Side Python

Most server-side code works identically in both versions:

```python
import frappe

@frappe.whitelist()
def get_data(name):
    # Works in v15 and v16
    return frappe.get_doc("MyDocType", name).as_dict()

@frappe.whitelist()
def get_list(filters=None):
    # Works in v15 and v16
    return frappe.get_all(
        "MyDocType",
        fields=["name", "status"],
        filters=filters or {},
        order_by="creation desc"
    )
```

### Frontend JavaScript

**Use `createResource` from frappe-ui** - it handles both versions:

```javascript
import { createResource } from 'frappe-ui'

// This works in both v15 and v16
const itemsResource = createResource({
  url: 'my_app.api.get_items',
  params: { filters: {} },
  auto: true,
  onSuccess: (data) => { /* handle */ },
  onError: (error) => { /* handle */ }
})
```

**`frappe.call` and `frappe.xcall` both exist in v15 AND v16** (defined in `apps/frappe/frappe/public/js/frappe/request.js`). `frappe.xcall` is simply a Promise wrapper around `frappe.call` and has shipped since v13 — neither is version-specific. Prefer `createResource` in Vue SPAs for reactivity and caching, not for version compatibility:

```javascript
// Both work in v15 and v16 (frappe.xcall returns a Promise):
frappe.call({
  method: 'my_app.api.get_data',
  callback: (r) => { }
})

await frappe.xcall('my_app.api.get_data', { name: 'X' })

// Preferred in Vue SPAs (reactive resource with loading/error state):
const resource = createResource({
  url: 'my_app.api.get_data',
  auto: true
})
```

## Workspace Compatibility

### v15 Page Registration

```javascript
// pages/my_page.js
frappe.pages['my_page'].on_page_load = function(wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __('My Page'),
    single_column: true
  })

  page.set_primary_action(__('New'), function() {
    frappe.set_route('/my-app/new')
  })

  var $container = page.main.find('.layout-main')
  new Vue({
    render: function(h) {
      return h(MyComponent)
    }
  }).$mount($container[0])
}
```

### v16 Workspace Registration

```python
# install.py or hooks.py after_install
def setup_workspace():
    """Create v16 workspace for the module"""
    if frappe.db.exists("Workspace", "My Module"):
        return

    workspace = frappe.new_doc("Workspace")
    workspace.title = "My Module"
    workspace.module = "my_app"
    workspace.public = 1
    workspace.icon = "layer"
    workspace.indicator_color = "blue"

    # Add shortcuts
    for shortcut in get_shortcuts():
        workspace.append("shortcuts", shortcut)

    # Add links (sidebar items)
    for link in get_links():
        workspace.append("links", link)

    workspace.save()

def get_shortcuts():
    return [
        {
            "type": "DocType",
            "link_to": "MyDocType",
            "label": "New MyDocType",
            "icon": "plus",
            "color": "green"
        }
    ]

def get_links():
    return [
        {
            "type": "Page",
            "link_to": "my_page",
            "label": "My Page",
            "icon": "file"
        }
    ]
```

### Conditional Registration

```python
import frappe

def get_frappe_version():
    """Get Frappe version as tuple"""
    version = frappe.__version__
    try:
        return tuple(map(int, version.split('.')))
    except ValueError:
        major = int(version.split('.')[0])
        return (major, 0, 0)

def is_v16_or_later():
    """Check if running on v16 or later"""
    return get_frappe_version()[0] >= 16

def setup_workspace_or_pages():
    """Setup workspace for v16, ensure pages exist for v15"""
    if is_v16_or_later():
        setup_workspace()
    else:
        # v15 uses page registration in hooks
        pass
```

## Hooks Compatibility

These hooks work the same in both versions:

```python
# hooks.py

# Document events (shared)
doc_events = {
    "MyDocType": {
        "validate": "my_app.my_module.controllers.my_doc.validate",
        "on_submit": "my_app.my_module.controllers.my_doc.on_submit",
        "on_cancel": "my_app.my_module.controllers.my_doc.on_cancel",
    }
}

# JS includes (shared)
app_include_js = [
    "my_app/bundle.js",
]

# Website routes (for SPA pages)
website_route_rules = [
    {
        "from_route": "/my-app/<path>",
        "to_route": "my_app.my_app",
    }
]

# Permission query conditions (optional)
permission_query_conditions = {
    "MyDocType": "my_app.my_module.utils.get_permission_conditions",
}

# Installation hooks (shared)
after_install = [
    "my_app.install.setup"
]

before_uninstall = [
    "my_app.install.cleanup"
]
```

## Version Detection

### Python Backend

```python
import frappe

def get_frappe_version():
    """Get Frappe version as tuple (major, minor, patch)"""
    version = frappe.__version__
    try:
        return tuple(map(int, version.split('.')))
    except ValueError:
        # Handle versions like '15.x-dev'
        major = int(version.split('.')[0])
        return (major, 0, 0)

def is_v15():
    """Check if running on Frappe v15"""
    return get_frappe_version()[0] == 15

def is_v16_or_later():
    """Check if running on Frappe v16 or later"""
    return get_frappe_version()[0] >= 16

def is_feature_available(feature):
    """Check if a specific feature is available"""
    features = {
        "workspace_v16": is_v16_or_later(),
        "sidebar_v2": is_v16_or_later(),
        "desk_v2": is_v16_or_later(),
        "new_api": is_v16_or_later(),
    }
    return features.get(feature, False)
```

### JavaScript Frontend

```javascript
// composables/useVersion.js
import { ref, computed } from 'vue'
import { call } from 'frappe-ui'

export function useVersion() {
  const version = ref(null)

  async function fetchVersion() {
    // frappe.utils.change_log.get_versions is the real whitelisted endpoint
    // (there is no `frappe.version.get_version`); it returns a dict of
    // per-app info, e.g. { frappe: { title, version, branch, ... }, ... }
    const res = await call('frappe.utils.change_log.get_versions')
    version.value = res.frappe?.version
  }

  const isV16 = computed(() => {
    if (!version.value) return false
    const major = parseInt(version.value.split('.')[0])
    return major >= 16
  })

  const isV15 = computed(() => {
    if (!version.value) return false
    const major = parseInt(version.value.split('.')[0])
    return major === 15
  })

  const majorVersion = computed(() => {
    if (!version.value) return null
    return parseInt(version.value.split('.')[0])
  })

  const versionString = computed(() => version.value || 'Unknown')

  return {
    version,
    isV16,
    isV15,
    majorVersion,
    versionString,
    fetchVersion
  }
}
```

## DocType Compatibility

DocType JSON structure is identical in both versions:

```json
{
  "name": "MyDocType",
  "module": "My Module",
  "fields": [
    {"fieldname": "name", "fieldtype": "Data", "label": "Name", "reqd": 1},
    {"fieldname": "status", "fieldtype": "Select", "options": "Draft\nActive\nInactive"}
  ],
  "permissions": [
    {"role": "System Manager", "read": 1, "write": 1, "create": 1}
  ]
}
```

## What Actually Changed in v16 (source-verified on bench 16.35.0)

> Verified against `apps/frappe/frappe/__init__.py` → `__version__ = "16.35.0"` and the DocType sources below.

**1. Workspace DocType gained navigation fields (`apps/frappe/frappe/desk/doctype/workspace/workspace.json`).**
In v16 a Workspace row can itself be a navigation entry, not only a dashboard. New/relevant fields:
`type` (Select: `Workspace` / `Link` / `URL`, default `Workspace`, **reqd**), `link_type` (`DocType`/`Page`/`Report`),
`link_to` (Dynamic Link), `external_link` (URL), `app` (Data), plus `quick_lists`, `custom_blocks`, `number_cards`,
`roles`, `sequence_id`, `parent_page`, `is_hidden`. The `content` field is a hidden Long Text holding the
EditorJS-style block JSON. See [workspace-patterns.md](../../frappe-desk-customization/references/workspace-patterns.md) for the full block schema.

**2. Workspace Sidebar is a NEW v16 DocType** (`apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json`,
`creation: 2025-08-12`) with child `Workspace Sidebar Item`. v15 had no such DocType — sidebar entries were derived
from Workspace `links`/module config. Mark any sidebar-DocType code as **v16-only**.

**3. Desktop Icon revamped for the v16 apps screen** (`apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json`)
with `icon_type`, `link_type`, `parent_icon`, `sidebar`, `logo_url`, `app`. Combined with the `add_to_apps_screen`
hook (`apps/frappe/frappe/hooks.py`), this drives the app tiles.

**4. Desk URL prefix changed from `/app` to `/desk` (v16).** The desk SPA www page was
renamed `app.py`→`desk.py` (`apps/frappe/frappe/www/desk.py`; `www/app.py`/`www/apps.py`
no longer exist) and `website_route_rules` now serves `/desk/<path:app_path>`
(`apps/frappe/frappe/hooks.py`). `website_redirects` sends `/app/*`, `/app`, and `/apps`
to `/desk/*`/`/desk` (302, query params preserved) so old `/app/...` links and bookmarks
still work, but `frappe.router.is_app_route()`/`frappe.set_route()`
(`apps/frappe/frappe/public/js/frappe/router.js`) now generate and expect `/desk/...` —
treat `/desk/<workspace>` as the canonical v16 URL and `/app/<workspace>` as a
redirect-only legacy alias, reversed from v15 where `/app` was canonical.

**5. Custom fields — prefer the framework helper.** Both v15 and v16 expose
`frappe.custom.doctype.custom_field.custom_field.create_custom_fields(custom_fields, update=True)` — the idiomatic
way ERPNext/HRMS register fields. See `fixtures-guide.md`.

**6. `extend_doctype_class` (v16+) is a safer alternative to `override_doctype_class`** — it extends the
base controller instead of fully replacing it (`apps/frappe/frappe/model/base_document.py`).

**7. Runtime requirements bumped.** v16 requires Python `>=3.14,<3.15` and Node `>=24`
(`pyproject.toml`, `package.json`); v15 requires Python `>=3.10,<3.15` and Node `>=18`. A
bench mixing a v15-only app with a v16 site still needs the v16 interpreter/Node bench-wide.

**8. Deprecation system replaced.** v15 marks deprecated APIs with
`frappe.utils.deprecations.deprecated`/`deprecation_warning` (plain `DeprecationWarning`).
v16 replaces that module with `frappe.deprecation_dumpster`
(`apps/frappe/frappe/deprecation_dumpster.py`): `deprecated(original, marked, graduation, msg)`
and `deprecation_warning(marked, graduation, msg)` now carry a graduation version —
`V15FrappeDeprecationWarning` (already graduated, raises as an error),
`V16FrappeDeprecationWarning` (warns), `V17FrappeDeprecationWarning`/`PendingFrappeDeprecationWarning`
(silenced). Code importing `frappe.utils.deprecations` on v16 should move to
`frappe.deprecation_dumpster`.

**9. Test runner rewritten (v16).** v15 runs tests via inline logic in `commands/utils.py`
with no `frappe/testing/` package. v16 adds a dedicated `frappe/testing/` package
(`TestConfig`, `TestRunner`, `discover_all_tests`, `discover_doctype_tests`,
`discover_module_tests` — see `frappe/testing/README.md`) and moves `run-tests`,
`run-parallel-tests`, `run-ui-tests` into their own `frappe/commands/testing.py` (v15 keeps
them in `commands/utils.py`). `frappe.tests_runner.get_modules`/`make_test_records`/
`make_test_objects` and related helpers are deprecated shims in `deprecation_dumpster.py`
pointing at `frappe.tests.utils.*` and `frappe.tests.classes.context_managers.*`
(`change_settings`, `patch_hooks`, `debug_on`, `timeout`).

**10. SQLite added as a third database engine (v16).** `frappe/database/sqlite/` is new
(`database.py`, `setup_db.py`, `schema.py`); `bench new-site --db-type sqlite` and
`bench sqlite`/`bench db-console` work alongside `mariadb`/`postgres`. v15's
`new-site --db-type` `click.Choice` only accepts `mariadb`/`postgres`
(`apps/frappe/frappe/commands/site.py`). Code branching on `frappe.conf.db_type` should
account for `"sqlite"`; `frappe.qb`/`frappe.get_all`/`get_list` emit SQLite-flavored SQL
when a site is configured that way.

**11. PDF generation default switched (v16).** The `pdf_generator` hook now defaults to
`frappe.utils.pdf.get_chrome_pdf` (`apps/frappe/frappe/hooks.py`) instead of wkhtmltopdf;
v15's `patches.txt` still carries
`frappe.printing.doctype.print_format.patches.sets_wkhtmltopdf_as_default_for_pdf_generator_field`
as its baseline default. Individual Print Formats can still opt into wkhtmltopdf; new sites
on v16 default to the Chrome-based generator.

**12. Hooks added/removed (v16).** New: `after_app_install`, `after_app_uninstall`
(app-level install/uninstall lifecycle, distinct from the per-DocType `after_install`/
`before_uninstall`), `app_home`, `web_include_icons` (SVG icon-sprite bundles), plus the
already-noted `add_to_apps_screen`. Removed relative to v15's `hooks.py`: `leaderboards`
and `standard_navbar_items` — registering either on v16 is silently ignored, not an error.

REST API v2 (`/api/v2/`, since v15) and token-based REST API authentication (since v11.0.3) both work
unchanged on v16 — prefer them over version-gating for API compatibility.


## Verified Version Matrix

| Version set | Notes |
|---|---|
| frappe 16.35.0 / erpnext 16.6.1 / hrms 16.4.1 | Baseline bench — all v16 examples fully verified |
| frappe 16.51.1 / erpnext 16.50.0 / hrms 16.50.0 | Delta pass — see `## What Changed in frappe 16.51` and `## What Changed in ERPNext/HRMS 16.50` below |

## What Changed in frappe 16.51 (source-verified)

Use `(frappe 16.51)` to tag behaviour present in frappe 16.51.1 and absent in 16.35.0.
Use `(frappe <=16.35)` to tag the old form.
ERPNext/HRMS facts use `(ERPNext 16.50)` / `(HRMS 16.50)` / `(ERPNext <=16.6)` / `(HRMS <=16.4)`.

### 1. Sidebar fixture path: `workspace_sidebar/` removed (16.51)

Apps used to ship sidebars as `<app>/workspace_sidebar/*.json`. The `workspace_sidebar/`
directory is gone from Frappe 16.51. The new path is `<app>/<module>/sidebar/`
(one JSON per module, standard doc-files walk). Old files are silently ignored.

```bash
# Migrate existing apps:
bench --site <site> convert-sidebar-fixtures --app <app> [--dry-run]
```

The new doctype is `Sidebar` (not `Workspace Sidebar`); child is `Sidebar Item`
(not `Workspace Sidebar Item`). Fixture `dt` keys must be updated to match.

### 2. `frappe.utils.weasyprint` — shim only (16.51)

`from frappe.utils.weasyprint import download_pdf, get_html` still works — the module
exists as a forwarding shim. But the canonical import is now
`frappe.utils.print_format_generator`. New print formats cannot select WeasyPrint
(`validate_weasyprint_choice()` throws on new format creation). Typst is a new engine:
`pdf_generator` field values are now `wkhtmltopdf | chrome | Typst | WeasyPrint`.
`typst~=0.15.0` is a new required Python package installed by `pip install frappe` (16.51+).

### 3. `frappe.breadcrumbs.clear()` / `toggle()` deprecated (16.51)

```js
// (<=16.35) — still works but logs a v17-removal warning:
frappe.breadcrumbs.clear()
frappe.breadcrumbs.toggle(show)

// (16.51) preferred:
frappe.get_current_page().set_breadcrumbs([])   // clear
page.show_breadcrumbs = false                   // toggle
```

### 4. `frappe.boot.user.all_reports` deprecated (16.51)

```js
// (<=16.35):
const reports = frappe.boot.user.all_reports

// (16.51): same data, new canonical key:
const reports = frappe.boot.allowed_reports
```

A getter on `frappe.boot.user.all_reports` still works but emits a console warning.
Verified: `apps/frappe/frappe/public/js/frappe/desk.js:291-308`.

### 5. `mask_field_value` removed from `frappe.model.db_query` (16.51)

```python
# (<=16.35) — worked because db_query re-exported it:
from frappe.model.db_query import mask_field_value  # ImportError in 16.51+

# (16.51) canonical — always the real location:
from frappe.model.utils.mask import mask_field_value
```

`frappe.model.utils.mask` is the canonical module in both versions; only the
re-export from `db_query` was removed.

### 6. ERPNext 16.50 — BOM `scrap_items` → `secondary_items`

| Old (<=16.6.1) | New (16.50+) |
|---|---|
| `BOM.scrap_items` | `BOM.secondary_items` |
| `BOMScrapItem` | `BOMSecondaryItem` |
| `scrap_material_cost` | `secondary_items_cost` |
| `"% of FG Cost"` valuation literal | `"% of Component Cost"` |

Patch `co_by_product_patch` migrated existing data. Custom code reading the old child
table name will 404.

### 7. HRMS 16.50 — Upload Attendance DocType deleted

Patch `delete_upload_attendance_doctype` removes the `Upload Attendance` DocType.
Replacement: Employee Attendance Tool. Any custom code referencing
`frappe.get_doc("Upload Attendance", ...)` will fail after migration.

### 8. CRM 2.x — `WhatsApp Message` → `WA Message`; `frappe_whatsapp` → `whatsapp`

CRM 2.x (`crm/hooks.py`) registers doc_events on `"WA Message"`, not `"WhatsApp Message"`.
The new `whatsapp` app (required by CRM 2.x) defines `WA Message`, `WA Account`,
`WA Profile`, `WA Template` — all with the `WA` prefix. Custom apps hooking into
`"WhatsApp Message"` doc_events will silently do nothing on CRM 2.x.

### 9. `frappe-dependencies` pyproject.toml pin convention

Frappe Cloud reads `[tool.bench.frappe-dependencies]` to verify compatibility window.
The working upper-bound form is `<17.0.0`, not `<=16.x.0-dev` (rejected by Cloud CI).

```toml
[tool.bench.frappe-dependencies]
frappe = ">=16.0.0-dev,<17.0.0"
```

`required_apps` in `hooks.py` is separate from this (declares runtime app deps).
Verified: ERPNext 16.50 and HRMS 16.50 `pyproject.toml` on the target bench.

## What Changed in ERPNext 16.50 / HRMS 16.50 (source-verified)

Use `(ERPNext 16.50)` / `(HRMS 16.50)` for new behaviour; `(ERPNext <=16.6)` / `(HRMS <=16.4)` for old.
Full upgrade checklist: [`frappe-deprecation-and-migration/references/erpnext-16-50-upgrade-checklist.md`](../../frappe-deprecation-and-migration/references/erpnext-16-50-upgrade-checklist.md).

### 10. ERPNext 16.50 — Python ≥ 3.14 and frappe ≥ 16.50 required

`pyproject.toml` `requires-python = ">=3.14"` (up from 3.10). `frappe-dependencies: frappe = ">=16.50.0,<17.0.0"`.
HRMS additionally requires `erpnext = ">=16.0.0,<17.0.0"`. A bench must pull Frappe to 16.51 before updating ERPNext/HRMS to 16.50.

### 11. ERPNext 16.50 — Account Freezing settings moved to Company

`Accounts Settings.acc_frozen_upto` → `Company.accounts_frozen_till_date`.
`Accounts Settings.frozen_accounts_modifier` → `Company.role_allowed_for_frozen_entries`.
Patch `migrate_account_freezing_settings_to_company` copies values to all companies.

### 12. ERPNext 16.50 — `repost_allowed_doctypes` hook added; Repost Accounting Ledger Settings removed

`(ERPNext <=16.6):` allowed types lived in the `Repost Accounting Ledger Settings` singleton.
`(ERPNext 16.50):` the singleton is merged into `Accounts Settings.repost_allowed_types`. The `repost_allowed_doctypes` hook is still read (install/migrate seeding and `_repost_vouchers` at runtime). Code that reads the old singleton breaks.

### 13. ERPNext 16.50 — AR/AP Ageing filter `calculate_ageing_with` → `age_as_on`

Filter key and option `"Today Date"` → `"Today"` in Accounts Receivable/Payable and their Summary reports.
Saved Auto Email Reports, Dashboard Charts, and Number Cards are migrated by `rename_ar_ap_ageing_filter`.
Custom code passing the old key falls back to default silently.

### 14. ERPNext 16.50 — Role permission grants expanded on several DocTypes

Patches `mirror_select_perms_to_custom_docperm` and `mirror_release_perms_to_custom_docperm` add new `select`/`release`
grants for roles on Account, Asset, Serial and Batch Bundle, Payment Terms Template, POS Invoice, and others. DocTypes
with existing Custom DocPerm rows get the new grants mirrored in. Review permission setups on these DocTypes.

### 15. HRMS 16.50 — Salary Slip print formats renamed

| Old name (HRMS <=16.4) | New name (HRMS 16.50) |
|---|---|
| `Salary Slip Standard` | `Salary Slip Classic` |
| `Salary Slip with Year to Date` | `Salary Slip Detailed` |
| `Salary Slip based on Timesheet` | `Salary Slip Classic` |

Print Settings, Email Templates, or custom code referencing old names must be updated.

### 16. HRMS 16.50 — `Holiday List Assignment` DocType introduced

Existing employee- and company-level holiday list settings are migrated to submitted `Holiday List Assignment`
records by patch `create_holiday_list_assignments`. Verify payroll calendar after migration.

### 17. HRMS 16.50 — Multi-currency Expense Claims auto-enabled

`HR Settings.enable_multi_currency_expense_claim` is set to `1` if any multi-currency expense records exist.
Verify expense claim workflows after migration.

## Best Practices

1. **Always use `createResource`** from frappe-ui for API calls
2. **Register pages using v15 pattern**, v16 will link to them via workspace
3. **Use conditional logic** for v16-specific features (workspaces, new sidebar)
4. **Keep DocType, controller, and API patterns standard** (work in both)
5. **Test on both versions** before deployment
6. **Use fixtures** for custom fields on standard DocTypes
7. **Implement version detection** for conditional behavior
8. **Document version-specific features** in code comments

## frappe-ui Version Compatibility (independent of Frappe framework version)

**This is a separate axis from the Frappe v15/v16 split above.** `frappe-ui` is versioned and
released independently on npm; a bench can run Frappe v15 or v16 with either `frappe-ui@0.1.x`
or the `1.0.0-beta` line. Pin the frontend's `package.json` and check which line a project is on
before applying the patterns below — they are `(v1)` breaking changes, not Frappe-version gates.

| Component | 0.1.x | 1.0 beta | Fix |
|-----------|-------|----------|-----|
| `Dialog` | nested `options="{title, message, actions}"` blob, `v-model="show"` | flat top-level props (`title`, `message`, `icon`, `size`, `actions`), `v-model:open`; new imperative `dialog.confirm()` / `dialog.danger()` / `dialog.prompt()` helpers | Migrate to flat props + `v-model:open`; legacy `options`/`v-model` still work but warn |
| `DateRangePicker` | emits `update:modelValue`/`change` as a comma-joined string | emits a `[from, to]` tuple (`DateRangeValue = [string, string] \| []`) | Update the event handler to destructure `[from, to]`, not split a string |
| `DateTimePicker` | selecting a date auto-closed the popover | selecting a date keeps the popover open (focus moves into the embedded `TimePicker` for a continuous date -> time flow); closes on Esc/click-outside/`close()` | Bind `v-model:open` and close from `@update:modelValue`, or add an `#actions` "Apply" button, if the old auto-close behavior is required |
| `Dropdown` | `menu` items keyed `{ group, items }` | `{ group, options }` (matches `Combobox`/`MultiSelect`/`Select`) | Rename `items` to `options`; the old key is a silent deprecated alias that warns if both are present |
| `FeatherIcon` (as a component) | primary icon component | deprecated; feather-name strings passed to `Button.icon`/`iconLeft`/`iconRight`, `Dialog.options.icon`, `Dropdown` item icons, `TabButtons` icons still render via `FeatherIcon` internally but warn | Prefer `lucide-*` icon name strings |
| `Autocomplete` | link-style picker component | deprecated; still exported | Use `Combobox` (single select) or `MultiSelect` |
| `Input` (SFC) | generic input wrapper | deprecated; still exported | Use `TextInput` |
| `Card`, `ConfirmDialog`/`confirmDialog`, `ListItem`, `MonthPicker`, `Toast` (SFC), `ThemeSwitcher`, root `TextEditor` + editor extensions, `FormControl` `type="autocomplete"` | present | marked `@deprecated`, still exported pre-1.0.0 | See `v1-release/deprecated-removals.md` in the frappe-ui repo for each replacement |

`createResource`, `createListResource`, `createDocumentResource`, the legacy resource API, the
`useCall`/`useDoc`/`useList` v2 data-fetching composables, and `ListView` are unaffected by the
0.1.x -> 1.0 beta transition — none of that surface is in scope for the v1 deprecation pass.

## Sources

Verified against Frappe v16.35.0 at `<bench>/apps/frappe`, diffed against a v15.120.0 baseline:
- `apps/frappe/frappe/__init__.py` (`__version__ = "16.35.0"`)
- `apps/frappe/pyproject.toml` (`requires-python`) and `apps/frappe/package.json` (`engines.node`)
  for both versions
- `apps/frappe/frappe/public/js/frappe/request.js` (`frappe.call`, `frappe.xcall` both defined)
- `apps/frappe/frappe/desk/doctype/workspace/workspace.json`
- `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json` (created 2025-08-12, v16-only)
- `apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json`
- `apps/frappe/frappe/www/desk.py` (`www/app.py`/`www/apps.py` absent in v16) and
  `apps/frappe/frappe/public/js/frappe/router.js` (`is_app_route`, `make_url`, `set_route`)
- `apps/frappe/frappe/hooks.py` `website_route_rules`/`website_redirects` (both versions,
  diffed for the `/app` -> `/desk` prefix change)
- `apps/frappe/frappe/custom/doctype/custom_field/custom_field.py` (`create_custom_fields`)
- `apps/frappe/frappe/hooks.py` (both versions, diffed for added/removed hook names)
- `apps/frappe/frappe/utils/change_log.py` (`get_versions`, whitelisted)
- `apps/frappe/frappe/deprecation_dumpster.py` (v16-only) vs `apps/frappe/frappe/utils/deprecations.py` (v15)
- `apps/frappe/frappe/testing/` and `apps/frappe/frappe/commands/testing.py` (v16-only) vs
  `apps/frappe/frappe/commands/utils.py` `run-tests`/`run-parallel-tests`/`run-ui-tests` (v15)
- `apps/frappe/frappe/database/sqlite/` (v16-only) and `apps/frappe/frappe/commands/site.py`
  `new-site --db-type` choices (both versions)
- `apps/frappe/frappe/patches.txt` (both versions, diffed for framework patch deltas)
- `frappe-ui` `v1-release/changelog.md` and `v1-release/deprecated-removals.md` (0.1.x -> 1.0 beta
  breaking changes and deprecation table)

ERPNext 16.50 / HRMS 16.50 delta verified against a target bench (frappe 16.51.1 / erpnext 16.50.0 / hrms 16.50.0):
- `apps/frappe/frappe/desk/doctype/sidebar/` and `sidebar/convert_fixtures.py` (workspace_sidebar/ removal)
- `apps/frappe/frappe/public/js/frappe/views/breadcrumbs.js` (`deprecated()` calls on clear/toggle)
- `apps/frappe/frappe/public/js/frappe/desk.js:291-308` (`frappe.boot.user.all_reports` getter)
- `apps/frappe/frappe/model/db_query.py` (mask_field_value no longer re-exported; confirmed absent)
- `apps/frappe/frappe/model/utils/mask.py` (canonical location of mask_field_value)
- `apps/frappe/frappe/utils/weasyprint.py` (shim confirmed present; delegates to print_format_generator)
- `apps/frappe/pyproject.toml` (typst~=0.15.0 new dependency; RestrictedPython~=8.5)
- `apps/erpnext/erpnext/manufacturing/doctype/bom/bom.py` (secondary_items, BOMSecondaryItem)
- `apps/hrms/hrms/patches/v16_0/delete_upload_attendance_doctype.py` (Upload Attendance deletion)
- `apps/crm/crm/hooks.py` (WA Message doc_events; WhatsApp Message absent)
- `apps/erpnext/pyproject.toml` (`requires-python = ">=3.14"`, `frappe = ">=16.50.0,<17.0.0"`)
- `apps/hrms/pyproject.toml` (`frappe = ">=16.50.0,<17.0.0"`, `erpnext = ">=16.0.0,<17.0.0"`)
- `apps/erpnext/erpnext/patches.txt` (v16_0 section diff: baseline vs 16.50.0)
- `apps/hrms/hrms/patches.txt` (v16_0 section diff: baseline vs 16.50.0)
- `apps/erpnext/erpnext/patches/v16_0/migrate_account_freezing_settings_to_company.py`
- `apps/erpnext/erpnext/patches/v16_0/merge_repost_settings_to_accounts_settings.py`
- `apps/erpnext/erpnext/patches/v16_0/rename_ar_ap_ageing_filter.py`
- `apps/hrms/hrms/patches/v16_0/delete_old_salary_slip_print_formats.py`
- `apps/hrms/hrms/patches/v16_0/create_holiday_list_assignments.py`
- `apps/hrms/hrms/patches/v16_0/enable_multi_currency_expense_claim_for_existing_users.py`
