# Frappe v15 vs v16 Compatibility Guide

This guide covers the key differences between Frappe v15 and v16 and how to write code that works on both versions.

## Overview

| Area | v15 | v16 | Compatible Approach |
|------|-----|-----|-------------------|
| **Workspace** | Page-based HTML | EditorJS JSON blocks | Conditional or page-based |
| **Sidebar** | Menu items in hooks | Workspace Sidebar DocType | Use hooks, create sidebar via setup |
| **Routing** | `/app/{workspace}` | `/app/{workspace}` (unchanged) | Same desk route; SPAs use `website_route_rules` |
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
    const res = await call('frappe.version.get_version')
    version.value = res
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

## What Actually Changed in v16 (source-verified on bench 16.9.0)

> Verified against `apps/frappe/frappe/__init__.py` → `__version__ = "16.9.0"` and the DocType sources below.

**1. Workspace DocType gained navigation fields (`apps/frappe/frappe/desk/doctype/workspace/workspace.json`).**
In v16 a Workspace row can itself be a navigation entry, not only a dashboard. New/relevant fields:
`type` (Select: `Workspace` / `Link` / `URL`, default `Workspace`, **reqd**), `link_type` (`DocType`/`Page`/`Report`),
`link_to` (Dynamic Link), `external_link` (URL), `app` (Data), plus `quick_lists`, `custom_blocks`, `number_cards`,
`roles`, `sequence_id`, `parent_page`, `is_hidden`. The `content` field is a hidden Long Text holding the
EditorJS-style block JSON. See `workspace-patterns.md` for the full block schema.

**2. Workspace Sidebar is a NEW v16 DocType** (`apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json`,
`creation: 2025-08-12`) with child `Workspace Sidebar Item`. v15 had no such DocType — sidebar entries were derived
from Workspace `links`/module config. Mark any sidebar-DocType code as **v16-only**.

**3. Desktop Icon revamped for the v16 apps screen** (`apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json`)
with `icon_type`, `link_type`, `parent_icon`, `sidebar`, `logo_url`, `app`. Combined with the `add_to_apps_screen`
hook (`apps/frappe/frappe/hooks.py`), this drives the app tiles.

**4. Desk route is unchanged (`/app/<workspace>`).** The desk SPA www page was renamed `app.py`→`desk.py`
(`apps/frappe/frappe/www/desk.py`) but the router still accepts both `app` and `desk` prefixes
(`apps/frappe/frappe/public/js/frappe/router.js`); URLs remain `/app/...`.

**5. Custom fields — prefer the framework helper.** Both v15 and v16 expose
`frappe.custom.doctype.custom_field.custom_field.create_custom_fields(custom_fields, update=True)` — the idiomatic
way ERPNext/HRMS register fields. See `fixtures-guide.md`.

## Best Practices

1. **Always use `createResource`** from frappe-ui for API calls
2. **Register pages using v15 pattern**, v16 will link to them via workspace
3. **Use conditional logic** for v16-specific features (workspaces, new sidebar)
4. **Keep DocType, controller, and API patterns standard** (work in both)
5. **Test on both versions** before deployment
6. **Use fixtures** for custom fields on standard DocTypes
7. **Implement version detection** for conditional behavior
8. **Document version-specific features** in code comments
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `app-development/references/version-compat.md`.

### Version compatibility notes

#### Frappe v16+
- `extend_doctype_class` is available as a safer alternative to full controller overrides.

#### Frappe v15+
- REST API v2 is available under `/api/v2/` routes.

#### Frappe v11.0.3+
- Token-based authentication for REST API is supported.

#### Guidance
- When targeting multiple versions, prefer hooks and APIs that exist across versions.
- If a feature is version-gated, add a clear fallback path or guard in code.

Sources: Hooks (v16), REST API v2 (v15), Token Based Authentication (v11.0.3) (official docs)

---

## Sources

Verified against Frappe v16.9.0 at `<bench>/apps/frappe`:
- `apps/frappe/frappe/__init__.py` (`__version__ = "16.9.0"`)
- `apps/frappe/frappe/public/js/frappe/request.js` (`frappe.call`, `frappe.xcall` both defined)
- `apps/frappe/frappe/desk/doctype/workspace/workspace.json`
- `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json` (created 2025-08-12, v16-only)
- `apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json`
- `apps/frappe/frappe/www/desk.py` and `apps/frappe/frappe/public/js/frappe/router.js`
- `apps/frappe/frappe/custom/doctype/custom_field/custom_field.py` (`create_custom_fields`)
- `apps/frappe/frappe/hooks.py` (`add_to_apps_screen`)
