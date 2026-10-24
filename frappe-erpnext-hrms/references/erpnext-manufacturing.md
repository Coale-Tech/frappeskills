# ERPNext Manufacturing

BOM, Work Order, Job Card, Production Plan and subcontracting. Part of
[erpnext-workflows.md](erpnext-workflows.md).

---

`BOM(WebsiteGenerator)` (`manufacturing/doctype/bom/bom.py:104`) costs raw
materials per `rm_cost_as_per` (`DF.Literal["Valuation Rate", "Last Purchase
Rate", "Price List"]`, `bom.py:155`, default `Valuation Rate`). `update_cost`
recalculates costs down the BOM tree when a component's rate changes;
`BOM Update Tool` (queues a `BOM Update Log`, processed in batches via `BOM
Update Batch`) propagates a BOM/cost change to every BOM and Work
Order/Production Plan that references it, instead of editing each manually.

**BOM secondary items — renamed from scrap items (16.51):**
`BOM.scrap_items` (child: `BOM Scrap Item`) → `BOM.secondary_items` (child: `BOM Secondary Item`).
Cost fields: `scrap_material_cost`/`base_scrap_material_cost` →
`secondary_items_cost`/`base_secondary_items_cost`. Valuation literal `"% of FG Cost"` →
`"% of Component Cost"`. New fields: `cost_allocation`, `cost_allocation_per`,
`track_semi_finished_goods` (drives per-operation finished-good validation).
Patch `co_by_product_patch` migrated existing data; custom code reading the old child
table name or the old literal will fail silently. `(<=16.35):` child table was `BOM Scrap Item`.

## Work Order

`status` (Select, `work_order.json:107-113`) is exactly: *(blank)*, `Draft`,
`Submitted`, `Not Started`, `In Process`, `Stock Reserved`, `Stock Partially
Reserved`, `Completed`, `Stopped`, `Closed`, `Cancelled` — do not assume a
plain `Draft`/`Submitted`/`Completed` set.

```python
from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry, make_job_card
make_stock_entry(work_order_id, purpose, qty=None, target_warehouse=None,
    is_additional_transfer_entry=False)  # work_order.py:2353
make_job_card(work_order, operations)    # work_order.py:2456
```

`purpose` here is one of the manufacturing `Stock Entry` purposes (`Material
Transfer for Manufacture`, `Manufacture`, etc.) — see
[erpnext-stock.md](erpnext-stock.md#stock-entry). `make_stock_entry` derives
the WIP warehouse from the Work Order and returns an unsaved Stock Entry.

## Job Card

`JobCard(Document)` (`manufacturing/doctype/job_card/job_card.py:60`) tracks
one operation of a Work Order against a Workstation, with
`JobCardCancelError`/`JobCardOverTransferError` guards. Time is logged via
`make_time_log(kwargs)` (`job_card.py:1548`); the routing/operations list on
the BOM determines how many Job Cards a Work Order produces.

## Production Plan

`Production Plan` is a Document, not a submittable transaction with GL
impact; its "make" actions are instance methods, not module functions:

```python
plan = frappe.get_doc("Production Plan", name)
plan.get_items()                        # production_plan.py:316 — populate planned items from demand
plan.make_work_order()                  # production_plan.py:769 — dispatcher
plan.make_work_order_for_finished_goods(wo_list, default_warehouses)  # :788
plan.make_work_order_for_subassembly_items(wo_list, subcontracted_po, default_warehouses)  # :800
plan.get_sub_assembly_items(manufacturing_type=None)  # :1037

from erpnext.manufacturing.doctype.production_plan.production_plan import get_items_for_material_requests
get_items_for_material_requests(doc, warehouses=None, get_parent_warehouse_data=None)  # :1640
```

Material Requests for shortfall raw materials are generated from the second
(module-level) function above, not from a Work Order directly.

## Manufacturing Settings

`backflush_raw_materials_based_on` (`BOM` or `Material Transferred for
Manufacture`) decides whether consumption is deducted per the BOM quantity or
per what was actually transferred to WIP.
`overproduction_percentage_for_sales_order` /
`_for_work_order` cap how far a Work Order may exceed its planned qty before
validation blocks it — read these instead of hardcoding a tolerance.

## Subcontracting

v15+ subcontracting is **not** the legacy Purchase Order
`is_subcontracted` checkbox flow alone: `Subcontracting Order` and
`Subcontracting Receipt` (with `Subcontracting Order Item`/`Supplied Item`,
`Subcontracting Receipt Item`/`Supplied Item`) are dedicated DocTypes created
from a Purchase Order (`purchase_order.py:901`,
[erpnext-selling-buying.md](erpnext-selling-buying.md)) that track supplied
raw materials, service items and BOM consumption explicitly through
`SubcontractingController(StockController)`
(`controllers/subcontracting_controller.py:26`). The PO's `is_subcontracted`
field still exists and gates whether the Subcontracting Order option is
offered, but the actual receipt/consumption ledger runs through
Subcontracting Order/Receipt, not the PO itself. `Subcontracting Inward
Order`/`...Receipt` are the reverse flow — this company subcontracting for
another company — and `Subcontracting Inward Controller` is mixed into
`Stock Entry` for that side.

## v16: Production Plan extensions

`Master Production Schedule` (+ `Master Production Schedule Item`) **(v16)**
and `Sales Forecast` (+ `Sales Forecast Item`) **(v16)** are new planning
DocTypes that feed longer-horizon demand into Production Plan, above the
single-run planning Production Plan already did. `Workstation Cost`,
`Workstation Operating Component` and `Workstation Operating Component
Account` **(v16)** break Workstation costing into per-component operating
cost lines (e.g. power, consumables) posted to specific accounts, instead of
one flat hourly rate on the Workstation.

## Sources

Verified against ERPNext v16.6.1 (coale_v16) and ERPNext 16.50.0 (16.51.1 bench 16.51):

- `apps/erpnext/erpnext/manufacturing/doctype/bom/bom.py` — `BOM(WebsiteGenerator)` (:104), `rm_cost_as_per` (:155); 16.51.1 bench: `secondary_items` (:161), `secondary_items_cost` (:162), `validate_secondary_items` (:304); coale_v16: `scrap_items` (:158), `validate_scrap_items` (:1216)
- `apps/erpnext/erpnext/manufacturing/doctype/work_order/work_order.json` — `status` options (:107-113)
- `apps/erpnext/erpnext/manufacturing/doctype/work_order/work_order.py` — `make_stock_entry` (:2353), `make_job_card` (:2456)
- `apps/erpnext/erpnext/manufacturing/doctype/job_card/job_card.py` — `JobCard(Document)` (:60), `make_time_log` (:1548)
- `apps/erpnext/erpnext/manufacturing/doctype/production_plan/production_plan.py` — `get_items` (:316), `make_work_order` (:769), `get_items_for_material_requests` (:1640)
- `apps/erpnext/erpnext/manufacturing/doctype/manufacturing_settings/manufacturing_settings.json` — `backflush_raw_materials_based_on`, `overproduction_percentage_for_*`
- `apps/erpnext/erpnext/controllers/subcontracting_controller.py` — `SubcontractingController(StockController)` (:26)
- `apps/erpnext/erpnext/buying/doctype/purchase_order/purchase_order.py` — `make_subcontracting_order` (:901)
- Patch: `apps/erpnext/erpnext/patches/v16_0/co_by_product_patch.py` (16.51.1 bench) — renamed scrap→secondary items
- Directory listing: `apps/erpnext/erpnext/manufacturing/doctype/` (v16-only: `master_production_schedule`, `sales_forecast`, `workstation_cost`, `workstation_operating_component`; 16.51: `bom_secondary_item`, `job_card_secondary_item`, `work_order_additional_item`)
