# Workspace Patterns Guide (v16)

This guide covers the **two-layer navigation system** in Frappe v16: Sidebar and Workspace (dashboard). Desktop Icons are additive app-level tiles; they are auto-generated from `add_to_apps_screen`.

## Architecture Overview

```
Desktop Icon (App)          ← App tile on /desk home
├── Desktop Icon (Link)     ← Child: opens Workspace Sidebar
├── Desktop Icon (Link)     ← Child: opens SPA frontend (External)
└── Desktop Icon (Link)     ← Child: links to another sidebar

Sidebar (16.51) / Workspace Sidebar (<=16.35) ← Left sidebar navigation
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
├── my_module/
│   ├── sidebar/
│   │   └── my_module/
│   │       └── my_module.json         ← Sidebar (16.51) navigation
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
- Mismatch causes orphan deletion on `bench --site <site> migrate`!

## 1. Desktop Icons

Desktop Icon's `icon_type` is `Link` / `Folder` / `App`; its `link_type` is
only `Workspace Sidebar` or `External` — there is **no** `"Workspace"`
option (verified: `DF.Literal["Workspace Sidebar", "External"]` in
`desktop_icon.py`). Only `App`/`Folder` icons can be a `parent_icon`
(enforced by the `parent_icon` link query in `desktop_icon.js`).

### Parent Icon (icon_type: "App")

Creates the app tile on the desk home screen. App tiles always use
`link_type: "External"` with a fixed `link` route (the `route` from the
app's `add_to_apps_screen` hook) — never `link_to`. Real example
(`apps/frappe/frappe/desktop_icon/framework.json`):

```json
{
 "app": "frappe",
 "doctype": "Desktop Icon",
 "icon_type": "App",
 "idx": 0,
 "label": "Framework",
 "link": "/desk/build",
 "link_type": "External",
 "logo_url": "/assets/frappe/images/frappe-framework-logo.svg",
 "name": "Framework",
 "owner": "Administrator",
 "standard": 1
}
```

`create_desktop_icons_from_installed_apps()` (`desktop_icon.py`) creates
this automatically for every installed app that defines `add_to_apps_screen`
— you normally don't hand-author it; ship the hook instead (see "6. hooks.py
Configuration" below).

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

`link_to` here is a Dynamic Link resolved by `link_type`, so it must name an
existing **Workspace Sidebar** document — by convention the sidebar and its
matching Workspace share the same name (see "2. Workspace Sidebar" below).

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

## 2. Sidebar (navigation)

> **Version note**: 16.51 introduces a new `Sidebar` doctype and path. The old `Workspace Sidebar`
> doctype and `workspace_sidebar/` path still load but are deprecated — they fall back to an
> auto-generated sidebar. Migrate with: `bench --site <site> convert-sidebar-fixtures --app <app>`

### 2a. New format (16.51): `<module>/sidebar/<scrubbed>/<scrubbed>.json`, doctype `Sidebar`

```json
{
 "app": "my_app",
 "doctype": "Sidebar",
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
   "label": "Invoicing", "link_type": "DocType",
   "show_arrow": 0, "type": "Section Break"
  },
  {
   "child": 1, "collapsible": 1, "indent": 0, "keep_closed": 0,
   "label": "My DocType", "link_to": "My DocType", "link_type": "DocType",
   "show_arrow": 0, "type": "Link"
  }
 ]
}
```

`Sidebar` parent fields: `module` (Link), `title` (autoname = `name`), `header_icon`, `app` (Autocomplete), `items` (child: `Sidebar Item`), `standard`, `merged_from` (Long Text). The file lives at `<app>/<module>/sidebar/<frappe.scrub(title)>/<frappe.scrub(title)>.json` — the ordinary doc-files walk imports it automatically; no special folder or command is needed after migration.

### 2b. Old format (<=16.35, deprecated 16.51): `workspace_sidebar/<module>.json`, doctype `Workspace Sidebar`

The old `Workspace Sidebar` doctype and `workspace_sidebar/` directory continue to work in 16.51 but fall back to a generated sidebar when the app has not converted. Run the migration command to produce proper `Sidebar` fixtures from the old ones; the old folder is left in place and can be deleted afterward.

### Sidebar Item fields (both `Workspace Sidebar Item` and `Sidebar Item`)

| Field | Type | Description |
|-------|------|-------------|
| `type` | Select: `Link` / `Section Break` / `Spacer` | Item kind |
| `child` | Check | 1 = nested under the preceding Section Break |
| `indent` | Check | Section-Break-only |
| `collapsible` | Check | Section-Break-only |
| `keep_closed` | Check | Section-Break-only; 1 = collapsed by default |
| `label` | Data | Display text |
| `link_type` | Select: `DocType` / `Page` / `Report` / `Workspace` / `Dashboard` / `URL` | Target kind |
| `link_to` | Dynamic Link (options: `link_type`) | Target name |
| `icon` | Icon | Item icon |
| `url` | Data | When `link_type == "URL"` |
| `navigate_to_tab` | Autocomplete | Jump to a Workspace tab on click |
| `show_arrow` | Check | Show expand arrow |
| `filters` / `route_options` | Code JSON | Preset list filters / route options on click |
| `open_in_new_tab` | Check | (16.51, `Sidebar Item` only) |

> Verified: `apps/frappe/frappe/desk/doctype/sidebar/sidebar.json`, `apps/frappe/frappe/desk/doctype/sidebar_item/sidebar_item.json` (16.51). Old: `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json`. Boot changed: `bootinfo.module_sidebars` replaces `bootinfo.workspace_sidebar_item` in 16.51 (`frappe/boot.py`). Companion doctypes added in 16.51: `Custom Sidebar` (per-user sidebar override), `Dock`/`Dock Item` (app dock tray).


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
    # Flat dict: each top-level key becomes `window[key]` client-side via the
    # `jinjaBootData` plugin's `{% for key in boot %}` loop (below).
    # CRM/HRMS `www/<app>.py` use the same shape; neither nests a `session`
    # sub-object. The current user comes from the `user_id` cookie.
    bootinfo = frappe._dict({
        "site_name": frappe.local.site,
        "csrf_token": frappe.sessions.get_csrf_token(),
    })
    bootinfo.lang = frappe.local.lang
    load_translations(bootinfo)
    return bootinfo
```

The current user is read from the `user_id` cookie, not boot data — see
[authentication-client.md](../../frappe-api-development/references/authentication-client.md)
(Session/User State).

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

- [ ] Add `add_to_apps_screen` to `hooks.py` (App icon auto-generated on `bench migrate` with `developer_mode`)
- [ ] **(16.51)** Create sidebar at `<module>/sidebar/<name>/<name>.json` with `"doctype": "Sidebar"`
- [ ] **(<=16.35)** Create sidebar at `workspace_sidebar/<module>.json` with `"doctype": "Workspace Sidebar"`
- [ ] **(16.51 migration)** Run `bench --site <site> convert-sidebar-fixtures --app <app>` to migrate old fixtures
- [ ] Create `module/workspace/<name>/<name>.json` dashboard
- [ ] Create `public/images/` app logo SVG
- [ ] Create `www/` entry point (`.html` + `.py`) for SPA (if applicable)
- [ ] Add `website_route_rules` to `hooks.py` for the SPA route (if applicable)
- [ ] Run `bench --site <site> migrate` then `bench build`


## Sources

Verified against Frappe v16.35.0 (<=16.35 entries) and v16.51.1 (16.51 entries) at `apps/frappe`:
- `apps/frappe/frappe/desk/doctype/workspace/workspace.json` — Workspace DocType fields & child tables
- `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.json` (<=16.35, still present in 16.51)
- `apps/frappe/frappe/desk/doctype/workspace_sidebar_item/workspace_sidebar_item.json`
- `apps/frappe/frappe/desk/doctype/sidebar/sidebar.json` (16.51) — `Sidebar` doctype: `module`, `title`, `header_icon`, `app`, `items`, `standard`, `merged_from`
- `apps/frappe/frappe/desk/doctype/sidebar_item/sidebar_item.json` (16.51) — `Sidebar Item` child table fields
- `apps/frappe/frappe/desk/doctype/sidebar/convert_fixtures.py` (16.51) — `OLD_FIXTURE_FOLDER = "workspace_sidebar"`, `export_path()` writes `<module>/sidebar/<scrubbed>/<scrubbed>.json`
- `apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.json` — `link_type` still `"Workspace Sidebar" | "External"` in 16.51
- `apps/frappe/frappe/public/js/frappe/views/workspace/blocks/index.js` — 10 content block types
- `apps/frappe/frappe/boot.py:249-250` (16.51) — `bootinfo.module_sidebars = get_module_sidebars()`
- `apps/frappe/frappe/website/workspace/website/website.json` — real content/links/number_cards example
- `apps/frappe/frappe/hooks.py` — `add_to_apps_screen`
