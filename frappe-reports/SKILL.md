---
name: frappe-reports
description: "Create Frappe reports using Report Builder, Query Reports (SQL), and Script Reports (Python plus JS), and visualize data with charts, dashboards, and Insights. Use when building data analysis views or dashboards."
---

# Frappe Reports & Visualization

Turn stored data into answers — report first, chart second.

## When to use

- Building a tabular report for users
- Writing a Query or Script Report with computed columns
- Adding dashboard charts or number cards
- Choosing between Frappe Charts and Frappe Insights

## Inputs required

- The question the report answers, and who asks it
- Source DocTypes and the filters users need
- Whether computation is pure SQL or needs Python
- Roles allowed to run it

## Procedure

### 0) Choose the report type

| Need | Type |
|---|---|
| Ad-hoc columns and filters, no code | Report Builder |
| Fixed SQL with parameters | Query Report |
| Computed rows, conditional formatting, charts | Script Report |
| Saved columns/filters over an existing report | Custom Report |
| Exploration and BI | Frappe Insights |

See [references/reports.md](references/reports.md).

### 1) Script Report — Python side

```python
import frappe
from frappe import _
from frappe.query_builder.functions import Sum

def execute(filters=None):
    filters = filters or {}
    columns = [
        {"label": _("Customer"), "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 200},
        {"label": _("Total"), "fieldname": "total", "fieldtype": "Currency", "width": 140},
    ]
    SO = frappe.qb.DocType("Sales Order")
    total = Sum(SO.grand_total).as_("total")
    query = (
        frappe.qb.from_(SO)
        .select(SO.customer, total)
        .where(SO.docstatus == 1)
        .groupby(SO.customer)
        .orderby(total, order=frappe.qb.desc)
    )
    if filters.get("company"):
        query = query.where(SO.company == filters["company"])
    data = query.run(as_dict=True)
    return columns, data
```

Build the query with `frappe.qb` (never `frappe.db.sql`) — see
[references/database.md](../frappe-api-development/references/database.md#never-use-frappedbsql-by-default).
The full return is `columns, data, message, chart, report_summary,
skip_total_row`; trailing items may be omitted.

### 2) Script Report — JS filters

```javascript
frappe.query_reports["Customer Totals"] = {
    filters: [
        {fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", reqd: 1},
    ],
};
```

### 3) Add visualization

Embedded charts, number cards and dashboard wiring:
[references/data-visualization.md](references/data-visualization.md). Reach for
Insights when users need to explore rather than read a fixed view.

### 4) Register and permit

A user can run it only if `frappe.has_permission(ref_doctype, "report")` passes
**and** the Report's Roles table is empty or contains one of their roles. Ship
the report as part of the app module, and migrate. Slow reports: enable
`prepared_report` (runs on the `long` queue).

## Verification

- [ ] Report runs with no filters and with each required filter
- [ ] Totals reconcile against the source documents
- [ ] Only permitted roles can run it
- [ ] Large date ranges complete without timeout
- [ ] Column types render correctly (Currency, Date, Link)
- [ ] Chart reflects the same numbers as the table

## Failure modes / debugging

- **Report not listed**: missing `ref_doctype`, wrong module, or roles not granted
- **`Unknown column`**: DocType field renamed; column names are table columns, not labels
- **Empty result**: `docstatus` filter excludes drafts, or the filter default is unset
- **Slow report**: missing index on the filtered column, or per-row Python queries
- **Wrong totals**: joins duplicating rows — aggregate before joining
- **Currency shows raw numbers**: column `fieldtype` not set to `Currency`

## Escalation

- Query performance and indexing → [`frappe-api-development`](../frappe-api-development/SKILL.md) → `database.md`
- Printable output instead of a screen report → [`frappe-printing-templates`](../frappe-printing-templates/SKILL.md)
- Domain semantics of the numbers → [`frappe-erpnext-hrms`](../frappe-erpnext-hrms/SKILL.md)

- Slow reports and query tuning → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)
- Unexpected empty result or wrong totals → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)

## References

- [references/reports.md](references/reports.md) - Report Builder, Query and Script Reports
- [references/data-visualization.md](references/data-visualization.md) - Frappe Charts, dashboards, Insights

## Guardrails

- **`frappe.qb` always, never `frappe.db.sql`**: for a query the query builder can express
- **Translate column labels**: `_("Total")`
- **Set `fieldtype` on every column**: it drives formatting and links
- **Respect permissions**: reports expose data — grant roles deliberately
- **Aggregate via `frappe.qb`, not Python loops**: per-row queries do not scale

<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The report is slow only on big sites" | A report slow at scale is already deployed to production; add `EXPLAIN` and indexes before release. |
| "`frappe.db.sql` is more readable than `frappe.qb`" | Raw SQL bypasses dialect safety and is one edit away from an injection point; use `frappe.qb`. |
| "The totals look right, I don't need to reconcile them" | Joins before aggregation silently duplicate rows and inflate totals; verify against source documents. |
| "I'll set report permissions later, everyone can run it for now" | An empty Roles table grants report access to every logged-in user; set roles before the first deploy. |
| "I'll sum in Python after the query, it's cleaner code" | Per-row Python aggregation means N round-trips at scale; push aggregation into `frappe.qb` in SQL. |
| "It's a Query Report — the SQL is parameterized so injection is not a risk" | Query Report SQL is editable on the server; use Script Reports with `frappe.qb` for code-controlled queries. |

## Red Flags

- `frappe.db.sql` used in a Script Report instead of `frappe.qb`
- Python `sum()` or loop over query result rows computing aggregates
- Report Roles table left empty at the time of first deploy
- Column definitions missing `fieldtype` (numbers render as raw strings without formatting)
- `GROUP BY` on a joined query without verifying rows are not duplicated by the join
- Report not tested against a date range that returns a large result set

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| `frappe.db.sql` for a query `frappe.qb` can express | Injection risk; bypasses dialect handling | Rewrite with `frappe.qb` |
| Untyped columns | No formatting or links | Set `fieldtype` |
| Including drafts unintentionally | Inflated totals | Filter `docstatus = 1` |
| Joins before aggregation | Duplicated rows | Aggregate, then join |
| Python loop over rows for sums | Slow reports | `frappe.qb` aggregation |
| Chart disagreeing with the table | Two query paths | Derive both from one dataset |
