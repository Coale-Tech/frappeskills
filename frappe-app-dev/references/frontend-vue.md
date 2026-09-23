# Vue SPA Frontend

Entry point for building a standalone Vue 3 + frappe-ui SPA inside a Frappe app.
Read this to wire and build one; then go deeper:

- **[frontend-architecture.md](./frontend-architecture.md)** — the full SPA
  blueprint: bootstrap order, stores vs composables vs data layer, the
  `useDocument` facade, router and guards, socket-driven invalidation, vite
  wiring, TypeScript conventions.
- **[frappe-ui-components.md](./frappe-ui-components.md)** — component and
  data-layer catalog: `createResource`, `createListResource`,
  `createDocumentResource`, form controls, `LinkField`, `Dialog`, toasts.

## When an SPA is the wrong choice

Standard Desk already gives you list views, filters, form layouts, permissions,
keyboard navigation and print formats for free. Build an SPA only for a
customer-facing portal, a bespoke dashboard, or a workflow Desk genuinely
cannot express. For everything else see
[frontend-desk.md](./frontend-desk.md) and
[listview-patterns.md](./listview-patterns.md) — customizing Desk is cheaper to
build and cheaper to keep working across upgrades.

---

Some apps have a standalone Vue 3 frontend in a `frontend/` directory. This is a full SPA that talks to Frappe via API calls.

## Structure

```
apps/<app>/
  frontend/
    src/
      main.js          # app entry
      App.vue          # root component
      pages/           # route views
      components/      # reusable components
      router.js        # vue-router setup
      composables/     # Vue composables
    index.html
    vite.config.ts
    package.json
    tailwind.config.js
  <app>/
    hooks.py           # website_route_rules to serve the SPA
```

## Key dependencies

- `vue` (3.x), `vue-router`, `frappe-ui` — UI framework with Frappe-aware components
- `vite` with `@vitejs/plugin-vue` — build tool
- `frappe-ui` vite plugin — handles dev proxy to Frappe backend, type generation

## vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(async () => {
  const { default: frappeui } = await import('frappe-ui/vite')

  return {
    plugins: [
      frappeui({
        frontendRoute: '/myapp',       // route prefix for the SPA
        frappeTypes: {                  // auto-generate TypeScript types for DocTypes
          input: {
            myapp: ['my_doctype'],
          },
        },
      }),
      vue(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  }
})
```

## hooks.py route

Wire the SPA route in `hooks.py` so Frappe serves the Vue app:

```python
website_route_rules = [
    {"from_route": "/myapp/<path:app_path>", "to_route": "myapp"},
]
```

## Development

```bash
cd apps/<app>/frontend
yarn install
yarn dev            # starts Vite dev server with HMR (proxies API to Frappe)
```

The Vite dev server proxies `/api` calls to the running Frappe backend (`bench start` must be running).

## Production build

```bash
cd apps/<app>/frontend
yarn build          # outputs to apps/<app>/<app>/public/frontend
```

Or via bench:
```bash
bench build --app <app-name>
```

## Calling Frappe APIs from Vue

frappe-ui provides composables for data fetching:

```javascript
import { useCall, useList, useDoc } from 'frappe-ui'

// API call
const result = useCall({
  url: '/api/v2/method/myapp.api.get_summary',
  method: 'POST',
  immediate: false,        // set true to call on mount
  onSuccess: (data) => {
    console.log(data)
  },
})
result.fetch({ status: 'Draft' })  // call manually with params

// Document list
const expenses = useList({
  doctype: 'Expense',
  fields: ['name', 'title', 'amount', 'status'],
  filters: { status: 'Draft' },
})
// expenses.data — reactive list
// expenses.reload() — refetch

// Single document
const expense = useDoc({
  doctype: 'Expense',
  name: 'EXP-0001',
})
// expense.doc — reactive document data
// expense.doc.title — access fields
// expense.setValue.submit({ status: 'Approved' }) — update fields
```

## Session and CSRF

Requests from the SPA carry the Frappe session cookie. For non-GET calls
include the CSRF token Frappe injects into the served page
(`window.csrf_token`); `frappe-ui`'s request layer does this for you, which is
one more reason to route every call through `createResource` / `useCall`
instead of raw `fetch`.

## Checklist

- Route wired in `hooks.py` via `website_route_rules`.
- `frontendRoute` in the vite config matches that route prefix.
- Every data path goes through a frappe-ui resource, not raw `fetch`.
- Loading, error and empty states exist for each resource.
- Design tokens used rather than hardcoded colours or spacing — see
  [design-tokens.md](./design-tokens.md).
- `bench build --app <app>` runs clean before shipping.
