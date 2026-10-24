# Frappe CRM WhatsApp Integration (CRM 2.x)

CRM 2.x requires the `whatsapp` app and uses its `WA Message`, `WA Account`,
and `WA Template` doctypes for all WhatsApp messaging. The old
`frappe_whatsapp` community app and its `WhatsApp Message` doctype are no
longer supported.

## Architecture

```
whatsapp app                    crm app
──────────────────              ──────────────────────────────────────
WA Account                      crm/api/whatsapp.py
WA Settings (singleton)     ←── whatsapp_access_guard hook
WA Template                     validate_access() checks CRM roles
WA Message                  ←── doc_events["WA Message"]
WA Profile (Contact)            notify_agent(), update_reference_modified()
  ↕                             crm.automation.events.on_whatsapp_message()
frontend @whatsapp/ui
  link:../../whatsapp/ui     ─── linked in CRM's package.json
```

The `whatsapp` app has no role model of its own; `hooks.py:332` registers
`whatsapp_access_guard = ["crm.api.whatsapp.validate_access"]` so that
every whitelisted endpoint in the whatsapp app is gated on CRM's sales roles
before the whatsapp app's own logic runs.

## Guard and Role Check

```python
# crm/api/whatsapp.py
ALLOWED_WHATSAPP_ROLES = ["System Manager", "Sales Manager", "Sales User"]

def validate_access() -> None:
    """Registered as the WhatsApp app's whatsapp_access_guard hook."""
    if not set(frappe.get_roles()) & set(ALLOWED_WHATSAPP_ROLES):
        frappe.throw(_("Only sales users can access WhatsApp features."), frappe.PermissionError)
```

## WA Message doc_events

```python
# hooks.py (CRM 2.x)
doc_events = {
    "WA Message": {
        "validate": ["crm.api.whatsapp.validate"],          # link to CRM entity, guard recipient change
        "on_submit": ["crm.api.whatsapp.update_reference_modified"],  # bump lead/deal modified
        "on_update": [
            "crm.api.whatsapp.notify_agent",               # in-app CRM Notification
            "crm.automation.events.on_whatsapp_message",   # Automation Engine trigger
        ],
    },
}
```

## Incoming Message Flow

1. WhatsApp webhook → `whatsapp` app creates `WA Message` (direction=Incoming)
2. `validate` → `_resolve_reference(doc, phone_number)` finds Lead or Deal
   with matching `mobile_no`; if none exists and the account has
   `append_to = "CRM Lead"`, a new Lead is created.
3. `_link_profile_to_crm_entities` links the `WA Profile` to all matching
   Lead/Deal/Contact records.
4. `on_update` → `notify_agent` posts a `CRM Notification` to the `deal_owner`
   or `lead_owner`.
5. Automation Engine `on_whatsapp_message` fires `crm.prospect_message_received`.

## Outgoing Message

Frontend sends via the `whatsapp` app's own whitelisted endpoint (protected
by `validate_access`). For template messages, `WA Template` records
(Approved status) are selected by the sender. The CRM Forms Builder can also
set a WhatsApp template as a follow-up action.

## `is_whatsapp_installed()` vs `is_whatsapp_enabled()`

```python
@frappe.whitelist()
def is_whatsapp_installed() -> bool:
    return frappe.db.exists("DocType", "WA Settings")

@frappe.whitelist()
def is_whatsapp_enabled() -> bool:
    if not frappe.db.exists("DocType", "WA Settings"):
        return False
    return frappe.db.get_single_value("WA Settings", "status") == "Active"
```

**Always guard on both.** App installed but `status != "Active"` means the
integration is disabled. The frontend checks `is_whatsapp_enabled()` before
showing the WhatsApp tab.

## Recipient Change Guard

```python
def guard_recipient_change(doctype, docname, old_number, new_number) -> None:
    """Refuse to move a Lead/Deal off a number it already has WA messages with,
    unless CONFIRM_PARAM is in the request (a dialog in the frontend)."""
```

If a Lead or Deal's `mobile_no` is being changed and there are existing
`WA Message` records for the old number, the controller raises
`WhatsAppRecipientChangeError`. The frontend surfaces a confirmation dialog
before allowing the change.

## Frontend WhatsApp UI

The CRM frontend imports `@whatsapp/ui` directly from the whatsapp app:

```json
// frontend/package.json
"@whatsapp/ui": "link:../../whatsapp/ui"
```

This means the CRM's frontend build includes the WhatsApp UI components
from the whatsapp app source tree via a yarn workspace link. The component
is not versioned separately — it tracks the whatsapp app on the same bench.

## Migration from `frappe_whatsapp` → `whatsapp` app

`crm/patches/v1_0/migrate_from_frappe_whatsapp.py` runs on `bench migrate`
and converts all data in place:

| Old | New | Notes |
|---|---|---|
| `WhatsApp Account` | `WA Account` | Copies `app_id`, `business_id`, `phone_id`, `auto_read_receipts`, decrypts `token` |
| `WhatsApp Settings` | `WA Settings` | Copies `default_outgoing_account`, `whatsapp_api_url`, `webhook_verify_token` |
| `WhatsApp Templates` | `WA Template` | Copies template body/header/footer, parses comma-separated `sample_values` into `WA Template Variable` rows |
| `WhatsApp Message` | `WA Message` | Processed in 500-row batches via `db_insert()` — bypasses the controller so outgoing messages are not resent to Meta |
| Link fields | — | `File.attached_to_doctype`, `Comment.reference_doctype`, `CRM Notification.notification_type_doctype` updated from `"WhatsApp Message"` → `"WA Message"` |

After data copy the patch calls `link_existing_whatsapp_profiles_to_crm`
to attach `WA Profile` records to matching CRM entities by phone number.

If a `frappe_whatsapp` site does not have an existing `WA Account` record
at the time of migration, the patch also copies `WhatsApp Settings` into
the new `WA Settings` singleton (default URL, version, webhook verify token).

## `add_roles()` — after_migrate

```python
# called from after_migrate
def add_roles():
    """Grant WA Message read/write to CRM roles so sales users can message."""
```

Adds `WA Message` permissions for `Sales Manager` and `Sales User` via
`update_permission_property`. Called on every `bench migrate` (idempotent).

## Automation Engine Integration

WhatsApp events are wired into the Automation Engine:

```python
# hooks.py
automation_events = [{
    "crm.prospect_message_sent": {
        "label": "We emailed the prospect",
        "subject": REFERENCE_SUBJECT,  # resolves Lead or Deal from WA Message
    },
    "crm.prospect_message_received": {
        "label": "The prospect replied",
        "subject": REFERENCE_SUBJECT,
    },
}]
```

Automation flows can fire on `crm.prospect_message_sent`/`received` without
custom `doc_events` code — use the Automation Engine flow builder.

## Sources

Verified against CRM 2.0.0-dev (`apps/crm`, 16.51 bench) and `apps/whatsapp`:

- `crm/hooks.py` — `whatsapp_access_guard` (:332), `doc_events["WA Message"]` (:270-277), `required_apps = ["whatsapp"]` (:14)
- `crm/api/whatsapp.py` — `validate_access`, `validate`, `notify_agent`, `update_reference_modified`, `guard_recipient_change`, `is_whatsapp_installed`, `is_whatsapp_enabled`, `add_roles`
- `crm/patches/v1_0/migrate_from_frappe_whatsapp.py` — full migration patch
- `crm/patches/v1_0/link_existing_whatsapp_profiles_to_crm.py` — profile link patch
- `frontend/package.json` — `"@whatsapp/ui": "link:../../whatsapp/ui"` (:32)
- `apps/whatsapp/whatsapp/doctype/` — `wa_account`, `wa_settings`, `wa_template`, `wa_message`, `wa_profile` doctype list
