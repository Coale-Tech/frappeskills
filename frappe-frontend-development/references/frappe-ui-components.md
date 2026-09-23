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
## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frontend-development/SKILL.md`.

### Frappe Frontend Development

Build modern frontend applications using Frappe UI (Vue 3 + TailwindCSS) and portal pages.

#### When to use

- Building a custom SPA frontend for a Frappe app
- Using Frappe UI components (Button, Dialog, ListView, etc.)
- Implementing data fetching with Resource, ListResource, DocumentResource
- Creating portal/public-facing pages
- Setting up Vue 3 frontend tooling inside a Frappe app

#### Inputs required

- App name and whether frontend already exists
- Frontend type (full SPA via Frappe UI, or portal pages)
- Authentication requirements (logged-in users, guest access)
- Key components and data resources needed

#### Procedure

##### 0) Choose frontend approach

| Approach | When to Use | Stack |
|----------|-------------|-------|
| Frappe UI SPA | Custom app frontend | Vue 3, TailwindCSS, Vite |
| Portal pages | Simple public pages | Jinja + HTML, minimal JS |
| Desk extensions | Admin UI enhancements | Form/List scripts (see `frappe-desk-customization`) |

##### 1) Scaffold Frappe UI frontend

```bash
# Inside your Frappe app directory
cd apps/my_app
npx degit frappe/frappe-ui-starter frontend

# Install dependencies
cd frontend
yarn

# Start dev server
yarn dev
```

##### 2) Configure main.js

```javascript
import { createApp } from 'vue'
import {
    FrappeUI,
    setConfig,
    frappeRequest,
    resourcesPlugin,
    pageMetaPlugin
} from 'frappe-ui'
import App from './App.vue'
import './index.css'

let app = createApp(App)

// Register FrappeUI plugin (components + directives)
app.use(FrappeUI)

// Enable Frappe response parsing
setConfig('resourceFetcher', frappeRequest)

// Optional: Options API resource support
app.use(resourcesPlugin)

// Optional: Reactive page titles
app.use(pageMetaPlugin)

app.mount('#app')
```

##### 3) Fetch data with Resources

**Generic Resource** — for custom API calls:

```javascript
import { createResource } from 'frappe-ui'

let stats = createResource({
    url: 'my_app.api.get_dashboard_stats',
    params: { period: 'monthly' },
    auto: true,
    cache: 'dashboard-stats',
    transform(data) {
        return { ...data, formatted_total: format_currency(data.total) }
    },
    onSuccess(data) { console.log('Loaded:', data) },
    onError(error) { console.error('Failed:', error) }
})

// Properties
stats.data       // Response data
stats.loading    // Boolean: request in progress
stats.error      // Error object if failed
stats.fetched    // Boolean: data fetched at least once

// Methods
stats.fetch()    // Trigger request
stats.reload()   // Re-fetch
stats.submit({ period: 'weekly' })  // Fetch with new params
stats.reset()    // Reset state
```

**List Resource** — for DocType lists with pagination:

```javascript
import { createListResource } from 'frappe-ui'

let todos = createListResource({
    doctype: 'ToDo',
    fields: ['name', 'description', 'status'],
    filters: { status: 'Open' },
    orderBy: 'creation desc',
    pageLength: 20,
    auto: true,
    cache: 'open-todos'
})

// List-specific API
todos.data              // Array of records
todos.hasNextPage       // Boolean: more pages
todos.next()            // Load next page
todos.reload()          // Refresh list

// CRUD operations
todos.insert.submit({ description: 'New task' })
todos.setValue.submit({ name: 'TODO-001', status: 'Closed' })
todos.delete.submit('TODO-001')
todos.runDocMethod.submit({ method: 'send_email', name: 'TODO-001' })
```

**Document Resource** — for single document operations:

```javascript
import { createDocumentResource } from 'frappe-ui'

let todo = createDocumentResource({
    doctype: 'ToDo',
    name: 'TODO-001',
    whitelistedMethods: {
        sendEmail: 'send_email',
        markComplete: 'mark_complete'
    },
    onSuccess(doc) { console.log('Loaded:', doc.name) }
})

// Document API
todo.doc                 // Full document object
todo.reload()            // Refresh document

// Update fields
todo.setValue.submit({ status: 'Closed' })

// Debounced update (coalesces rapid changes)
todo.setValueDebounced.submit({ description: 'Updated' })

// Call whitelisted methods
todo.sendEmail.submit({ email: 'user@example.com' })

// Delete
todo.delete.submit()
```

##### 4) Use Frappe UI components

```vue
<template>
    <div class="p-4">
        <Button variant="solid" theme="blue" @click="showDialog = true">
            Add Todo
        </Button>

        <ListView :columns="columns" :rows="todos.data">
            <template #cell="{ column, row, value }">
                <Badge v-if="column.key === 'status'" :theme="value === 'Open' ? 'orange' : 'green'">
                    {{ value }}
                </Badge>
                <span v-else>{{ value }}</span>
            </template>
        </ListView>

        <Dialog v-model="showDialog" :options="{ title: 'New Todo' }">
            <template #body-content>
                <TextInput v-model="newDescription" placeholder="Description" />
            </template>
            <template #actions>
                <Button variant="solid" @click="addTodo">Save</Button>
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button, ListView, Badge, Dialog, TextInput, createListResource } from 'frappe-ui'

const showDialog = ref(false)
const newDescription = ref('')

const todos = createListResource({
    doctype: 'ToDo',
    fields: ['name', 'description', 'status'],
    auto: true
})

const columns = [
    { label: 'Description', key: 'description' },
    { label: 'Status', key: 'status', width: 100 }
]

function addTodo() {
    todos.insert.submit(
        { description: newDescription.value },
        { onSuccess() { showDialog.value = false; newDescription.value = '' } }
    )
}
</script>
```

**Available component categories:**

| Category | Components |
|----------|------------|
| Inputs | TextInput, Textarea, Select, Combobox, MultiSelect, Checkbox, Switch, DatePicker, TimePicker, Slider, Password, Rating |
| Display | Alert, Avatar, Badge, Breadcrumbs, Progress, Tooltip, ErrorMessage, LoadingText |
| Navigation | Button, Dropdown, Tabs, Sidebar, Popover |
| Layout | Dialog, ListView, Calendar, Tree |
| Rich Content | TextEditor (TipTap), Charts, FileUploader |

##### 5) Add directives and utilities

```vue
<script setup>
import { onOutsideClickDirective, visibilityDirective, debounce } from 'frappe-ui'

const vOnOutsideClick = onOutsideClickDirective
const vVisibility = visibilityDirective

const debouncedSearch = debounce((query) => {
    // Search logic
}, 500)
</script>

<template>
    <div v-on-outside-click="closeDropdown">...</div>
    <div v-visibility="onVisible">Lazy loaded content</div>
</template>
```

##### 6) Configure TailwindCSS

```javascript
// tailwind.config.js
module.exports = {
    presets: [
        require('frappe-ui/src/utils/tailwind.config')
    ],
    content: [
        './index.html',
        './src/**/*.{vue,js,ts}',
        './node_modules/frappe-ui/src/components/**/*.{vue,js,ts}'
    ]
}
```

##### 7) Build for production

```bash
# Build frontend assets
cd frontend && yarn build

# Assets are served at /frontend by Frappe
```

##### 8) Portal pages (alternative approach)

For simple public pages without a full SPA:

```python
# In your app's website/ or www/ directory
# my_app/www/my_page.html

{% extends "templates/web.html" %}
{% block page_content %}
<h1>{{ title }}</h1>
<p>Welcome, {{ frappe.session.user }}</p>
{% endblock %}
```

```python
# my_app/www/my_page.py
def get_context(context):
    context.title = "My Page"
    context.data = frappe.get_all("ToDo", filters={"owner": frappe.session.user})
```

#### Verification

- [ ] `yarn dev` starts without errors
- [ ] Components render correctly
- [ ] Data resources fetch and display data
- [ ] CRUD operations work (insert, update, delete)
- [ ] Authentication works (login redirect, session handling)
- [ ] `yarn build` completes successfully
- [ ] Production assets serve correctly from Frappe

#### Failure modes / debugging

- **CORS errors**: Set `ignore_csrf` for local dev; ensure proper CSRF token in production
- **404 on API calls**: Check method path; verify `@frappe.whitelist()` decorator
- **Component not found**: Ensure import path is correct; check `frappe-ui` version
- **Styles broken**: Verify TailwindCSS config includes `frappe-ui` component paths
- **Auth issues**: Check session cookie; ensure site URL matches in dev proxy config

#### Escalation

- For Desk UI scripting → `frappe-desk-customization`
- For API endpoint implementation → `frappe-api-development`
- For app architecture → `frappe-app-development`
- For UI/UX patterns from official apps → `frappe-ui-patterns`

#### References

- [references/frappe-ui.md](frappe-ui-components.md) — Frappe UI framework reference
- [references/portal-development.md](frontend-portal.md) — Portal pages overview

#### Guardrails

- **ALWAYS use Frappe UI for custom frontends**: Never use vanilla JS, jQuery, or custom frameworks for app frontends — Frappe UI (Vue 3 + TailwindCSS) is the standard. This ensures consistency with CRM, Helpdesk, and other official Frappe apps.
- **Use FrappeUI components**: Prefer `<Button>`, `<Input>`, `<FormControl>` over custom HTML for consistency
- **Follow CRM/Helpdesk app shell patterns**: For CRUD apps, follow `frappe-ui-patterns` skill which documents sidebar navigation, list views, form layouts, and routing patterns from official Frappe apps
- **Handle loading states**: Always show loading indicators during API calls; use `resource.loading`
- **Validate API responses**: Check for errors before accessing data; handle `exc` responses
- **Configure proxy correctly**: Dev server must proxy API calls to Frappe backend
- **Handle authentication**: Check `$session.user` and redirect to login when needed

#### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Missing CORS/proxy setup | API calls fail in development | Configure Vite proxy to forward `/api` to Frappe site |
| Not handling auth state | App crashes for logged-out users | Check `call('frappe.auth.get_logged_user')` on mount |
| Wrong resource URLs | 404 errors on API calls | Use `createResource` with correct method paths |
| Hardcoded site URL | Breaks across environments | Use relative URLs or environment variables |
| Not including CSRF token | POST requests fail | Use `frappe.csrf_token` or configure session properly |
| Missing TailwindCSS config | Frappe UI styles broken | Include `frappe-ui` in Tailwind content paths |
| Using vanilla JS/jQuery | Inconsistent UX, maintenance burden | Always use Frappe UI for custom frontends |
| Custom app shell design | Inconsistent with ecosystem | Follow CRM/Helpdesk patterns for navigation, lists, forms |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frontend-development/references/frappe-ui.md`.

### Frappe UI (frontend framework)

#### Overview
Frappe UI is a set of components and utilities for building frontend apps based on Frappe Framework. Built on Vue 3 and TailwindCSS, it provides:
- 30+ UI components following the Frappe design system
- Reactive data-fetching with Resource, List Resource, and Document Resource
- Utilities and Vue directives for common patterns

**Used by**: Frappe Cloud, Gameplan, Helpdesk, Frappe Insights, Frappe Drive, Frappe Builder

**Under the hood**: Vue 3, TailwindCSS, Headless UI, TipTap (rich text), PopperJS, dayjs, Feather Icons

#### Installation and Setup

##### Quick Start with Starter Template
Use the official Frappe UI starter template:

```bash
# Create a Frappe app first
bench new-app my_app

# Scaffold Vue frontend inside the app
cd apps/my_app
npx degit frappe/frappe-ui-starter frontend

# Install dependencies and start dev server
cd frontend
yarn
yarn dev
```

##### Manual Installation
```bash
npm install frappe-ui
# or
yarn add frappe-ui
```

**main.js:**
```javascript
import { createApp } from 'vue'
import { FrappeUI, setConfig, frappeRequest, resourcesPlugin, pageMetaPlugin } from 'frappe-ui'
import App from './App.vue'
import './index.css'

let app = createApp(App)

// Register FrappeUI plugin
app.use(FrappeUI)

// Enable Frappe response parsing (extracts data from `message`, errors from `exc`)
setConfig('resourceFetcher', frappeRequest)

// Optional plugins
app.use(resourcesPlugin)    // For Options API resources
app.use(pageMetaPlugin)     // For reactive page titles

app.mount('#app')
```

**tailwind.config.js:**
```javascript
module.exports = {
  presets: [
    require('frappe-ui/src/utils/tailwind.config')
  ],
  // ... your config
}
```

##### CSRF Configuration
```bash
# For local dev only (disable CSRF checks)
bench --site mysite.local set-config ignore_csrf 1
```

In production, `csrf_token` is automatically attached to the window in `index.html`.

#### Data Fetching

##### Resource (createResource)
For generic async data fetching with caching, loading states, and lifecycle hooks.

```javascript
import { createResource } from 'frappe-ui'

// Basic usage
let todos = createResource({
  url: 'frappe.client.get_list',  // Can omit /api/method when using frappeRequest
  params: {
    doctype: 'ToDo',
    filters: { status: 'Open' }
  },
  auto: true,           // Fetch automatically on mount
  cache: 'todos',       // Cache key (string or array)
  debounce: 500,        // Debounce requests (ms)
  initialData: [],      // Seed data before first fetch
  method: 'GET',        // HTTP method (default: POST)
  
  // Generate params dynamically
  makeParams() {
    return { id: 1 }
  },
  
  // Lifecycle hooks
  beforeSubmit(params) { },
  validate(params) {
    if (!params.doctype) return 'doctype is required'  // Return string to throw error
  },
  onSuccess(data) { },
  onError(error) { },
  transform(data) {
    // Modify data before setting
    return data.map(d => ({ ...d, open: false }))
  }
})

// Resource API - Properties
todos.data           // Returned data
todos.loading        // Boolean: fetching in progress
todos.error          // Error from request or validate
todos.fetched        // Boolean: has data been fetched once
todos.previousData   // Data before last reload
todos.params         // Current params (from makeParams if used)
todos.promise        // Awaitable promise

// Resource API - Methods
todos.fetch()        // Make request
todos.reload()       // Alias to fetch
todos.submit({ ... }) // Fetch with different params
todos.reset()        // Reset state
todos.update({ url, params }) // Update config
todos.setData(data)  // Override data manually
todos.setData(d => d.filter(x => x.open)) // Modify data
```

##### List Resource (createListResource)
Specialized wrapper for fetching DocType lists with pagination and CRUD operations.

```javascript
import { createListResource } from 'frappe-ui'

let todos = createListResource({
  doctype: 'ToDo',
  fields: ['name', 'description', 'status'],
  filters: { status: 'Open' },
  orderBy: 'creation desc',
  start: 0,              // Starting index (default: 0)
  pageLength: 20,        // Records per page (default: 20)
  parent: null,          // Parent doctype for child tables
  debug: 0,              // Enable query debugging
  cache: 'todos',
  url: 'custom.api.get_todos',  // Custom API (default: frappe.client.get_list)
  auto: true,
  
  // Lifecycle hooks
  onSuccess(data) { },
  onError(error) { },
  transform(data) { return data },
  
  // Events for sub-resources
  fetchOne: { onSuccess() {}, onError() {} },
  insert: { onSuccess() {}, onError() {} },
  delete: { onSuccess() {}, onError() {} },
  setValue: { onSuccess() {}, onError() {} },
  runDocMethod: { onSuccess() {}, onError() {} },
})

// List Resource API
todos.data             // List data
todos.originalData     // Data before transform
todos.reload()         // Reload list
todos.next()           // Fetch next page
todos.hasNextPage      // Boolean: more pages available
todos.update({ fields, filters })  // Update list options

// Sub-resources for list operations
todos.list             // The underlying list resource
todos.list.loading     // Loading state
todos.list.error       // Error state
todos.list.promise     // Awaitable promise

// Fetch and update a single record in the list
todos.fetchOne.submit(name)

// Set values on a record
todos.setValue.submit({
  name: 'TODO-001',     // Record ID
  status: 'Closed',     // Field-value pairs
  description: 'Updated'
})

// Insert new record
todos.insert.submit({ description: 'New todo' })

// Delete record
todos.delete.submit(name)

// Run doc method
todos.runDocMethod.submit({
  method: 'send_email',
  name: 'TODO-001',
  email: 'test@example.com'
})
```

##### Document Resource (createDocumentResource)
For working with a single document (fetch, update, delete, call methods).

```javascript
import { createDocumentResource } from 'frappe-ui'

let todo = createDocumentResource({
  doctype: 'ToDo',
  name: 'TODO-001',
  
  // Expose whitelisted controller methods as resources
  whitelistedMethods: {
    sendEmail: 'send_email',
    markComplete: 'mark_complete'
  },
  
  // Lifecycle hooks
  onSuccess(doc) { },
  onError(error) { },
  transform(doc) {
    doc.computed_field = doc.qty * doc.rate
    return doc
  },
  
  // Events for sub-resources
  delete: { onSuccess() {}, onError() {} },
  setValue: { onSuccess() {}, onError() {} },
})

// Document Resource API
todo.doc               // The document object with all fields
todo.reload()          // Reload document
todo.update({ doctype, name })  // Change document

// Sub-resources
todo.get               // The underlying get resource
todo.get.loading       // Loading state
todo.get.error         // Error state
todo.get.promise       // Awaitable promise

// Set values
todo.setValue.submit({
  status: 'Closed',
  description: 'Updated'
})

// Debounced setValue (runs once after 500ms)
todo.setValueDebounced.submit({
  description: 'Updated'
})

// Delete document
todo.delete.submit()

// Whitelisted methods become resources
todo.sendEmail.submit({ email: 'user@example.com' })
todo.sendEmail.loading
```

##### Unified createResource with type
You can also use `createResource` with a `type` option:

```javascript
import { createResource } from 'frappe-ui'

let todos = createResource({
  type: 'list',
  doctype: 'ToDo',
  fields: ['name', 'description'],
  cache: 'ToDos',
  auto: true,
})
```

##### Options API Usage
```javascript
import { resourcesPlugin } from 'frappe-ui'
app.use(resourcesPlugin)

// In component
export default {
  resources: {
    todos() {
      return {
        type: 'list',  // 'list' or 'document'
        doctype: 'ToDo',
        fields: ['name', 'status'],
        auto: true
      }
    },
    todo() {
      return {
        type: 'document',
        doctype: 'ToDo',
        name: '1'
      }
    }
  },
  computed: {
    todoList() {
      return this.$resources.todos.data
    }
  }
}
```

#### Components

##### Component List
| Category | Components |
|----------|------------|
| **Inputs** | TextInput, Textarea, Select, Combobox, MultiSelect, Checkbox, Switch, DatePicker, TimePicker, MonthPicker, Slider, Password, Rating |
| **Display** | Alert, Avatar, Badge, Breadcrumbs, Progress, Tooltip, ErrorMessage, LoadingText |
| **Navigation** | Button, Dropdown, Tabs, Sidebar, Popover |
| **Layout** | Dialog, ListView, Calendar, Tree |
| **Rich Content** | TextEditor (TipTap-based), Charts, FileUploader |

##### Key Component Examples

###### Button
```vue
<template>
  <Button 
    variant="solid"
    theme="blue"
    :loading="isLoading"
    @click="handleClick"
  >
    Click Me
  </Button>
</template>

<script>
import { Button } from 'frappe-ui'
export default {
  components: { Button }
}
</script>
```

###### Dialog
```vue
<Dialog 
  v-model="showDialog"
  :options="{
    title: 'Confirm Action',
    message: 'Are you sure?',
    actions: [
      { label: 'Cancel', variant: 'outline' },
      { label: 'Confirm', variant: 'solid', theme: 'blue', onClick: confirm }
    ]
  }"
>
  <template #body-content>
    <p>Custom dialog content</p>
  </template>
</Dialog>
```

###### ListView
```vue
<ListView
  :columns="columns"
  :rows="todos.data"
>
  <template #cell="{ column, row, value }">
    <Badge v-if="column.key === 'status'">{{ value }}</Badge>
    <span v-else>{{ value }}</span>
  </template>
</ListView>
```

###### TextEditor (TipTap-based)
```vue
<TextEditor
  v-model="content"
  :editable="true"
  :fixedMenu="true"
  placeholder="Start typing..."
/>
```

#### Utilities

##### debounce
```javascript
import { debounce } from 'frappe-ui'

let debouncedSearch = debounce((query) => {
  // Search logic
}, 500)
```

##### fileToBase64
```javascript
import { fileToBase64 } from 'frappe-ui'

let base64 = await fileToBase64(fileObject)
```

##### pageMeta Plugin
```javascript
// In component (Options API)
export default {
  pageMeta() {
    return {
      title: 'Page Title',
      icon: '/path/to/icon.png',
      emoji: '✅'
    }
  }
}
```

#### Directives

##### v-on-outside-click
```vue
<template>
  <div v-on-outside-click="closeDropdown">
    <!-- Content -->
  </div>
</template>

<script>
import { onOutsideClickDirective } from 'frappe-ui'
export default {
  directives: {
    onOutsideClick: onOutsideClickDirective
  }
}
</script>
```

##### v-visibility
```vue
<template>
  <div v-visibility="onVisibilityChange">
    <!-- Triggers when element enters/leaves viewport -->
  </div>
</template>

<script>
import { visibilityDirective } from 'frappe-ui'
export default {
  directives: {
    visibility: visibilityDirective
  },
  methods: {
    onVisibilityChange(visible, entry) {
      // entry is IntersectionObserverEntry
    }
  }
}
</script>
```

#### References
- https://ui.frappe.io/docs/introduction
- https://ui.frappe.io/docs/getting-started
- https://ui.frappe.io/docs/data-fetching/resource
- https://ui.frappe.io/docs/data-fetching/list-resource
- https://ui.frappe.io/docs/data-fetching/document-resource
- https://ui.frappe.io/docs/other/utilities
- https://ui.frappe.io/docs/other/directives
- https://github.com/frappe/frappe-ui
- https://github.com/netchampfaris/frappe-ui-starter

---

## Sources

- `apps/frappe/frappe/public/js/frappe/request.js` — `frappe.call`, `frappe.xcall`, `frappe.request.call`
- `apps/frappe/frappe/public/js/frappe/db.js` — `frappe.db.*`
- `apps/frappe/frappe/public/js/frappe/ui/dialog.js` — `frappe.ui.Dialog`
- `apps/frappe/frappe/public/js/frappe/ui/field_group.js` — `frappe.ui.FieldGroup` (`get_values`/`set_value`)
- `apps/frappe/frappe/public/js/frappe/form/form.js` — `frappe.ui.form.Form` (`frm.*`)
- `apps/frappe/frappe/public/js/frappe/form/script_manager.js` — `frappe.ui.form.on`
- `apps/frappe/frappe/public/js/frappe/form/controls/` — control fieldtypes; `base_control.js`
- `apps/crm/frontend/node_modules/frappe-ui/` (v0.1.261) — `src/index.ts` exports; `resources/{resources,listResource,documentResource}.js`; `components/FormControl/FormControl.vue`
