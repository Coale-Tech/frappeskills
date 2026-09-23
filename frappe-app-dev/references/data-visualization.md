# Data Visualization Reference

Comprehensive reference for Frappe Charts (lightweight SVG charting) and Frappe Insights (BI platform).

---

## Frappe Charts

### Overview

- **Size**: ~18KB minified
- **Rendering**: SVG-based (no Canvas)
- **Types**: 8 chart types
- **GitHub**: https://github.com/frappe/charts

### Installation

```bash
npm install frappe-charts
# or
yarn add frappe-charts
```

```javascript
import { Chart } from 'frappe-charts'
import 'frappe-charts/dist/frappe-charts.min.css'
```

### CDN Usage

```html
<script src="https://cdn.jsdelivr.net/npm/frappe-charts@2/dist/frappe-charts.umd.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-charts@2/dist/frappe-charts.min.css">
```

### In Desk (bundled global — not npm)

Inside Frappe Desk, `frappe-charts` is already bundled and re-exported as the **`frappe.Chart`** global — there is
**no `frappe.ui.Chart`**. Use `frappe.Chart` directly in Desk scripts/client scripts; there is also a
`frappe.ui.RealtimeChart` subclass for socket-fed charts.

```javascript
// Desk (client script / bundle) — no import needed:
const chart = new frappe.Chart("#chart", { data, type: "line", height: 300 })

// Socket-driven realtime chart (extends frappe.Chart):
const rt = new frappe.ui.RealtimeChart("#chart", "my_event", 8, initialData)
```

> Source: `apps/frappe/frappe/public/js/frappe/ui/chart.js` —
> `import { Chart } from "frappe-charts/dist/frappe-charts.esm"; frappe.Chart = Chart;`
> In a standalone Vue SPA you still `import { Chart } from 'frappe-charts'` as shown below.

---

### Chart Types

#### 1. Line Chart

```javascript
const chart = new Chart("#chart", {
    title: "Sales Trend",
    data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
            {
                name: "Revenue",
                type: "line",
                values: [18000, 25000, 22000, 30000, 28000, 35000]
            }
        ]
    },
    type: "line",
    height: 300,
    colors: ["#171717"],  // Black/minimal palette
    lineOptions: {
        hideDots: 0,
        dotSize: 4,
        regionFill: 1,        // Fill area under line
        heatline: 0,
        spline: 0             // Curved lines
    }
})
```

#### 2. Bar Chart

```javascript
const chart = new Chart("#chart", {
    title: "Monthly Sales",
    data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
            { name: "2023", values: [50000, 60000, 55000, 70000] },
            { name: "2024", values: [65000, 75000, 70000, 85000] }
        ]
    },
    type: "bar",
    height: 300,
    colors: ["#737373", "#171717"],
    barOptions: {
        stacked: 0,
        spaceRatio: 0.5
    }
})
```

#### 3. Axis Mixed Chart

```javascript
const chart = new Chart("#chart", {
    title: "Revenue vs Orders",
    data: {
        labels: ["Jan", "Feb", "Mar", "Apr"],
        datasets: [
            { name: "Revenue", type: "bar", values: [50000, 60000, 55000, 70000] },
            { name: "Orders", type: "line", values: [120, 150, 130, 180] }
        ]
    },
    type: "axis-mixed",
    height: 300,
    colors: ["#E5E5E5", "#171717"]
})
```

#### 4. Pie Chart

```javascript
const chart = new Chart("#chart", {
    title: "Sales by Region",
    data: {
        labels: ["East Africa", "West Africa", "Southern Africa", "North Africa"],
        datasets: [{ values: [45, 25, 20, 10] }]
    },
    type: "pie",
    height: 300,
    colors: ["#171717", "#525252", "#A3A3A3", "#D4D4D4"]
})
```

#### 5. Donut Chart

```javascript
const chart = new Chart("#chart", {
    title: "Order Status",
    data: {
        labels: ["Completed", "In Progress", "Pending", "Cancelled"],
        datasets: [{ values: [65, 20, 10, 5] }]
    },
    type: "donut",
    height: 300,
    colors: ["#171717", "#525252", "#A3A3A3", "#D4D4D4"]
})
```

#### 6. Percentage Chart

```javascript
const chart = new Chart("#chart", {
    title: "Task Completion",
    data: {
        labels: ["Done", "In Progress", "Pending"],
        datasets: [{ values: [70, 20, 10] }]
    },
    type: "percentage",
    height: 50,
    colors: ["#171717", "#737373", "#D4D4D4"]
})
```

#### 7. Heatmap Chart

```javascript
const chart = new Chart("#chart", {
    title: "Activity Heatmap",
    data: {
        dataPoints: {
            1704067200: 5,   // Unix timestamps
            1704153600: 10,
            1704240000: 3,
            // ... more data points
        },
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31")
    },
    type: "heatmap",
    height: 200,
    discreteDomains: 1,
    countLabel: "Activities"
})
```

---

### Chart Configuration

```javascript
const chart = new Chart("#chart", {
    title: "Chart Title",
    data: { ... },
    type: "line",
    height: 300,
    colors: ["#171717", "#737373"],
    animate: 1,
    truncateLegends: 1,
    axisOptions: {
        xAxisMode: "tick",       // "tick" or "span"
        yAxisMode: "span",
        xIsSeries: 0
    },
    tooltipOptions: {
        formatTooltipX: d => d.toUpperCase(),
        formatTooltipY: d => `$${d.toLocaleString()}`
    },
    isNavigable: 1,  // Enable click events
    valuesOverPoints: 0
})
```

### Dynamic Updates

```javascript
// Update entire dataset
chart.update({
    labels: ["Jan", "Feb", "Mar"],
    datasets: [{ values: [100, 200, 300] }]
})

// Add data point
chart.addDataPoint("Apr", [400])

// Remove data point
chart.removeDataPoint(0)  // Remove first point

// Export
chart.export()  // Downloads as PNG
```

### Events

```javascript
// Click on data point
chart.parent.addEventListener('data-select', (e) => {
    console.log(e.index, e.values, e.label)
})
```

---

### Vue.js Integration

```vue
<template>
  <div class="p-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">Sales Dashboard</h2>
    <div ref="chartContainer" class="border border-gray-200 rounded-lg p-4"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { createResource } from 'frappe-ui'
import { Chart } from 'frappe-charts'

const chartContainer = ref(null)
let chartInstance = null

const salesData = createResource({
  url: 'my_app.api.get_sales_trend',
  auto: true,
  onSuccess(data) {
    renderChart(data)
  }
})

function renderChart(data) {
  if (chartInstance) {
    chartInstance.update(data)
  } else {
    chartInstance = new Chart(chartContainer.value, {
      title: "Sales Trend",
      data: data,
      type: "line",
      height: 300,
      colors: ["#171717"],
      lineOptions: { regionFill: 1 }
    })
  }
}

onMounted(() => {
  if (salesData.data) renderChart(salesData.data)
})
</script>
```

---

## Frappe Insights

### Overview

Frappe Insights is a full BI (Business Intelligence) platform built on Frappe.

> **Note:** Insights is a **separate installable app**, not part of the Frappe framework core (it is not present
> on this <bench> bench). Its DocTypes/API (e.g. `Insights Data Source`) track the Insights release, not
> Frappe's — verify against the installed Insights version before relying on the snippets below.

- **Repository**: https://github.com/frappe/insights
- **Features**: Visual query builder, dashboards, sharing, scheduled reports
- **Data Sources**: MariaDB, PostgreSQL, SQLite, external databases

### Installation

```bash
bench get-app insights
bench --site my-site install-app insights
```

### Query Builder

```python
# Programmatic query via API
import frappe

@frappe.whitelist()
def get_insights_data():
    return frappe.db.sql("""
        SELECT
            customer,
            SUM(grand_total) as total_sales,
            COUNT(*) as invoice_count,
            AVG(grand_total) as avg_sale
        FROM `tabSales Invoice`
        WHERE docstatus = 1
        AND posting_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY customer
        ORDER BY total_sales DESC
        LIMIT 10
    """, as_dict=True)
```

### Dashboard Configuration

Insights dashboards are configured via the web UI at `/insights`. Key features:

- Drag-and-drop chart placement
- Multiple data sources per dashboard
- Filters that apply across charts
- Auto-refresh intervals
- Share with roles/users
- Export as PDF

### Data Sources

```python
# Add external data source via API
ds = frappe.new_doc("Insights Data Source")
ds.title = "Analytics DB"
ds.database_type = "MariaDB"
ds.host = "analytics-db.example.com"
ds.port = 3306
ds.database_name = "analytics"
ds.username = "reader"
ds.password = "secure_password"
ds.insert()
```

---

## Frappe Dashboard Charts (Desk)

### Number Card

```python
nc = frappe.get_doc({
    "doctype": "Number Card",
    "label": "Total Revenue",            # autoname field:label -> the name
    "type": "Document Type",             # Document Type | Report | Custom
    "document_type": "Sales Invoice",
    "function": "Sum",                   # Count | Sum | Average | Minimum | Maximum
    "aggregate_function_based_on": "grand_total",
    "filters_json": '{"docstatus": 1}',
    "is_standard": 1,
    "show_percentage_stats": 1,
    "stats_time_interval": "Monthly"     # Daily | Weekly | Monthly | Yearly
}).insert()
```

> `Number Card` autoname is `field:label`, so `label` becomes `name` — do not also pass `name`.
> Fields verified against `apps/frappe/frappe/desk/doctype/number_card/number_card.json`.

### Dashboard Chart

```python
dc = frappe.get_doc({
    "doctype": "Dashboard Chart",
    "chart_name": "Monthly Sales",
    "chart_type": "Sum",       # Count | Sum | Average | Group By | Custom | Report
    "document_type": "Sales Invoice",
    "based_on": "posting_date",
    "value_based_on": "grand_total",   # required when chart_type = Sum/Average
    "timespan": "Last Year",   # Last Year | Last Quarter | Last Month | Last Week | Select Date Range
    "time_interval": "Monthly",# Yearly | Quarterly | Monthly | Weekly | Daily
    "filters_json": '{"docstatus": 1}',
    "type": "Bar",             # Line | Bar | Percentage | Pie | Donut | Heatmap
    "is_standard": 1
}).insert()
```

> For `chart_type: "Group By"` use `group_by_based_on` + `group_by_type` (Count/Sum/Average) instead of
> `based_on`/`value_based_on`. Fields verified against
> `apps/frappe/frappe/desk/doctype/dashboard_chart/dashboard_chart.json`.

---

## Best Practices

1. **Use Frappe Charts** for simple embedded visualizations (lightweight, 18KB)
2. **Use Frappe Insights** for complex BI dashboards and ad-hoc analysis
3. **Apply black/minimal design tokens** to chart colors (`#171717`, `#737373`, `#D4D4D4`)
4. **Use createResource** for loading chart data in Vue.js
5. **Prefer Query Builder** (PyPika) over raw SQL for chart data queries
6. **Add loading states** while chart data fetches
7. **Make charts responsive** with percentage-based widths
8. **Export functionality** - use `chart.export()` for PNG downloads
9. **Use heatmaps** for time-series activity data
10. **Use percentage charts** for simple proportion displays

## Sources

Verified against Frappe v16.9.0 at `<bench>/apps/frappe`:
- `apps/frappe/frappe/public/js/frappe/ui/chart.js` — `frappe.Chart` global + `frappe.ui.RealtimeChart`
- `apps/frappe/frappe/desk/doctype/dashboard_chart/dashboard_chart.json` — chart_type/type/timespan options
- `apps/frappe/frappe/desk/doctype/number_card/number_card.json` — function/type/stats_time_interval options
- `apps/frappe/frappe/desk/doctype/dashboard/dashboard.json` (Dashboard container)
- Frappe Insights is an external app: https://github.com/frappe/insights (not on this bench)
