# Reports — Report Builder, Query Reports, Script Reports

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `reports/SKILL.md`.

## Frappe Reports

Build reports using Report Builder, Query Reports (SQL), or Script Reports (Python + JS).

### When to use

- Creating data analysis or summary reports
- Building SQL-based query reports
- Implementing complex reports with Python logic and JS UI
- Adding custom filters, formatters, and charts to reports
- Creating printable report formats

### Inputs required

- Report purpose and data requirements
- Source DocType(s) for the report
- Filter requirements
- Column definitions (fields, types, formatting)
- Whether report is standard (app-bundled) or custom (site-specific)

### Procedure

#### 0) Choose report type

| Type | Complexity | Code Required | Best For |
|------|-----------|---------------|----------|
| Report Builder | Low | None | Simple field selection, grouping, sorting |
| Query Report | Medium | SQL only | Direct SQL queries, joins, aggregations |
| Script Report | High | Python + JS | Complex logic, computed fields, dynamic filters |

#### 1) Report Builder

Create via UI with no code:
1. Navigate to the Report list → New Report
2. Select Reference DocType
3. Choose Report Type = "Report Builder"
4. Add columns, filters, sorting, and grouping via the builder UI

#### 2) Query Report

Reports using raw SQL queries:

1. Create Report → Type = "Query Report"
2. Set Reference DocType (controls permissions)
3. Write SQL query

```sql
SELECT
    `tabSales Order`.name AS "Sales Order:Link/Sales Order:200",
    `tabSales Order`.customer AS "Customer:Link/Customer:200",
    `tabSales Order`.transaction_date AS "Date:Date:120",
    `tabSales Order`.grand_total AS "Grand Total:Currency:150",
    `tabSales Order`.status AS "Status:Data:100"
FROM `tabSales Order`
WHERE `tabSales Order`.docstatus = 1
    {% if filters.company %}
    AND `tabSales Order`.company = %(company)s
    {% endif %}
    {% if filters.from_date %}
    AND `tabSales Order`.transaction_date >= %(from_date)s
    {% endif %}
ORDER BY `tabSales Order`.transaction_date DESC
```

**Column format in SELECT**: `"Label:Fieldtype/Options:Width"`

| Fieldtype | Example |
|-----------|---------|
| Link | `"Customer:Link/Customer:200"` |
| Currency | `"Amount:Currency:150"` |
| Date | `"Date:Date:120"` |
| Int | `"Quantity:Int:100"` |
| Data | `"Status:Data:100"` |

**Filter variables**: Use `%(filter_name)s` for parameterized queries.

#### 3) Script Report (standard)

For app-bundled reports with full Python + JS control:

**Create the report structure:**
```
my_app/
└── my_module/
    └── report/
        └── sales_summary/
            ├── sales_summary.json    # Report metadata
            ├── sales_summary.py      # Python data logic
            └── sales_summary.js      # JS filters and UI
```

**Python script** (`sales_summary.py`):

```python
import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data)
    return columns, data, None, chart

def get_columns():
    return [
        {
            "label": _("Customer"),
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 200
        },
        {
            "label": _("Total Orders"),
            "fieldname": "total_orders",
            "fieldtype": "Int",
            "width": 120
        },
        {
            "label": _("Total Amount"),
            "fieldname": "total_amount",
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "label": _("Average Order"),
            "fieldname": "avg_order",
            "fieldtype": "Currency",
            "width": 150
        }
    ]

def get_data(filters):
    conditions = get_conditions(filters)

    data = frappe.db.sql("""
        SELECT
            customer,
            COUNT(name) as total_orders,
            SUM(grand_total) as total_amount,
            AVG(grand_total) as avg_order
        FROM `tabSales Order`
        WHERE docstatus = 1 {conditions}
        GROUP BY customer
        ORDER BY total_amount DESC
    """.format(conditions=conditions), filters, as_dict=True)

    return data

def get_conditions(filters):
    conditions = ""
    if filters.get("company"):
        conditions += " AND company = %(company)s"
    if filters.get("from_date"):
        conditions += " AND transaction_date >= %(from_date)s"
    if filters.get("to_date"):
        conditions += " AND transaction_date <= %(to_date)s"
    return conditions

def get_chart(data):
    if not data:
        return None

    return {
        "data": {
            "labels": [d.customer for d in data[:10]],
            "datasets": [{
                "name": _("Total Amount"),
                "values": [d.total_amount for d in data[:10]]
            }]
        },
        "type": "bar"
    }
```

**JavaScript script** (`sales_summary.js`):

```javascript
frappe.query_reports["Sales Summary"] = {
    filters: [
        {
            fieldname: "company",
            label: __("Company"),
            fieldtype: "Link",
            options: "Company",
            default: frappe.defaults.get_user_default("Company"),
            reqd: 1
        },
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            default: frappe.datetime.add_months(frappe.datetime.get_today(), -1)
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            default: frappe.datetime.get_today()
        }
    ],

    onload(report) {
        // Custom initialization
    },

    formatter(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);

        // Highlight high-value customers
        if (column.fieldname === "total_amount" && data.total_amount > 100000) {
            value = `<span style="color: green; font-weight: bold">${value}</span>`;
        }

        return value;
    }
};
```

**Report JSON** (`sales_summary.json`):

```json
{
    "name": "Sales Summary",
    "doctype": "Report",
    "report_type": "Script Report",
    "ref_doctype": "Sales Order",
    "module": "My Module",
    "is_standard": "Yes",
    "disabled": 0
}
```

#### 4) Add report print format

Create `sales_summary.html` in the report folder for a custom print layout:

```html
<h2>Sales Summary Report</h2>
<table class="table table-bordered">
    <tr>
        <th>Customer</th>
        <th>Orders</th>
        <th>Total</th>
    </tr>
    {% for row in data %}
    <tr>
        <td>{{ row.customer }}</td>
        <td>{{ row.total_orders }}</td>
        <td>{{ frappe.format(row.total_amount, {fieldtype: 'Currency'}) }}</td>
    </tr>
    {% endfor %}
</table>
```

#### 5) Register report in hooks (optional)

Reports are auto-discovered if they follow the standard directory structure. No `hooks.py` entry is needed for standard reports.

### Verification

- [ ] Report appears in Report list
- [ ] Filters work correctly and affect results
- [ ] Columns display with proper formatting
- [ ] Chart renders (if applicable)
- [ ] Permissions respected (only authorized users see data)
- [ ] Print format works
- [ ] Performance acceptable for expected data volume

### Failure modes / debugging

- **Report not found**: Check module path and `is_standard` setting; run `bench migrate`
- **SQL syntax error**: Test query in `bench --site <site> mariadb` first
- **No data returned**: Check `docstatus` filter; verify filters match data
- **Permission denied**: Verify Reference DocType permissions for the user's role
- **Slow query**: Add indexes; use Query Builder; limit result set

### Escalation

- For DocType schema → `doctype-development`
- For API endpoints (report data via API) → `api-development`
- For Desk UI customization → `desk-customization`

### References

- [references/reports.md](./reports.md) — Report types, creation, and examples

### Guardrails

- **Validate filters**: Check filter values before building queries; handle empty/invalid input
- **Handle empty results**: Always handle case where query returns no data; show appropriate message
- **Use `frappe.db.escape()`**: Escape user input in SQL queries to prevent injection
- **Limit result sets**: Add LIMIT clause or pagination for large datasets
- **Check permissions in execute**: Verify user has permission to see the data

### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| SQL injection via filters | Security vulnerability | Use `frappe.db.escape()` or Query Builder with parameters |
| Missing permission checks | Unauthorized data access | Verify `frappe.has_permission()` or filter by allowed records |
| Unbounded queries | Timeouts, memory issues | Add `LIMIT`, use pagination, or filter by date range |
| Wrong column fieldtype | Formatting issues | Match column `fieldtype` to data (Currency, Date, etc.) |
| Not handling None in aggregations | Errors or wrong totals | Use `COALESCE()` or `IFNULL()` in SQL |
| Hardcoded `docstatus` assumptions | Missing draft/cancelled records | Explicitly filter `docstatus` based on report needs |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `reports/references/reports.md`.

## Reports

### Overview
Frappe supports three types of reports:
- **Report Builder**: Simple reports built using the UI
- **Query Report**: Reports generated from SQL queries
- **Script Report**: Reports with custom Python and JavaScript logic

### Report Builder
Basic reports created through the UI with filters, grouping, and field selection. No coding required.

### Query Report
Reports using a single SQL query. Created by System Manager and stored in the database.

#### Creating a Query Report
1. Type "new report" in the awesomebar
2. Set Report Type as "Query Report"
3. Set the Reference DocType (controls access permissions)
4. Set the Module
5. Write your SQL query

#### Columns and Filters (v13+)
Configure columns and filters in the Report document:
- Set label, width, and fieldtype for columns
- Filters can be used as variables in the query: `%(filter_name)s`

#### Example Query
```sql
SELECT
    name,
    creation,
    production_item,
    qty,
    produced_qty,
    company
FROM `tabWork Order`
WHERE docstatus=1
AND ifnull(produced_qty,0) < qty
```

#### Column Formatting (Old Style)
Format columns in the SELECT clause: `{label}:{fieldtype}/{options}:{width}`

```sql
SELECT
    `tabWork Order`.name as "Work Order:Link/Work Order:200",
    `tabWork Order`.creation as "Date:Date:120",
    `tabWork Order`.qty as "To Produce:Int:100"
FROM `tabWork Order`
```

### Script Report
Reports with complex logic using Python for data processing and JavaScript for UI customization.

#### Creating a Script Report
1. Create a Report document with Type = "Script Report"
2. Set Is Standard = "Yes" (Developer Mode required)
3. Create the report folder structure in your app:
   ```
   your_app/
   └── module_name/
       └── report/
           └── report_name/
               ├── report_name.json
               ├── report_name.py
               └── report_name.js
   ```

#### Python Script (`report_name.py`)
```python
import frappe

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {"label": "Name", "fieldname": "name", "fieldtype": "Link", "options": "DocType", "width": 200},
        {"label": "Amount", "fieldname": "amount", "fieldtype": "Currency", "width": 150},
    ]

def get_data(filters):
    return frappe.get_all("DocType",
        filters=filters,
        fields=["name", "amount"]
    )
```

#### JavaScript Script (`report_name.js`)
```javascript
frappe.query_reports["Report Name"] = {
    filters: [
        {
            fieldname: "company",
            label: __("Company"),
            fieldtype: "Link",
            options: "Company",
            default: frappe.defaults.get_user_default("Company")
        }
    ],
    onload: function(report) {
        // Custom onload behavior
    },
    formatter: function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        // Custom formatting
        return value;
    }
};
```

### Standard vs Custom Reports
- **Standard**: Bundled with app, version controlled, requires Developer Mode
- **Custom**: Stored in database, user-editable, site-specific

### Print Formats for Reports
Create `{report-name}.html` in the Report folder for custom print formats (uses JS templating).

Sources: Reports, Script Report, Query Report, Report Builder (official docs)
