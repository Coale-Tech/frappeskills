# Workspace Patterns Guide (v16)

This guide covers the **three-layer navigation system** in Frappe v16: Desktop Icons, Workspace Sidebar, and Workspace (dashboard).

## Architecture Overview

```
Desktop Icon (App)          ← App tile on /desk home
├── Desktop Icon (Link)     ← Child: opens Workspace Sidebar
├── Desktop Icon (Link)     ← Child: opens SPA frontend (External)
└── Desktop Icon (Link)     ← Child: links to another sidebar

Workspace Sidebar           ← Left sidebar navigation (collapsible sections)
├── Link items              ← DocType, Report, URL links
└── Section Breaks          ← Collapsible group headers

Workspace                   ← Main content dashboard (shortcuts, cards, charts)
├── shortcuts[]             ← Quick action tiles
├── links[]                 ← Card sections with DocType/Report links
├── content                 ← JSON layout grid
└── number_cards[]          ← KPI number cards
```

## File Locations (Critical)

```
my_app/
├── desktop_icon/
│   ├── my_app.json                    ← Parent App icon
│   ├── my_module.json                 ← Child Link to sidebar
│   └── open_my_app.json               ← Child External link to SPA
├── workspace_sidebar/
│   └── my_module.json                 ← Sidebar navigation
├── my_module/                         ← Module directory
│   └── workspace/
│       └── my_module/
│           └── my_module.json         ← Workspace dashboard
├── public/
│   └── images/
│       └── my-app-logo.svg            ← App icon SVG
└── www/
    ├── my-app.html                    ← SPA entry point (Jinja template)
    └── my-app.py                      ← Boot data provider
```

**CRITICAL: Filename must match `frappe.scrub(doc.name)`**
- "Construction Management" → `construction_management.json`
- Mismatch causes orphan deletion on `bench migrate`!

## 1. Desktop Icons

### Parent Icon (icon_type: "App")

Creates the app tile on desk home screen.

```json
{
 "app": "my_app",
 "doctype": "Desktop Icon",
 "icon_type": "App",
 "idx": 15,
 "label": "My App",
 "link_to": "My Module",
 "link_type": "Workspace",
 "logo_url": "/assets/my_app/images/my-app-logo.svg",
 "name": "My App",
 "owner": "Administrator",
 "standard": 1
}
```

### Child Icon - Workspace Sidebar Link

```json
{
 "app": "my_app",
 "doctype": "Desktop Icon",
 "icon_type": "Link",
 "idx": 0,
 "label": "My Module",
 "link_to": "My Module",
 "link_type": "Workspace Sidebar",
 "logo_url": "/assets/my_app/images/my-app-logo.svg",
 "name": "My Module",
 "owner": "Administrator",
 "parent_icon": "My App",
 "standard": 1
}
```

### Child Icon - External SPA Link

Links to a Vue.js frontend SPA (like a custom app).

```json
{
 "app": "my_app",
 "doctype": "Desktop Icon",
 "icon_type": "Link",
 "idx": 1,
 "label": "Open My App",
 "link": "/my-app",
 "link_type": "External",
 "logo_url": "/assets/my_app/images/my-app-logo.svg",
 "name": "Open My App",
 "owner": "Administrator",
 "parent_icon": "My App",
 "standard": 1
}
```

**Note**: External links use `link` field (not `link_to`).

## 2. Workspace Sidebar

Left sidebar with collapsible sections. Filed in `workspace_sidebar/` directory.

```json
{
 "app": "my_app",
 "doctype": "Workspace Sidebar",
 "header_icon": "building",
 "module": "My Module",
 "name": "My Module",
 "owner": "Administrator",
 "standard": 1,
 "title": "My Module",
 "items": [
  {
   "child": 0, "collapsible": 1, "indent": 0, "keep_closed": 0,
   "label": "Dashboard", "link_to": "My Module", "link_type": "Workspace",
   "show_arrow": 0, "type": "Link", "icon": "home"
  },
  {
   "child": 0, "collapsible": 1, "icon": "dollar-sign",
   "indent": 1, "keep_closed": 1,
   "label": "Section Name", "link_type": "DocType",
   "show_arrow": 0, "type": "Section Break"
  },
  {
   "child": 1, "collapsible": 1, "indent": 0, "keep_closed": 0,
   "label": "My DocType", "link_to": "My DocType", "link_type": "DocType",
   "show_arrow": 0, "type": "Link"
  },
  {
   "child": 1, "collapsible": 1, "indent": 0, "keep_closed": 0,
   "label": "My Report", "link_to": "My Report", "link_type": "Report",
   "show_arrow": 0, "type": "Link"
  }
 ]
}
```

### Sidebar Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | "Link" / "Section Break" | Item type |
| `child` | 0/1 | 0 = top-level, 1 = nested under Section Break |
| `indent` | 0/1 | 0 for links, 1 for Section Break headers |
| `collapsible` | 1 | Always 1 |
| `keep_closed` | 0/1 | 1 = collapsed by default |
| `label` | string | Display text |
| `link_to` | string | Target DocType/Report/Workspace name |
| `link_type` | string | "DocType", "Report", "Workspace", "URL" |
| `icon` | string | Icon name (Espresso/Lucide) — used on Section Breaks |
| `url` | string | Target when `link_type` = "URL" |
| `navigate_to_tab` | 0/1 | Navigate to a specific Workspace tab |
| `collapsible_column` | 0/1 | Column-level collapse |
| `display_depends_on` | string | `eval:` condition to show/hide the item |
| `filters` / `route_options` | JSON | Preset list filters / route options applied on click |

> Verified against `apps/frappe/frappe/desk/doctype/workspace_sidebar_item/workspace_sidebar_item.json`
> (child of `Workspace Sidebar`, both **new in v16**, created 2025-08-12). The parent `Workspace Sidebar`
> fields are: `title` (autoname `field:title` → the `name`), `header_icon`, `for_user` (Link→User),
> `module`, `standard`, `app`, `items` (child table). See `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json`.

## 3. Workspace (Dashboard)

The main content area with shortcuts, cards, and number cards. Lives in `module/workspace/<name>/<name>.json`.

```json
{
 "doctype": "Workspace",
 "icon": "building",
 "label": "My Module",
 "module": "My Module",
 "name": "My Module",
 "public": 1,
 "content": "[{\"type\":\"shortcut\",\"data\":{\"shortcut_name\":\"My Shortcut\",\"col\":3}}]",
 "shortcuts": [
  {
   "label": "Open Frontend",
   "link_to": "/my-app",
   "type": "URL",
   "color": "#0284c7"
  },
  {
   "label": "My DocType",
   "link_to": "My DocType",
   "type": "DocType",
   "doc_view": "List"
  },
  {
   "label": "My Report",
   "link_to": "My Report",
   "type": "Report",
   "is_query_report": 1
  }
 ],
 "links": [
  {
   "label": "Card Section Name",
   "link_type": "DocType",
   "type": "Card Break"
  },
  {
   "label": "My DocType",
   "link_to": "My DocType",
   "link_type": "DocType",
   "onboard": 1,
   "type": "Link"
  }
 ],
 "number_cards": [],
 "charts": []
}
```

### Workspace `content` — v16 Block Schema (source-verified)

The `content` field is a **hidden Long Text** on the Workspace DocType
(`apps/frappe/frappe/desk/doctype/workspace/workspace.json`, default `"[]"`). It stores an **EditorJS-style
JSON array of blocks** that lays out the dashboard grid. Each block is:

```json
{ "id": "<random-10-char-id>", "type": "<block_type>", "data": { "col": <1-12>, ...typeSpecific } }
```

- `id` — random string (any unique id; EditorJS generates it).
- `col` — column span out of a 12-column grid.
- The named entity in `data` (e.g. `shortcut_name`, `chart_name`) MUST match a row in the corresponding
  child table (`shortcuts`, `charts`, `number_cards`, `links`, `quick_lists`, `custom_blocks`).

**All 10 block types** (from `apps/frappe/frappe/public/js/frappe/views/workspace/blocks/index.js`):

| `type` | `data` payload (besides `col`) | Backing child table |
|--------|-------------------------------|---------------------|
| `header` | `text` (HTML, e.g. `"<span class=\"h2\">Hi,</span>"`) | — |
| `paragraph` | `text` (HTML) | — |
| `card` | `card_name` | `links` (Card Break groups) |
| `chart` | `chart_name` | `charts` |
| `shortcut` | `shortcut_name` | `shortcuts` |
| `number_card` | `number_card_name` | `number_cards` |
| `quick_list` | `quick_list_name` | `quick_lists` |
| `custom_block` | `custom_block_name` | `custom_blocks` |
| `onboarding` | `onboarding_name` | (Module Onboarding) |
| `spacer` | — | — |

**Real example** (from `apps/frappe/frappe/website/workspace/website/website.json`):

```json
[
  {"id":"6zVvGE_xaw","type":"chart","data":{"chart_name":"Website Visits","col":12}},
  {"id":"_cD8O3c7OX","type":"number_card","data":{"number_card_name":"Published Web Pages","col":4}},
  {"id":"7NNFjUlDOJ","type":"number_card","data":{"number_card_name":"Published Web Forms","col":4}}
]
```

Header/paragraph example (from `apps/frappe/frappe/core/workspace/welcome_workspace/welcome_workspace.json`):

```json
[
  {"id":"2eyXSHwMTE","type":"header","data":{"text":"<span class=\"h2\">Hi,</span>","col":12}},
  {"id":"ZusKvFOXgu","type":"paragraph","data":{"text":"...","col":12}}
]
```

> In a `.json` fixture the whole array is stored **as an escaped JSON string** (the DocType field is Long Text),
> e.g. `"content": "[{\"id\":\"...\",\"type\":\"chart\",...}]"`.

### Workspace DocType Fields (v16, source-verified)

From `apps/frappe/frappe/desk/doctype/workspace/workspace.json` `field_order`:
`label` (Name, unique reqd — the `name`), `title` (reqd), `sequence_id`, `for_user`, `parent_page` (Link→Workspace),
`module`, `app`, `type` (**reqd** Select `Workspace`/`Link`/`URL`), `link_type`, `link_to`, `external_link`,
`icon`, `indicator_color`, `restrict_to_domain`, `hide_custom`, `public`, `is_hidden`, `content`,
and the child tables: `charts` (→Workspace Chart), `shortcuts` (→Workspace Shortcut), `links` (→Workspace Link),
`number_cards` (→Workspace Number Card), `quick_lists` (→Workspace Quick List),
`custom_blocks` (→Workspace Custom Block), `roles` (→Has Role).

- **`type`**: a Workspace is normally `Workspace` (a dashboard). Set `type: "Link"` (+`link_type`/`link_to`) or
  `type: "URL"` (+`external_link`) to make the Workspace itself act as a nav shortcut. **New in v16.**
- **`link_to`** on the Workspace is a `Dynamic Link` keyed by `link_type` (`DocType`/`Page`/`Report`).

## 4. SPA Frontend Entry Point

### www/my-app.py (Boot data provider)

```python
import frappe
from frappe.boot import load_translations

no_cache = 1

def get_context(context):
    csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()
    context = frappe._dict()
    context.csrf_token = csrf_token
    context.boot = get_boot()
    return context

@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
    if not frappe.conf.developer_mode:
        frappe.throw(frappe._("This method is only meant for developer mode"))
    return get_boot()

def get_boot():
    bootinfo = frappe._dict({
        "site_name": frappe.local.site,
        "csrf_token": frappe.sessions.get_csrf_token(),
    })
    bootinfo.lang = frappe.local.lang
    load_translations(bootinfo)
    bootinfo.frappe = frappe._dict({
        "session": frappe._dict({
            "user": frappe.session.user,
            "sid": frappe.session.sid,
        }),
        "csrf_token": frappe.sessions.get_csrf_token(),
        "user": frappe.session.user,
    })
    return bootinfo
```

### www/my-app.html (Auto-generated by Vite build)

The `frappe-ui/vite` plugin auto-generates this file during build. It contains:
- Asset references (JS/CSS with content hashes)
- Jinja template for boot data injection

## 5. Vite Config with frappe-ui/vite

```javascript
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'

export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: true,        // Proxy API calls to Frappe backend
      jinjaBootData: true,      // Inject boot data via Jinja
      lucideIcons: true,        // Auto-import Lucide icons
      buildConfig: {
        indexHtmlPath: '../my_app/www/my-app.html',  // Output www HTML
        emptyOutDir: true,
        outDir: '../my_app/public/frontend',
      },
    }),
    vue(),
  ],
  build: {
    outDir: '../my_app/public/frontend',
    emptyOutDir: true,
    target: 'es2015',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

## 6. hooks.py Configuration

```python
# App screen tile
add_to_apps_screen = [
    {
        "name": "my_app",
        "logo": "/assets/my_app/images/my-app-logo.svg",
        "title": "My App",
        "route": "/my-app",  # SPA route, or "/desk/my-module" for desk
    }
]

# SPA routing
website_route_rules = [
    {"from_route": "/my-app/<path:app_path>", "to_route": "my-app"},
    {"from_route": "/my-app", "to_route": "my-app"},
]
```

## Checklist for New App Navigation

- [ ] Create `desktop_icon/` parent App icon JSON
- [ ] Create `desktop_icon/` child Workspace Sidebar link JSON
- [ ] Create `desktop_icon/` child External link to SPA (if applicable)
- [ ] Create `workspace_sidebar/` with sections and links
- [ ] Create `module/workspace/<name>/<name>.json` dashboard
- [ ] Create `public/images/` app logo SVG
- [ ] Create `www/` entry point (`.html` + `.py`) for SPA
- [ ] Update `hooks.py` with `add_to_apps_screen` and `website_route_rules`
- [ ] Use `frappe-ui/vite` plugin in `vite.config.mjs`
- [ ] Run `npm run build` then `bench migrate` then `bench build`

## Sources

Verified against Frappe v16.9.0 at `<bench>/apps/frappe`:
- `apps/frappe/frappe/desk/doctype/workspace/workspace.json` — Workspace DocType fields & child tables
- `apps/frappe/frappe/desk/doctype/workspace_link/workspace_link.json`
- `apps/frappe/frappe/desk/doctype/workspace_shortcut/workspace_shortcut.json`
- `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json` (v16-only, created 2025-08-12)
- `apps/frappe/frappe/desk/doctype/workspace_sidebar_item/workspace_sidebar_item.json`
- `apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json`
- `apps/frappe/frappe/public/js/frappe/views/workspace/blocks/index.js` — the 10 content block types
- `apps/frappe/frappe/website/workspace/website/website.json` — real content/links/number_cards example
- `apps/frappe/frappe/core/workspace/welcome_workspace/welcome_workspace.json` — header/paragraph example
- `apps/frappe/frappe/hooks.py` — `add_to_apps_screen`
