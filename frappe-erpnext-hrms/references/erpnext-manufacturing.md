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

**BOM secondary items — renamed from scrap items (ERPNext 16.50):**
`BOM.scrap_items` (child: `BOM Scrap Item`) → `BOM.secondary_items` (child: `BOM Secondary Item`).
Cost fields: `scrap_material_cost`/`base_scrap_material_cost` →
`secondary_items_cost`/`base_secondary_items_cost`. `BOM Secondary Item.valuation_type`
options: `"Valuation Rate"`, `"% of Component Cost"`, `"Manual"` (the old literal
`"% of FG Cost"` was renamed via patch `rename_component_cost_valuation_type`).
New fields on BOM: `cost_allocation`, `cost_allocation_per`,
`track_semi_finished_goods` (drives per-operation finished-good validation).
`BOM.set_bom_scrap_items_detail` → `set_secondary_items_details`;
`BOM.calculate_sm_cost` → `calculate_secondary_items_costs`;
module function `get_scrap_items_from_sub_assemblies` → `get_secondary_items_from_sub_assemblies`.
Patch `co_by_product_patch` migrated existing data; custom code reading the old child
table name, old function name, or old literal will fail. `(<=16.6):` child table was `BOM Scrap Item`.

## Work Order

`status` (Select, `work_order.json:107-113`) is exactly: *(blank)*, `Draft`,
`Submitted`, `Not Started`, `In Process`, `Stock Reserved`, `Stock Partially
Reserved`, `Completed`, `Stopped`, `Closed`, `Cancelled` — do not assume a
plain `Draft`/`Submitted`/`Completed` set.

```python
from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry, make_job_card
make_stock_entry(work_order_id, purpose, qty=None, target_warehouse=None,
    is_additional_transfer_entry=False,
    source_stock_entry=None)              # work_order.py:2759 (ERPNext 16.50)
make_job_card(work_order, operations, parent_bom=None)  # work_order.py:2892 (ERPNext 16.50)

`purpose` here is one of the manufacturing `Stock Entry` purposes (`Material
Transfer for Manufacture`, `Manufacture`, etc.) — see
[erpnext-stock.md](erpnext-stock.md#stock-entry). `make_stock_entry` derives
the WIP warehouse from the Work Order and returns an unsaved Stock Entry.

## Job Card

`JobCard(Document)` (`manufacturing/doctype/job_card/job_card.py:60`) tracks
one operation of a Work Order against a Workstation, with
`JobCardCancelError`/`JobCardOverTransferError` guards. Time is logged via
`make_time_log(kwargs)` (`job_card.py:1829`); the routing/operations list on
the BOM determines how many Job Cards a Work Order produces.

**ERPNext 16.50 Job Card changes:**
- `scrap_items` table renamed to `secondary_items` (child: `Job Card Secondary Item`)
- New `stock_uom` field; back-filled by patch `set_stock_uom_in_job_card`
- `validate_produced_quantity(for_quantity, process_loss_qty, pending_qty, wo)` —
  added `pending_qty` parameter
- `update_work_order_data(for_quantity, process_loss_qty, pending_qty, time_in_mins, wo)` —
  added `pending_qty` parameter
- New methods: `validate_not_on_hold`, `validate_time_logs_present`,
  `get_qty_to_produce`, `set_stock_uom`, `get_max_completable_qty`

## Production Plan

`Production Plan` is a Document, not a submittable transaction with GL
impact; its "make" actions are instance methods, not module functions:

```python
plan = frappe.get_doc("Production Plan", name)
plan.get_items()                        # production_plan.py:366 — populate planned items from demand
plan.make_work_order()                  # production_plan.py:823 — dispatcher
plan.make_work_order_for_finished_goods(wo_list, default_warehouses)  # :843
plan.make_work_order_for_subassembly_items(wo_list, subcontracted_po, default_warehouses)  # :855
plan.get_sub_assembly_items(manufacturing_type=None)  # :1101

from erpnext.manufacturing.doctype.production_plan.production_plan import get_items_for_material_requests
get_items_for_material_requests(doc, warehouses=None, get_parent_warehouse_data=None)  # :1831
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

**ERPNext 16.50:** `set_op_cost_and_scrap_from_sub_assemblies` (field and checkbox)
renamed to `set_op_cost_and_secondary_items_from_sub_assemblies` in
`manufacturing_settings.json`. Custom code reading the old field name will silently
get `None`. `(<=16.6):` old name `set_op_cost_and_scrap_from_sub_assemblies`.

## Subcontracting

v15+ subcontracting is **not** the legacy Purchase Order
`is_subcontracted` checkbox flow alone: `Subcontracting Order` and
`Subcontracting Receipt` (with `Subcontracting Order Item`/`Supplied Item`,
`Subcontracting Receipt Item`/`Supplied Item`) are dedicated DocTypes created
from a Purchase Order (`purchase_order.py:1017`,
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

**ERPNext 16.50 Subcontracting changes:**
- `Subcontracting Receipt Item` now has `secondary_item_type` and `valuation_type`
  fields (secondary items on SCR); `rename_secondary_item_type_field` patch renamed
  the old `type` field.
- `set_subcontracting_order_status(sco, status=None)` is the new authoritative
  function; `update_subcontracting_order_status` also updated but both exist in 16.50.
- `recalculate_subcontracting_order_service_cost` patch recomputed SCO service costs
  (conversion rate and currency propagation fix).

## v16 / ERPNext 16.50: Planning and Workstation extensions

`Master Production Schedule` (+ `Master Production Schedule Item`) **(v16)**
and `Sales Forecast` (+ `Sales Forecast Item`) **(v16)** are new planning
DocTypes that feed longer-horizon demand into Production Plan, above the
single-run planning Production Plan already did. `Workstation Cost`,
`Workstation Operating Component` and `Workstation Operating Component
Account` **(v16)** break Workstation costing into per-component operating
cost lines (e.g. power, consumables) posted to specific accounts, instead of
one flat hourly rate on the Workstation.

**ERPNext 16.50:** `Work Order Additional Item` — new DocType; Work Order gains
a virtual read-only `secondary_items` table backed by this doctype, showing
secondary items (by-products, scrap) as per BOM. Do not write to it directly.

**ERPNext 16.50:** `ProductionPlanWorkOrderQuantities` class
(`manufacturing/doctype/production_plan/work_order_quantities.py`) tracks
submitted Work Orders and process loss separately per plan row for accurate
overproduction enforcement; `plan.validate_work_order(wo, process_loss_qty=0)`
is the entry point called during Job Card completion.

**ERPNext 16.50:** `BOMCreator` — `add_item`, `add_sub_assembly`, `delete_node`
and `edit_bom_creator` moved from module-level functions to instance methods.
Custom code that imported these as `from ... import add_item` at module level
will break. `(<=16.6):` these were module-level `@frappe.whitelist()` functions.

## Sources

Verified against ERPNext v16.6.1 (baseline) and ERPNext 16.50.0 (target):

- `apps/erpnext/erpnext/manufacturing/doctype/bom/bom.py` — `BOM(WebsiteGenerator)` (:104), `rm_cost_as_per` (:158), `secondary_items` (:161), `secondary_items_cost` (:162), `validate_secondary_items` (:363), `calculate_secondary_items_costs`; baseline: `scrap_items` (:158), `validate_scrap_items`
- `apps/erpnext/erpnext/manufacturing/doctype/bom_secondary_item/bom_secondary_item.json` — `valuation_type` options: `"Valuation Rate"`, `"% of Component Cost"`, `"Manual"` (:185)
- `apps/erpnext/erpnext/manufacturing/doctype/work_order/work_order.json` — `status` options (verified unchanged from baseline)
- `apps/erpnext/erpnext/manufacturing/doctype/work_order/work_order.py` — `make_stock_entry` (:2759), `make_job_card` (:2892); baseline: `make_stock_entry` (:2353), `make_job_card` (:2456)
- `apps/erpnext/erpnext/manufacturing/doctype/work_order_additional_item/work_order_additional_item.json` (16.50, new)
- `apps/erpnext/erpnext/manufacturing/doctype/job_card/job_card.py` — `JobCard(Document)` (:60), `make_time_log` (:1829); baseline: `make_time_log` (:1548)
- `apps/erpnext/erpnext/manufacturing/doctype/job_card/job_card.json` — `secondary_items` field (:632); baseline: `scrap_items` (:433)
- `apps/erpnext/erpnext/manufacturing/doctype/production_plan/production_plan.py` — `get_items` (:366), `make_work_order` (:823), `get_items_for_material_requests` (:1831); baseline: (:316), (:769), (:1640)
- `apps/erpnext/erpnext/manufacturing/doctype/production_plan/work_order_quantities.py` (16.50, new) — `ProductionPlanWorkOrderQuantities`
- `apps/erpnext/erpnext/manufacturing/doctype/manufacturing_settings/manufacturing_settings.json` — `set_op_cost_and_secondary_items_from_sub_assemblies`; baseline had `set_op_cost_and_scrap_from_sub_assemblies`
- `apps/erpnext/erpnext/manufacturing/doctype/bom_creator/bom_creator.py` — `add_item`, `add_sub_assembly`, `delete_node`, `edit_bom_creator` now instance methods; baseline had module-level functions
- `apps/erpnext/erpnext/controllers/subcontracting_controller.py` — `SubcontractingController(StockController)` (:26)
- `apps/erpnext/erpnext/buying/doctype/purchase_order/purchase_order.py` — `make_subcontracting_order` (:1017); baseline: (:901)
- `apps/erpnext/erpnext/subcontracting/doctype/subcontracting_order/subcontracting_order.py` — `set_subcontracting_order_status` (16.50, new function)
- Patches: `apps/erpnext/erpnext/patches/v16_0/co_by_product_patch.py` (BOM scrap→secondary), `rename_component_cost_valuation_type.py` (`% of FG Cost`→`% of Component Cost`), `set_secondary_item_valuation_type.py`, `rename_secondary_item_type_field.py`, `set_stock_uom_in_job_card.py`, `recalculate_subcontracting_order_service_cost.py`
- Directory: `apps/erpnext/erpnext/manufacturing/doctype/` — `bom_secondary_item`, `job_card_secondary_item`, `work_order_additional_item` present in 16.50; baseline had `bom_scrap_item`, `job_card_scrap_item` instead
