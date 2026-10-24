# ERPNext Selling & Buying

The sell and buy document chains, their real mapper functions, item-detail
fetch, and pricing. Part of [erpnext-workflows.md](erpnext-workflows.md).
Controller hierarchy is in [erpnext-architecture.md](erpnext-architecture.md).

---

## Chains and mapper functions

Every "Create X" button in the UI calls a `@frappe.whitelist()` mapper that
wraps `frappe.model.mapper.get_mapped_doc` (`frappe/model/mapper.py:55`).
Fields with the same fieldname on both DocTypes auto-map; a field list under
`"field_no_map"` in the mapping table is explicitly excluded (e.g. Sales
Order → Delivery Note excludes `payment_terms_template`,
`sales_order.py:1459`). Always create the next document through its mapper,
not by copying fields by hand — mappers also carry over `field_no_map`
exclusions and per-row `postprocess` logic that plain copying misses.

### Sell: Lead → Opportunity → Quotation → Sales Order → Delivery Note → Sales Invoice

| From → To | Function | Source |
|---|---|---|
| Lead → Customer | `make_customer(source_name, target_doc=None)` | `crm/doctype/lead/lead.py:316` |
| Lead → Opportunity | `make_opportunity(source_name, target_doc=None)` | `lead.py:363` |
| Lead → Quotation | `make_quotation(source_name, target_doc=None)` | `lead.py:393` |
| Opportunity → Quotation | `make_quotation(source_name, target_doc=None)` | `crm/doctype/opportunity/opportunity.py:410` |
| Opportunity → Customer | `make_customer(source_name, target_doc=None)` | `opportunity.py:485` |
| Quotation → Sales Order | `make_sales_order(source_name: str, target_doc=None, args=None)` | `selling/doctype/quotation/quotation.py:377` |
| Sales Order → Delivery Note | `make_delivery_note(source_name, target_doc=None, kwargs=None)` | `selling/doctype/sales_order/sales_order.py:1206` |
| Sales Order → Sales Invoice | `make_sales_invoice(source_name, target_doc=None, args=None, ignore_permissions=False)` | `sales_order.py:1391` |
| Delivery Note → Sales Invoice | `make_sales_invoice(source_name, target_doc=None, args=None)` | `stock/doctype/delivery_note/delivery_note.py:835` |
| Sales Invoice → Delivery Note | `make_delivery_note(source_name, target_doc=None)` | `accounts/doctype/sales_invoice/sales_invoice.py:2509` |

### Buy: Material Request → RFQ/Supplier Quotation → Purchase Order → Purchase Receipt → Purchase Invoice

| From → To | Function | Source |
|---|---|---|
| Material Request → RFQ | `make_request_for_quotation(source_name, target_doc=None)` | `stock/doctype/material_request/material_request.py:788` |
| Material Request → Supplier Quotation | `make_supplier_quotation(source_name, target_doc=None)` | `material_request.py:948` |
| Material Request → Purchase Order | `make_purchase_order(source_name, target_doc=None, args=None)` | `material_request.py:598` |
| Material Request → POs by supplier **(ERPNext 16.50)** | `make_purchase_orders_by_supplier(source_name, item_suppliers)` | `material_request.py:715` |
| Purchase Order → Purchase Receipt | `make_purchase_receipt(source_name, target_doc=None, args=None)` | `buying/doctype/purchase_order/purchase_order.py:804` |
| Purchase Order → Purchase Invoice | `make_purchase_invoice(source_name, target_doc=None, args=None)` | `purchase_order.py:873` |
| Purchase Order → Subcontracting Order | `make_subcontracting_order(source_name, target_doc=None, save=False, submit=False, notify=False)` | `purchase_order.py:1017` |
| Purchase Receipt → Purchase Invoice | `make_purchase_invoice(source_name, target_doc=None, args=None)` | `stock/doctype/purchase_receipt/purchase_receipt.py:1527` |

Returns (not their own DocTypes — reuse the same mapper with the source's
return fields already set): `Sales Invoice.make_sales_return` (`sales_invoice.py:2558`)
and `Purchase Receipt.make_purchase_return` (`purchase_receipt.py:1689`) build
a negative-qty document via `make_return_doc`, with `is_return=1` and
`return_against` set to the source name.

Other real mappers worth knowing: `Sales Order.make_material_request`
(`sales_order.py:1077`), `Sales Order.make_purchase_order` — drop ship
(`sales_order.py:1711`), `Sales Order.make_work_orders` (`sales_order.py:1886`),
`Delivery Note.make_shipment` (`delivery_note.py:1086`), and inter-company
mirrors (`make_inter_company_purchase_order`,
`make_inter_company_purchase_receipt`, etc.) that create the counterpart
document in a linked company.

## Overriding a mapper in a custom app

Do not monkey-patch the function. Point `override_whitelisted_methods` in
`hooks.py` at your own function that calls the original and mutates the
returned doc, or add `doc_events` on the target DocType's `before_insert` to
adjust fields the mapper just set (see
[erpnext-extending.md](erpnext-extending.md)).

`get_qty_already_mapped(target_doc, ref_field, qty_field="qty")` **(ERPNext 16.50)**
(`controllers/mapper.py:1`) returns a `{source_row_name: qty}` map of rows already
present on the in-progress (unsaved) target document — pass it to your custom mapper's
`postprocess` to avoid double-mapping when the user opens the same source document twice
via "Get Items From".

## get_item_details

```python
from erpnext.stock.get_item_details import get_item_details
get_item_details(ctx, doc=None, for_validate=False, overwrite_warehouse=True)
# stock/get_item_details.py:85 — returns an ItemDetails dict (frappe._dict)
```

This is what fills price, UOM, tax template and warehouse defaults on an
item row whenever an item is picked or an item-affecting field changes on
the client. `ctx` is a dict of the current row/document context (item_code,
qty, company, price_list, customer/supplier, etc. — see
`ItemDetailsCtx`/`normalize_ctx_input` in the same file). **v16 renamed the
parameter from `args` to `ctx`**; the v15 baseline signature is `(args,
doc=None, for_validate=False, overwrite_warehouse=True)`
(`get_item_details.py:39` in the v15 baseline) — positional calls still work,
but a custom app passing `args=` as a keyword must switch to `ctx=`.

## Pricing Rule and Price List

```python
from erpnext.accounts.doctype.pricing_rule.pricing_rule import get_pricing_rule_for_item, apply_pricing_rule
get_pricing_rule_for_item(args, doc=None, for_validate=False)  # pricing_rule.py:446
apply_pricing_rule(args, doc=None)                             # pricing_rule.py:364
```

Precedence when multiple rules match: `priority` field first, then the more
specific rule (item code over item group over brand; customer over customer
group over territory) wins — see `pricing_rule/utils.py:557`
(`apply_pricing_rule_on_transaction`). `Price List` selects the base rate
before any pricing rule discount is applied; a Price List is
buying- or selling-scoped (`buying`/`selling` checkboxes), not shared blindly.

## Selling/Buying Settings

`Selling Settings` and `Buying Settings` singletons hold cross-cutting flags
consulted by the controllers above — e.g. whether a Sales Order is required
before Sales Invoice, default customer/supplier group, and role-based rate
editing (`maintain_same_rate`). Read them rather than hardcoding the
behaviour they gate.

## POS Invoice

`POS Invoice` (with `POS Invoice Item`, `POS Invoice Merge Log`, `POS Invoice
Reference`) is its own DocType in both v15 and v16 — not a mode of `Sales
Invoice` — used by the Point of Sale UI for high-volume, offline-tolerant
billing; `POS Invoice Merge Log` consolidates POS Invoices into regular
Sales Invoices for accounting.

## Blanket Order

A long-term customer/supplier commitment (`Blanket Order` +
`Blanket Order Item`) that Sales Order/Purchase Order rows can reference via
`blanket_order`/`blanket_order_rate`, tracked against the ordered quantity
over the blanket's date range rather than a single document. **(ERPNext 16.50)**
`Blanket Order` now carries `currency`, `conversion_rate`, `selling_price_list`,
`buying_price_list`, `price_list_currency`, and `plc_conversion_rate` fields
(ERPNext <=16.6 had none of these) — code reading blanket order rate must also
read the currency context when multi-currency sites are involved.

## v16: Customer Number At Supplier

`Customer Number At Supplier` **(v16)** is a new child table on `Supplier`
recording the customer-facing account/reference number a specific supplier
uses for this company, for matching supplier invoices that quote their own
customer code rather than the Purchase Order number.

## CRM DocType changes

**`Lead Source`** doctype is absent from both ERPNext <=16.6 and 16.50 (no `crm/doctype/lead_source`);
`Lead` has `utm_source` (Link to the frappe-core `UTM Source`) in both. Customizations that link to a
`Lead Source` doctype must use `UTM Source` or their own DocType. Not a 16.50 change.

**`Market Segment`** (`crm/doctype/market_segment`) exists in both ERPNext <=16.6 and 16.50 (unchanged).

**`Frappe CRM Allowed User`** (`crm/doctype/frappe_crm_allowed_user/`) **(ERPNext 16.50)**
is a new child table DocType (`istable=1`) used by `CRM Settings.allowed_users` (Table
MultiSelect) to list users permitted for Frappe CRM data synchronisation. It is NOT
present in ERPNext <=16.6. `CRM Settings` also gained two new fields: 
`enable_frappe_crm_data_synchronization` (Check) and `enable_opportunity_creation_from_contact_us`
(Check). The patch `remove_frappe_crm_custom_fields` removes the `crm_deal` custom field
from Quotation and Customer when Frappe CRM sync is disabled.

## Sources

Verified against ERPNext 16.50.0 / Frappe 16.51.1:

- `apps/frappe/frappe/model/mapper.py` — `get_mapped_doc` (:55)
- `apps/erpnext/erpnext/controllers/mapper.py` — `get_qty_already_mapped` (:1) (ERPNext 16.50)
- `apps/erpnext/erpnext/crm/doctype/lead/lead.py` — `make_customer` (:316), `make_opportunity` (:363), `make_quotation` (:393)
- `apps/erpnext/erpnext/crm/doctype/opportunity/opportunity.py` — `make_quotation` (:410), `make_customer` (:485)
- `apps/erpnext/erpnext/selling/doctype/quotation/quotation.py` — `make_sales_order` (:377)
- `apps/erpnext/erpnext/selling/doctype/sales_order/sales_order.py` — `make_delivery_note` (:1206), `make_sales_invoice` (:1391), `make_material_request` (:1077), `make_purchase_order` (:1711), `make_work_orders` (:1886)
- `apps/erpnext/erpnext/stock/doctype/delivery_note/delivery_note.py` — `make_sales_invoice` (:835), `make_shipment` (:1086)
- `apps/erpnext/erpnext/accounts/doctype/sales_invoice/sales_invoice.py` — `make_delivery_note` (:2509), `make_sales_return` (:2558)
- `apps/erpnext/erpnext/stock/doctype/material_request/material_request.py` — `make_request_for_quotation` (:788), `make_supplier_quotation` (:948), `make_purchase_order` (:598), `make_purchase_orders_by_supplier` (:715) (ERPNext 16.50)
- `apps/erpnext/erpnext/buying/doctype/purchase_order/purchase_order.py` — `make_purchase_receipt` (:804), `make_purchase_invoice` (:873), `make_subcontracting_order` (:1017)
- `apps/erpnext/erpnext/stock/doctype/purchase_receipt/purchase_receipt.py` — `make_purchase_invoice` (:1527), `make_purchase_return` (:1689)
- `apps/erpnext/erpnext/stock/get_item_details.py` — `get_item_details` (:85), `ItemDetails`/`ItemDetailsCtx` (:33-34)
- `apps/erpnext/erpnext/accounts/doctype/pricing_rule/pricing_rule.py` — `get_pricing_rule_for_item` (:446), `apply_pricing_rule` (:364); `pricing_rule/utils.py` — `apply_pricing_rule_on_transaction` (:557)
- `apps/erpnext/erpnext/manufacturing/doctype/blanket_order/blanket_order.json` — currency fields added (ERPNext 16.50)
- `apps/erpnext/erpnext/crm/doctype/crm_settings/crm_settings.json` — `allowed_users`, `enable_frappe_crm_data_synchronization` (ERPNext 16.50)
- Directory listings: `crm/doctype/lead_source` absent from both ERPNext <=16.6 and 16.50; `crm/doctype/frappe_crm_allowed_user` absent <=16.6, present 16.50; `crm/doctype/market_segment` present <=16.6, absent 16.50; `accounts/doctype/pos_invoice*`, `buying/doctype/customer_number_at_supplier` present in both
