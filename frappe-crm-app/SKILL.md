---
name: frappe-crm-app
description: "Extend or integrate with FCRM (Frappe CRM), the standalone Deal-pipeline app with its own Vue3 SPA — not an ERPNext built-in module. CRM 1.x (<=16.35) is standalone; CRM 2.x (16.51+) requires the `whatsapp` app. Use when configuring FCRM Lead/Deal stages, SLA rules, hierarchy permissions, telephony or WhatsApp integrations, or the FCRM Vue frontend."
---

# Frappe CRM App

Frappe CRM (`crm`, app title "Frappe CRM") is a standalone product on top of
Frappe Framework and frappe-ui: its own Lead/Deal pipeline, org-hierarchy
permission model, SLA engine, telephony/WhatsApp/lead-sync integrations, and
a separate Vue3 SPA served at `/crm`. It is unrelated to ERPNext's bundled
`crm` module (Lead/Opportunity) — see
[erpnext-selling-buying.md](../frappe-erpnext-hrms/references/erpnext-selling-buying.md)
for that one.

## When to use

- Customizing `CRM Lead`/`CRM Deal` fields or the Lead→Deal conversion
- Changing what appears in a Lead/Deal side panel, quick entry, or kanban
  board without editing the Vue frontend
- Adjusting row-level visibility (org-hierarchy) or SLA rules
- Adding/debugging telephony, WhatsApp, Facebook Lead Ads sync, or website
  domain-enrichment integrations
- Building on the ERPNext bridge (same-site or cross-site)
- Extending the Vue3 frontend (stores, pages, realtime) or its generic
  list/kanban backend API

## Inputs required

- Confirmation that the `crm` app (Frappe CRM) is installed on the site —
  distinct from ERPNext being installed
- Whether the target is a pipeline DocType (`CRM Lead`/`CRM Deal`) or a
  supporting one (Contact, Organization, Call Log, etc.)
- Whether ERPNext is on the same site or a different one, if the bridge is
  in scope

## Procedure

### 0) Confirm the app and distinguish from ERPNext's `crm` module

```bash
bench --site <site> list-apps
```

If both `crm` (Frappe CRM) and `erpnext` are installed, they are two
separate Lead concepts — `CRM Lead` (this skill) vs. ERPNext's `Lead`. Do
not conflate them.

### 1) Prefer the customization primitives over editing Vue components

`CRM Fields Layout` (side panel/quick-entry/grid layout), `CRM Form Script`
(client-script equivalent), and `CRM View Settings` (saved list/kanban
views) are the intended no-core-edit surface. Details:
[references/crm-customization.md](references/crm-customization.md).

### 2) Extend the backend via `doc_events`/`override_doctype_class`, not by forking DocTypes

Frappe core DocTypes CRM reuses (e.g. `Contact`) are subclassed via
`override_doctype_class`, not forked. New backend behaviour hooks in via
`doc_events`, matching the existing table in
[references/crm-customization.md](references/crm-customization.md).

### 3) Know the pipeline mechanics before touching Lead/Deal

Field-mapping rules for Lead→Deal conversion (including how custom fields
survive) are in
[references/crm-data-model.md](references/crm-data-model.md) — a
mismatched label/fieldtype on a custom field silently drops the value on
conversion. `lead.convert_to_deal(deal={...})` is an instance method
(see crm-data-model.md for C9 usage pattern).

### 4) Respect the permission and SLA layers

Row visibility comes from `crm/permissions/org_hierarchy.py`, not standard
Frappe role permissions alone. SLA selection evaluates `condition`
(`condition_json` is UI-only, never evaluated). Both:
[references/crm-permissions-sla.md](references/crm-permissions-sla.md).

### 5) Route integrations through the existing provider shape

Telephony follows the existing `crm/integrations/<provider>/` shape.
**CRM 2.x (16.51):** WhatsApp uses the new `whatsapp` app (`WA Message`, `WA Account`,
`WA Template` doctypes). The old `frappe_whatsapp` community app and `WhatsApp Message`
doctype are replaced. Automation Engine hooks (`automation_relationships`,
`automation_actions`, `automation_events`) enable trigger-based Lead/Deal flows:
[references/crm-integrations.md](references/crm-integrations.md).

### 6) Frontend work goes through the generic `api/doc.py` surface

New DocTypes exposed in the CRM sidebar reuse `api/doc.py`'s
list/filter/kanban functions; new frontend state goes in a Pinia store
wrapping `frappe-ui`'s `createResource`. Details:
[references/crm-frontend-architecture.md](references/crm-frontend-architecture.md).

## Verification

- [ ] Confirmed `crm` app is installed and distinguished from ERPNext's own `crm` module
- [ ] Custom fields on Lead/Deal have matching label+fieldtype on both sides if conversion must carry them
- [ ] No core Vue component or DocType forked — used `CRM Fields Layout`/`CRM Form Script`/`CRM View Settings`/`override_doctype_class`
- [ ] Row permission changes tested with a hierarchy user, a plain Sales User, and a Sales Manager outside the tree
- [ ] SLA condition changes tested via `condition` (Python expression), not assumed from `condition_json`
- [ ] New integration writes to the existing shared DocType (`CRM Call Log`, etc.) rather than a new one
- [ ] New DocType in the CRM UI works through `api/doc.py`, not a bespoke endpoint

## Failure modes / debugging

- **Custom Lead field vanishes on conversion to Deal**: label or fieldtype differs between the two custom fields — see `get_deal_fieldname` in [crm-data-model.md](references/crm-data-model.md)
- **SLA never applies**: `condition_json` was edited but `condition` (the Python string actually evaluated) was not regenerated
- **A `Sales Manager` sees everything despite being placed in the hierarchy tree**: role alone grants full access unless the user is in `CRM Sales Hierarchy` — check `_in_hierarchy`
- **Standard `CRM Form Script` edits keep reverting**: `is_standard` scripts require `developer_mode` to edit outside `enabled`
- **Webhook (Exotel/Twilio/WhatsApp) call rejected**: `allow_guest=True` endpoints authenticate via signature/token, not session — check the provider-specific validation function, not Frappe permissions
- **Lead/Contact can't be deleted, blocked by a sync log**: only `Failed Lead Sync Log` is exempted via `ignore_links_on_delete`; other link types still block

## Escalation

- DocType/controller/hook mechanics in general → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- ERPNext-side domain semantics behind the bridge → [`frappe-erpnext-hrms`](../frappe-erpnext-hrms/SKILL.md)
- General frappe-ui/Vue SPA patterns not specific to CRM → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- Generic SLA/condition-builder patterns across apps → [`frappe-enterprise-patterns`](../frappe-enterprise-patterns/SKILL.md)
- Webhook and guest-endpoint security → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Testing the Vue SPA in a real browser → [`frappe-browser-testing`](../frappe-browser-testing/SKILL.md)
- Undocumented core behaviour → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)

## References

- [references/crm-data-model.md](references/crm-data-model.md) - Lead/Deal pipeline, conversion field-mapping, supporting DocTypes, default list/kanban views
- [references/crm-customization.md](references/crm-customization.md) - CRM Fields Layout, CRM Form Script, CRM View Settings, `override_doctype_class`, `doc_events` table
- [references/crm-permissions-sla.md](references/crm-permissions-sla.md) - Org-hierarchy row permissions, CRM Service Level Agreement, condition/condition_json pattern
- [references/crm-integrations.md](references/crm-integrations.md) - ERPNext bridge (same-site/cross-site), telephony, WhatsApp, lead syncing, domain enrichment
- [references/crm-frontend-architecture.md](references/crm-frontend-architecture.md) - Vue3 SPA structure, Pinia stores, realtime, generic `api/doc.py` backend surface

## Guardrails

- **Never confuse `CRM Lead`/`CRM Deal` with ERPNext's `Lead`/`Opportunity`**: different app, different DocTypes
- **Never edit a Vue component to customize fields shown**: use `CRM Fields Layout`/`CRM View Settings`
- **Never assume `condition_json` is evaluated**: only `condition` (Python string) runs server-side
- **Never fork a core DocType CRM reuses**: use `override_doctype_class`
- **CRM 2.x (16.51+): never add a new call-log/message DocType**: reuse `CRM Call Log`; use `WA Message` (not `WhatsApp Message`) for WhatsApp
- **CRM 2.x: annotate every `@frappe.whitelist()` extension**: CRM declares `require_type_annotated_api_methods = True` in `hooks.py` (a convention; no framework code enforces it). Annotated params are validated/coerced; unannotated ones arrive as strings
- **Never build a per-DocType list endpoint for the CRM UI**: extend `api/doc.py`'s generic surface


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll edit the Vue component to add this field to the side panel" | `CRM Fields Layout` exists to avoid this; a component edit diverges from core and breaks on upgrade. |
| "`condition_json` is where the SLA condition lives" | `condition_json` is UI-only and is never evaluated; only `condition` (the Python expression string) runs server-side. |
| "Sales Manager role will restrict the user's Lead visibility" | The `Sales Manager` role bypasses the hierarchy filter; restriction requires the user to be in `CRM Sales Hierarchy`. |
| "I can fork `Contact` to add CRM-specific fields without touching core" | A forked DocType diverges from core Contact and breaks on upgrade; use `override_doctype_class`. |
| "CRM 2.x still uses `WhatsApp Message` doctype and `frappe_whatsapp`" | CRM 2.x requires the `whatsapp` app; doctypes are now `WA Message`, `WA Account`, `WA Template` — `WhatsApp Message` hooks are dead. |
| "My whitelist extension doesn't need type annotations in CRM" | CRM 2.x declares `require_type_annotated_api_methods = True`; the framework doesn't raise on untyped methods, but only annotated params are validated. Follow the convention. |

## Red Flags

- Vue component file edited to change which fields appear in a Lead or Deal panel
- `condition_json` edited without regenerating the `condition` field on the same SLA record
- New per-integration call-log or message DocType created instead of reusing `CRM Call Log`
- `CRM Lead` or `CRM Deal` DocType JSON forked rather than extended via `doc_events` and custom fields
- Code hooks `doc_events["WhatsApp Message"]` on a CRM 2.x site — the doctype is `WA Message`
- `@frappe.whitelist()` method in a CRM 2.x extension without Python type annotations (convention break, not a runtime error)
- Cross-site ERPNext DB write from a CRM hook without checking `is_erpnext_in_different_site`

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Renaming a custom field on Lead without matching it on Deal | Conversion drops the value | Keep label + fieldtype identical on both custom fields |
| Editing `condition_json` and expecting new SLA behaviour | Field is UI-only, never evaluated | Edit/regenerate `condition` |
| Assuming `Sales Manager` role restricts visibility | Role bypasses hierarchy unless user is placed in the tree | Add the user to `CRM Sales Hierarchy` if restriction is intended |
| Forking `Contact`'s Desk controller for CRM-only fields | Diverges from core, breaks on upgrade | Extend via `override_doctype_class` |
| Treating `is_whatsapp_installed()` as "integration enabled" | App can be installed but disabled in settings | Check both install and enable flags |
| Writing directly to ERPNext's DB from CRM hooks | Breaks when ERPNext is on a different site | Use `get_erpnext_site_client` / same-site `doc_events` per `is_erpnext_in_different_site` |
