# Frappe CRM Integrations

Telephony, WhatsApp, lead syncing, website enrichment, ERPNext bridge,
and calling CRM Python APIs from setup/patch code.
All modules under `crm/integrations/`, `crm/lead_syncing/`,
`crm/domain_enrichment/`, `crm/api/`, and `crm/fcrm/doctype/erpnext_crm_settings/`.

## Calling CRM internal APIs from `after_install` / patch code

`crm/api/form.py` exports `@frappe.whitelist()` functions (`save_form`,
`grant_guest_link_access`) that can be **imported and called directly from Python**
(no HTTP, no CSRF). Because they call `_check_manager()` internally (requires
`System Manager` or `Sales Manager` role), the calling context must impersonate
Administrator:

```python
from crm.api.form import grant_guest_link_access, save_form

old_user = frappe.session.user
frappe.set_user("Administrator")
try:
    grant_guest_link_access("CRM Industry")  # enables Guest link-field reads
    save_form(None, {"route": "enquiry", "doc_type": "CRM Lead", ...})
finally:
    frappe.set_user(old_user)  # always restore; omitting leaves the context elevated
```

`grant_guest_link_access(doctype)` calls `_link_target_doctypes()` which scans
`frappe.get_meta("CRM Lead").fields` — includes Custom Fields **after**
`frappe.clear_cache(doctype="CRM Lead")` is called. If the custom field was added
in the same setup function, clear the cache before calling `grant_guest_link_access`.

## ERPNext bridge — same-site and cross-site

`ERPNext CRM Settings` (singleton) has two integration modes controlled by
`is_erpnext_in_different_site` (`erpnext_crm_settings.json`):

- **Same site** (ERPNext installed alongside CRM): the bridge runs through
  ordinary `doc_events` — `Item`, `User Permission`, `DocShare` full CRUD
  hooks under `crm.integrations.erpnext.*`
  (see [crm-customization.md](crm-customization.md#doc_events-table)) mirror
  ERPNext master data and sharing into the CRM site directly via the ORM.
- **Different site**: `api_key`/`api_secret`/`erpnext_site_url` fields
  configure a `frappe.frappeclient.FrappeClient` (`erpnext_crm_settings.py`,
  `get_erpnext_site_client`) that talks to a remote ERPNext instance over
  its REST API instead of the local ORM — this is how CRM integrates with
  ERPNext when the two are genuinely separate deployments, not just separate
  apps on one bench.

`CRM Deal.on_update` calls `create_customer_in_erpnext`
(`hooks.py:186-190`); `Sales Order.before_validate` calls
`create_customer_on_sales_order` (`hooks.py:191-195`) for the reverse
direction. `prefill_quotation_items(crm_deal)` and `get_quotation_url(...)`
(`erpnext_crm_settings.py`) build a Quotation (local or remote) pre-filled
from a Deal's `CRM Products` child table, rather than requiring the agent to
re-enter items in ERPNext. `sync_products` mirrors ERPNext `Item` into
`CRM Product`, logging failures to `CRM Product Sync Issue` — inspect that
child table before assuming a missing product synced silently.

## Telephony

Two provider integrations under `crm/integrations/`, each with an inbound
webhook plus an outbound call trigger:

- **Exotel** (`integrations/exotel/handler.py`): `handle_request(**kwargs)`
  is `@frappe.whitelist(allow_guest=True)` — the public webhook Exotel calls
  on call events; `validate_request()` checks the request before trusting
  it. `make_a_call(to_number, from_number=None, caller_id=None)` is the
  agent-initiated outbound call endpoint. `create_call_log`/`get_call_log`/
  `get_call_log_status` write/read `CRM Call Log`.
- **Twilio** (`integrations/twilio/api.py` +
  `integrations/twilio/twilio_handler.py`): `generate_access_token()` issues
  a client-side Voice SDK token; `voice(**kwargs)` and
  `twilio_incoming_call_handler(**kwargs)` are the `allow_guest=True`
  webhooks (marked `# nosemgrep: guest-whitelisted-method` — Twilio's own
  request-signature check is the auth, not a Frappe session, so the guest
  flag is intentional and reviewed). `validate_twilio_request(args,
  require_application_sid=False)` verifies Twilio's signature before acting
  on webhook payloads.

Both providers register phone numbers/agents through `CRM Telephony Phone` /
`CRM Telephony Agent` rather than hardcoding a number-to-agent map, and both
write to the same `CRM Call Log` DocType — a third provider should follow
that shape (its own `integrations/<provider>/` module, webhook + outbound
call function, writing to the shared `CRM Call Log`) instead of inventing a
parallel call-log DocType.

## WhatsApp (CRM 2.x)

**CRM 2.x (16.51)** replaces `frappe_whatsapp` with the new `whatsapp` app and renames all
doctypes with a `WA ` prefix. `crm/api/whatsapp.py` layers CRM-specific behaviour on top
of `WA Message` (not `WhatsApp Message`): `validate_access(reference_doctype, reference_name,
permtype)` gates every endpoint on read/write permission for the linked Lead/Deal/Contact.
`doc_events["WA Message"]["on_update"]` calls `notify_agent(doc)`. `is_whatsapp_installed()`/
`is_whatsapp_enabled()` are separate checks — guard on both.

**CRM 1.x (<=16.35):** used `WhatsApp Message` doctype from `frappe_whatsapp`. Doc events
on `"WhatsApp Message"` are dead on CRM 2.x sites.

## Removed integrations in CRM 2.x (16.51)

The following modules, doctypes, and routes were **removed entirely** in CRM 2.x:
- `crm.ai_agent` — doctypes `crm_agent_conversation`, `crm_agent_feedback`, etc.
- `crm.integrations.meta` — Facebook Lead Ads backend (doctypes `crm_meta_*`)
- `crm.integrations.email_sync` — `crm_email_account`, `crm_email_sync_settings`
- `crm.integrations.sms` — `crm_sms_settings`
- `crm.integrations.calendar_sync` — `crm_calendar_settings`
- `crm.lead_syncing` (Google Ads, LinkedIn, TikTok) — all `crm_*_lead_config` doctypes
- `crm.integrations.forecasting` and `/forecast` frontend route
- `crm.integrations.workflows` (custom rule engine) → replaced by `crm.automation`
- `crm_lead_score` doctype — `lead_score` is now a plain `Int` field on `CRM Lead`
- `crm_knowledge_article`, `crm_knowledge_embedding`, `crm_workflow_rule`
- Frontend routes `/sentiment`, `/calendar`, `/agent-analytics`

Custom integrations depending on any of these must be rewritten or removed before upgrading.

## Automation Engine (CRM 2.x, 16.51)

CRM 2.x integrates with Frappe's Automation Engine via three `hooks.py` entries:
- `automation_relationships` — relationship definitions for Lead/Deal/Contact
- `automation_actions` — `AdjustLeadScore`, `SetLeadTemperature`, `ConvertLeadToDeal`,
  `SendEmailToRecord`, `SendCRMNotification`
- `automation_events` — `crm.lead_qualified/converted`, `crm.deal_stage_changed/won/lost`,
  `crm.prospect_message_sent/received`, `crm.task_overdue`

Automation flows can trigger on CRM Lead/Deal stage changes, incoming messages, and task
overdue without writing custom `doc_events` handlers.

## Lead syncing / Facebook Lead Ads (CRM 1.x only, <=16.35)

**Removed in CRM 2.x (16.51).** The following was present in CRM 1.x only:
`crm/lead_syncing/doctype/` held `Facebook Page`, `Facebook Lead Form`,
`Lead Sync Source`, `Failed Lead Sync Log`. `background_sync.py` drove six cadences
(`sync_leads_from_sources_5_minutes`/`_10_minutes`/`_15_minutes`, `_hourly`, `_daily`,
`_monthly`). `Failed Lead Sync Log` was `ignore_links_on_delete`-exempt.
All lead-syncing, Google Ads, LinkedIn, TikTok doctypes and scheduler entries are gone in 2.x.

## Domain enrichment

`crm/domain_enrichment/` is a website crawler that fills in
Lead/Deal/Organization fields (industry, employee count, etc.) from the
prospect's own website. `ENABLE_FLAG_BY_DOCTYPE = {"CRM Lead": "enable_lead",
"CRM Deal": "enable_deal", "CRM Organization": "enable_organization"}`
(`config.py`) is the single source of truth both the manual (`api.py`) and
scheduled auto-enrich (`tasks.py`) paths check — a custom app adding
enrichment for a fourth DocType should extend this dict, not branch on
doctype name in the pipeline itself. `get_config()` rebuilds an
`EnrichmentConfig` from the config DocTypes **on every call** (deliberately
uncached, per the module docstring) — hot paths use `get_settings()`/
`auto_enrich_enabled_for()` instead of a full `get_config()` build.
`pipeline.py` exposes `preview(website, cfg=None)` (dry run, no DB writes)
and `run(website, cfg=None, progress=None)` (applies results) as the two
entry points — crawl limits (`max_pages`, `max_depth`, `use_sitemap`,
`request_timeout`, `max_download_bytes`) come from `DEFAULT_SETTINGS` in
`config.py` when the settings singleton has never been saved.

## Sources

Verified against CRM 1.58.5 (coale_v16) and CRM 2.0.0-dev (16.51.1 bench):

- `crm/fcrm/doctype/erpnext_crm_settings/erpnext_crm_settings.py` — `get_erpnext_site_client`, `prefill_quotation_items`
- `crm/hooks.py` (16.51.1 bench) — `required_apps = ["whatsapp"]` (:14), `doc_events["WA Message"]` (:270), `automation_relationships` (:155), `automation_actions` (:157), `automation_events` (:187), `permission_query_conditions` for Lead/Deal (:138-140)
- `crm/hooks.py` (coale_v16) — `doc_events["WhatsApp Message"]` (now dead in 2.x), `lead_syncing` scheduler entries
- `crm/integrations/exotel/handler.py` — `handle_request`, `make_a_call`, `validate_request`
- `crm/integrations/twilio/api.py` — `generate_access_token`, `voice`, `validate_twilio_request`
- `crm/api/whatsapp.py` (16.51.1 bench) — `validate_access`, `notify_agent`, `is_whatsapp_installed`/`is_whatsapp_enabled`; `WA Message` doc events
- `crm/domain_enrichment/config.py` — `ENABLE_FLAG_BY_DOCTYPE`, `DEFAULT_SETTINGS`
- `crm/domain_enrichment/pipeline.py` — `preview`, `run`
- `crm/automation/` (16.51.1 bench) — `events.py`, `actions.py`, `relationships.py`, `scoring.py`
- Module listings (16.51.1 bench vs coale_v16): confirmed removal of `crm.ai_agent`, `crm.integrations.meta`, `crm.integrations.email_sync`, `crm.integrations.sms`, `crm.lead_syncing`
- `crm/api/form.py` (16.51.1 bench) — `save_form` (:433), `grant_guest_link_access` (:269), `_check_manager` (:234), `_link_target_doctypes` (:119-125)
- `apps/frappe/frappe/database/database.py` (16.51.1 bench) — `frappe.session.user` / `frappe.set_user()` pattern; `savepoint` (:1219), `rollback(save_point=)` (:1196)
