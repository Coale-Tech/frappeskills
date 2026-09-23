# Frappe UI Components Reference

Index for the frappe-ui (Vue 3) component library, its data-fetching layer, and
the vanilla-JS Desk client APIs. Split by topic so each file stays readable:

- [frappe-ui-core-components.md](frappe-ui-core-components.md) — project setup,
  the component catalog (Button, FormControl, Dialog, ListView, Badge, Alert,
  Autocomplete, TextEditor, …), and the navigation components
- [frappe-ui-data-fetching.md](frappe-ui-data-fetching.md) — `createResource` /
  `createListResource` / `createDocumentResource`, Pinia store patterns, Vue
  Router setup, authentication, Socket.io, utilities, and directives
- [frappe-desk-client-apis.md](frappe-desk-client-apis.md) — the Desk
  (`frappe.*`) vanilla-JS APIs: `frappe.call`, `frappe.db`, `frappe.ui.Dialog`,
  form client scripts, and list customization

**Documentation:** https://ui.frappe.io
**GitHub:** https://github.com/frappe/frappe-ui

> **Scope — two distinct UIs.** The first two files above document
> **frappe-ui** (the Vue 3 library used to build *standalone SPA frontends*
> mounted under an app, e.g. `crm`, `hrms/frontend`, `helpdesk`). It is **not**
> the Frappe Desk. Desk (`/app/*`) is rendered by vanilla-JS `frappe.*` APIs
> (`frappe.ui.form`, `frappe.ui.Dialog`, `frappe.call`, `frappe.db`, control
> classes) — covered in `frappe-desk-client-apis.md`. Do not mix `frappe-ui`
> imports into Desk client scripts or vice-versa.
>
> Verified against **frappe-ui `0.1.261`** as vendored in
> `apps/crm/frontend/node_modules/frappe-ui` (also used by
> `apps/hrms/frontend`). Exact exports/props vary by frappe-ui version — treat
> component prop lists as guidance and confirm against the installed version.

## Desk vs frappe-ui — quick map

| Concern | Desk (`frappe.*`) | frappe-ui (Vue) |
|---|---|---|
| Server call | `frappe.call` / `frappe.xcall` | `call()` / `createResource` |
| List data | `frappe.db.get_list` | `createListResource` |
| Single doc | `frappe.db.get_doc` / `frm` | `createDocumentResource` |
| Modal | `new frappe.ui.Dialog(...)` | `<Dialog>` component |
| Form | `frappe.ui.form.on` + `frm` | hand-built `<FormControl>` + resource |
| List customization | `frappe.listview_settings` | `<ListView>` props |
| Toast/alert | `frappe.show_alert` / `frappe.msgprint` | `toast()` / `<Alert>` |
