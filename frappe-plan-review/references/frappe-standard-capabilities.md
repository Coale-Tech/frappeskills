# Frappe / ERPNext Standard Capabilities

Read this before scoring Mode A (Scope / Standard-first). If a capability on this list covers the plan's need, Reduce scope — do not build custom code for it.

Each entry is verified against installed source (see Sources at the bottom).

## Configuration — no custom Python required

| Capability | DocType / Mechanism | What it replaces |
|---|---|---|
| Approval routing | `Workflow` + `Workflow State` + `Workflow Transition` | Custom `on_submit` approval chain |
| Auto-assign document to a user | `Assignment Rule` | `frappe.assign_to.add()` in controller |
| Recurring / auto-repeat document | `Auto Repeat` | Scheduled job that clones records |
| Email or in-app notification on event | `Notification` | `frappe.sendmail()` in controller hooks |
| Outbound HTTP call on event | `Webhook` | `requests.post()` in controller or background job |
| Per-document Python logic, no redeploy | `Server Script` *(requires `server_script_enabled: 1` in `common_site_config.json`)* | `frappe.get_doc()` logic in a separate app |
| Tabular data query, no code | `Report Builder` report | Custom page + query |
| Parameterised SQL or Python report | `Query Report` / `Script Report` | Custom page with frappe.db calls |
| Data dashboard tiles | `Dashboard` + `Dashboard Chart` | Custom Vue page |
| Portal data entry from non-Desk user | `Web Form` | Custom Frappe page or external form |
| Extra fields without forking core | `Custom Field` | Adding fields to core DocTypes by editing source |
| Field-level restrictions per role | `User Permission` + `permlevel` | Custom `has_permission` overrides |
| Print layout customization | `Print Format` builder | Custom Jinja template from scratch |
| Workspace tile / shortcut | `Workspace` editor | Custom module page |
| Milestone on document | `Milestone Tracker` | Manual status-change hook |

## Configuration — with minor coding

| Capability | DocType / Mechanism | Notes |
|---|---|---|
| Custom approval chain beyond simple two-step | `Workflow` + custom `Workflow Transition` roles | One Workflow DocType record; no app code |
| Assignment by round-robin or load | `Assignment Rule` (type: Round Robin / Load Balancing) | Config only |
| Scheduled reminder | `Reminder` DocType | User-set; no cron job needed |

## Typical build threshold

A custom Python app (or controller extension) is justified when:

1. **Performance**: operation runs in a tight loop and Server Script overhead matters
2. **Untestable via UI**: logic requires programmatic integration tests (`IntegrationTestCase`)
3. **Multi-DocType transaction**: a single atomic operation spans several DocTypes and must roll back together
4. **External system integration**: OAuth, signed webhooks, or binary payloads beyond the standard Webhook DocType
5. **Override core behaviour**: `override_doctype_class`, `extend_bootinfo`, or custom scheduler event — document the justification

If none of these apply, prefer configuration.

## Upgrade cost note (16.x)

Custom apps using `override_doctype_class` or patching `frappe.db` must be re-verified on every minor release. Configuration-only changes (Workflow, Custom Field, Server Script) survive minor upgrades without code review. Each custom Python file is a maintenance liability through the 16.x release cycle.

## Sources

- `frappe/automation/doctype/` (16.51.1): `assignment_rule/`, `auto_repeat/`, `milestone_tracker/`, `reminder/` — directory listing verified
- `frappe/workflow/doctype/` (16.51.1): `workflow/`, `workflow_state/`, `workflow_transition/`, `workflow_action/` — directory listing verified
- `frappe/email/doctype/notification/` (16.51.1): `notification.json` + `test_records.json` — presence verified
- `frappe/integrations/doctype/webhook/` (16.51.1): presence verified
- `frappe/desk/doctype/dashboard/`, `dashboard_chart/` (16.51.1): presence verified
- `frappe/core/doctype/` (16.51.1): `server_script/`, `web_form/`, `custom_field/` — verified via directory listing
- `frappe/utils/safe_exec.py` (16.51.1): `SAFE_EXEC_CONFIG_KEY = "server_script_enabled"` and `frappe.get_common_site_config(cached=True).get("server_script_enabled")` — confirms Server Script is gated by `server_script_enabled: 1` in `common_site_config.json`, not per-site config
- ERPNext standard modules (ERPNext 16.50): Accounts, Assets, Buying, HR, Projects, Stock, CRM — available but not enumerated here; check the running ERPNext instance for module-level capabilities
