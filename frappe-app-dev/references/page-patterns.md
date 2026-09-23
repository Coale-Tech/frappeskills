# Page Patterns

This guide defines common page layouts and patterns for Frappe/ERPNext applications.

> **Scope.** The List/Detail/Form patterns above are **frappe-ui (Vue) SPA** layouts. Frappe also has two native page kinds, documented at the bottom of this file: **Desk Pages** (`frappe.pages[...]`, custom full-page apps inside `/app`) and **Web/Portal Pages** (server-rendered pages under `www/` or via `get_context`). Pick the right one: standalone product UI → frappe-ui SPA; an admin/tool screen inside Desk → Desk Page; a public/portal page → Web Page.

## Pattern: List Page

The List Page displays a collection of items with search, filters, and pagination.

### Structure

```
List Page
├── Header Section
│   ├── Title
│   ├── Description
│   └── Action Buttons (New, Refresh)
├── Dashboard Section (Optional)
│   └── NumberChart Stats
├── Tabs Section (Optional)
│   └── Tab buttons with counts
├── Search & Filter Section
│   ├── Search input
│   ├── Filter dropdowns
│   └── Clear filters button
├── List Section
│   ├── List header
│   ├── ListView component
│   └── Empty/Loading states
└── Pagination
    ├── Page size selector
    └── Page navigation
```

### Template

```vue
<template>
  <div class="p-6 space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900">{{ title }}</h1>
        <p v-if="description" class="text-sm text-gray-600">{{ description }}</p>
      </div>
      <div class="flex gap-2">
        <Button
          variant="solid"
          theme="blue"
          size="sm"
          @click="create"
        >
          <template #prefix><FeatherIcon name="plus" class="h-4 w-4" /></template>
          New
        </Button>
        <Button
          variant="solid"
          theme="gray"
          size="sm"
          :loading="loading"
          @click="refresh"
        >
          <template #prefix><FeatherIcon name="refresh-ccw" class="h-4 w-4" /></template>
          Refresh
        </Button>
      </div>
    </div>

    <!-- Dashboard Section -->
    <div class="bg-white rounded-lg shadow-sm">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-md font-semibold text-gray-900">Overview</h3>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <NumberChart
            v-for="stat in stats"
            :key="stat.label"
            :config="stat"
          />
        </div>
      </div>
    </div>

    <!-- Tabs Section -->
    <div class="bg-white rounded-lg shadow-sm">
      <nav class="flex border-b border-gray-200 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-3 flex items-center gap-2 border-b-2 transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-blue-500 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          "
        >
          <FeatherIcon :name="tab.icon" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ tab.label }}</span>
          <span
            class="px-2 py-0.5 text-xs font-medium rounded-full"
            :class="
              activeTab === tab.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            "
          >
            {{ getTabCount(tab.key) }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Search & Filter Section -->
    <div class="bg-white rounded-lg shadow-sm border-t">
      <div class="p-4 space-y-3">
        <div class="flex flex-col md:flex-row gap-3">
          <FormControl
            v-model="filters.search"
            type="text"
            placeholder="Search..."
            class="flex-1"
          />
          <FormControl
            v-model="filters.status"
            type="select"
            :options="statusOptions"
            class="md:w-40"
          />
          <Button
            variant="outline"
            theme="gray"
            size="sm"
            @click="clearFilters"
          >
            <template #prefix><FeatherIcon name="x" class="h-4 w-4" /></template>
            Clear
          </Button>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <FeatherIcon name="alert-circle" class="h-5 w-5 text-red-500" />
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800">{{ error }}</p>
        </div>
        <Button
          variant="outline"
          theme="red"
          size="sm"
          @click="refresh"
        >
          Retry
        </Button>
      </div>
    </div>

    <!-- List Section -->
    <div class="bg-white rounded-lg shadow-sm">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ tabs.find(t => t.key === activeTab)?.label || 'Items' }}
          </h3>
          <span class="text-sm text-gray-500">
            Showing {{ startIndex }} to {{ endIndex }} of {{ totalItems }}
          </span>
        </div>
      </div>

      <!-- ListView Component -->
      <ListView
        v-if="!loading && !error"
        :columns="columns"
        :rows="paginatedRows"
        :options="{
          selectable: true,
          onRowClick: handleRowClick,
          getRowRoute: (row) => ({ name: row.name })
        }"
      >
        <template #name="{ item }">
          <div class="font-medium text-gray-900">{{ item.name }}</div>
        </template>

        <template #status="{ item }">
          <Badge :theme="getStatusTheme(item.status)">
            {{ item.status }}
          </Badge>
        </template>
      </ListView>

      <!-- Loading State -->
      <div v-if="loading" class="p-12 flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !error && paginatedRows.length === 0" class="p-12 text-center">
        <FeatherIcon name="inbox" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-1">No items found</h3>
        <p class="text-sm text-gray-500">
          {{ hasActiveFilters ? 'Try adjusting your filters' : 'Get started by creating a new item' }}
        </p>
        <Button
          v-if="!hasActiveFilters"
          variant="solid"
          theme="blue"
          class="mt-4"
          @click="create"
        >
          Create New
        </Button>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="bg-white rounded-lg shadow-sm border-t flex items-center justify-between px-6 py-3">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">Rows per page:</span>
        <select
          v-model="pageSize"
          class="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          theme="gray"
          size="sm"
          :disabled="currentPage === 1"
          @click="currentPage = 1"
        >
          <FeatherIcon name="chevrons-left" class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          theme="gray"
          size="sm"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          <FeatherIcon name="chevron-left" class="h-4 w-4" />
        </Button>
        <span class="text-sm text-gray-600">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <Button
          variant="outline"
          theme="gray"
          size="sm"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          <FeatherIcon name="chevron-right" class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          theme="gray"
          size="sm"
          :disabled="currentPage === totalPages"
          @click="currentPage = totalPages"
        >
          <FeatherIcon name="chevrons-right" class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
```

### Script Pattern

```javascript
import { ref, computed, onMounted } from 'vue'
import { createResource, useRouter } from 'frappe-ui'
import { Button, FormControl, ListView, Badge, NumberChart, FeatherIcon } from 'frappe-ui'

const router = useRouter()
const loading = ref(false)
const error = ref(null)
const activeTab = ref('all')
const currentPage = ref(1)
const pageSize = ref(25)

const filters = ref({
  search: '',
  status: ''
})

const tabs = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'active', label: 'Active', icon: 'check-circle' },
  { key: 'draft', label: 'Draft', icon: 'file' },
  { key: 'inactive', label: 'Inactive', icon: 'x-circle' }
]

const columns = [
  { label: 'Name', key: 'name' },
  { label: 'Status', key: 'status' },
  { label: 'Date', key: 'date' },
  { label: 'Actions', key: 'actions', align: 'right' }
]

const dataResource = createResource({
  url: 'my_app.api.get_items',
  params: { limit_page_length: 0 },
  auto: true,
  onSuccess: () => { error.value = null },
  onError: (err) => { error.value = err.message }
})

const filteredData = computed(() => {
  let items = dataResource.data || []

  if (activeTab.value !== 'all') {
    items = items.filter(item => item.status?.toLowerCase() === activeTab.value)
  }

  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    items = items.filter(item =>
      item.name?.toLowerCase().includes(search)
    )
  }

  if (filters.value.status) {
    items = items.filter(item => item.status === filters.value.status)
  }

  return items
})

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredData.value.length / pageSize.value))
const totalItems = computed(() => filteredData.value.length)
const startIndex = computed(() => (currentPage.value - 1) * pageSize.value + 1)
const endIndex = computed(() => Math.min(currentPage.value * pageSize.value, totalItems.value))

const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.status || activeTab.value !== 'all'
})

const stats = computed(() => [
  { title: 'Total', value: dataResource.data?.length || 0 },
  { title: 'Active', value: dataResource.data?.filter(i => i.status === 'Active').length || 0 },
  { title: 'Draft', value: dataResource.data?.filter(i => i.status === 'Draft').length || 0 },
  { title: 'Inactive', value: dataResource.data?.filter(i => i.status === 'Inactive').length || 0 }
])

function getTabCount(key) {
  if (key === 'all') return dataResource.data?.length || 0
  return dataResource.data?.filter(i => i.status?.toLowerCase() === key)?.length || 0
}

function getStatusTheme(status) {
  const themes = { Active: 'green', Draft: 'yellow', Inactive: 'gray' }
  return themes[status] || 'gray'
}

function handleRowClick(row) {
  router.push({ name: 'ItemDetail', params: { name: row.name } })
}

function create() {
  router.push({ name: 'ItemNew' })
}

function refresh() {
  dataResource.fetch()
}

function clearFilters() {
  filters.value = { search: '', status: '' }
  activeTab.value = 'all'
  currentPage.value = 1
}
```

## Pattern: Detail Page

The Detail Page shows a single item with related information and actions.

### Structure

```
Detail Page
├── Header Section
│   ├── Back button
│   ├── Title & Status
│   └── Action buttons
├── Status Banner (Conditional)
├── Tabs Section
│   └── Details, Activity, etc.
└── Tab Content
    └── Dynamic content per tab
```

### Template

```vue
<template>
  <div class="p-6 space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <Button
          variant="outline"
          theme="gray"
          size="sm"
          @click="goBack"
        >
          <FeatherIcon name="arrow-left" class="h-4 w-4" />
        </Button>
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900">{{ doc?.name }}</h1>
            <Badge :theme="getStatusTheme(doc?.status)">
              {{ doc?.status }}
            </Badge>
          </div>
          <p class="text-sm text-gray-500 mt-1">{{ doc?.customer }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="doc?.docstatus === 0"
          variant="solid"
          theme="blue"
          @click="save"
          :loading="saving"
        >
          Save
        </Button>
        <Button
          v-if="doc?.docstatus === 0"
          variant="solid"
          theme="green"
          @click="submit"
          :loading="submitting"
        >
          Submit
        </Button>
        <Button
          v-if="doc?.docstatus === 1"
          variant="outline"
          theme="red"
          @click="cancel"
          :loading="cancelling"
        >
          Cancel
        </Button>
        <Dropdown v-if="doc" :options="moreOptions" placement="right">
          <template #default="{ toggleDropdown }">
            <Button variant="outline" theme="gray" @click="toggleDropdown">
              <FeatherIcon name="more-vertical" class="h-4 w-4" />
            </Button>
          </template>
        </Dropdown>
      </div>
    </div>

    <!-- Status Banner -->
    <div
      v-if="doc?.docstatus === 1"
      class="bg-green-50 border border-green-200 rounded-lg p-4"
    >
      <div class="flex items-center gap-3">
        <FeatherIcon name="check-circle" class="h-5 w-5 text-green-500" />
        <div>
          <p class="text-sm font-medium text-green-800">Submitted</p>
          <p class="text-xs text-green-600">This document has been submitted and is read-only</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-lg shadow-sm">
      <nav class="flex border-b border-gray-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-3 text-sm font-medium transition-colors"
          :class="
            activeTab === tab.key
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="p-6">
        <div v-show="activeTab === 'details'">
          <!-- Details Content -->
        </div>
        <div v-show="activeTab === 'activity'">
          <!-- Activity Content -->
        </div>
      </div>
    </div>
  </div>
</template>
```

## Pattern: Form Page

The Form Page is used for creating and editing items.

### Template

```vue
<template>
  <div class="max-w-4xl mx-auto p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900">
          {{ isEdit ? 'Edit' : 'New' }} Item
        </h1>
        <p class="text-sm text-gray-500">
          {{ isEdit ? 'Update the item details' : 'Create a new item' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" theme="gray" @click="cancel">
          Cancel
        </Button>
        <Button
          variant="solid"
          theme="blue"
          @click="save"
          :loading="saving"
        >
          {{ isEdit ? 'Update' : 'Create' }}
        </Button>
      </div>
    </div>

    <!-- Form -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormControl
            v-model="form.name"
            label="Name"
            placeholder="Enter name"
            :required="true"
          />
          <FormControl
            v-model="form.customer"
            label="Customer"
            type="link"
            doctype="Customer"
            placeholder="Select customer"
          />
          <FormControl
            v-model="form.status"
            label="Status"
            type="select"
            :options="statusOptions"
          />
          <FormControl
            v-model="form.date"
            label="Date"
            type="date"
          />
        </div>

        <FormControl
          v-model="form.description"
          label="Description"
          type="textarea"
          placeholder="Enter description"
          :rows="4"
        />
      </div>
    </div>
  </div>
</template>
```

## Best Practices

1. **Consistent spacing**: Use 8pt grid (p-4, p-6, p-8)
2. **Loading states**: Show spinner during data fetch
3. **Empty states**: Helpful message + action button
4. **Error states**: Clear message + retry button
5. **Mobile responsive**: Stack columns on small screens
6. **Keyboard navigation**: Support tab and arrow keys
7. **Progressive disclosure**: Hide advanced options by default

---

# Desk Page (`frappe.pages`, `frappe.ui.make_app_page`)

A **Desk Page** is a custom full-page screen inside `/app` (not tied to a DocType). Create the "Page" doctype record (via `bench` or fixtures) which produces a folder `{app}/{module}/page/{page_name}/` with `{page_name}.js` (+ optional `.json`, `.py`, `.html`). Source: `apps/frappe/frappe/public/js/frappe/ui/page.js`.

```javascript
// {app}/{module}/page/my_tool/my_tool.js
frappe.pages["my-tool"].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("My Tool"),
    single_column: true,
    card_layout: true,        // wrap content in a card
  });

  frappe.breadcrumbs.add("Setup");

  // page.main is the jQuery content container:
  $("<div class='my-tool-body' style='padding:15px;'></div>").appendTo(page.main);

  wrapper.my_tool = new MyTool(page);
};

// Fires on every route back to the page (on_page_load fires only once):
frappe.pages["my-tool"].on_page_show = function (wrapper) {};
// Some pages also define .refresh:
frappe.pages["my-tool"].refresh = function (wrapper) {};
```

## `page` object API (verified in `ui/page.js`)

| Method | Purpose |
|---|---|
| `page.set_primary_action(label, click, icon?, working_label?)` | Blue primary button |
| `page.set_secondary_action(label, click, icon?, working_label?)` | Secondary button |
| `page.clear_primary_action()` / `page.clear_actions()` | Remove action buttons |
| `page.add_inner_button(label, action, group?, type?, align_right?)` | Button in the inner button bar (grouped) |
| `page.add_button(label, click, opts?)` | Standalone action button |
| `page.add_menu_item(label, click, standard?, shortcut?, show_parent?)` | Item in the "..." menu |
| `page.add_action_item(label, click, standard?)` | Item in the actions dropdown |
| `page.add_action_icon(icon, click, css_class?, tooltip_label?)` | Icon button |
| `page.set_indicator(label, color)` | Status indicator in the header |
| `page.set_title_sub(txt)` | Subtitle under the title |

`frappe.ui.make_app_page(opts)` just does `opts.parent.page = new frappe.ui.Page(opts); return opts.parent.page;`. Useful `opts`: `parent`, `title`, `single_column`, `card_layout`. You can also add a `frappe.ui.form.Layout`/fields, filters (`page.add_field`), or embed a `frappe.views.QueryReport`.

---

# Web / Portal Page (public, server-rendered)

Public-facing pages live under an app's `www/` folder (auto-routed by path) or are built dynamically. Each page is an `.html` (Jinja) template plus an optional same-named `.py` exposing `get_context(context)`. Source dir: `apps/frappe/frappe/www/` (e.g. `about.py`, `contact.py`, `list.py`, `app.py`).

```python
# {app}/www/dashboard.py
import frappe

no_cache = 1                      # module-level flags are read by the renderer

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.throw("Login required", frappe.PermissionError)
    context.title = "Dashboard"
    context.orders = frappe.get_all(
        "Sales Order",
        filters={"owner": frappe.session.user},
        fields=["name", "status", "grand_total"],
    )
    # return context (optional) — mutating in place also works
    return context
```

```html
{# {app}/www/dashboard.html — rendered at /dashboard #}
{% extends "templates/web.html" %}
{% block page_content %}
  <h1>{{ title }}</h1>
  <ul>
    {% for o in orders %}
      <li>{{ o.name }} — {{ o.status }} — {{ frappe.format_value(o.grand_total, {"fieldtype": "Currency"}) }}</li>
    {% endfor %}
  </ul>
{% endblock %}
```

Notes (verified against `frappe/www/*.py` and `templates/`):
- File path under `www/` maps to the URL path; `index.html` maps to the folder root. A leading `_` (e.g. `_test/`) hides the folder.
- Common module-level flags: `no_cache`, `no_sitemap`, `sitemap`, `base_template_path`, `condition_field`.
- Portal templates extend `templates/web.html` and use blocks like `page_content`, `title`, `head_include`.
- **Web Page** DocType (`frappe/website/doctype/web_page/`) is the no-code alternative: content authored in the DB, rendered via the website router — use it for CMS-style pages, `www/` + `get_context` for code-driven ones.
- For DocType-backed portal listing/detail, ERPNext uses `Web Form` and the generic `www/list.py` / portal item views rather than hand-written templates.

## Sources

- `apps/frappe/frappe/public/js/frappe/ui/page.js` — `frappe.ui.Page`, `frappe.ui.make_app_page`, page action API
- `apps/frappe/frappe/core/page/permission_manager/permission_manager.js` — real `frappe.pages[...].on_page_load` example
- `apps/frappe/frappe/www/` — portal pages (`about.py`, `contact.py`, `list.py`, `app.py`) using `get_context`
- `apps/frappe/frappe/website/doctype/web_page/` — Web Page DocType (no-code portal pages)
