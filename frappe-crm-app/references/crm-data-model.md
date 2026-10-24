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

**New fields in CRM 2.x (16.51):** `lead_score (Int)`, `lead_temperature (Select: Cold/Warm/Hot)`,
`lost_reason (Link: CRM Lost Reason)`, `lost_notes (Text)`. `validate_status()` auto-sets
status to the first "Open" type on insert. `validate_lost_reason()` throws if status type=Lost
and `lost_reason` is blank (or reason="Other" and `lost_notes` is blank).

`CRM Deal` key fields: `organization`, `deal_owner`, `status` (Link to `CRM Deal Status`),
`probability`, `next_step`, `lead` (back-reference to the originating Lead), `contacts`
(child table `CRM Contacts`), plus the same SLA block.

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
  `CRM Industry`, `CRM Territory` — simple lookup/master DocTypes; a Deal
  reaching a lost status records the reason via `validate_lost_reason` on
  the source doctype's controller.
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
- `CRM Dashboard`, `CRM Sales Hierarchy` — reporting rollups and the
  org-hierarchy tree consumed by the permission model (see
  [crm-permissions-sla.md](crm-permissions-sla.md)).

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

Verified against CRM 1.58.5 (coale_v16) and CRM 2.0.0-dev (16.51.1 bench):

- `crm_lead/crm_lead.json` — Lead field list (16.51.1 bench adds `lead_score`, `lead_temperature`, `lost_reason`, `lost_notes`)
- `crm_deal/crm_deal.json` — Deal field list (status is Link to `CRM Deal Status` in both versions)
- `crm_lead/crm_lead.py` (CRM 2.x 16.51.1 bench) — `convert_to_deal` instance method (:456-457), `create_deal` (:354), `validate_lost_reason`, `validate_status`
- `crm_lead/crm_lead.py` (CRM 1.x coale_v16) — `convert_to_deal` module-level function (:523)
- `crm_lead/crm_lead.py` both — `get_deal_fieldname`/`is_matching_custom_field` (:551-577), `LEAD_DEAL_FIELD_MAP` (:18), `default_list_data`/`default_kanban_settings` (:447, :514)
- Directory listing: `crm/fcrm/doctype/` — full DocType inventory
- `crm/fcrm/doctype/crm_notification/crm_notification.py` — permission hooks
