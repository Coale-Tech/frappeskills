# ERPNext Stock

Stock Entry, Bin, valuation, serial/batch, and reposting. Part of
[erpnext-workflows.md](erpnext-workflows.md). Posting mechanics are in
[erpnext-architecture.md](erpnext-architecture.md#stock-ledger-posting-path).

---

## Stock Entry

`purpose` (Select, `stock_entry.json:133`) is one of: `Material Issue`,
`Material Receipt`, `Material Transfer`, `Material Transfer for Manufacture`,
`Material Consumption for Manufacture`, `Manufacture`, `Repack`, `Send to
Subcontractor`, `Disassemble`, `Receive from Customer`, `Return Raw Material
to Customer`, `Subcontracting Delivery`, `Subcontracting Return`. Purpose
drives which `s_warehouse`/`t_warehouse` combination is required per row and
which controller validations run (`stock/doctype/stock_entry/stock_entry.py`,
`StockEntry(StockController, SubcontractingInwardController)`).

## Bin

One `Bin` per item/warehouse holds running quantities (`bin.json`):

| Field | Meaning |
|---|---|
| `actual_qty` | Physical qty on hand (from Stock Ledger Entry) |
| `reserved_qty` | Reserved against Sales Order via `update_stock` or Stock Reservation |
| `reserved_qty_for_production` / `_for_sub_contract` / `_for_production_plan` | Reserved by manufacturing/subcontracting demand |
| `ordered_qty` | On open Purchase Orders |
| `indented_qty` | On open Material Requests |
| `planned_qty` | On open Work Orders |
| `projected_qty` | `actual_qty + ordered_qty + indented_qty + planned_qty - reserved_qty*` |

Never write `Bin` directly; it is maintained by SLE posting and the
reservation/requisition documents above.

## Valuation

Set per item (`Item.valuation_method`: `FIFO`, `Moving Average`, or `LIFO`;
all three remain active in ERPNext 16.50). Key read APIs, all in `erpnext/stock/`:

```python
from erpnext.stock.utils import get_stock_balance, get_latest_stock_qty, get_stock_value_on
get_stock_balance(item_code, warehouse, posting_date=None, posting_time=None,
    with_valuation_rate=False, with_serial_no=False,
    inventory_dimensions_dict=None)               # utils.py:96  (ERPNext 16.50)
get_latest_stock_qty(item_code, warehouse=None)   # utils.py:177
get_stock_value_on(warehouses=None, posting_date=None, item_code=None,
    company=None)                                 # utils.py:59 (accepts list or str)

from erpnext.stock.stock_ledger import get_previous_sle, get_valuation_rate
get_previous_sle(args, for_update=False, extra_cond=None, for_report=False)  # stock_ledger.py:2119
get_valuation_rate(item_code, warehouse, voucher_type, voucher_no,
    allow_zero_rate=False, currency=None, company=None,
    fallbacks=True, raise_error_if_no_rate=True, batch_no=None,
    serial_and_batch_bundle=None, posting_datetime=None, creation=None)  # stock_ledger.py:2271
```

`get_incoming_rate(args, raise_error_if_no_rate=True, fallbacks=True)` (`stock/utils.py:253`)
is what controllers call to price an inward stock row.
`(<=16.6):` `get_stock_balance` had no `inventory_dimensions_dict`; `get_valuation_rate` had no
`fallbacks`/`posting_datetime`/`creation`; `get_incoming_rate` had no `fallbacks`.

## Serial No Wise Valuation (ERPNext 16.50)

`Item.use_serial_no_wise_valuation` (Check, `item.json`) – when enabled on a
serialized item, each serial number tracks its own cost through the ledger
(FIFO-only per serial). Migration patch `enable_serial_no_wise_valuation`
back-filled this flag to 1 for all existing `has_serial_no` items.
`is_serial_no_wise_valuation_disabled(item_code)` (`stock/utils.py:415`) returns
`True` when the item has serial nos but the per-serial costing is OFF, which
skips serial-wise outgoing rate computation. `(<=16.6):` field did not exist;
all serial items costed through the FIFO queue.

## Serial and Batch Bundle

`Serial and Batch Bundle` (with child `Serial and Batch Entry`) exists in
both v15 and v16 as the structured replacement for the legacy `serial_no`
newline-text field and bare `batch_no` link on transaction item rows: one
bundle groups the exact serials/batches and quantities consumed or produced
by a single row. `Stock Settings.use_serial_batch_fields`
(`stock_settings.json:446`) toggles whether the UI still shows the legacy
flat `serial_no`/`batch_no` fields (auto-building a bundle behind the scenes)
or requires picking a bundle directly — it does not change what is actually
stored on submit.

## Stock Reservation Entry

Reserves specific serial/batch/qty against a Sales Order before delivery
(`Stock Settings.enable_stock_reservation`). Distinct from the plain
`reserved_qty` a Sales Order without reservation puts on `Bin` — reservation
entries are their own ledger, checked by
`SellingController.has_unreserved_stock()`/`has_reserved_stock()`
(`selling_controller.py`, surfaced via `onload` in
[erpnext-architecture.md](erpnext-architecture.md)).

## Repost Item Valuation

A backdated or edited stock document invalidates every later-dated SLE for
processed (`erpnext/stock/stock_ledger.py`: `repost_future_sle`:268,
`get_items_to_be_repost`:487) to recompute valuation and running qty forward
from the edit point, then `repost_future_sle_and_gle()` regenerates the
dependent GL entries. Never hand-edit an old SLE's `qty_after_transaction`.

**ERPNext 16.50 Repost Item Valuation changes** vs `(<=16.6)`:
- Removed fields: `affected_transactions`, `distinct_item_and_warehouse`
- Added fields: `total_vouchers`, `vouchers_posted`, `recalculate_valuation_rate`,
  `recreate_stock_ledgers`, `repost_only_accounting_ledgers`
- Status `Literal`: `"Queued" | "In Progress" | "Completed" | "Skipped" | "Failed" | "Cancelled"`
  (no "Partially Reposted" status exists in 16.50)
- New validation: `validate_recreate_stock_ledgers` blocks `recreate_stock_ledgers`
  for Serial/Batch items; `validate_repost_only_accounting_ledgers` blocks GL-Entry voucher types.

**Valuation Adjustment Entry (ERPNext 16.50):** a `Stock Reconciliation` with
`purpose = "Adjustment Entry"` (new option; `(<=16.6):` only `"Opening Stock"` and
`"Stock Reconciliation"`) resets each item-warehouse to the correct valuation
without reposting across closed fiscal years. Implemented in two new files:
`erpnext/stock/valuation_adjustment.py` and `erpnext/stock/expected_valuation.py`.
Once an Adjustment Entry exists, `validate_no_later_adjustment_entry` on SLE.validate
raises `BackdatedEntryBeforeAdjustmentError` for any transaction posted before it.
`is_adjustment_entry` (Check) on `Stock Ledger Entry` existed in <=16.6 but the
`AdjustmentEntry` class and the Reconciliation purpose are new in 16.50.
See also: **Stock Valuation Comparison** report (new in 16.50) — compares expected
vs actual valuation and generates Adjustment Entry rows.

## Inventory Dimensions (ERPNext 16.50)

`Inventory Dimension` lets a site add a custom stock-splitting dimension
(e.g. Cold Storage Location) beyond Warehouse/Batch/Serial; it auto-adds the
dimension's field to Stock Entry, transaction item tables, and `Stock Ledger
Entry`/`Bin` so valuation and quantity tracking stay dimension-aware.

**ERPNext 16.50:** new field `mandatory_depends_on_backend` on `Inventory Dimension`
— mandatory enforcement is now server-side via
`StockController.validate_inventory_dimension_mandatory()` (not `reqd` on the
Custom Field, so cancel is never blocked). `get_mandatory_inventory_dimensions(doctype)`
(`inventory_dimension.py`) returns dimensions that need server enforcement.
`(<=16.6):` no `mandatory_depends_on_backend`; mandatory was set via `reqd` on the
Custom Field directly.

## UOM conversion

Every item row carries `uom`, `conversion_factor` and `stock_qty =
qty * conversion_factor`; `stock_qty` (not `qty`) is what SLE/valuation and
Bin quantities use. Ledger and reporting code should read `stock_qty`, never
recompute conversion by hand.

## Serial No Inventory Dimensions (ERPNext 16.50)

Outward SLEs for serialized items now validate that each serial's inventory dimension
(e.g. custom project dimension) matches the dimension recorded when it was last received,
raising `SerialNoInventoryDimensionError` on mismatch. Dimension must be consistent
end-to-end for a serial number's lifecycle. `(<=16.35):` dimension mismatch was not
validated on outward SLEs.

## Landed Cost Voucher (ERPNext 16.50)

Distributes additional cost (freight, customs) across a Purchase
Receipt/Invoice's item rows by updating their valuation rate and reposting
the affected SLEs (`via_landed_cost_voucher=True` on the SLE functions above).

**ERPNext 16.50:** Accounting Dimensions are now propagated to `Landed Cost Taxes
and Charges` rows via patch `create_accounting_dimensions_in_landed_cost_taxes_and_charges`.
New controller methods: `validate_expense_accounts`, `validate_mandatory_dimensions`.

## Quality Inspection

If `Item.inspection_required_before_purchase`/`...before_delivery` is set,
the controller requires a submitted `Quality Inspection` referencing the
transaction row before it can be submitted, raising
`QualityInspectionRequiredError` / `QualityInspectionRejectedError`.
**(ERPNext 16.50):** these error classes are now defined in `erpnext/exceptions.py`
(lines 34-52) and only imported into `stock_controller.py`; import from
`erpnext.exceptions` in custom code. `(<=16.6):` defined in
`controllers/stock_controller.py:40-48`.

## Putaway Rule and Pick List (ERPNext 16.50)

`Putaway Rule` auto-suggests warehouse/qty split on inward stock (capacity
per item/warehouse). `Pick List` (+ `Pick List Item`) batches multiple Sales
Orders/Material Requests into one warehouse picking run, then generates
Delivery Notes/Stock Entries from the picked quantities.

**ERPNext 16.50:** `Pick List Item` has a new `transferred_qty` field that tracks
how much of the `picked_qty` has been moved into submitted Stock Entries.
Back-filled by patch `backfill_pick_list_transferred_qty`.
`pick_list.py` adds `is_fully_transferred()`, `is_partially_transferred()` and
`get_transfer_status()` methods. `(<=16.6):` no `transferred_qty`.

## Perpetual inventory

`erpnext.is_perpetual_inventory_enabled(company)` (`erpnext/__init__.py:78`,
see [erpnext-architecture.md](erpnext-architecture.md)) gates whether stock
movements also produce GL entries against the item's `Item Group`/`Item`
stock/COGS accounts; with it off, ERPNext tracks quantity only, no
accounting impact.

## Stock Settings changes (ERPNext 16.50)

**Removed** (were in `(<=16.6)`): `allow_from_dn` ("Allow Material Transfer from
Delivery Note to Sales Invoice") and `allow_from_pr` ("Allow Material Transfer from
Purchase Receipt to Purchase Invoice").

**Added**: `allow_to_edit_stock_uom_qty_for_stock_entry`,
`auto_map_raw_materials_to_finished_goods` (on Manufacture/Repack submit, auto-map
raw material serial/batch nos not yet assigned to finished goods),
`enable_serial_and_batch_no_for_item` ("Activate Serial / Batch No for Item").

## Book Stock Expense GL Entries (ERPNext 16.50)

New `Accounts Settings.book_stock_expense_gl_entries` (Check, default off). When
enabled, the `Purchase Expense Account` / `Expenses Added To Stock` account pairs
are mandatory in Company or Item Defaults for Purchase Receipt, Purchase Invoice,
Stock Entry, Stock Reconciliation and Landed Cost Voucher. Migration patch
`enable_book_stock_expense_gl_entries` auto-enables this on sites that already had
expense accounts configured. `(<=16.6):` these expense GL pairs posted regardless;
the flag makes them explicitly opt-in.

## Sources

Verified against ERPNext v16.6.1 (baseline) and ERPNext 16.50.0 (target):

- `apps/erpnext/erpnext/stock/doctype/stock_entry/stock_entry.json` — `purpose` options (:143)
- `apps/erpnext/erpnext/stock/doctype/bin/bin.json` — field list
- `apps/erpnext/erpnext/stock/utils.py` — `get_stock_balance` (:96), `get_latest_stock_qty` (:177), `get_incoming_rate` (:253), `get_stock_value_on` (:59), `is_serial_no_wise_valuation_disabled` (:415)
- `apps/erpnext/erpnext/stock/stock_ledger.py` — `get_previous_sle` (:2119), `get_valuation_rate` (:2271), `repost_future_sle` (:268), `get_items_to_be_repost` (:487)
- `apps/erpnext/erpnext/stock/doctype/repost_item_valuation/repost_item_valuation.py` — `status` Literal (:48), `total_vouchers`/`vouchers_posted`/`recalculate_valuation_rate` (:50-61), `validate_repost_only_accounting_ledgers` (:107), `validate_recreate_stock_ledgers` (:132)
- `apps/erpnext/erpnext/stock/valuation_adjustment.py` (16.50, new) — `validate_no_later_adjustment_entry` (:864), `BackdatedEntryBeforeAdjustmentError` (:49), `AdjustmentEntry` class (:351)
- `apps/erpnext/erpnext/stock/expected_valuation.py` (16.50, new) — `ADJUSTMENT_ENTRY` constant, `iterate_expected_stock_at`
- `apps/erpnext/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.json` — `purpose` options: `Opening Stock`, `Stock Reconciliation`, `Adjustment Entry` (16.50); old baseline had only two options
- `apps/erpnext/erpnext/stock/doctype/stock_ledger_entry/stock_ledger_entry.py` — `is_adjustment_entry` (:61), `validate_serial_no_inventory_dimension` import (:21)
- `apps/erpnext/erpnext/stock/doctype/stock_settings/stock_settings.json` — `use_serial_batch_fields`, `enable_serial_and_batch_no_for_item`, `auto_map_raw_materials_to_finished_goods`
- `apps/erpnext/erpnext/stock/doctype/stock_settings/stock_settings.py` — `allow_to_edit_stock_uom_qty_for_stock_entry` (:35); baseline had `allow_from_dn` (:29), `allow_from_pr` (:30)
- `apps/erpnext/erpnext/accounts/doctype/accounts_settings/accounts_settings.json` — `book_stock_expense_gl_entries` (:785)
- `apps/erpnext/erpnext/controllers/stock_controller.py` — `validate_inventory_dimension_mandatory` method; baseline had `QualityInspectionRequiredError` (:40-48); 16.50 imports these from `erpnext/exceptions.py` (:29-32)
- `apps/erpnext/erpnext/exceptions.py` — `QualityInspectionRequiredError` (:34), `QualityInspectionRejectedError` (:38), `QualityInspectionNotSubmittedError` (:42), `BatchExpiredError` (:46)
- `apps/erpnext/erpnext/stock/doctype/pick_list_item/pick_list_item.json` — `transferred_qty` (:263, 16.50)
- `apps/erpnext/erpnext/stock/doctype/inventory_dimension/inventory_dimension.py` — `mandatory_depends_on_backend` DF field, `get_mandatory_inventory_dimensions` function (16.50)
- `apps/erpnext/erpnext/stock/doctype/item/item.json` — `use_serial_no_wise_valuation` (:548)
- `apps/erpnext/erpnext/patches/v16_0/` — `enable_serial_no_wise_valuation.py`, `backfill_pick_list_transferred_qty.py`, `create_accounting_dimensions_in_landed_cost_taxes_and_charges.py`, `enable_book_stock_expense_gl_entries.py`
- `apps/erpnext/erpnext/stock/report/stock_valuation_comparison/` (16.50, new report)
- Directory listing: `apps/erpnext/erpnext/stock/doctype/` on both benches — `stock_closing_balance` and `stock_closing_entry` present in both v16.6 and v16.50 (the removed v15 doctype was `closing_stock_balance`, not present in either v16 branch)
