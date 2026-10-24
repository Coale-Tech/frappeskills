# Frappe CRM Data Model

Frappe CRM (`crm`, app title "Frappe CRM") is a standalone product built on
Frappe Framework and frappe-ui — not the same thing as ERPNext's bundled
`crm` module (Lead/Opportunity, see
[erpnext-selling-buying.md](../../frappe-erpnext-hrms/references/erpnext-selling-buying.md)).
Every DocType here is prefixed `CRM ` and lives under `crm/fcrm/doctype/`.

## Pipeline: Lead and Deal

`CRM Lead` and `CRM Deal` are the two pipeline objects; a Lead converts into a
Deal once qualified, it does not go through an Opportunity stage.
`CRM Lead` key fields: `status` (Link to `CRM Lead Status`), `lead_owner`,
`source` (Link to `CRM Lead Source`), `organization`, `converted` (Check),
`industry`, `territory`, plus an SLA block and `status_change_log`.

**Fields added in CRM 2.x (CRM 2.0):** `lead_score (Int)`, `lead_temperature (Select: Cold/Warm/Hot)`,
`lost_reason (Link: CRM Lost Reason)`, `lost_notes (Text)`. `validate_status()` auto-sets
status to the first "Open" type on insert. `validate_lost_reason()` throws if status type=Lost
and `lost_reason` is blank (or reason="Other" and `lost_notes` is blank).

**Domain Enrichment fields on Lead (CRM 2.x):** `organization_logo (Attach Image)`,
`company_description (Small Text)`, `linkedin (Data)`, `twitter (Data)`, `facebook (Data)` —
all `no_copy=1`, populated by Domain Enrichment; not offered in conversion.
**Lead syncing fields:** `facebook_lead_id (Data, unique)`, `facebook_form_id (Data)`.

`CRM Deal` key fields: `organization` (Link to `CRM Organization`), `deal_owner`,
`status` (Link to `CRM Deal Status`), `probability`, `next_step`,
`lead` (back-reference to the originating Lead), `contacts`
(child table `CRM Contacts`), plus the same SLA block.

**Fields added in CRM 2.x (CRM 2.0):** `currency (Link: Currency)`, `exchange_rate (Float, default 1)`,
`source (Link: CRM Lead Source)`, `expected_deal_value (Currency)`, `expected_closure_date (Date)`,
`closed_date (Date)`, `lost_reason (Link: CRM Lost Reason)`, `lost_notes (Text)`,
`organization_name (Data)`. Same domain enrichment fields as Lead plus a dedicated
`lead_name (Data)` denormalized from the primary contact.
## Lead → Deal conversion

**CRM 2.x (16.51):** `convert_to_deal` is an **instance method** on `CRM Lead`:
```python
# Python setup/migration code — instance method pattern (CRM 2.x)
lead = frappe.get_doc("CRM Lead", lead_name)
lead.convert_to_deal(deal={
    "status": "Qualified",
    "probability": 70,
    "expected_deal_value": 50000,
    "deal_value": 50000,
})
# The `deal` dict sets initial field values on the newly created CRM Deal.
# crm_lead.py:456-457: def convert_to_deal(self, deal=None): return convert_to_deal(lead=self.name, doc=self, deal=deal)
```
**CRM 1.x (<=16.35):** `convert_to_deal` was a module-level `@frappe.whitelist()` function:
`frappe.call("crm.fcrm.doctype.crm_lead.crm_lead.convert_to_deal", lead=name, deal={...})`.

Sequence: permission check → sets `CRM Lead.status = "Qualified"` and `converted = 1`
via `db_set` (no `validate` re-run) → `lead.create_contact(...)` and
`lead.create_organization(...)` → `lead.create_deal(contact, organization, deal)`.

`create_deal` (`crm_lead.py:337`) copies every Lead field to the new Deal
except a fixed `restricted_fieldtypes` list (Tab Break, Section Break, Column
Break, HTML, Button, Attach) and a fixed `restricted_map_fields` list
(`name`, `naming_series`, `status`, `sla`/SLA fields, `status_change_log`,
etc. — status and SLA state do **not** carry over blindly). Field-name
translation goes through `get_deal_fieldname`:

1. `LEAD_DEAL_FIELD_MAP = {"lead_owner": "deal_owner"}` (`crm_lead.py:18`) —
   the one hardcoded rename.
2. Same fieldname on both DocTypes — direct copy.
3. A custom field (`fieldname` starts with `custom_`, or `is_custom_field`)
   with a **matching label and fieldtype** on the Deal side — matched by
   `is_matching_custom_field` (`crm_lead.py:565`), and only if exactly one
   Deal field matches.

A custom Lead field only survives conversion into a custom Deal field with
the identical label and fieldtype — renaming one side without the other
silently drops the value.

Deal SLA state carries over only if the Lead had already received a first
response (`self.first_responded_on`); otherwise the new Deal starts its own
SLA clock. Any user assigned to the Lead (via `get_assigned_users`) is
re-assigned to the new Deal unless they are already its `deal_owner`.

## Supporting DocTypes

- `CRM Organization` / `CRM Contacts` (child table linking a Lead/Deal to one
  or more `Contact` records) — Contact itself is Frappe core's `Contact`,
  extended via `override_doctype_class` (see
  [crm-customization.md](crm-customization.md)), not a CRM-specific DocType.
- `CRM Lead Status`, `CRM Deal Status`, `CRM Lead Source`, `CRM Lost Reason`,
  `CRM Industry`, `CRM Territory` — simple lookup/master DocTypes; a Deal or Lead
  reaching a lost status records the reason via `validate_lost_reason` on
  the source doctype's controller. **(CRM 2.x)** Both `CRM Lead` and `CRM Deal`
  now carry `lost_reason`/`lost_notes` directly as plain fields (not child).
- `CRM Task`, `fcrm Note` — per-record task/note child records, independent
  of Frappe's generic `ToDo`/`Comment` (which CRM also hooks into for
  assignment and activity-feed purposes, see
  [crm-customization.md](crm-customization.md)).
- `CRM Call Log`, `CRM Telephony Agent`, `CRM Telephony Phone` — call
  records and agent/phone-number registration for the telephony
  integrations (see [crm-integrations.md](crm-integrations.md)).
- `CRM Notification` — in-app notification feed, with its own
  `permission_query_conditions`/`has_permission` hooks
  (`fcrm/doctype/crm_notification/crm_notification.py`).
- `CRM Dashboard` — reporting rollups (see
  [crm-permissions-sla.md](crm-permissions-sla.md)).
- `CRM Sales Hierarchy` **(CRM 2.x):** Promoted to a formal `is_tree=1`
  DocType under `fcrm/doctype/crm_sales_hierarchy/`; fields: `user`
  (Link: User), `reports_to` (Link: CRM Sales Hierarchy), `is_group`,
  `full_name`. `nsm_parent_field = "reports_to"`. In CRM 1.x the table
  existed but was not in the `fcrm/doctype/` directory.
- `CRM Availability Status` **(CRM 2.x new):** Configurable user-presence
  badges. Fields: `availability_status (Data)`, `category (Select:
  Active/Away/Unavailable)`, `enabled (Check)`, `color (Select)`,
  `position (Int)`. Drives the coloured dot in the CRM user list and routes
  assignment-rule load-balancing (Active preferred → Away → Unavailable).
- `CRM Product Sync Issue` **(CRM 2.x new):** Log of CRM↔ERPNext item
  sync failures. Fields: `product`, `kind`, `detail`, `detected_on`,
  `dismissed`. Check this before assuming a missing CRM Product synced from
  ERPNext silently.

## Default list and kanban views

Every pipeline DocType ships a `default_list_data()` and
`default_kanban_settings()` static method on its controller
(`crm_lead.py:447`, `:514`) returning the columns/rows JSON and kanban
`column_field`/`title_field`/`kanban_fields` the frontend falls back to when
no `CRM View Settings` record exists yet for that user — e.g. Lead's kanban
groups by `status` with `lead_name` as the card title. A DocType-specific
default view lives in Python next to the controller, not hardcoded in the
Vue frontend.

## Sources

Verified against CRM 1.58.5 (16.35 bench) and CRM 2.0.0-dev (16.51 bench):

- `crm/fcrm/doctype/crm_lead/crm_lead.json` — Lead field list (2.0 adds `lead_score`, `lead_temperature`, `lost_reason`, `lost_notes`, enrichment fields)
- `crm/fcrm/doctype/crm_deal/crm_deal.json` — Deal field list (2.0 adds `currency`, `exchange_rate`, `source`, `expected_deal_value`, `closed_date`, `lost_reason`, enrichment fields)
- `crm/fcrm/doctype/crm_lead/crm_lead.py` (CRM 2.x) — `convert_to_deal` instance method (:456-457), `create_deal` (:354), `validate_lost_reason`, `validate_status`
- `crm/fcrm/doctype/crm_lead/crm_lead.py` (CRM 1.x) — `convert_to_deal` module-level function (:523)
- `crm/fcrm/doctype/crm_lead/crm_lead.py` both — `get_deal_fieldname`/`is_matching_custom_field` (:551-577), `LEAD_DEAL_FIELD_MAP` (:18), `default_list_data`/`default_kanban_settings`
- `crm/fcrm/doctype/crm_sales_hierarchy/crm_sales_hierarchy.json` — `is_tree=1`, field list
- `crm/fcrm/doctype/crm_availability_status/crm_availability_status.json` — fields, category enum
- `crm/fcrm/doctype/crm_product_sync_issue/crm_product_sync_issue.json` — fields
- `crm/fcrm/doctype/crm_notification/crm_notification.py` — permission hooks
- Directory diff: `crm/fcrm/doctype/` old vs new — confirmed removed/added doctype list
