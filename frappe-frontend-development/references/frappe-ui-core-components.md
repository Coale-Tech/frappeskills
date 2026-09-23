# Frappe UI — Core Components

Component catalog and project setup for the frappe-ui Vue 3 library. See
[frappe-ui-components.md](frappe-ui-components.md) for the file index and the
Desk-vs-frappe-ui scope note.

frappe-ui is used by Frappe Cloud, Gameplan, Helpdesk, Frappe Insights, Frappe
Drive, and Frappe Builder. Under the hood: Vue 3, TailwindCSS, Headless UI,
TipTap (rich text), PopperJS, dayjs, Feather Icons.

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

### CSRF (local dev only)

```bash
bench --site <site> set-config ignore_csrf 1
```

In production, `csrf_token` is automatically attached to the window in `index.html` — never disable CSRF outside local development.

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

**Props:** `theme` (`gray|blue|green|orange|red`, default `gray`), `variant` (`subtle|solid|outline|ghost`, default `subtle`), `size` (`sm|md|lg`, default `md`)

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

### TextEditor (TipTap-based)

```vue
<TextEditor
  v-model="content"
  :editable="true"
  :fixedMenu="true"
  placeholder="Start typing..."
/>
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

## Component index

Full category list (some entries only ship a prop signature, not a worked example above — confirm against the installed version before use):

| Category | Components |
|----------|------------|
| Inputs | TextInput, Textarea, Select, Combobox, MultiSelect, Checkbox, Switch, DatePicker, TimePicker, MonthPicker, Slider, Password, Rating, FormControl |
| Display | Alert, Avatar, Badge, Breadcrumbs, Progress, Tooltip, ErrorMessage, LoadingText, NumberChart |
| Navigation | Button, Dropdown, Tabs, Sidebar, Popover, UserNav |
| Layout | Dialog, ListView, Calendar, Tree, Card |
| Rich Content | TextEditor (TipTap), Charts, FileUploader |

---

## Sources

- `apps/crm/frontend/node_modules/frappe-ui/` (v0.1.261) — `src/index.ts` exports; `resources/{resources,listResource,documentResource}.js`; `components/FormControl/FormControl.vue`
