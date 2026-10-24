# Frappe CRM 2.0 Breaking Changes and Migration

## Overview

CRM 2.0.0-dev is the development branch of Frappe CRM that requires the new
`whatsapp` app as a hard dependency (`required_apps = ["whatsapp"]`).
Upgrading a CRM 1.x site requires the `whatsapp` app to be installed
**first**, after which `bench migrate` runs the breaking patches below.

## Required App: `whatsapp`

CRM 2.x lists `whatsapp` in `required_apps`. The whatsapp app ships its own
doctypes (`WA Account`, `WA Settings`, `WA Template`, `WA Message`,
`WA Profile`) — distinct from the old `frappe_whatsapp` community app.

## Breaking Patches (post-model-sync, since CRM 1.58.5 baseline)

The following patches in `crm/patches/v1_0/` run automatically on
`bench migrate` and may need companion work in custom apps:

| Patch | Effect |
|---|---|
| `migrate_from_frappe_whatsapp` | Copies `WhatsApp Account` → `WA Account`, `WhatsApp Settings` → `WA Settings`, `WhatsApp Templates` → `WA Template`, `WhatsApp Message` → `WA Message` (500/batch). Updates link fields on `File`, `Comment`, `CRM Notification`. Then calls `link_existing_whatsapp_profiles_to_crm`. Doc events on `"WhatsApp Message"` become dead. |
| `update_lead_status_type` | Sets a `type` field on `CRM Lead Status` records (used by `validate_lost_reason`). |
| `create_custom_fields_for_erpnext_in_crm` | Adds `crm_source_deal` and other custom fields to ERPNext doctypes for the CRM bridge. |
| `update_deal_status_probabilities` | Sets `probability` on default `CRM Deal Status` records. |
| `update_deal_status_type` | Adds `type` (Open/Won/Lost) to `CRM Deal Status`; needed by automation events. |
| `add_fields_in_assignment_rule` | Adds `assign_condition_json` / `unassign_condition_json` to `Assignment Rule` via Custom Field. |
| `reset_erpnext_form_script` | Regenerates the standard ERPNext CRM Form Script after schema changes. |
| `create_default_lost_reasons` | Seeds default `CRM Lost Reason` records. |
| `add_fb_lead_source` / `add_whatsapp_lead_source` / `add_email_in_default_lead_sources` | Seeds `CRM Lead Source` records. |
| `link_existing_whatsapp_profiles_to_crm` | Links `WA Profile` records to existing CRM Lead/Deal/Contact by phone match. |
| `create_custom_fields_for_product_item_sync` | Adds `crm_product` Link field to ERPNext `Item`. |
| `add_enrichment_fields_to_layouts` | Adds enrichment fields (`organization_logo`, `company_description`, social links) to default `CRM Fields Layout` rows. |
| `set_seen_for_existing_deals_and_leads` | Populates the `_seen` field for existing records (enables "seen by" tracking). |
| `rebuild_crm_territory_tree` | Rebuilds `CRM Territory`'s nested-set fields after tree structure changes. |
| `set_setup_completed_for_existing_sites` | Sets `FCRM Settings.setup_completed = 1` so the onboarding wizard is skipped on upgrade. |
| `add_availability_statuses` | Seeds default `CRM Availability Status` records (Online, Away, Do Not Disturb, Offline). |
| `add_quotation_layouts` | Adds a Quotations tab to default `CRM Fields Layout` for Deal. |

## Removed Doctypes

| Removed Doctype | Replaced By / Notes |
|---|---|
| `CRM Lead Score` | `lead_score` (Int field) on `CRM Lead` |
| `CRM Workflow Rule` | `crm.automation` module (Automation Engine) |
| `CRM Agent Conversation`, `CRM Agent Feedback`, `CRM Agent Message`, `CRM Agent Settings` | AI agent feature removed |
| `CRM Knowledge Article`, `CRM Knowledge Embedding` | Removed |
| `CRM Calendar Settings` | Calendar config moved to `FCRM Settings` |
| `CRM SMS Settings` | SMS integration removed |
| `CRM Email Account`, `CRM Email Sync Settings` | Email sync integration removed |
| `CRM Meta Settings`, `CRM Meta Message`, `CRM Meta Auto Reply`, `CRM Meta Comment`, `CRM Meta Sentiment Log`, `CRM Meta Lead Ad Config`, `CRM Meta Lead Ad Field Map` | Meta messaging integration removed (Meta Facebook Lead Ads syncing via `lead_syncing` remains) |
| `CRM Google Lead Config`, `CRM LinkedIn Lead Config`, `CRM TikTok Lead Config` | Platform-specific lead sync configs removed; generic `Lead Sync Source` remains |

## New Doctypes (CRM 2.0)

| New Doctype | Purpose |
|---|---|
| `CRM Availability Status` | Configurable user-presence statuses (Online/Away/Unavailable categories), shown as coloured dots in the UI. Custom statuses can be added. |
| `CRM Product Sync Issue` | Log of CRM↔ERPNext item sync failures (`product`, `kind`, `detail`, `detected_on`, `dismissed`). Check this before assuming a missing product synced silently. |
| `CRM Sales Hierarchy` | Formally promoted to an `fcrm/doctype` tree DocType (`is_tree=1`, `nsm_parent_field=reports_to`). Fields: `user` (Link: User), `reports_to` (Link: CRM Sales Hierarchy), `is_group`, `full_name`. |

## New / Changed API Modules (crm/api/)

| Module | Status | Notes |
|---|---|---|
| `form.py` | **NEW** | Hybrid CRM forms API — stores via Frappe's `Web Form` doctype; `save_form`, `grant_guest_link_access`, `get_form_fields`, `link_field_guest_access` |
| `availability.py` | **NEW** | User availability management; `validate_user`, `on_user_update`, `publish_availability`; uses `CRM Availability Status` |
| `event.py` | **NEW** | Calendar event notification triggers |
| `command_palette.py` | **NEW** | Command-palette global search |
| `exchange_rate.py` | **NEW** | Currency exchange rate lookup for multi-currency deals |
| `live_demo.py` | **NEW** (was `demo.py`) | Live-demo site guardrails for User creation/reset-password |
| `auth.py` | **NEW** | Authentication helpers |
| `demo.py` | **REMOVED** | Replaced by `live_demo.py` |
| `erpnext_bridge.py` | **REMOVED** | Logic absorbed into `erpnext_crm_settings.py` |
| `meta.py` | **REMOVED** | Meta/Facebook messaging API removed |

## Removed Frontend Routes

| Old Route | Notes |
|---|---|
| `/sentiment` | Meta sentiment analysis removed |
| `/calendar` | Calendar view removed (calendar in FCRM Settings; event.py still sends notifications) |
| `/agent-analytics` | AI agent analytics removed |
| `/forecast` | Forecasting view removed (enable_forecasting flag still in FCRM Settings) |

## Custom-App Impact Checklist

- `doc_events["WhatsApp Message"]` → rename to `doc_events["WA Message"]`
- Code importing from `crm.api.demo` → update to `crm.api.live_demo`
- Code referencing `crm.api.erpnext_bridge` → move to `erpnext_crm_settings.py`
- Code checking `frappe.db.exists("DocType", "CRM Lead Score")` → use `lead_score` field on Lead directly
- Facebook Meta messaging integrations (`crm_meta_*` doctypes) → must be rewritten; Facebook Lead Ads sync via `Lead Sync Source` remains
- Google/LinkedIn/TikTok lead configs → removed; migrate to `Lead Sync Source` generic approach
- Any `crm.integrations.workflows` rule code → replace with Automation Engine flows
- Any `crm.ai_agent.*` imports → remove

## `FCRM Settings` New Fields (CRM 2.x)

| Field | Notes |
|---|---|
| `currency` | Base currency for deals (Link: Currency) |
| `service_provider` / `access_key` | Exchange-rate provider for multi-currency |
| `update_timestamp_on_new_communication` | Toggle set to `1` by migrate patch |
| `auto_mark_replied_on_response` | Auto-close SLA on reply |
| `auto_reopen_on_new_communication` | Reopen SLA on new inbound message |
| `auto_update_expected_deal_value` | Auto-sync expected deal value from products total |
| `setup_completed` | Whether onboarding wizard has run |
| `default_calendar_view` / `event_notifications` / `all_day_event_notifications` | Calendar defaults |

## Sources

Verified against CRM 1.58.5 (`apps/crm`, 16.35 bench) and CRM 2.0.0-dev (`apps/crm`, 16.51 bench):

- `crm/patches.txt` — new patch list vs baseline
- `crm/patches/v1_0/migrate_from_frappe_whatsapp.py` — full WhatsApp migration logic
- `crm/hooks.py` (2.0.0-dev) — `required_apps`, `doc_events`, `after_migrate`
- `crm/fcrm/doctype/` — directory diff for added/removed doctypes
- `crm/fcrm/doctype/crm_availability_status/crm_availability_status.json` — new doctype fields
- `crm/fcrm/doctype/crm_product_sync_issue/crm_product_sync_issue.json` — new doctype fields
- `crm/fcrm/doctype/crm_sales_hierarchy/crm_sales_hierarchy.json` — formalized tree doctype
- `crm/fcrm/doctype/fcrm_settings/fcrm_settings.json` — new FCRM Settings fields
- `crm/api/` — directory diff for added/removed API modules
