# ERPNext Workflows Complete Reference

Comprehensive reference for ERPNext modules: Accounting, Stock, Selling, Buying, Manufacturing, CRM, Projects, Assets, and workflow patterns.

---

## Architecture Overview

### Document Lifecycle (docstatus)

| Value | Status | Description |
|-------|--------|-------------|
| 0 | Draft | Not submitted, fully editable |
| 1 | Submitted | Finalized, creates ledger entries, limited edits |
| 2 | Cancelled | Reversed, entries cancelled, read-only |

```python
if doc.docstatus == 0:   # Draft
if doc.docstatus == 1:   # Submitted
if doc.docstatus == 2:   # Cancelled

doc.submit()
doc.cancel()

# Amend cancelled document
amended = frappe.copy_doc(doc)
amended.amended_from = doc.name
amended.insert()
```

### Module Overview

| Module | Key DocTypes | Purpose |
|--------|-------------|---------|
| **Accounts** | Sales Invoice, Purchase Invoice, Payment Entry, Journal Entry, GL Entry | Financial transactions |
| **Stock** | Stock Entry, Delivery Note, Purchase Receipt, Stock Ledger Entry | Inventory management |
| **Selling** | Quotation, Sales Order, Customer, Sales Partner | Sales pipeline |
| **Buying** | Supplier Quotation, Purchase Order, Supplier, Request for Quotation | Procurement |
| **Manufacturing** | BOM, Work Order, Job Card, Production Plan | Production |
| **CRM** | Lead, Opportunity, Campaign, Prospect | Customer acquisition |
| **Projects** | Project, Task, Timesheet, Activity Type | Project delivery |
| **Assets** | Asset, Asset Movement, Asset Depreciation Entry | Fixed assets |
| **Quality** | Quality Inspection, Quality Procedure, Quality Goal | Quality assurance |

### Company Setup

```python
company = frappe.defaults.get_user_default("Company")
company_doc = frappe.get_doc("Company", company)
companies = frappe.get_all("Company", fields=["name", "abbr", "default_currency"])
```

**Verified `get_default` / company helpers** (`erpnext/__init__.py`, cache-backed):

```python
import erpnext

erpnext.get_default_company(user=None)      # __init__.py:12  user default -> Global Defaults.default_company
erpnext.get_default_currency()              # __init__.py:28  currency of default company
erpnext.get_default_cost_center(company)    # __init__.py:35  Company.cost_center (cached via frappe.flags)
erpnext.get_company_currency(company)       # __init__.py:47  Company.default_currency (cached)
erpnext.is_perpetual_inventory_enabled(company)  # __init__.py:78  gates stock -> GL posting
erpnext.get_default_finance_book(company)   # __init__.py:93  Company.default_finance_book
```

These wrap `frappe.get_cached_value("Company", ...)` and stash results on `frappe.flags` /
`frappe.local` — prefer them over re-querying `Company` in loops. For a warehouse default,
read the item/company setting (`Stock Settings.default_warehouse`, or Item's `item_defaults`
child table) rather than hardcoding a warehouse name.

---

## Controller Hierarchy (verified v16.6.1)

ERPNext transaction DocTypes do **not** subclass `frappe.model.document.Document` directly.
They inherit a chain of controllers, each adding a layer of behavior. Confirmed against
`apps/erpnext/erpnext/controllers/` and `apps/erpnext/erpnext/utilities/transaction_base.py`:

```
frappe.model.document.Document
└── StatusUpdater              erpnext/controllers/status_updater.py:180
    └── TransactionBase        erpnext/utilities/transaction_base.py:20   (NOT under controllers/)
        └── AccountsController  erpnext/controllers/accounts_controller.py:103
            └── StockController erpnext/controllers/stock_controller.py:56
                ├── SellingController        erpnext/controllers/selling_controller.py:18
                └── SubcontractingController erpnext/controllers/subcontracting_controller.py:26
                    └── BuyingController     erpnext/controllers/buying_controller.py:29
```

> **Naming note (corrects common assumptions):** there is **no** class named
> `TransactionController` or `TaxesAndTotalsController` in the source. Tax/total math lives in
> the helper class `calculate_taxes_and_totals` (`erpnext/controllers/taxes_and_totals.py:27`),
> which is instantiated by `AccountsController.calculate_taxes_and_totals()`
> (`accounts_controller.py:733`) — it is a plain helper, not a controller subclass.

### What each layer provides

| Class | File | Responsibility (verified methods) |
|-------|------|-----------------------------------|
| **StatusUpdater** | `controllers/status_updater.py:180` | `update_prevdoc_status`, `update_qty`, over-delivery/over-billing validation, percent-billed/received status. Raises `OverAllowanceError`. |
| **TransactionBase** | `utilities/transaction_base.py:20` | `validate_posting_time`, contact/address fetch, UOM & duplicate-row validation, rate/currency helpers shared by all transactions. |
| **AccountsController** | `controllers/accounts_controller.py:103` | Core: `validate()` (217), `set_missing_values()` (726), `calculate_taxes_and_totals()` (733), `validate_qty_is_not_zero()` (1443), payment schedule, party accounts, multi-currency, advances, `on_cancel()` (1955). Raises `AccountMissingError`, `InvalidQtyError`. |
| **StockController** | `controllers/stock_controller.py:56` | `validate()` (57), `make_gl_entries()` (215) for stock/COGS GL, serial/batch bundle, quality inspection (`QualityInspectionRequiredError`), `repost_future_sle_and_gle`, valuation. |
| **SellingController** | `controllers/selling_controller.py:18` | `validate()` (59), `set_missing_values()` (109), `set_total_in_words()` (194), `update_stock_ledger()` (650) for outward stock, selling price list, customer/commission logic. |
| **SubcontractingController** | `controllers/subcontracting_controller.py:26` | Subcontracting BOM/raw-material consumption; base for `BuyingController`. |
| **BuyingController** | `controllers/buying_controller.py:29` | `validate()` (33), `set_missing_values()` (208), `set_total_in_words()` (384), `update_stock_ledger()` (732) for inward stock, `on_submit()` (928)/`on_cancel()` (942), supplier defaults, landed cost. |
| `calculate_taxes_and_totals` (helper) | `controllers/taxes_and_totals.py:27` | Item amount, tax rows, grand total, rounding, in-words — invoked from `AccountsController`. |

### Which controller a DocType subclasses (verified)

| DocType | Base class | File |
|---------|-----------|------|
| Sales Invoice | `SellingController` | `accounts/doctype/sales_invoice/sales_invoice.py:57` |
| Sales Order | `SellingController` | `selling/doctype/sales_order/sales_order.py:53` |
| Delivery Note | `SellingController` | `stock/doctype/delivery_note/delivery_note.py:24` |
| Purchase Invoice | `BuyingController` | `accounts/doctype/purchase_invoice/purchase_invoice.py:53` |
| Purchase Order | `BuyingController` | `buying/doctype/purchase_order/purchase_order.py:35` |
| Stock Entry | `StockController, SubcontractingInwardController` | `stock/doctype/stock_entry/stock_entry.py:87` |

### When to subclass which

- **New buying/selling transaction with items + GL + stock** → subclass `SellingController`
  (outward) or `BuyingController` (inward). You get taxes, party accounts, stock ledger, and GL
  posting essentially for free; override `validate`/`on_submit` and call `super()`.
- **Stock-only movement (no party invoice)** → subclass `StockController` (e.g. Stock Entry).
- **Accounting document with GL but no stock** (Journal Entry, Payment Entry) → subclass
  `AccountsController` directly.
- **Always call `super().validate()` / `super().on_submit()`** first — each layer's logic
  (status update, tax calc, GL/SLE posting) runs through the MRO chain. Skipping `super()`
  silently drops ledger postings.

---

## Transaction Lifecycle & Ledger Posting (verified v16.6.1)

### Event order on a submittable transaction

Frappe fires controller events in this order (framework: `frappe/model/document.py`):

```
before_validate → validate → before_save → (insert/save)
... on submit ...
before_submit → on_submit → on_update_after_submit
... on cancel ...
before_cancel → on_cancel → on_update_after_submit
```

ERPNext controllers hang their ledger logic off `validate` and `on_submit`. The **stock ledger
is always written before the general ledger**, because GL stock/COGS values depend on the
valuation computed while writing SLEs.

### Delivery Note `on_submit` (concrete, verified)

`stock/doctype/delivery_note/delivery_note.py:460-492` — canonical outward-stock + GL order:

```python
def on_submit(self):
    ...
    self.update_prevdoc_status()      # StatusUpdater: mark Sales Order delivered qty
    self.update_billing_status()
    ...
    self.update_stock_ledger()        # SellingController.update_stock_ledger() -> make_sl_entries()
    self.make_gl_entries()            # StockController.make_gl_entries()      -> make_gl_entries()
    self.repost_future_sle_and_gle()  # reposts later-dated entries if backdated
```

The comment in source is explicit: *"Updating stock ledger should always be called after
updating prevdoc status, because updating reserved qty in bin depends upon updated delivered
qty in SO"* (`delivery_note.py:488`). `on_cancel` mirrors this and calls
`make_gl_entries_on_cancel()` instead.

### General Ledger posting path

`erpnext/accounts/general_ledger.py`:

| Function | Line | Role |
|----------|------|------|
| `make_gl_entries(gl_map, cancel=False, adv_adj=False, ...)` | 29 | Entry point. Validates, processes, and writes GL Entry rows. |
| `process_gl_map(gl_map, merge_entries=True, ...)` | 189 | Round-off, drop zero-value rows, merge. |
| `merge_similar_entries(gl_map, ...)` | 274 | Collapse rows with same account/party/dimensions. |
| `make_entry(args, adv_adj, update_outstanding, ...)` | 425 | Creates one `GL Entry` doc (`ignore_permissions = 1`). |

Controllers build a `gl_map` (list of dicts, usually via `self.get_gl_dict(...)`) and call
`make_gl_entries(gl_map)`. **Never insert `GL Entry` docs by hand** — go through the parent
transaction's `make_gl_entries()`.

### Stock Ledger posting path

`erpnext/stock/stock_ledger.py`:

| Function | Line | Role |
|----------|------|------|
| `make_sl_entries(sl_entries, allow_negative_stock=False, ...)` | 57 | Entry point; writes `Stock Ledger Entry` rows and updates `Bin`. |
| `make_entry(args, ...)` | 229 | Creates one `Stock Ledger Entry` doc. |
| `update_entries_after(...)` | — | Recomputes running qty/valuation for all SLEs after a given point (backdated/repost). |

`SellingController.update_stock_ledger()` (`selling_controller.py:650`) and
`BuyingController.update_stock_ledger()` (`buying_controller.py:732`) assemble the `sl_entries`
list and call `make_sl_entries()`. Perpetual inventory (`is_perpetual_inventory_enabled(company)`,
`erpnext/__init__.py:78`) gates whether stock movements also produce GL entries.

### Party details (`erpnext/accounts/party.py`)

| Function | Line | Purpose |
|----------|------|---------|
| `get_party_details(party, party_type="Customer", ...)` | 59 | `@frappe.whitelist()` — resolve address, contact, tax template, payment terms, currency, price list for a customer/supplier. Called from client forms. |
| `get_party_account(party_type, party, company, ...)` | 421 | Receivable/Payable account: party record → group → company default. |
| `validate_party_accounts(doc)` | 579 | Ensures party account currency matches company. |
| `get_due_date(posting_date, party_type, party, ...)` | 624 | Due date from the party's Payment Terms Template. |
| `set_taxes(party, party_type, posting_date, ...)` | 721 | Resolve the applicable tax template for a party. |

### Naming series

Transaction names come from the DocType's `naming_series` field (autoname `naming_series:`),
editable per-company via **Stock/Selling/Buying Settings** and the **Naming Series** tool.
Series prefixes (e.g. `ACC-SINV-.YYYY.-`) are defined in each DocType JSON's `naming_series`
options. Amendments append `-1`, `-2` to the original via `amended_from`. Do not hardcode
`name`; let the series generate it.

---

## Accounting Module

### Chart of Accounts

| Root Type | Account Types |
|-----------|--------------|
| Asset | Bank, Cash, Stock, Fixed Asset, Receivable |
| Liability | Payable, Current Liability |
| Income | Income Account, Direct Income |
| Expense | Expense Account, Cost of Goods Sold, Direct Expense |
| Equity | Equity |

```python
# Get accounts
accounts = frappe.get_all("Account",
    filters={"company": company, "root_type": "Income", "is_group": 0},
    fields=["name", "account_name", "account_type"]
)
```

### General Ledger Entry

```python
# GL Entry is auto-created by submittable documents
# Read GL entries for an invoice
gl_entries = frappe.get_all("GL Entry",
    filters={"voucher_no": "SINV-001", "is_cancelled": 0},
    fields=["account", "debit", "credit", "party"]
)
```

### Sales Invoice

```python
si = frappe.new_doc("Sales Invoice")
si.customer = "CUST-001"
si.posting_date = frappe.utils.today()
si.due_date = frappe.utils.add_days(frappe.utils.today(), 30)
si.append("items", {
    "item_code": "ITEM-001",
    "qty": 5,
    "rate": 100
})
si.insert()
si.submit()
```

### Payment Entry

```python
# Create payment from invoice
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

pe = get_payment_entry("Sales Invoice", "SINV-001")
pe.reference_no = "CHQ-123"
pe.reference_date = frappe.utils.today()
pe.insert()
pe.submit()
```

### Journal Entry

```python
je = frappe.new_doc("Journal Entry")
je.posting_date = frappe.utils.today()
je.company = company
je.append("accounts", {
    "account": "Debtors - CO",
    "party_type": "Customer",
    "party": "CUST-001",
    "debit_in_account_currency": 1000
})
je.append("accounts", {
    "account": "Sales - CO",
    "credit_in_account_currency": 1000
})
je.insert()
je.submit()
```

### Tax Templates

```python
# Sales Taxes and Charges Template
tax_template = frappe.get_doc("Sales Taxes and Charges Template", "Kenya VAT")

# Apply to invoice
si.taxes_and_charges = "Kenya VAT"
si.set_taxes()
```

### Account Balances

```python
from erpnext.accounts.utils import get_balance_on

balance = get_balance_on(
    account="Debtors - CO",
    date=frappe.utils.today(),
    party_type="Customer",
    party="CUST-001"
)
```

---

## Stock / Inventory Module

### Stock Entry Types

| Type | Purpose | Example |
|------|---------|---------|
| Material Receipt | Add stock | Purchase without PO |
| Material Issue | Remove stock | Consumption |
| Material Transfer | Move between warehouses | Rebalancing |
| Manufacture | Convert raw to finished | Production |
| Repack | Repackage items | Bundling |
| Send to Subcontractor | Send for processing | Outsourced work |

```python
se = frappe.new_doc("Stock Entry")
se.stock_entry_type = "Material Receipt"
se.append("items", {
    "item_code": "ITEM-001",
    "qty": 100,
    "t_warehouse": "Stores - CO",
    "basic_rate": 50
})
se.insert()
se.submit()
```

### Stock Queries

```python
from erpnext.stock.utils import get_stock_balance

# Get stock balance
qty = get_stock_balance("ITEM-001", "Stores - CO")

# Get stock value
from erpnext.stock.utils import get_stock_value_on
value = get_stock_value_on("Stores - CO", frappe.utils.today())

# Get projected quantity
from erpnext.stock.stock_balance import get_balance_qty_from_sle
projected = frappe.db.get_value("Bin",
    {"item_code": "ITEM-001", "warehouse": "Stores - CO"},
    ["actual_qty", "planned_qty", "ordered_qty", "reserved_qty", "projected_qty"],
    as_dict=True
)
```

### Serial Number & Batch

```python
# Serial number item
se.append("items", {
    "item_code": "LAPTOP-001",
    "qty": 2,
    "serial_no": "SN001\nSN002",
    "t_warehouse": "Stores - CO"
})

# Batch item
se.append("items", {
    "item_code": "CHEMICAL-001",
    "qty": 50,
    "batch_no": "BATCH-2024-001",
    "t_warehouse": "Stores - CO"
})
```

### Delivery Note

```python
# Create from Sales Order
from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

dn = make_delivery_note("SO-001")
dn.insert()
dn.submit()
```

---

## Selling Module

### Sales Pipeline

```
Lead → Opportunity → Quotation → Sales Order → Delivery Note → Sales Invoice → Payment Entry
```

### Quotation

```python
qt = frappe.new_doc("Quotation")
qt.quotation_to = "Customer"
qt.party_name = "CUST-001"
qt.append("items", {
    "item_code": "ITEM-001",
    "qty": 10,
    "rate": 100
})
qt.insert()
qt.submit()
```

### Sales Order

```python
# Create from Quotation
from erpnext.selling.doctype.quotation.quotation import make_sales_order

so = make_sales_order("QTN-001")
so.delivery_date = frappe.utils.add_days(frappe.utils.today(), 14)
so.insert()
so.submit()
```

### Full Selling Workflow

```python
# 1. Create Quotation
# 2. Convert to Sales Order
from erpnext.selling.doctype.quotation.quotation import make_sales_order
so = make_sales_order("QTN-001")

# 3. Create Delivery Note
from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
dn = make_delivery_note("SO-001")

# 4. Create Sales Invoice
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
si = make_sales_invoice("SO-001")

# 5. Create Payment Entry
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
pe = get_payment_entry("Sales Invoice", "SINV-001")
```

---

## Buying Module

### Procurement Pipeline

```
Material Request → Supplier Quotation → Purchase Order → Purchase Receipt → Purchase Invoice → Payment Entry
```

### Purchase Order

```python
po = frappe.new_doc("Purchase Order")
po.supplier = "SUP-001"
po.schedule_date = frappe.utils.add_days(frappe.utils.today(), 7)
po.append("items", {
    "item_code": "RAW-001",
    "qty": 100,
    "rate": 50,
    "schedule_date": frappe.utils.add_days(frappe.utils.today(), 7)
})
po.insert()
po.submit()
```

### Purchase Receipt

```python
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt

pr = make_purchase_receipt("PO-001")
pr.insert()
pr.submit()
```

### Purchase Invoice

```python
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_invoice

pi = make_purchase_invoice("PO-001")
pi.insert()
pi.submit()
```

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
9. **Always run `bench migrate`** after adding custom fields to ERPNext DocTypes

---

## Extending ERPNext (the correct way)

**Never edit core ERPNext files.** They are overwritten on every `bench update`. Extend from
your own custom app instead:

### 1. Custom Fields (not core DocType edits)

Add fields via **Custom Field** DocType, and ship them as fixtures or via
`frappe.custom.doctype.custom_field.custom_field.create_custom_fields`:

```python
# your_app/setup.py (called from after_install / after_migrate hook)
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

create_custom_fields({
    "Sales Invoice": [
        {"fieldname": "custom_project_code", "label": "Project Code",
         "fieldtype": "Data", "insert_after": "customer"},
    ]
}, ignore_validate=True)
```

Custom fields survive updates; `bench migrate` re-applies fixtures.

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

---

## Sources

Verified against ERPNext v16.6.1 (`apps/erpnext/erpnext/__init__.py:9`):

- `apps/erpnext/erpnext/controllers/status_updater.py` — `StatusUpdater(Document)` (:180)
- `apps/erpnext/erpnext/utilities/transaction_base.py` — `TransactionBase(StatusUpdater)` (:20)
- `apps/erpnext/erpnext/controllers/accounts_controller.py` — `AccountsController(TransactionBase)` (:103), `validate` (:217), `set_missing_values` (:726), `calculate_taxes_and_totals` (:733), `on_cancel` (:1955)
- `apps/erpnext/erpnext/controllers/stock_controller.py` — `StockController(AccountsController)` (:56), `make_gl_entries` (:215)
- `apps/erpnext/erpnext/controllers/selling_controller.py` — `SellingController(StockController)` (:18), `update_stock_ledger` (:650)
- `apps/erpnext/erpnext/controllers/subcontracting_controller.py` — `SubcontractingController(StockController)` (:26)
- `apps/erpnext/erpnext/controllers/buying_controller.py` — `BuyingController(SubcontractingController)` (:29), `update_stock_ledger` (:732), `on_submit` (:928)
- `apps/erpnext/erpnext/controllers/taxes_and_totals.py` — `calculate_taxes_and_totals` helper (:27)
- `apps/erpnext/erpnext/accounts/general_ledger.py` — `make_gl_entries` (:29), `process_gl_map` (:189), `make_entry` (:425)
- `apps/erpnext/erpnext/stock/stock_ledger.py` — `make_sl_entries` (:57), `make_entry` (:229)
- `apps/erpnext/erpnext/accounts/party.py` — `get_party_details` (:59), `get_party_account` (:421), `validate_party_accounts` (:579), `get_due_date` (:624), `set_taxes` (:721)
- `apps/erpnext/erpnext/__init__.py` — `get_default_company` (:12), `get_default_currency` (:28), `get_default_cost_center` (:35), `is_perpetual_inventory_enabled` (:78)
- `apps/erpnext/erpnext/hooks.py` — `doc_events` (:336)
- DocType bases: `sales_invoice.py:57`, `sales_order.py:53`, `delivery_note.py:24` (`on_submit` :460), `purchase_invoice.py:53`, `purchase_order.py:35`, `stock_entry.py:87`
