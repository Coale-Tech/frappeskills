# Frappe CRM Frontend Architecture

The frontend (`crm/frontend/`) is a Vue3 SPA built on `frappe-ui`, served at
`/crm`, independent of Desk. It talks to the backend almost entirely through
one generic list/kanban API surface rather than per-DocType endpoints.

**CRM 2.x:** `frappe-ui` upgraded to `1.0.0-rc.2`. New major dependencies:
`@vue-flow/core` (workflow automation canvas), `@whatsapp/ui` (linked as
`link:../../whatsapp/ui` — builds from the whatsapp app's source tree),
`@tiptap/core` v3 (rich text), `@vueuse/core` v14.

## Directory layout

`frontend/src/`:

- `App.vue`, `main.js` — app bootstrap.
- `router.js` — Vue Router routes plus first-run setup wizard logic (see below).
- `socket.js` — realtime cache invalidation over Socket.IO.
- `stores/` — Pinia stores: `availability.ts` **(new CRM 2.x)**, `session.js`,
  `global.js`, `meta.js`, `notifications.js`, `organizations.js`, `settings.js`,
  `statuses.js`, `users.js`, `views.js`.
- `composables/` — large set; see `frontend/src/composables/` for full list.
  Key: `onboarding.js`, `noteView.ts`, `emailSubject.js`, `leadImport.js`.
- `pages/` — one component per route: `CallLogs.vue`, `Contact.vue`/`Contacts.vue`,
  `Dashboard.vue`, `DataImport.vue`/`DataImports.vue` **(new CRM 2.x)**,
  `Deal.vue`/`Deals.vue`, `Lead.vue`/`Leads.vue`, `Mobile*.vue` variants,
  `Notes.vue`, `Organization.vue`/`Organizations.vue`, `Setup.vue` **(new CRM 2.x)**.
  **Removed in CRM 2.x:** `Sentiment.vue`, `CalendarView.vue`, `AgentAnalytics.vue`,
  `Forecast.vue`.
- `data/`, `doctypes/`, `components/`, `utils/`, `types.ts`, `translation.js`.

## State: Pinia + frappe-ui `createResource`

```js
// stores/session.js
export const sessionStore = defineStore('crm-session', () => {
  let user = getCurrentUser()
  const login = createResource({ url: 'login', ... })
  const logout = createResource({
    url: 'logout',
    onSuccess() { window.location.href = '/crm' },
  })
  ...
})
```

Stores wrap `frappe-ui`'s `createResource`/`createListResource` rather than
hand-rolling `fetch`; a store's job is caching and exposing reactive state,
not building request payloads. `session.js` also exports `getCurrentUser()`
and `userResource` used across the app to check the logged-in user without
every component re-deriving it. New CRM-adjacent frontend work should add a
Pinia store the same way — one `defineStore('crm-<name>', () => {...})`
module wrapping the relevant resource(s) — rather than fetching directly
from a page/component.

## Realtime: socket.js

`initSocket()` opens a Socket.IO connection to
`<protocol>://<host><port>/<site_name>` (site name and socketio port come
from `window.site_name`/`window.socketio_port`, injected server-side) and
listens for a single `refetch_resource` event carrying `{cache_key}`. On
receipt it looks up that key via `frappe-ui`'s `getCachedResource`/
`getCachedListResource` and calls `.reload()` if found — the backend
triggers a `frappe.publish_realtime('refetch_resource', {cache_key:
...})` (standard Frappe realtime, not a CRM-specific socket protocol) to
push any list/document update to the frontend. A new resource that needs
live refresh just needs its cache key published this way; no new
frontend-side socket handler is required.

## Setup Wizard (CRM 2.x)

`router.js`'s `beforeEach` guard checks `FCRM Settings.setup_completed` via
`frappe.client.get_single_value` on first admin visit:

```js
export const SETUP_DONE_KEY = 'crm_setup_completed'
async function needsSetup() {
  if (localStorage.getItem(SETUP_DONE_KEY)) return false
  const completed = await call('frappe.client.get_single_value', { ... })
  return !completed
}
```

Admin users who have not completed setup are redirected to `/setup` (the
`Setup.vue` onboarding wizard). On upgrade, the `set_setup_completed_for_existing_sites`
patch sets `setup_completed = 1` to skip the wizard. This replaces the CRM 1.x
persona-capture wizard (which depended on Frappe Cloud telemetry opt-in — gone in 2.x).

## Backend surface: `api/doc.py`

The generic list/kanban/detail backend every DocType's Vue views call
through, instead of one endpoint per DocType:

| Function | Purpose |
|---|---|
| `sort_options(doctype: str)` | sortable field list for a list view |
| `get_filterable_fields(doctype: str)` | fields eligible for the filter UI |
| `get_group_by_fields(doctype: str)` | fields eligible for kanban/group-by |
| `get_quick_filters(doctype, cached)` / `update_quick_filters(...)` | per-user "quick filter" chips; new `CRM Global Settings` row stores the default |
| `get_data(...)` | the actual list/kanban row fetch, filters/order/paging applied |
| `add_seen(doctype, name)` **(CRM 2.x)** | marks a document as seen by the current user |
| `remove_assignments` / `get_assigned_users` | assignment sidebar |
| `get_fields(doctype, allow_all_fieldtypes=False)` | field metadata for form rendering |
| `get_linked_docs_of_document` / `remove_linked_doc_reference` | "linked documents" panel |
| `delete_bulk_docs(doctype, items, delete_linked=False)` | bulk-delete from a list view |

A custom DocType added to the CRM sidebar reuses this same surface (it is
generic over `doctype`) rather than needing bespoke endpoints — register it
with a `CRM Fields Layout`/`CRM View Settings` (see
[crm-customization.md](crm-customization.md)) and these functions already
know how to list, filter, and group it.

## Public Lead/Deal Forms: `api/form.py` (CRM 2.x)

`crm/api/form.py` builds public-facing lead/deal capture forms on top of
Frappe's built-in `Web Form` doctype (not a custom CRM Form doctype). The
builder in Settings → Forms creates/updates `Web Form` records scoped to
`CRM Lead` or `CRM Deal` only. Key endpoints:

| Function | Purpose |
|---|---|
| `save_form(name, form_doc)` | create or update a `Web Form` via the builder |
| `get_form_fields(document_type)` | mappable fields for the builder picker |
| `grant_guest_link_access(doctype)` | adds Guest `select` perm on a Link target so public dropdowns work |
| `link_field_guest_access(doctype)` | checks current Guest access (for builder warning) |
| `get_hidden_seed(document_type)` | mandatory system fields the form hides (e.g. Status) |

`_check_manager()` gates all write operations on `System Manager` or `Sales Manager`.
`_link_target_doctypes()` limits `grant_guest_link_access` to doctypes linked from
a CRM form field — the endpoint cannot open Guest access on arbitrary doctypes.
Custom apps can import `save_form` and `grant_guest_link_access` directly from
Python after `frappe.set_user("Administrator")` (see [crm-integrations.md](crm-integrations.md)).

## Sources

Verified against CRM 1.58.5 (16.35 bench) and CRM 2.0.0-dev (16.51 bench):

- `frontend/package.json` — `frappe-ui: 1.0.0-rc.2`, `@vue-flow/core`, `@whatsapp/ui: link:...`, `vite: ^8.2.0`, `vitest: ^4.1.10`
- `frontend/src/` directory listing — pages, stores, composables, components
- `frontend/src/router.js` — `SETUP_DONE_KEY`, `needsSetup`, `getSetupRedirect`, route list
- `frontend/src/stores/availability.ts` — new store (CRM 2.x)
- `crm/api/doc.py` — full whitelisted function list
- `crm/api/form.py` — `save_form`, `grant_guest_link_access`, `_check_manager`, `SEED_LAYOUT`, `SUPPORTED_FIELDTYPES`, `DENIED_FIELDNAMES`
- `crm/api/availability.py` — `validate_user`, `on_user_update`, `publish_availability`, `get_user_categories`
- `crm/fcrm/doctype/fcrm_settings/fcrm_settings.json` — `setup_completed` field
