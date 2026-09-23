# ERPNext Transaction Modules

Accounting, Stock, Selling and Buying document patterns. Part of
[erpnext-workflows.md](erpnext-workflows.md).

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

