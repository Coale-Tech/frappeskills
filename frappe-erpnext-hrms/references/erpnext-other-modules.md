# ERPNext Manufacturing, CRM & Extension Patterns

Manufacturing, CRM, Projects, Assets, Quality, workflow approvals, reporting,
and the correct way to extend ERPNext without editing core. Part of
[erpnext-workflows.md](erpnext-workflows.md).

---

## Manufacturing Module

### BOM (Bill of Materials)

```python
bom = frappe.new_doc("BOM")
bom.item = "FINISHED-001"
bom.quantity = 1
bom.append("items", {
    "item_code": "RAW-001",
    "qty": 2,
    "rate": 50
})
bom.append("items", {
    "item_code": "RAW-002",
    "qty": 1,
    "rate": 100
})
bom.insert()
bom.submit()
```

### Work Order

```python
wo = frappe.new_doc("Work Order")
wo.production_item = "FINISHED-001"
wo.bom_no = "BOM-FINISHED-001-001"
wo.qty = 10
wo.fg_warehouse = "Finished Goods - CO"
wo.wip_warehouse = "Work In Progress - CO"
wo.insert()
wo.submit()

# Start work order
wo.db_set("status", "In Process")

# Complete (create stock entries)
from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

# Material transfer to WIP
se_transfer = make_stock_entry(wo.name, "Material Transfer for Manufacture", wo.qty)
se_transfer.insert()
se_transfer.submit()

# Manufacture (WIP to FG)
se_manufacture = make_stock_entry(wo.name, "Manufacture", wo.qty)
se_manufacture.insert()
se_manufacture.submit()
```

### Production Plan

```python
pp = frappe.new_doc("Production Plan")
pp.company = company
pp.append("po_items", {
    "item_code": "FINISHED-001",
    "planned_qty": 100,
    "warehouse": "Finished Goods - CO"
})
pp.insert()
pp.submit()
```

---

## CRM Module

### Lead to Customer

```python
# Create Lead
lead = frappe.new_doc("Lead")
lead.first_name = "John"
lead.last_name = "Doe"
lead.email_id = "john@example.com"
lead.source = "Website"
lead.insert()

# Convert Lead to Opportunity
from erpnext.crm.doctype.lead.lead import make_opportunity
opp = make_opportunity(lead.name)
opp.opportunity_type = "Sales"
opp.insert()

# Convert Opportunity to Quotation
from erpnext.crm.doctype.opportunity.opportunity import make_quotation
qt = make_quotation(opp.name)
qt.insert()

# Convert Lead to Customer
from erpnext.crm.doctype.lead.lead import make_customer
customer = make_customer(lead.name)
customer.insert()
```

---

## Projects Module

### Project and Tasks

```python
# Create Project
project = frappe.new_doc("Project")
project.project_name = "Website Redesign"
project.expected_start_date = frappe.utils.today()
project.expected_end_date = frappe.utils.add_months(frappe.utils.today(), 3)
project.insert()

# Create Task
task = frappe.new_doc("Task")
task.subject = "Design Mockups"
task.project = project.name
task.exp_start_date = frappe.utils.today()
task.exp_end_date = frappe.utils.add_days(frappe.utils.today(), 14)
task.insert()
```

### Timesheet

```python
ts = frappe.new_doc("Timesheet")
ts.company = company
ts.append("time_logs", {
    "activity_type": "Development",
    "from_time": "2024-01-15 09:00:00",
    "to_time": "2024-01-15 17:00:00",
    "hours": 8,
    "project": project.name,
    "task": task.name
})
ts.insert()
ts.submit()
```

---

## Assets Module

### Asset Lifecycle

```
Purchase Receipt → Asset → Asset Movement → Depreciation → Disposal
```

```python
# Create Asset
asset = frappe.new_doc("Asset")
asset.asset_name = "Office Laptop"
asset.item_code = "LAPTOP-001"
asset.company = company
asset.purchase_date = frappe.utils.today()
asset.gross_purchase_amount = 50000
asset.asset_category = "Electronic Equipment"
asset.append("finance_books", {
    "depreciation_method": "Straight Line",
    "total_number_of_depreciations": 36,
    "frequency_of_depreciation": 1,
    "expected_value_after_useful_life": 5000
})
asset.insert()
asset.submit()
```

---

## Quality Management

### Quality Inspection

```python
qi = frappe.new_doc("Quality Inspection")
qi.inspection_type = "Incoming"
qi.reference_type = "Purchase Receipt"
qi.reference_name = "PREC-001"
qi.item_code = "RAW-001"
qi.inspected_by = frappe.session.user
qi.append("readings", {
    "specification": "Weight",
    "value": "50kg",
    "status": "Accepted"
})
qi.insert()
qi.submit()
```

---

## Document Workflow (Approval)

### Workflow Definition

```python
workflow = frappe.new_doc("Workflow")
workflow.workflow_name = "Purchase Order Approval"
workflow.document_type = "Purchase Order"
workflow.is_active = 1
workflow.send_email_alert = 1

# States
workflow.append("states", {
    "state": "Pending",
    "doc_status": "0",
    "allow_edit": "Purchase User"
})
workflow.append("states", {
    "state": "Approved",
    "doc_status": "1",
    "allow_edit": "Purchase Manager"
})
workflow.append("states", {
    "state": "Rejected",
    "doc_status": "0",
    "allow_edit": "Purchase Manager"
})

# Transitions
workflow.append("transitions", {
    "state": "Pending",
    "action": "Approve",
    "next_state": "Approved",
    "allowed": "Purchase Manager"
})
workflow.append("transitions", {
    "state": "Pending",
    "action": "Reject",
    "next_state": "Rejected",
    "allowed": "Purchase Manager"
})

workflow.insert()
```

### Apply Workflow Action

```python
from frappe.model.workflow import apply_workflow

apply_workflow(doc, "Approve")
```

---

## Reporting & Analytics

### Script Reports

```python
# my_app/report/sales_summary/sales_summary.py
def execute(filters=None):
    columns = [
        {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer", "width": 200},
        {"fieldname": "total", "label": "Total Sales", "fieldtype": "Currency", "width": 150},
        {"fieldname": "count", "label": "Invoice Count", "fieldtype": "Int", "width": 100}
    ]

    data = frappe.db.sql("""
        SELECT customer, SUM(grand_total) as total, COUNT(*) as count
        FROM `tabSales Invoice`
        WHERE docstatus = 1
        AND posting_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY customer
        ORDER BY total DESC
    """, filters, as_dict=True)

    return columns, data
```

### Query Reports

```sql
-- my_app/report/customer_balance/customer_balance.sql
SELECT
    customer as "Customer:Link/Customer:200",
    SUM(grand_total) as "Total:Currency:150",
    COUNT(*) as "Count:Int:100"
FROM `tabSales Invoice`
WHERE docstatus = 1
GROUP BY customer
ORDER BY SUM(grand_total) DESC
```

### Dashboard Chart

```python
# Number Card
frappe.get_doc({
    "doctype": "Number Card",
    "name": "Total Sales",
    "document_type": "Sales Invoice",
    "function": "Sum",
    "aggregate_function_based_on": "grand_total",
    "filters_json": '{"docstatus": 1}',
    "is_standard": 1
}).insert()
```

---

## Common API Patterns

### Get Outstanding Amount

```python
from erpnext.accounts.utils import get_outstanding_invoices

outstanding = get_outstanding_invoices(
    party_type="Customer",
    party="CUST-001",
    account="Debtors - CO"
)
```

### Get Item Details

```python
from erpnext.stock.get_item_details import get_item_details

item_details = get_item_details({
    "item_code": "ITEM-001",
    "company": company,
    "doctype": "Sales Invoice",
    "customer": "CUST-001"
})
```

### Get Exchange Rate

```python
from erpnext.setup.utils import get_exchange_rate

rate = get_exchange_rate("USD", "KES", frappe.utils.today())
```

---

## Best Practices

1. **Always check docstatus** before modifying submitted documents
2. **Use make_* functions** for document conversion (Sales Order → Delivery Note)
3. **Never modify GL/SLE directly** - always through parent documents
4. **Test with proper Company setup** - currency, accounts, warehouses
5. **Use frappe.utils** for date arithmetic (add_days, date_diff)
6. **Check stock availability** before creating delivery notes
7. **Handle multi-currency** with exchange rates
8. **Use workflow states** for approval processes
9. **Always run `bench --site <site> migrate`** after adding custom fields to ERPNext DocTypes

---

## Extending ERPNext (the correct way)

**Never edit core ERPNext files.** They are overwritten on every `bench update`. Extend from
your own custom app instead:

### 1. Custom Fields (not core DocType edits)

Add fields via **Custom Field** DocType, and ship them as fixtures or via
`frappe.custom.doctype.custom_field.custom_field.create_custom_fields`:

```python
# your_app/install.py — hooked via after_install = "your_app.install.after_install" in hooks.py
# (v16 `bench new-app` generates pyproject.toml; setup.py is a legacy ≤v14 convention)
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def after_install():
    create_custom_fields({
        "Sales Invoice": [
            {"fieldname": "custom_project_code", "label": "Project Code",
             "fieldtype": "Data", "insert_after": "customer"},
        ]
    }, ignore_validate=True)
```

Custom fields survive updates; `bench --site <site> migrate` re-applies fixtures.

### 2. Hook into events (`doc_events`) instead of subclassing core

ERPNext itself uses this pattern — `apps/erpnext/erpnext/hooks.py:336` defines `doc_events`
mapping DocType → event → dotted function path (regional logic, SLA, etc.). Mirror it in your
app's `hooks.py`:

```python
# your_app/hooks.py
doc_events = {
    "Sales Invoice": {
        "validate": "your_app.overrides.sales_invoice.validate",
        "on_submit": "your_app.overrides.sales_invoice.on_submit",
    },
    "*": {  # applies to every DocType, like erpnext's "*" entry
        "validate": "your_app.audit.log_change",
    },
}
```

Handlers receive `(doc, method)`; they run **in addition** to the controller's own
`validate`/`on_submit`, so ledger posting stays intact.

### 3. Override a whole controller class (last resort)

When you must change core method behavior, use `override_doctype_class` in `hooks.py` and
subclass the real ERPNext controller, calling `super()`:

```python
# your_app/hooks.py
override_doctype_class = {
    "Sales Invoice": "your_app.overrides.sales_invoice.CustomSalesInvoice"
}
```
```python
# your_app/overrides/sales_invoice.py
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice

class CustomSalesInvoice(SalesInvoice):  # keeps SellingController chain intact
    def validate(self):
        super().validate()
        # extra logic
```

**Guidance:** prefer Custom Fields + `doc_events` for 95% of cases. Reserve
`override_doctype_class` for behavior you cannot reach via events, and always chain `super()`
so GL/SLE posting and status updates keep working.

