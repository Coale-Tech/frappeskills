# Frappe UI — Data Fetching, Stores, Router, Utilities

Data layer, state, and wiring for a frappe-ui SPA. See
[frappe-ui-components.md](frappe-ui-components.md) for the file index and the
Desk-vs-frappe-ui scope note, and
[frappe-ui-core-components.md](frappe-ui-core-components.md) for the component
catalog.

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
  validate?: (params: object) => string | void   // Validate before fetch; return a string to throw
  makeParams?: () => object                      // Dynamic params generator
  beforeSubmit?: (params: object) => void
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

interface Resource {
  data: Ref<any>            // Response data
  loading: Ref<boolean>     // Loading state
  error: Ref<Error | null>  // Error from request or validate
  fetched: Ref<boolean>     // Has fetched at least once
  previousData: Ref<any>    // Data before the last reload
  params: Ref<object>       // Current params (from makeParams if used)
  promise: Promise<any>     // Awaitable promise for the in-flight/last request
  fetch: () => Promise
  reload: () => Promise      // Alias for fetch
  submit: (params?) => Promise
  reset: () => void
  update: (opts: { url?, params? }) => void
  setData: (data: any | ((prev: any) => any)) => void  // Override data manually, or transform in place
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
  start?: number                // Starting index (default: 0)
  parent?: string                // Parent doctype for child tables
  url?: string                   // Custom list API (default: frappe.client.get_list)
  cache?: string | string[]
  auto?: boolean
  transform?: (data: any[]) => any[]
  onSuccess?: (data: any[]) => void
  onError?: (error: Error) => void
}

interface ListResource {
  data: Ref<any[]>
  originalData: Ref<any[]>     // Data before transform
  loading: Ref<boolean>
  error: Ref<Error | null>

  // Pagination
  hasNextPage: ComputedRef<boolean>
  hasPreviousPage: ComputedRef<boolean>
  next: () => Promise
  previous: () => Promise

  // CRUD (each a sub-resource: .loading, .error, .promise)
  insert: { submit: (doc) => Promise, loading: Ref<boolean> }
  setValue: { submit: (name, field, value) => Promise, loading: Ref<boolean> }
  delete: { submit: (name) => Promise, loading: Ref<boolean> }
  fetchOne: { submit: (name) => Promise }           // Fetch and update a single record in the list
  runDocMethod: { submit: (params: { method, name, ...args }) => Promise }

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
await tasks.runDocMethod.submit({ method: 'send_email', name: 'TASK-001', email: 'user@example.com' })

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
  whitelistedMethods?: object   // { alias: 'controller_method' } — each becomes a sub-resource
  transform?: (doc: object) => object
  onSuccess?: (doc: object) => void
  onError?: (error: Error) => void
}

interface DocumentResource {
  doc: Ref<object | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  get: { loading: Ref<boolean>, error: Ref<Error | null>, promise: Promise }  // underlying fetch sub-resource
  reload: () => Promise
  update: (params: { doctype, name }) => void   // Point the resource at a different document
  setValue: { submit: (values) => Promise, loading: Ref<boolean> }
  setValueDebounced: { submit: (values) => Promise }  // Coalesces rapid field edits (500ms)
  save: { submit: () => Promise, loading: Ref<boolean> }
  delete: { submit: () => Promise, loading: Ref<boolean> }
  [methodName]: { submit: (params?) => Promise, loading: Ref<boolean> }  // one per whitelistedMethods entry
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

// Debounced update while typing (coalesces rapid changes into one request)
task.setValueDebounced.submit({ subject: 'Typing...' })

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

### Unified `createResource` with a `type`

`createResource` also accepts `type: 'list' | 'document'` to build a list/document resource without importing the dedicated factory:

```javascript
import { createResource } from 'frappe-ui'

const todos = createResource({
  type: 'list',
  doctype: 'ToDo',
  fields: ['name', 'description'],
  cache: 'ToDos',
  auto: true,
})
```

### call

```javascript
import { call } from 'frappe-ui'

const customer = await call('frappe.client.get', { doctype: 'Customer', name: 'CUST-001' })
```

### Options API resources (legacy)

`resourcesPlugin` exposes the same resource types to Options API components via `this.$resources`. Prefer Composition API (`<script setup>`) in new code; this exists for components that predate it.

```javascript
import { resourcesPlugin } from 'frappe-ui'
app.use(resourcesPlugin)

// In component
export default {
  resources: {
    todos() {
      return { type: 'list', doctype: 'ToDo', fields: ['name', 'status'], auto: true }
    },
    todo() {
      return { type: 'document', doctype: 'ToDo', name: '1' }
    }
  },
  computed: {
    todoList() { return this.$resources.todos.data }
  }
}
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

> **Note:** frappe-ui `0.1.261` does **not** export a `user` ref. Get the current user via a `call`/`createResource`, or read Frappe's injected `frappe.boot.user` / `window.frappe.session.user` when the SPA runs inside a Frappe bench.

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

## Utilities

### debounce

```javascript
import { debounce } from 'frappe-ui'

const debouncedSearch = debounce((query) => {
  // Search logic
}, 500)
```

### fileToBase64

```javascript
import { fileToBase64 } from 'frappe-ui'

const base64 = await fileToBase64(fileObject)
```

### pageMeta plugin

Sets the document title (and optionally a favicon override) reactively per component:

```javascript
// In component (Options API)
export default {
  pageMeta() {
    return {
      title: 'Page Title',
      icon: '/path/to/icon.png'
    }
  }
}
```

---

## Directives

### v-on-outside-click

```vue
<script setup>
import { onOutsideClickDirective } from 'frappe-ui'

const vOnOutsideClick = onOutsideClickDirective
</script>

<template>
  <div v-on-outside-click="closeDropdown">
    <!-- Content -->
  </div>
</template>
```

### v-visibility

Fires when an element enters/leaves the viewport (wraps `IntersectionObserver`):

```vue
<script setup>
import { visibilityDirective } from 'frappe-ui'

const vVisibility = visibilityDirective

function onVisible(visible, entry) {
  // entry is an IntersectionObserverEntry
}
</script>

<template>
  <div v-visibility="onVisible">Lazy loaded content</div>
</template>
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

## References

- https://ui.frappe.io/docs/introduction
- https://ui.frappe.io/docs/getting-started
- https://ui.frappe.io/docs/data-fetching/resource
- https://ui.frappe.io/docs/data-fetching/list-resource
- https://ui.frappe.io/docs/data-fetching/document-resource
- https://ui.frappe.io/docs/other/utilities
- https://ui.frappe.io/docs/other/directives
- https://github.com/frappe/frappe-ui
