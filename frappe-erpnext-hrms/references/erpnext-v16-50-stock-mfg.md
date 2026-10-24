# ERPNext 16.50 — Stock and Manufacturing Deep Reference

New and changed behaviour in ERPNext 16.50.0 vs 16.6.1 baseline for stock,
valuation, serial/batch, pick list, inventory dimensions, manufacturing secondary
items, and subcontracting. See also
[erpnext-stock.md](erpnext-stock.md) and
[erpnext-manufacturing.md](erpnext-manufacturing.md).

---

## Valuation Adjustment Entry

The `Stock Reconciliation` doctype gained a third `purpose`: `"Adjustment Entry"`
(baseline had only `"Opening Stock"` and `"Stock Reconciliation"`). An Adjustment
Entry resets each item-warehouse to the stock your rows describe, without reposting
the entire ledger back through closed fiscal years.

**Flow:**

1. Run the **Stock Valuation Comparison** report (new in 16.50) to find
   item-warehouses where the actual ledger differs from expected valuation.
2. The report generates an Adjustment Entry draft via `AdjustmentEntry(doc).validate()`.
3. On submit, `AdjustmentEntry(doc).post()` runs a three-step reset per item-warehouse:
   - *Prime*: bring negative-qty batches/serials up to 0 or 1 unit.
   - *Count out*: zero all on-hand stock (SLEs with `is_adjustment_entry=1`).
   - *Count in*: post the rows from the reconciliation.
4. `validate_no_later_adjustment_entry(sle)` (`valuation_adjustment.py:864`) blocks
   any transaction or cancellation backdated before an existing Adjustment Entry on
   the same item-warehouse or serial/batch, raising `BackdatedEntryBeforeAdjustmentError`.

**Custom code impact:**
- Any SLE-creating or SLE-cancelling hook that runs against an item-warehouse that
  has an Adjustment Entry dated after the transaction will raise
  `BackdatedEntryBeforeAdjustmentError`. Gate with
  `frappe.db.exists("Stock Reconciliation", {"purpose": "Adjustment Entry", "docstatus": 1})`.
- The new `expected_valuation.py` module (`ADJUSTMENT_ENTRY` constant, `QueuePool`,
  `iterate_expected_stock_at`) is a private computation core; do not import or call
  it from custom code.

---

## Serial No Wise Valuation

`Item.use_serial_no_wise_valuation` (Check) — when `1`, every SLE for that item
tracks cost per serial number (FIFO per individual unit) instead of through the
shared FIFO queue. Activated item-by-item.

```python
from erpnext.stock.utils import is_serial_no_wise_valuation_disabled
is_serial_no_wise_valuation_disabled("ITEM-001")
# Returns True when item has_serial_no=1 but use_serial_no_wise_valuation=0
# (SLE will skip per-serial cost computation)
```

`is_serial_no_wise_valuation_disabled` is cached (`@request_cache`); clear it with
`frappe.local.request_cache.clear()` in tests.

**Migration:** patch `enable_serial_no_wise_valuation` set `use_serial_no_wise_valuation=1`
for all existing `has_serial_no` items on upgrade.

---

## Repost Item Valuation — 16.50 Changes

| Field / Constant | (<=16.6) | ERPNext 16.50 |
|---|---|---|
| `affected_transactions` | DF.Code | removed |
| `distinct_item_and_warehouse` | DF.Code | removed |
| `total_vouchers` | — | DF.Int |
| `vouchers_posted` | — | DF.Int |
| `recalculate_valuation_rate` | — | DF.Check |
| `recreate_stock_ledgers` | — | DF.Check |
| `repost_only_accounting_ledgers` | — | DF.Check |
| `MAX_VOUCHERS_PER_REPOST` | — | not present on Repost Item Valuation (it exists on Repost Accounting Ledger) |
| Status `"Partially Reposted"` | — | not on Repost Item Valuation (exists on Repost Accounting Ledger) |

Status `Literal`: `"Queued" | "In Progress" | "Completed" | "Skipped" | "Failed" | "Cancelled"`.

New validations:
- `validate_recreate_stock_ledgers` — blocks `recreate_stock_ledgers=1` for any
  Serial No or Batch No item.
- `validate_repost_only_accounting_ledgers` — blocks `repost_only_accounting_ledgers`
  when voucher type is `GL Entry`.
- `validate_update_stock` — ensures Sales/Purchase Invoice has `update_stock=1`
  before a repost is allowed against it.

New whitelisted methods on the document: `restart_reposting()`,
`bulk_restart_reposting(names)` (POST only, module-level).

---

## Pick List — `transferred_qty`

`Pick List Item` gained `transferred_qty` (Float). After a Pick List is
submitted, each time a Stock Entry linked to the Pick List is submitted, the
`transferred_qty` on matching `Pick List Item` rows increments.

```python
pick_list = frappe.get_doc("Pick List", name)
pick_list.is_fully_transferred()      # True if all picked qty is in stock entries
pick_list.is_partially_transferred()  # True if some but not all
status = pick_list.get_transfer_status()  # "Not Transferred" | "Partially Transferred" | "Fully Transferred"
```

`get_pending_transfer_stock_qty(location)` returns `picked_qty - transferred_qty`
for a given `Pick List Item` row.

---

## Inventory Dimensions — Server-Side Mandatory (ERPNext 16.50)

**Problem with the old approach:** setting `reqd=1` on the Custom Field the
dimension creates would block document cancellation, because Frappe validates
mandatory fields on cancel as well.

**New approach:** `Inventory Dimension` has `mandatory_depends_on_backend`
(SmallText). Custom Fields for mandatory dimensions are created with `reqd=0`;
server-side enforcement runs via `StockController.validate_inventory_dimension_mandatory()`
→ `validate_mandatory_dimensions_in_table(rows)` → `validate_mandatory_dimension_row(row, ...)`.
Cancellation is excluded from enforcement because the stock_controller sets this
only during `validate`.

```python
from erpnext.stock.doctype.inventory_dimension.inventory_dimension import get_mandatory_inventory_dimensions
dims = get_mandatory_inventory_dimensions("Stock Entry Detail")
# Returns list of dimension dicts that need server-side enforcement for that child table
```

`get_mandatory_inventory_dimensions` is `@request_cache`-wrapped. The result is
empty for doctypes that are not child tables of transactional stock documents.

---

## BOM Secondary Items — `valuation_type` Options

`BOM Secondary Item.valuation_type` can be one of:

| Value | Meaning |
|---|---|
| `"Valuation Rate"` | Cost = current valuation rate × qty |
| `"% of Component Cost"` | Cost = `cost_allocation_per`% of the finished-good component cost |
| `"Manual"` | Cost entered directly by the user |

`"% of FG Cost"` (old literal) was renamed to `"% of Component Cost"` by patch
`rename_component_cost_valuation_type`. Sites that migrated earlier and then had
`set_secondary_item_valuation_type` run may have had the old literal back-filled to
`"Valuation Rate"` on legacy rows before the rename, so verify actual field values.

The same `valuation_type` field appears on `Stock Entry Detail` and
`Subcontracting Receipt Item` rows for their secondary item lines.

---

## BOMCreator Instance Method Migration

In ERPNext <=16.6, `BOMCreator` exposed four `@frappe.whitelist()` module-level functions:

```python
# OLD (<=16.6) — module-level
from erpnext.manufacturing.doctype.bom_creator.bom_creator import (
    add_item, add_sub_assembly, delete_node, edit_bom_creator
)
```

In ERPNext 16.50 these are **instance methods** on the `BOMCreator` class. The
whitelist decorator is on the class, so they are still callable via the API (the
document name is the identifier), but direct module-level imports no longer work:

```python
# ERPNext 16.50 — instance method, call via frappe API or get_doc
doc = frappe.get_doc("BOM Creator", name)
doc.add_item(**kwargs)
doc.add_sub_assembly(**kwargs)
doc.delete_node(**kwargs)
doc.edit_bom_creator(docname, data)
```

---

## Sources

Verified against ERPNext v16.6.1 (baseline) and ERPNext 16.50.0 (target):

- `apps/erpnext/erpnext/stock/valuation_adjustment.py` (new in 16.50) — `BackdatedEntryBeforeAdjustmentError` (:49), `AdjustmentEntry` (:351), `validate_no_later_adjustment_entry` (:864)
- `apps/erpnext/erpnext/stock/expected_valuation.py` (new in 16.50) — `ADJUSTMENT_ENTRY`, `QueuePool`, `iterate_expected_stock_at`
- `apps/erpnext/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.json` — `purpose` options (:57)
- `apps/erpnext/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.py` — `validate_adjustment_entry` (:104), `AdjustmentEntry(self).post()` on submit (:137)
- `apps/erpnext/erpnext/stock/utils.py` — `is_serial_no_wise_valuation_disabled` (:415)
- `apps/erpnext/erpnext/stock/doctype/item/item.json` — `use_serial_no_wise_valuation` (:548)
- `apps/erpnext/erpnext/stock/doctype/repost_item_valuation/repost_item_valuation.py` — `status` Literal (:48), field list (:44-61), `validate_recreate_stock_ledgers` (:132), `validate_repost_only_accounting_ledgers` (:107), `bulk_restart_reposting` (:385)
- `apps/erpnext/erpnext/stock/doctype/pick_list/pick_list.py` — `is_fully_transferred` / `is_partially_transferred` / `get_transfer_status`, `get_pending_transfer_stock_qty` (:1829)
- `apps/erpnext/erpnext/stock/doctype/pick_list_item/pick_list_item.json` — `transferred_qty` (:263)
- `apps/erpnext/erpnext/stock/doctype/inventory_dimension/inventory_dimension.py` — `mandatory_depends_on_backend` DF note, `get_mandatory_inventory_dimensions` function
- `apps/erpnext/erpnext/controllers/stock_controller.py` — `validate_inventory_dimension_mandatory` method, `validate_mandatory_dimensions_in_table`, `validate_mandatory_dimension_row`
- `apps/erpnext/erpnext/manufacturing/doctype/bom_secondary_item/bom_secondary_item.json` — `valuation_type` (:185)
- `apps/erpnext/erpnext/manufacturing/doctype/bom_creator/bom_creator.py` — instance methods `add_item`, `add_sub_assembly`, `delete_node`, `edit_bom_creator`; baseline had module-level equivalents
- `apps/erpnext/erpnext/patches/v16_0/enable_serial_no_wise_valuation.py` — migration for `use_serial_no_wise_valuation`
- `apps/erpnext/erpnext/patches/v16_0/rename_component_cost_valuation_type.py` — renames `% of FG Cost` → `% of Component Cost`
- `apps/erpnext/erpnext/patches/v16_0/set_secondary_item_valuation_type.py` — back-fills `valuation_type` on BOM Secondary Item and SCR rows
- `apps/erpnext/erpnext/stock/report/stock_valuation_comparison/stock_valuation_comparison.json` — new report (16.50)
- `apps/erpnext/erpnext/manufacturing/doctype/production_plan/work_order_quantities.py` (new in 16.50) — `ProductionPlanWorkOrderQuantities`
