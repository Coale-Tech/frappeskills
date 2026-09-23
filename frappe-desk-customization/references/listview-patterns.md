# ListView Patterns Guide

This guide covers the complete ListView design pattern used throughout the application.

> **Scope.** The template above is the **frappe-ui (Vue) `<ListView>`** pattern for standalone SPA frontends. The **Desk** list view (`/app/<doctype>`) is customized differently — via `frappe.listview_settings` in a `<doctype>_list.js` file. See **"Desk ListView Settings"** at the bottom of this file. The two are unrelated APIs.

## Reference Design

Based on the Hotel Reservations ListView design with comprehensive features:
- Header with title, description, and action buttons
- Dashboard section with NumberChart stats
- Tabs with icons and badge counts
- Search and filter section
- Custom ListView with columns
- Loading and empty states
- Pagination with page size selector
- Bulk actions support

## Complete ListView Template

```vue
<template>
  <div class="p-6 space-y-6">
    <!-- ==================== HEADER SECTION ==================== -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900">{{ title }}</h1>
        <p v-if="description" class="text-sm text-gray-600 mt-1">{{ description }}</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="solid"
          theme="blue"
          size="sm"
          @click="create"
        >
          <template #prefix>
            <FeatherIcon name="plus" class="h-4 w-4" />
          </template>
          New
        </Button>
        <Button
          variant="solid"
          theme="gray"
          size="sm"
          :loading="loading"
          @click="refresh"
        >
          <template #prefix>
            <FeatherIcon name="refresh-ccw" class="h-4 w-4" />
          </template>
          Refresh
        </Button>
      </div>
    </div>

    <!-- ==================== DASHBOARD SECTION ==================== -->
    <div class="bg-white rounded-lg shadow-sm">
      <div class="p-3 border-b border-gray-200">
        <h3 class="text-md font-semibold text-gray-900">Overview</h3>
      </div>
      <div class="p-3">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <NumberChart
            v-for="stat in stats"
            :key="stat.title"
            :config="stat"
          />
        </div>
      </div>
    </div>

    <!-- ==================== TABS SECTION ==================== -->
    <div class="bg-white rounded-lg shadow-sm">
      <nav class="flex border-b border-gray-200 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap"
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

    <!-- ==================== SEARCH & FILTER SECTION ==================== -->
    <div class="bg-white rounded-lg shadow-sm border-t">
      <div class="p-3 space-y-3">
        <div class="flex flex-col md:flex-row gap-3">
          <FormControl
            v-model="filters.search"
            type="text"
            placeholder="Search..."
            class="flex-1"
          >
            <template #prefix>
              <FeatherIcon name="search" class="h-4 w-4 text-gray-400" />
            </template>
          </FormControl>

          <div class="flex items-center gap-2">
            <FormControl
              v-model="filters.status"
              type="select"
              :options="statusOptions"
              placeholder="Filter by status"
              class="md:w-40"
            />
            <FormControl
              v-if="showDateFilter"
              v-model="filters.date"
              type="date"
              placeholder="Filter by date"
              class="md:w-40"
            />
            <Button
              variant="outline"
              theme="gray"
              size="sm"
              @click="clearFilters"
            >
              <template #prefix>
                <FeatherIcon name="x" class="h-4 w-4" />
              </template>
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== ERROR STATE ==================== -->
    <div
      v-if="error"
      class="bg-red-50 border border-red-200 rounded-lg p-4"
    >
      <div class="flex items-center gap-3">
        <FeatherIcon name="alert-circle" class="h-5 w-5 text-red-500 flex-shrink-0" />
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

    <!-- ==================== LIST SECTION ==================== -->
    <div class="bg-white rounded-lg shadow-sm">
      <!-- List Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ currentTabLabel }}
          </h3>
          <span class="text-sm text-gray-500">
            Showing {{ startIndex }} to {{ endIndex }} of {{ totalItems }}
          </span>
        </div>
      </div>

      <!-- Custom ListView -->
      <ListView
        v-if="!loading && !error"
        :columns="columns"
        :rows="paginatedRows"
        :options="{
          selectable: true,
          getRowRoute: (row) => ({ name: row.name }),
          onRowClick: handleRowClick
        }"
      >
        <!-- Custom column slots -->
        <template #name="{ item }">
          <div class="font-medium text-gray-900">{{ item.name }}</div>
        </template>

        <template #status="{ item }">
          <Badge :theme="getStatusTheme(item.status)">
            {{ item.status }}
          </Badge>
        </template>

        <template #customer="{ item }">
          <div class="flex items-center gap-2">
            <FeatherIcon name="user" class="h-4 w-4 text-gray-400" />
            <span>{{ item.customer }}</span>
          </div>
        </template>

        <template #date="{ item }">
          <div class="flex items-center gap-2">
            <FeatherIcon name="calendar" class="h-4 w-4 text-gray-400" />
            <span>{{ formatDate(item.date) }}</span>
          </div>
        </template>

        <template #actions="{ item }">
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              theme="gray"
              size="sm"
              @click.stop="edit(item)"
            >
              <FeatherIcon name="edit-2" class="h-4 w-4" />
            </Button>
            <Dropdown
              :options="getDropdownOptions(item)"
              placement="right"
              @click.stop
            >
              <template #default="{ toggleDropdown }">
                <Button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  @click="toggleDropdown"
                >
                  <FeatherIcon name="more-vertical" class="h-4 w-4" />
                </Button>
              </template>
            </Dropdown>
          </div>
        </template>
      </ListView>

      <!-- Loading State -->
      <div v-if="loading" class="p-12 flex justify-center items-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>

      <!-- Empty State -->
      <div
        v-if="!loading && !error && paginatedRows.length === 0"
        class="p-12 text-center"
      >
        <FeatherIcon name="inbox" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-1">
          {{ hasActiveFilters ? 'No results found' : 'No items yet' }}
        </h3>
        <p class="text-sm text-gray-500 mb-4">
          {{ hasActiveFilters
            ? 'Try adjusting your filters or search terms'
            : 'Get started by creating your first item'
          }}
        </p>
        <Button
          v-if="!hasActiveFilters"
          variant="solid"
          theme="blue"
          @click="create"
        >
          Create New Item
        </Button>
        <Button
          v-else
          variant="outline"
          theme="gray"
          @click="clearFilters"
        >
          Clear Filters
        </Button>
      </div>

      <!-- Bulk Actions Banner -->
      <ListSelectBanner
        v-if="selectedRows.length > 0"
        :selected-items="selectedRows"
      >
        <template #actions="{ unselectAll }">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600">
              {{ selectedRows.length }} selected
            </span>
            <Button
              variant="outline"
              theme="gray"
              size="sm"
              @click="bulkAction"
            >
              Bulk Action
            </Button>
            <Button
              variant="outline"
              theme="gray"
              size="sm"
              @click="unselectAll"
            >
              Clear Selection
            </Button>
          </div>
        </template>
      </ListSelectBanner>
    </div>

    <!-- ==================== PAGINATION ==================== -->
    <div
      v-if="totalPages > 1"
      class="bg-white rounded-lg shadow-sm border-t flex items-center justify-between px-6 py-3"
    >
      <!-- Page Size Selector -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600">Rows per page:</span>
        <select
          v-model.number="pageSize"
          class="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>

      <!-- Page Navigation -->
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

        <span class="text-sm text-gray-600 px-2">
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

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  FormControl,
  ListView,
  ListSelectBanner,
  Badge,
  NumberChart,
  FeatherIcon,
  Dropdown,
  createResource
} from 'frappe-ui'

const router = useRouter()

// State
const loading = ref(false)
const error = ref(null)
const activeTab = ref('all')
const currentPage = ref(1)
const pageSize = ref(25)
const selectedRows = ref([])

const filters = ref({
  search: '',
  status: '',
  date: ''
})

// Configuration
const title = ref('Items')
const description = ref('Manage your items')
const showDateFilter = ref(true)

// Tabs configuration
const tabs = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'active', label: 'Active', icon: 'check-circle' },
  { key: 'draft', label: 'Draft', icon: 'file' },
  { key: 'inactive', label: 'Inactive', icon: 'x-circle' }
]

// Columns configuration
const columns = [
  { label: 'Name', key: 'name' },
  { label: 'Status', key: 'status' },
  { label: 'Customer', key: 'customer' },
  { label: 'Date', key: 'date' },
  { label: 'Actions', key: 'actions', align: 'right' }
]

// Status options for filter
const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'Active' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Inactive', value: 'Inactive' }
]

// Data resource
const dataResource = createResource({
  url: 'my_app.api.get_items',
  params: { limit_page_length: 0 },
  auto: true,
  onSuccess: () => {
    error.value = null
  },
  onError: (err) => {
    error.value = err.message || 'Failed to load items'
  }
})

// Computed
const currentTabLabel = computed(() => {
  return tabs.find(t => t.key === activeTab.value)?.label || 'Items'
})

const filteredData = computed(() => {
  let items = dataResource.data || []

  // Filter by tab
  if (activeTab.value !== 'all') {
    items = items.filter(item =>
      item.status?.toLowerCase() === activeTab.value
    )
  }

  // Filter by search
  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    items = items.filter(item =>
      item.name?.toLowerCase().includes(search) ||
      item.customer?.toLowerCase().includes(search)
    )
  }

  // Filter by status dropdown
  if (filters.value.status) {
    items = items.filter(item => item.status === filters.value.status)
  }

  // Filter by date
  if (filters.value.date) {
    items = items.filter(item => item.date === filters.value.date)
  }

  return items
})

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / pageSize.value)
)

const totalItems = computed(() => filteredData.value.length)

const startIndex = computed(() => {
  if (totalItems.value === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const endIndex = computed(() =>
  Math.min(currentPage.value * pageSize.value, totalItems.value)
)

const hasActiveFilters = computed(() => {
  return !!(
    filters.value.search ||
    filters.value.status ||
    filters.value.date ||
    activeTab.value !== 'all'
  )
})

const stats = computed(() => [
  {
    title: 'Total',
    value: dataResource.data?.length || 0,
    prefix: ''
  },
  {
    title: 'Active',
    value: dataResource.data?.filter(i => i.status === 'Active').length || 0,
    prefix: ''
  },
  {
    title: 'Draft',
    value: dataResource.data?.filter(i => i.status === 'Draft').length || 0,
    prefix: ''
  },
  {
    title: 'Inactive',
    value: dataResource.data?.filter(i => i.status === 'Inactive').length || 0,
    prefix: ''
  }
])

// Methods
function getTabCount(key) {
  if (key === 'all') return dataResource.data?.length || 0
  return dataResource.data?.filter(i =>
    i.status?.toLowerCase() === key
  )?.length || 0
}

function getStatusTheme(status) {
  const themes = {
    Active: 'green',
    Draft: 'yellow',
    Inactive: 'gray'
  }
  return themes[status] || 'gray'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function getDropdownOptions(item) {
  return [
    {
      label: 'View',
      icon: 'eye',
      onClick: () => view(item)
    },
    {
      label: 'Edit',
      icon: 'edit-2',
      onClick: () => edit(item)
    },
    {
      label: 'Delete',
      icon: 'trash-2',
      onClick: () => deleteItem(item)
    }
  ]
}

function handleRowClick(row) {
  router.push({ name: 'ItemDetail', params: { name: row.name } })
}

function create() {
  router.push({ name: 'ItemNew' })
}

function view(item) {
  router.push({ name: 'ItemDetail', params: { name: item.name } })
}

function edit(item) {
  router.push({ name: 'ItemEdit', params: { name: item.name } })
}

async function deleteItem(item) {
  if (!confirm(`Are you sure you want to delete ${item.name}?`)) return
  // Delete logic here
}

function bulkAction() {
  // Bulk action logic
  console.log('Bulk action on:', selectedRows.value)
}

function refresh() {
  error.value = null
  dataResource.fetch()
}

function clearFilters() {
  filters.value = { search: '', status: '', date: '' }
  activeTab.value = 'all'
  currentPage.value = 1
}

// Reset page when filters change
watch([filters, activeTab], () => {
  currentPage.value = 1
})

// Reset page when page size changes
watch(pageSize, () => {
  currentPage.value = 1
})
</script>
```

## Design Patterns Summary

### 1. Header Section
- Left: Title (bold, xl) + optional description (sm, gray-500)
- Right: Action buttons (New, Refresh) with icons
- Button variant: `solid` with theme `blue` or `gray`
- Button size: `sm`
- Icon prefix using `FeatherIcon` at `h-4 w-4`

### 2. Dashboard Section
- White background, rounded-lg, shadow-sm
- Section header: `p-3 border-b` with `text-md font-semibold`
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Padding: `p-3` for the chart container

### 3. Tabs Section
- White background, rounded-lg, shadow-sm
- Flex container with `border-b`
- Tab buttons:
  - Active: `border-blue-500 text-blue-600 bg-blue-50`
  - Inactive: `border-transparent text-gray-500`
- Icon + label + badge count
- Badge styling:
  - Active tab: `bg-blue-100 text-blue-700`
  - Inactive tab: `bg-gray-100 text-gray-600`

### 4. Search & Filter Section
- White background, border-t
- Padding: `p-3`
- Flex row for inputs
- Search input takes flex-1
- Filter selects: `md:w-40`
- Clear button with X icon

### 5. Error Banner
- `bg-red-50 border-red-200`
- `p-4` padding
- Alert circle icon (red-500)
- Retry button (outline, red theme)

### 6. List Section
- White background, rounded-lg, shadow-sm
- Header: `px-6 py-4 border-b`
- Count text: "Showing X to Y of Z"
- Custom ListView with column slots
- Row click navigation

### 7. Loading State
- `p-12` padding
- Flex centered
- Spinner: `animate-spin rounded-full h-8 w-8 border-b-2`

### 8. Empty State
- `p-12` padding, text center
- Inbox icon (gray-400, h-12 w-12)
- Heading: `text-lg font-medium text-gray-900`
- Description: `text-sm text-gray-500`
- Action button

### 9. Pagination
- `border-t bg-gray-50` or `border-t` on white
- `px-6 py-3`
- Left: Page size selector
- Right: Page navigation (first, prev, numbers, next, last)
- Disabled state for first/last buttons

---

# Desk ListView Settings (`frappe.listview_settings`)

The Desk list view at `/app/<doctype>` is the vanilla-JS `frappe.views.ListView` (source: `apps/frappe/frappe/public/js/frappe/list/list_view.js`, extends `base_list.js`). Customize it by assigning a settings object in `{app}/{module}/doctype/{doctype}/{doctype}_list.js`. This is **not** frappe-ui.

```javascript
frappe.listview_settings["Task"] = {
  // Extra fields to fetch for each row (needed by get_indicator/formatters)
  add_fields: ["status", "priority", "exp_end_date"],

  // Default filters when opening the list (2- or 3-tuple; doctype prepended)
  filters: [["status", "!=", "Cancelled"]],

  // Hide the auto "Name" column when title_field is set
  hide_name_column: true,

  // Colored status pill: [label, color, filter_condition]
  // colors: gray|blue|green|red|orange|yellow|purple|pink|cyan|...
  get_indicator(doc) {
    if (doc.status === "Open") return [__("Open"), "orange", "status,=,Open"];
    if (doc.status === "Completed") return [__("Completed"), "green", "status,=,Completed"];
    return [__(doc.status), "gray", "status,=," + doc.status];
  },

  // Per-field cell renderer: (value, df, doc) => html
  formatters: {
    priority(value, df, doc) {
      return `<span class="indicator-pill ${value === "High" ? "red" : "gray"}">${value}</span>`;
    },
  },

  // Inline per-row action button
  button: {
    show: (doc) => doc.status === "Open",
    get_label: () => __("Close"),
    get_description: (doc) => __("Close {0}", [doc.name]),
    action: (doc) => frappe.db.set_value("Task", doc.name, "status", "Completed"),
  },

  // Runs after the list controller is constructed; `listview` is the controller
  onload(listview) {
    listview.page.add_inner_button(__("Bulk Import"), () => open_import());
    listview.page.add_action_item(__("Archive selected"), () => {
      const names = listview.get_checked_items(true); // true -> docnames only
      // ...bulk operation
    });
  },

  // Override the primary ("+ Add") action
  primary_action() { frappe.new_doc("Task"); },

  // Override the row link target
  get_form_link(doc) { return `/app/task/${encodeURIComponent(doc.name)}`; },

  before_render() {},   // before each render pass
  refresh(listview) {}, // after each refresh
};
```

## Verified settings keys

All keys below are read directly in `list_view.js` (line refs approximate, v16):

| Key | Type | Behavior |
|---|---|---|
| `add_fields` | `string[]` | Extra fields fetched per row (merged into query, ~L225) |
| `filters` | `array[]` | Default filters; 3-tuples get the doctype prepended (~L107, `parse_filters_from_settings`) |
| `hide_name_column` | `boolean` | Suppresses the Name column when `title_field` set (~L456) |
| `get_indicator(doc)` | `fn → [label, color, condition]` | Row status pill; also drives `frappe.get_indicator` (`model/indicator.js`) |
| `formatters` | `{ [field]: (value, df, doc) => html }` | Custom cell HTML (~L997); skipped for the Subject column |
| `button` | `{ show, get_label, get_description, action }` | Inline row button (~L1148, action at ~L1590) |
| `dropdown_button` | `{ get_label, buttons: [{ show, get_label, get_description, action }] }` | Inline row dropdown (~L1169) |
| `onload(listview)` | `fn` | Called once after setup (~L338) |
| `primary_action()` | `fn` | Replaces the default "+ Add" behavior (~L297, ~L1694) |
| `get_form_link(doc)` | `fn → string` | Row link URL override (~L1253) |
| `before_render()` | `fn` | Before render (~L630) |

## Indicator precedence (from `model/indicator.js`)

`frappe.get_indicator(doc, doctype)` resolves in this order:
1. `doc.__unsaved` → "Not Saved" (orange)
2. Workflow state (unless `override_status` / `show_workflow_state`)
3. Submittable + `docstatus==0` → "Draft" (red), unless `settings.has_indicator_for_draft`
4. Submittable + `docstatus==2` → "Cancelled" (red), unless `settings.has_indicator_for_cancelled`
5. `settings.get_indicator(doc)` return value

So a custom `get_indicator` **does not** override the Draft/Cancelled pills for submittable doctypes unless you set `has_indicator_for_draft` / `has_indicator_for_cancelled`.

## Bulk actions & selection

- `listview.get_checked_items()` → array of row docs; `listview.get_checked_items(true)` → array of docnames.
- Standard bulk actions (Edit, Delete, Assign, Add Tags, Print, Export, Apply Assignment Rule, workflow transitions) are provided by `list/bulk_operations.js` and wired in the list view's actions menu — you don't reimplement them.
- Add custom bulk actions via `listview.page.add_action_item(label, fn)` inside `onload`.

## Real example (verified)

`apps/erpnext/erpnext/stock/doctype/delivery_note/delivery_note_list.js` defines `frappe.listview_settings["Delivery Note"]` with `add_fields`, a multi-branch `get_indicator` (To Bill / Partially Billed / Completed / Return / Closed), and an `onload` that adds a "Delivery Trip" bulk action using `doclist.get_checked_items()`.

## Sources

- `apps/frappe/frappe/public/js/frappe/list/list_view.js` — `frappe.views.ListView`, `this.settings.*`
- `apps/frappe/frappe/public/js/frappe/list/base_list.js` — base list controller
- `apps/frappe/frappe/public/js/frappe/list/bulk_operations.js` — bulk actions
- `apps/frappe/frappe/public/js/frappe/model/indicator.js` — `frappe.get_indicator`, precedence
- `apps/frappe/frappe/public/js/frappe/ui/page.js` — `add_inner_button`, `add_action_item`, `set_primary_action`
- `apps/erpnext/erpnext/stock/doctype/delivery_note/delivery_note_list.js` — real `listview_settings` example
