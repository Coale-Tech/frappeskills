---
name: frappe-frontend-development
description: Build Vue 3 frontends with frappe-ui including components, data fetching, routing, stores, and portal pages. Use when implementing a custom SPA or portal interface on top of Frappe.
---

# Frappe Frontend Development

Build a Vue 3 + frappe-ui single-page app served by a Frappe site — or a simpler
portal page when an SPA is overkill.

## When to use

- Building a custom dashboard, portal, or customer-facing app
- Consuming Frappe data with `createResource` / `createListResource`
- Structuring stores, router, sockets and TypeScript in an SPA
- Writing a website/portal page without a build step

## Inputs required

- Whether Desk already suffices (if yes, stop — use [`frappe-desk-customization`](../frappe-desk-customization/SKILL.md))
- Route prefix and auth model (logged-in users, guests, or both)
- The whitelisted endpoints the UI will call
- Design tokens or theme to follow

## Procedure

### 0) Choose the frontend

| Scenario | Choice |
|---|---|
| Simple CRUD | Desk — write no frontend |
| Custom dashboard | Vue + frappe-ui |
| Customer-facing portal | Vue + frappe-ui, or website pages |
| Multi-step workflow | Vue + frappe-ui + a store |
| Content page, no interactivity | `www/` portal page |

### 1) Scaffold the SPA

```bash
cd apps/<app> && npx degit frappe/frappe-ui/templates/spa frontend
cd frontend && yarn install
```

Wire the build output and the route in `hooks.py`
(`website_route_rules`, `app_include_js`) — see
[references/frontend-vue.md](references/frontend-vue.md) and
`assets/page.js.template`.

### 2) Fetch data with the data layer

```javascript
import { createResource, createListResource } from 'frappe-ui'

const orders = createListResource({
  doctype: 'Sales Order',
  fields: ['name', 'customer', 'grand_total', 'status'],
  filters: { docstatus: 1 },
  pageLength: 20,
  auto: true,
})

const approve = createResource({
  url: 'my_app.api.approve_order',
  onSuccess: () => orders.reload(),
})
```

Never use raw `fetch`. Catalog of resources and components:
[references/frappe-ui-components.md](references/frappe-ui-components.md)
(index — see also `frappe-ui-core-components.md`, `frappe-ui-data-fetching.md`,
and `frappe-desk-client-apis.md`).

### 3) Structure the app

Stores, router, socket wiring, TypeScript layout:
[references/frontend-architecture.md](references/frontend-architecture.md).
Shell, sidebar and navigation:
[references/app-shell-patterns.md](references/app-shell-patterns.md).
SPA page and component shapes:
[references/frappe-ui-spa-page-patterns.md](references/frappe-ui-spa-page-patterns.md),
[references/component-patterns.md](references/component-patterns.md).
Start from `assets/App.vue.template`, `assets/ListPage.vue.template`,
`assets/DetailPage.vue.template`, `assets/FormWizard.vue.template`.

### 4) Handle every state

Loading, error, and empty states are required, not optional — every resource has
`.loading`, `.error`, and a possibly-empty `.data`.

### 5) Style with tokens

Use Espresso tokens and the shared Tailwind preset
(`assets/tailwind.config.js.template`); never hardcode colors, spacing, or fonts
— [`frappe-design-tokens`](../frappe-design-tokens/SKILL.md).

### 6) Build

```bash
cd apps/<app>/frontend && yarn build
bench --site <site> clear-cache
```

## Verification

- [ ] Route loads in the browser for the intended auth state
- [ ] Data renders from real site data, not fixtures
- [ ] Loading, error and empty states each render correctly
- [ ] Mutations refresh the affected list/detail view
- [ ] A user without permission sees a handled error, not a blank screen
- [ ] No hardcoded colors/spacing; tokens only
- [ ] Production build succeeds and is served by the site

## Failure modes / debugging

- **Blank page after build**: route not registered in `hooks.py`, or the built `index.html` path is wrong
- **`createResource` returns `undefined`**: the whitelisted method returned a `Response` object instead of a dict
- **403 on every call**: session not shared — check the site origin and that the user is logged in
- **Stale UI after a mutation**: no `reload()` in `onSuccess`
- **Styles missing**: Tailwind preset not applied, or the build didn't run
- **Socket events never arrive**: socket.io not running on the bench

## Escalation

- Endpoint design or permission errors → [`frappe-api-development`](../frappe-api-development/SKILL.md)
- Proven app shells and UX patterns → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- Large multi-entity product → [`frappe-enterprise-patterns`](../frappe-enterprise-patterns/SKILL.md)
- Desk would be cheaper → [`frappe-desk-customization`](../frappe-desk-customization/SKILL.md)

## References

- [references/frontend-vue.md](references/frontend-vue.md) - SPA entry point, build wiring, when to choose it
- [references/frontend-architecture.md](references/frontend-architecture.md) - Stores, data layer, router, sockets, TS
- [references/frappe-ui-components.md](references/frappe-ui-components.md) - Component/data-layer catalog index
- [references/frappe-ui-core-components.md](references/frappe-ui-core-components.md) - Project setup and component catalog
- [references/frappe-ui-data-fetching.md](references/frappe-ui-data-fetching.md) - Resources, stores, router, utilities
- [references/frappe-desk-client-apis.md](references/frappe-desk-client-apis.md) - Desk `frappe.*` vanilla-JS APIs
- [references/component-patterns.md](references/component-patterns.md) - Lists, forms, dialogs, empty states
- [references/page-patterns.md](references/page-patterns.md) - Page kind index: Desk Pages, Web/Portal pages
- [references/frappe-ui-spa-page-patterns.md](references/frappe-ui-spa-page-patterns.md) - frappe-ui SPA List/Detail/Form page layouts
- [references/app-shell-patterns.md](references/app-shell-patterns.md) - Sidebar, nav, layout skeleton
- [references/frontend-portal.md](references/frontend-portal.md) - Website/portal pages without a build step
- `assets/App.vue.template`, `assets/ListPage.vue.template`, `assets/DetailPage.vue.template`, `assets/FormWizard.vue.template`, `assets/page.js.template`, `assets/useVersion.js.template`, `assets/tailwind.config.js.template`

## Guardrails

- **Don't build an SPA when Desk suffices**: Desk is free maintenance
- **`createResource`, never raw `fetch`**: you lose auth, errors and caching
- **Composition API with `<script setup>`**: Options API is inconsistent with the ecosystem
- **Every resource handles loading, error and empty**
- **Design tokens only**: no hardcoded hex, spacing or font stacks
- **Rebuild after changes**: `yarn build` then `clear-cache`

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Raw `fetch` calls | No auth, no error handling | `createResource` |
| Vue Options API | Ecosystem mismatch | `<script setup>` Composition API |
| No empty state | Blank screen on zero rows | Render an explicit empty state |
| Hardcoded colors | Breaks theming | Espresso tokens |
| Endpoint returning `Response` | Resource data is `undefined` | Return a dict |
| Permission checks only in the UI | API remains open | Gate on the server |
| Building an SPA for simple CRUD | Maintenance for nothing | Use Desk |
