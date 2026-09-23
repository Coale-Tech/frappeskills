# Frappe UI Components Reference

Complete reference for frappe-ui Vue 3 component library, data fetching resources, and integration patterns.

**Documentation:** https://ui.frappe.io
**GitHub:** https://github.com/frappe/frappe-ui

> **Scope — two distinct UIs.** This file's top section documents **frappe-ui** (the Vue 3 library used to build *standalone SPA frontends* mounted under an app, e.g. `crm`, `hrms/frontend`, `helpdesk`). It is **not** the Frappe Desk. Desk (`/app/*`) is rendered by vanilla-JS `frappe.*` APIs (`frappe.ui.form`, `frappe.ui.Dialog`, `frappe.call`, `frappe.db`, control classes). The **"Desk Client APIs"** section at the bottom of this file covers those. Do not mix `frappe-ui` imports into Desk client scripts or vice-versa.
>
> Verified against **frappe-ui `0.1.261`** as vendored in `apps/crm/frontend/node_modules/frappe-ui` (also used by `apps/hrms/frontend`). Exact exports/props vary by frappe-ui version — treat component prop lists as guidance and confirm against the installed version.

---

## Project Setup

### Installation

```bash
npm install frappe-ui
```

### Main Entry Point

```javascript
// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { FrappeUI, setConfig, frappeRequest } from 'frappe-ui'
import App from './App.vue'
import router from './router'
import './index.css'

const app = createApp(App)
setConfig('resourceFetcher', frappeRequest)
app.use(createPinia())
app.use(router)
app.use(FrappeUI)
app.mount('#app')
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  presets: [require('frappe-ui/src/utils/tailwind.config')],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts}'
  ]
}
```

### HTML Requirements

```html
<body>
  <div id="app"></div>
  <div id="modals"></div>    <!-- Required for Dialog teleport -->
  <div id="popovers"></div>  <!-- Required for Dropdown/Popover teleport -->
</body>
```

---

## Core Components

### Button

```vue
<template>
  <Button variant="solid" theme="blue" @click="handleClick">Save</Button>
  <Button variant="outline" theme="gray" size="sm">Cancel</Button>
  <Button variant="subtle" icon-left="x">Close</Button>
  <Button :loading="isLoading" loadingText="Saving...">Save</Button>
  <Button disabled>Disabled</Button>
  <Button :route="{ name: 'Detail', params: { id: '001' } }">View</Button>
</template>
```

**Props:**
- `variant`: `'solid' | 'outline' | 'subtle' | 'ghost'`
- `theme`: `'gray' | 'blue' | 'green' | 'red' | 'orange'`
- `size`: `'sm' | 'md' | 'lg' | 'xl' | '2xl'`
- `loading`: `boolean`
- `disabled`: `boolean`
- `label`: `string`
- `icon` / `iconLeft` / `iconRight`: `string | Component`
- `loadingText`: `string`
- `tooltip`: `string`
- `route`: `string | object` (Vue Router link)
- `link`: `string` (external URL)

**Slots:** `prefix`, `default`, `suffix`, `icon`

### FormControl

```vue
<template>
  <FormControl v-model="name" label="Name" type="text" placeholder="Enter name" />
  <FormControl v-model="email" label="Email" type="email" />
  <FormControl v-model="desc" label="Description" type="textarea" :rows="4" />
  <FormControl v-model="status" label="Status" type="select"
    :options="[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]" />
  <FormControl v-model="date" label="Date" type="date" />
  <FormControl v-model="checked" label="Active" type="checkbox" />
</template>
```

**Props:** `type`, `label`, `placeholder`, `disabled`, `options`, `rows`, `modelValue` (v-model)

### TextInput

```vue
<template>
  <TextInput v-model="search" placeholder="Search..." size="sm" variant="subtle">
    <template #prefix>
      <LucideIcon name="search" class="w-4 h-4 text-gray-500" />
    </template>
  </TextInput>
</template>
```

**Props:** `type`, `size` (`sm|md|lg|xl`), `variant` (`subtle|outline|ghost`), `placeholder`, `disabled`, `debounce`
**Slots:** `prefix`, `suffix`

### Dialog

```vue
<template>
  <Button @click="showDialog = true">Open</Button>
  <Dialog v-model="showDialog" :options="{ title: 'Create New', size: 'md' }">
    <template #body-content>
      <FormControl v-model="name" label="Name" />
    </template>
    <template #actions>
      <Button variant="outline" @click="showDialog = false">Cancel</Button>
      <Button variant="solid" theme="blue" @click="save">Save</Button>
    </template>
  </Dialog>
</template>
```

### Link fields (doctype pickers)

> **Note:** frappe-ui `0.1.261` does **not** export a `LinkField` component, and `FormControl` has **no** `type="link"` with a `doctype` prop (its `type` values are `text`/`email`/`number`/`date`/`select`/`combobox`/`autocomplete`/`textarea`/`checkbox` — verified in `components/FormControl/FormControl.vue`). Apps build a link/doctype picker by wrapping `Autocomplete` (or `Combobox`) with a `createResource` that calls `frappe.client.search_link` / `frappe.desk.search.search_link`. Some Frappe apps ship their own `Link.vue`/`LinkField.vue` component in `frontend/src/components/` — that is app-local, not a frappe-ui export.

```vue
<!-- App-local link picker pattern (Autocomplete + search resource) -->
<Autocomplete
  v-model="customer"
  :options="customerOptions.data || []"
  placeholder="Select customer"
  @update:query="(q) => customerOptions.update({ params: { txt: q } })"
/>
```

### ListView

```vue
<template>
  <ListView :columns="columns" :rows="rows" row-key="name"
    :options="{ selectable: true, getRowRoute: (row) => `/items/${row.name}` }">
    <template #status="{ item }">
      <Badge :theme="getTheme(item.status)">{{ item.status }}</Badge>
    </template>
  </ListView>
</template>

<script setup>
const columns = [
  { label: 'Name', key: 'name', width: '200px' },
  { label: 'Status', key: 'status', width: '120px' }
]
</script>
```

**Props:** `columns` (Column[]), `rows` (array), `rowKey` (string, required)
**Options:** `getRowRoute`, `onRowClick`, `selectable`, `resizeColumn`, `rowHeight`, `emptyState`

### Badge

```vue
<Badge>Default</Badge>
<Badge theme="blue" variant="subtle">Blue</Badge>
<Badge theme="green" variant="outline">Success</Badge>
<Badge theme="red">Error</Badge>
```

**Props:** `theme` (`gray|blue|green|red|orange|yellow`), `variant` (`subtle|outline`), `size` (`sm|md|lg`)

### FeatherIcon / LucideIcon

```vue
<FeatherIcon name="plus" class="h-4 w-4" />
<LucideIcon name="settings" class="w-5 h-5 text-gray-500" />
```

### NumberChart

```vue
<NumberChart :config="{
  title: 'Total Sales',
  value: 125000,
  delta: 15.5,
  deltaSuffix: '%',
  prefix: '$'
}" />
```

---

## Additional Components

### Alert

```vue
<Alert theme="red" title="Error" description="Failed to save changes.">
  <template #footer>
    <Button variant="subtle" size="sm" @click="retry">Retry</Button>
  </template>
</Alert>
<Alert theme="green" title="Success" description="Changes saved." />
<Alert theme="yellow" title="Warning" description="Session expiring." :dismissable="true" />
```

**Props:** `theme` (`red|green|yellow|blue`), `title`, `description`, `dismissable`

### Toast

```javascript
import { toast } from 'frappe-ui'

toast({ title: 'Success', text: 'Saved!', icon: 'check-circle', iconClasses: 'text-green-500' })
toast({ title: 'Error', text: 'Failed.', icon: 'alert-circle', iconClasses: 'text-red-500' })
```

Add `<Toasts />` to your App.vue for the toast container.

### Avatar

```vue
<Avatar image="/photo.jpg" size="lg" />
<Avatar label="John Doe" size="md" />
<Avatar label="Jane" size="lg">
  <template #indicator>
    <span class="w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
  </template>
</Avatar>
```

**Props:** `size` (`xs|sm|md|lg|xl|2xl|3xl`), `shape` (`circle|square`), `image`, `label`

### Autocomplete

```vue
<Autocomplete v-model="selected" :options="options" placeholder="Search..." />
<Autocomplete v-model="tags" :options="tagOptions" :multiple="true" />
```

**Props:** `modelValue`, `options`, `multiple`, `placeholder`, `loading`, `maxOptions`, `hideSearch`
**Slots:** `target`, `prefix`, `suffix`, `item-prefix`, `item-suffix`, `footer`

### Dropdown

```vue
<Dropdown :options="[
  { label: 'Edit', icon: 'edit-2', onClick: () => edit() },
  { label: 'Delete', icon: 'trash-2', onClick: () => delete() }
]">
  <template #default="{ open }">
    <Button variant="ghost" icon="more-horizontal" />
  </template>
</Dropdown>
```

### DatePicker / DateRangePicker

```vue
<DatePicker v-model="date" placeholder="Select date" />
<DateRangePicker v-model="range" placeholder="Select range" />
```

### FileUploader

```vue
<FileUploader @success="(file) => handleUpload(file)" :fileTypes="['image/*']">
  <template #default="{ uploading, progress, openFileSelector }">
    <Button @click="openFileSelector" :loading="uploading">Upload</Button>
  </template>
</FileUploader>
```

### Breadcrumbs

```vue
<Breadcrumbs :items="[
  { label: 'Home', route: '/' },
  { label: 'Customers', route: '/customers' },
  { label: 'CUST-001' }
]" />
```

### Tabs

```vue
<Tabs v-model="activeTab" :tabs="[
  { label: 'Details', value: 'details' },
  { label: 'Activity', value: 'activity' }
]" />
```

### Card

```vue
<Card title="Card Title">
  <template #actions><Button size="sm">Action</Button></template>
  <div>Content here</div>
</Card>
```

### ErrorMessage / LoadingIndicator / Progress

```vue
<ErrorMessage message="Something went wrong" />
<LoadingIndicator />
<Progress :progress="75" />
```

---

## Navigation Components

### UserNav

```vue
<UserNav />
```

### SideBarMenu & SideBarLink

```vue
<SideBarMenu>
  <SideBarLink icon="list" label="Items" route="/items" />
  <SideBarLink icon="users" label="Customers" route="/customers" />
</SideBarMenu>
```

---

## Data Fetching Resources

### createResource

Generic API resource for method calls.

```typescript
interface ResourceOptions {
  url: string                                    // API endpoint
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: object | (() => object)               // Request parameters
  auto?: boolean                                 // Auto-fetch on mount
  cache?: string | string[]                      // Cache key(s)
  debounce?: number                              // Debounce delay (ms)
  initialData?: any                              // Initial data value
  transform?: (data: any) => any                 // Transform response
  validate?: (params: object) => string | void   // Validate before fetch
  makeParams?: () => object                      // Dynamic params generator
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

interface Resource {
  data: Ref<any>           // Response data
  loading: Ref<boolean>    // Loading state
  error: Ref<Error | null>
  fetched: Ref<boolean>    // Has fetched at least once
  fetch: () => Promise
  reload: () => Promise
  submit: (params?) => Promise
  reset: () => void
}
```

```javascript
import { createResource } from 'frappe-ui'

// Auto-fetch
const stats = createResource({
  url: 'myapp.api.get_stats',
  auto: true,
  onSuccess(data) { console.log('Loaded:', data) }
})

// With dynamic params
const search = createResource({
  url: 'frappe.client.get_list',
  makeParams() {
    return { doctype: 'Task', filters: { status: ['!=', 'Cancelled'] }, limit_page_length: 20 }
  }
})

// Manual submit
const saveSettings = createResource({
  url: 'myapp.api.save_settings',
  onSuccess() { toast({ title: 'Saved' }) }
})
await saveSettings.submit({ theme: 'dark' })

// Transform response
const users = createResource({
  url: 'frappe.client.get_list',
  params: { doctype: 'User', fields: ['name', 'full_name'] },
  transform: (data) => data.map(u => ({ value: u.name, label: u.full_name })),
  auto: true
})
```

### createListResource

Resource for DocType list operations with pagination and CRUD.

```typescript
interface ListResourceOptions {
  doctype: string
  fields?: string[]
  filters?: object | ComputedRef
  orderBy?: string
  pageLength?: number
  start?: number
  cache?: string | string[]
  auto?: boolean
  transform?: (data: any[]) => any[]
  onSuccess?: (data: any[]) => void
  onError?: (error: Error) => void
}

interface ListResource {
  data: Ref<any[]>
  loading: Ref<boolean>
  error: Ref<Error | null>

  // Pagination
  hasNextPage: ComputedRef<boolean>
  hasPreviousPage: ComputedRef<boolean>
  next: () => Promise
  previous: () => Promise

  // CRUD
  insert: { submit: (doc) => Promise, loading: Ref<boolean> }
  setValue: { submit: (name, field, value) => Promise, loading: Ref<boolean> }
  delete: { submit: (name) => Promise, loading: Ref<boolean> }

  reload: () => Promise
  update: (params) => void
}
```

```javascript
import { createListResource } from 'frappe-ui'
import { computed, ref } from 'vue'

// Basic list
const tasks = createListResource({
  doctype: 'Task',
  fields: ['name', 'subject', 'status', 'priority'],
  orderBy: 'creation desc',
  pageLength: 20,
  auto: true
})

// Reactive filters
const statusFilter = ref('Open')
const filteredTasks = createListResource({
  doctype: 'Task',
  fields: ['name', 'subject', 'status'],
  filters: computed(() => ({
    status: statusFilter.value !== 'All' ? statusFilter.value : undefined
  })),
  auto: true
})

// CRUD operations
await tasks.insert.submit({ subject: 'New Task', status: 'Open' })
await tasks.setValue.submit('TASK-001', 'status', 'Completed')
await tasks.delete.submit('TASK-001')

// Pagination
if (tasks.hasNextPage) tasks.next()
```

### createDocumentResource

Resource for single document operations.

```typescript
interface DocumentResourceOptions {
  doctype: string
  name?: string | Ref<string>
  auto?: boolean
  whitelistedMethods?: object
  transform?: (doc: object) => object
  onSuccess?: (doc: object) => void
  onError?: (error: Error) => void
}

interface DocumentResource {
  doc: Ref<object | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  reload: () => Promise
  setValue: { submit: (values) => Promise, loading: Ref<boolean> }
  save: { submit: () => Promise, loading: Ref<boolean> }
  delete: { submit: () => Promise, loading: Ref<boolean> }
  [methodName]: { submit: (params?) => Promise, loading: Ref<boolean> }
}
```

```javascript
import { createDocumentResource } from 'frappe-ui'

const task = createDocumentResource({
  doctype: 'Task',
  name: props.taskId,
  auto: true
})

// Access: task.doc.subject, task.doc.status

// Update fields
await task.setValue.submit({ subject: 'Updated', priority: 'High' })

// Save entire doc
task.doc.subject = 'Changed'
await task.save.submit()

// Delete
await task.delete.submit()

// With custom whitelisted methods
const invoice = createDocumentResource({
  doctype: 'Sales Invoice',
  name: invoiceId,
  auto: true,
  whitelistedMethods: {
    submitInvoice: 'submit',
    sendEmail: 'send_email'
  }
})
await invoice.submitInvoice.submit()
await invoice.sendEmail.submit({ recipient: 'customer@example.com' })
```

### call

```javascript
import { call } from 'frappe-ui'

const customer = await call('frappe.client.get', { doctype: 'Customer', name: 'CUST-001' })
```

---

## Pinia Store Patterns

### Resource-based Store

```javascript
// stores/tasks.js
import { defineStore } from 'pinia'
import { createListResource, createDocumentResource } from 'frappe-ui'
import { ref, computed } from 'vue'

export const useTaskStore = defineStore('tasks', () => {
  const statusFilter = ref('All')
  const searchQuery = ref('')

  const tasks = createListResource({
    doctype: 'Task',
    fields: ['name', 'subject', 'status', 'priority', 'creation'],
    filters: computed(() => {
      const f = {}
      if (statusFilter.value !== 'All') f.status = statusFilter.value
      if (searchQuery.value) f.subject = ['like', `%${searchQuery.value}%`]
      return f
    }),
    orderBy: 'creation desc',
    pageLength: 20,
    auto: true
  })

  function getTask(name) {
    return createDocumentResource({ doctype: 'Task', name, auto: true })
  }

  async function createTask(data) {
    await tasks.insert.submit(data)
  }

  async function updateStatus(name, status) {
    await tasks.setValue.submit(name, 'status', status)
  }

  return { tasks, statusFilter, searchQuery, getTask, createTask, updateStatus }
})
```

### Using in Components

```vue
<script setup>
import { useTaskStore } from '@/stores/tasks'

const store = useTaskStore()
// Access: store.tasks.data, store.tasks.loading, store.statusFilter
</script>
```

---

## Vue Router Setup

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue') },
  { path: '/tasks', name: 'Tasks', component: () => import('@/views/TaskList.vue') },
  { path: '/tasks/:name', name: 'TaskDetail', component: () => import('@/views/TaskDetail.vue'), props: true },
  { path: '/tasks/new', name: 'TaskCreate', component: () => import('@/views/TaskCreate.vue') }
]

const router = createRouter({ history: createWebHistory(), routes })
export default router
```

---

## Authentication

> **Note:** frappe-ui `0.1.261` does **not** export a `user` ref. Get the current user via a `call`/`createResource`, or read Frappe's injected `frappe.boot.user` / `window.frappe.session.user` when the SPA runs inside a Frappe bench. `call('logout')` is not a valid method name — the endpoint is `/api/method/logout`, so use `call('logout')` only if your `frappeRequest`/backend maps it; the portable form is `window.location.href = '/api/method/logout'`.

```javascript
import { createResource, call } from 'frappe-ui'

// Current session user (server round-trip)
const session = createResource({ url: 'frappe.auth.get_logged_user', auto: true })
// session.data -> user id

// Or, inside a Frappe bench, read the bootstrapped value synchronously:
const currentUser = window.frappe?.session?.user

// Logout
window.location.href = '/api/method/logout'
```

---

## Socket.io Real-time

> **Note:** frappe-ui `0.1.261` exports **`initSocket`** (default from `utils/socketio.js`), not a ready `socket` singleton. Create the socket once (typically provided app-wide via the `FrappeUI` plugin / `app.provide`) and inject it, e.g. `const socket = inject('$socket')`. The realtime event names come from the Frappe backend (`frappe.publish_realtime`).

```javascript
import { onMounted, onUnmounted, inject } from 'vue'
// socket is provided by the FrappeUI plugin; or: import { initSocket } from 'frappe-ui'
const socket = inject('$socket')

onMounted(() => {
  socket.on('task_updated', (data) => {
    tasks.reload()
  })
})

onUnmounted(() => {
  socket.off('task_updated')
})
```

---

## Common Import Pattern

```javascript
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button, Dialog, FormControl, ListView, Badge,
  NumberChart, FeatherIcon, LucideIcon, Tabs,
  Avatar, Autocomplete, Breadcrumbs, Alert,
  TextInput, Card, ErrorMessage, LoadingIndicator
} from 'frappe-ui'
import { createResource, createListResource, createDocumentResource, call, toast } from 'frappe-ui'
```

---

## Best Practices

1. **Always use `createResource`** for API calls (handles loading/error states)
2. **Use `createListResource`** for DocType lists with pagination
3. **Use `createDocumentResource`** for single document CRUD
4. **Handle all states:** loading, error, empty, and success
5. **Use `toast`** for user feedback on operations
6. **Use `FormControl`** for form inputs; build DocType link pickers from `Autocomplete` + a search resource (no core `LinkField`)
7. **Use `Autocomplete`** for searchable dropdowns with async options
8. **Apply design tokens:** Inter font, black palette, 8pt grid spacing
9. **Use Pinia stores** to share resource state across components
10. **Use Vue Router** for navigation with `Button :route` prop
11. **Mount the toast/dialog containers** — use `<FrappeUIProvider>` (v0.1.261) or the `FrappeUI` plugin; keep teleport targets `#modals` / `#popovers` in `index.html`. (`<Toasts />` is not an export in this version; the singular `toast()` fn + `Toast` component are.)

---

# Desk Client APIs (vanilla JS — `frappe.*`)

Everything below is the **Frappe Desk** client (rendered at `/app/*`), a global `frappe.*` namespace loaded from `apps/frappe/frappe/public/js/frappe/`. This is **not** frappe-ui/Vue — no imports, no `.vue` files. Use it in DocType client scripts (`{doctype}.js`), Desk pages, and list scripts. All signatures below are verified against source (v16, frappe `16.9.0`).

## `frappe.call(opts)` — generic server call

Source: `public/js/frappe/request.js` (`frappe.call = function (opts)`).

```javascript
// Object form
frappe.call({
  method: "myapp.api.get_stats",   // dotted path to a @frappe.whitelist() fn
  args: { from_date, to_date },     // becomes cmd args; POST by default
  type: "GET",                      // optional; default "POST"
  freeze: true,                     // block UI with overlay
  freeze_message: __("Loading..."),
  callback: (r) => { console.log(r.message); },  // r.message = return value
  error: (r) => {},
  always: () => {},
});

// String shorthand:  frappe.call(method, args, callback, headers)
frappe.call("frappe.client.get_count", { doctype: "Task" }, (r) => console.log(r.message));
```

- Returns a jQuery `$.ajax` promise; the resolved value is the raw response, and the server return value is under `r.message`.
- `opts.doc` + `opts.method` runs a **document method** server-side via `run_doc_method`.
- `opts.url` overrides the default `/api/method/<cmd>` endpoint; `opts.api_version` switches to `/api/<version>/method/`.

### `frappe.xcall(method, params, type?, opts?)` — promise of `r.message`

Source: `public/js/frappe/request.js` (`frappe.xcall`). Thin promise wrapper that resolves **directly to `r.message`** (no `.message` unwrap needed) and rejects on `exc`. Prefer this in modern code.

```javascript
const stats = await frappe.xcall("myapp.api.get_stats", { from_date, to_date });
```

## `frappe.db` — client-side DB helpers

Source: `public/js/frappe/db.js` (`frappe.db = { ... }`). All return Promises.

| Method | Signature | Server method |
|---|---|---|
| `get_list` | `frappe.db.get_list(doctype, { fields, filters, order_by, limit, group_by, parent })` | `frappe.desk.reportview.get_list` |
| `get_value` | `frappe.db.get_value(doctype, filters, fieldname, callback?, parent_doc?)` | `frappe.client.get_value` |
| `get_single_value` | `frappe.db.get_single_value(doctype, field)` | `frappe.client.get_single_value` |
| `set_value` | `frappe.db.set_value(doctype, docname, fieldname, value, callback?)` | `frappe.client.set_value` |
| `get_doc` | `frappe.db.get_doc(doctype, name, filters?)` | `frappe.client.get` (syncs into `locals`) |
| `insert` | `frappe.db.insert(doc)` | `frappe.client.insert` (via `xcall`) |
| `delete_doc` | `frappe.db.delete_doc(doctype, name)` | `frappe.client.delete` |
| `exists` | `frappe.db.exists(doctype, nameOrFilters)` | — |
| `count` | `frappe.db.count(doctype, { filters, limit }, cache?)` | `frappe.desk.reportview.get_count` |
| `get_link_options` | `frappe.db.get_link_options(doctype, txt, filters)` | `frappe.desk.search.search_link` |

```javascript
// get_list defaults: fields=["name"], limit=20
const open = await frappe.db.get_list("Task", {
  fields: ["name", "subject", "status"],
  filters: { status: "Open" },
  order_by: "creation desc",
  limit: 50,
});

const { message } = await frappe.db.get_value("Customer", "CUST-0001", "customer_name");
await frappe.db.set_value("Task", "TASK-0001", "status", "Completed");
const doc = await frappe.db.get_doc("Sales Order", "SO-0001");
```

## `frappe.ui.Dialog` — modal with fields

Source: `public/js/frappe/ui/dialog.js` (`frappe.ui.Dialog extends frappe.ui.FieldGroup`). Field values are read via the FieldGroup API (`public/js/frappe/ui/field_group.js`).

```javascript
const d = new frappe.ui.Dialog({
  title: __("Create Task"),
  size: "large",                 // "small" | "large" | "extra-large" (default medium)
  fields: [
    { fieldname: "subject", label: __("Subject"), fieldtype: "Data", reqd: 1 },
    { fieldname: "priority", label: __("Priority"), fieldtype: "Select", options: "Low\nMedium\nHigh" },
    { fieldname: "assignee", label: __("Assign To"), fieldtype: "Link", options: "User" },
  ],
  primary_action_label: __("Create"),
  primary_action(values) {          // values = d.get_values()
    frappe.xcall("myapp.api.make_task", values).then(() => d.hide());
  },
  secondary_action_label: __("Cancel"),
  secondary_action() { d.hide(); },
});
d.show();

// FieldGroup API (inherited):
d.get_values();                     // {} of all field values; null if reqd missing
d.get_value("subject");             // single field value
d.set_value("priority", "High");    // returns a Promise
d.set_values({ subject: "x" });
d.get_field("subject");             // the control object
d.set_df_property("subject", "read_only", 1);
d.hide(); d.clear();
```

- `set_primary_action(label, click)` / `set_secondary_action(click)` / `set_secondary_action_label(label)` mutate the footer buttons after construction.
- `disable_primary_action()` / `enable_primary_action()` toggle the primary button.
- The currently open dialog is `cur_dialog`; `frappe.ui.hide_open_dialog()` closes it.
- `frappe.prompt(fields, callback, title, primary_label)` and `frappe.msgprint` / `frappe.confirm` are higher-level wrappers over Dialog.

## Form client scripts — `frappe.ui.form.on`

Source: `public/js/frappe/form/script_manager.js` (`frappe.ui.form.on`) and the `frm` (`frappe.ui.form.Form`) API in `public/js/frappe/form/form.js`.

```javascript
// {app}/{module}/doctype/{doctype}/{doctype}.js
frappe.ui.form.on("Sales Order", {
  onload(frm) {},                        // once, before first render
  refresh(frm) {                          // every render
    if (frm.doc.docstatus === 1) {
      frm.add_custom_button(__("Make Invoice"), () => make_invoice(frm), __("Create"));
    }
  },
  customer(frm) {},                       // fires when field `customer` changes
  validate(frm) {},                       // before save
  before_save(frm) {}, after_save(frm) {},
  before_submit(frm) {}, on_submit(frm) {},
});

// Child-table events: frappe.ui.form.on("<Child DocType>", { items_add(frm, cdt, cdn) {} })
```

### Common `frm` methods (verified in `form/form.js`)

| Call | Purpose |
|---|---|
| `frm.set_value(field, value)` / `frm.set_value({...})` | Set field(s) in the model (returns Promise) |
| `frm.get_field(fieldname)` | Get the control object |
| `frm.refresh_field(fieldname)` | Re-render one field |
| `frm.set_df_property(fieldname, prop, value)` | Change a docfield property (e.g. `read_only`, `options`, `hidden`) |
| `frm.toggle_display(fieldnames, show)` | Show/hide field(s) |
| `frm.toggle_reqd(fieldnames, mandatory)` | Toggle mandatory |
| `frm.set_query(fieldname, fn)` / `frm.set_query(fieldname, parentfield, fn)` | Filter a Link field's options |
| `frm.add_custom_button(label, fn, group?)` | Add a toolbar button (grouped under `group`) |
| `frm.set_intro(txt, color)` | Headline banner |
| `frm.add_fetch(link_field, source_field, target_field, target_doctype?)` | Auto-fetch value from linked doc |
| `frm.call(method, args, callback)` / `frm.call({method, doc, args})` | Call a whitelisted method with the current doc |
| `frm.trigger(event)` | Manually fire a form event |
| `frm.dashboard.add_comment / add_indicator / set_headline` | Dashboard region |
| `frm.reload_doc()` / `frm.save()` / `frm.savesubmit()` | Persistence |

`cur_frm` is the global reference to the active form. Prefer the `frm` argument passed to handlers.

## Form controls (`frappe.ui.form.Control`)

Source: `public/js/frappe/form/controls/` — one file per fieldtype. Base class `frappe.ui.form.Control` in `base_control.js` provides `make()`, `refresh()`, `get_value()`, `set_value(value, force?)`, `set_input(value)`. Available control fieldtypes (from `form/controls/`): `Data`, `Select`, `Link`, `Dynamic Link`, `Table`, `Table MultiSelect`, `Check`, `Int`, `Float`, `Currency`, `Percent`, `Date`, `Datetime`, `Time`, `Date Range`, `Duration`, `Text`, `Small Text`, `Text Editor`, `Markdown Editor`, `HTML Editor`, `Code`, `JSON`, `Color`, `Rating`, `Signature`, `Geolocation`, `Barcode`, `Attach`, `Attach Image`, `Autocomplete`, `Password`, `Phone`, `Icon`, `Heading`, `Multi Select`, `MultiSelect Pills`, `MultiSelect List`, `MultiCheck`, `Comment`, `Button`, `Image`, `HTML`.

Standalone control (outside a form):
```javascript
const control = frappe.ui.form.make_control({
  df: { fieldtype: "Link", options: "User", label: __("User") },
  parent: $("#my-container").get(0),
  render_input: true,
});
control.set_value("Administrator");
control.get_value();
```

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

## Sources

- `apps/frappe/frappe/public/js/frappe/request.js` — `frappe.call`, `frappe.xcall`, `frappe.request.call`
- `apps/frappe/frappe/public/js/frappe/db.js` — `frappe.db.*`
- `apps/frappe/frappe/public/js/frappe/ui/dialog.js` — `frappe.ui.Dialog`
- `apps/frappe/frappe/public/js/frappe/ui/field_group.js` — `frappe.ui.FieldGroup` (`get_values`/`set_value`)
- `apps/frappe/frappe/public/js/frappe/form/form.js` — `frappe.ui.form.Form` (`frm.*`)
- `apps/frappe/frappe/public/js/frappe/form/script_manager.js` — `frappe.ui.form.on`
- `apps/frappe/frappe/public/js/frappe/form/controls/` — control fieldtypes; `base_control.js`
- `apps/crm/frontend/node_modules/frappe-ui/` (v0.1.261) — `src/index.ts` exports; `resources/{resources,listResource,documentResource}.js`; `components/FormControl/FormControl.vue`
