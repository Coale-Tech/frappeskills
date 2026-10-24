# Extending ERPNext From a Custom App

Hook points ERPNext itself uses, and the ones a custom app should reuse the
same way. Part of [erpnext-workflows.md](erpnext-workflows.md). Frappe's own
hook system is documented in `frappe-doctype-development`/`frappe-app-dev`;
this file only covers how **ERPNext's own `hooks.py`** exercises them, so a
custom app follows the same pattern instead of inventing a new one.

---

## extend_doctype_class vs override_doctype_class

Two different Frappe core hooks, both `frappe.get_hooks(...)`-driven from
`frappe/model/base_document.py`:

- `override_doctype_class = {"DocType Name": "dotted.path.to.Class"}` —
  **replaces** the controller class wholesale (`base_document.py:110`,
  `frappe/installer.py:325`). Two apps cannot both override the same
  DocType's class without one clobbering the other at install time
  (`installer.py:328-329` explicitly checks for this collision).
- `extend_doctype_class = {"DocType Name": "dotted.path.to.MixinClass"}` —
  **mixes in** additional behaviour alongside the existing controller
  (`base_document.py:190`), so multiple apps can each extend the same
  DocType without conflicting.

**v15 → v16: ERPNext switched its own `Address` customization from
`override_doctype_class` to `extend_doctype_class`** — same target class
(`erpnext.accounts.custom.address.ERPNextAddress`), different hook key
(v15 baseline `hooks.py:47` vs v16 `hooks.py:56`). Prefer `extend_doctype_class`
in a new custom app for the same reason ERPNext moved to it: it composes with
other apps' extensions instead of racing them for the class slot.

## override_whitelisted_methods

```python
# hooks.py:58
override_whitelisted_methods = {
    "frappe.www.contact.send_message": "erpnext.templates.utils.send_message",
}
```

Redirects an existing whitelisted endpoint to your own function with the same
signature — this is how to change behaviour behind a call site you cannot
edit (a core or another app's `@frappe.whitelist()` function), instead of
monkey-patching it.

## doc_events

```python
# hooks.py:336
doc_events = {
    "*": {
        "validate": [
            "erpnext.support.doctype.service_level_agreement.service_level_agreement.apply",
            "erpnext.setup.doctype.transaction_deletion_record.transaction_deletion_record.check_for_running_deletion_job",
        ],
    },
    tuple(period_closing_doctypes): {
        "validate": "erpnext.accounts.doctype.accounting_period.accounting_period.validate_accounting_period_on_doc_save",
    },
}
```

`"*"` runs for every DocType's given event — this is how SLA application
(`Service Level Agreement.apply`) attaches to any transaction without editing
each one, and how ERPNext blocks saves during a running Transaction Deletion
job globally. A tuple key (`tuple(period_closing_doctypes)`) attaches the
same handler to several named DocTypes at once — build the tuple/list from a
constant instead of repeating the dotted path per DocType.

## scheduler_events

```python
# hooks.py — 16.51.1 bench 16.51 (0/30 bucket removed; reposting now shares 0/15)
scheduler_events = {
    "cron": {
        "0/15 * * * *": [
            "erpnext.manufacturing.doctype.bom_update_log.bom_update_log.resume_bom_cost_update_jobs",
            "erpnext.stock.doctype.repost_item_valuation.repost_item_valuation.run_parallel_reposting",
        ],
        "30 * * * *": ["erpnext.accounts.doctype.gl_entry.gl_entry.rename_gle_sle_docs"],
    },
    ...
}
# (<=16.35): run_parallel_reposting was in a separate "0/30 * * * *" bucket.
```

ERPNext uses `"cron"` with explicit cron expressions for its own recurring
jobs (BOM cost resume, item valuation reposting, GL/SLE renaming), plus
`"daily"`/`"hourly"`/`"all"` buckets elsewhere in the same dict (e.g.
`post_depreciation_entries`, see
[erpnext-projects-assets-support.md](erpnext-projects-assets-support.md#assets)).
Prefer a specific cron expression over `"all"` (runs every scheduler tick)
for anything that does real work.

**New scheduler entries (16.51):**
- **Hourly:** `bank_transaction_rule.scheduler_run_rule_evaluation` — Bank Transaction Rule auto-categorization
- **Weekly:** `stock_reposting_settings.repost_incorrect_valuation_entries` — opt-in valuation auto-correction (requires `Stock Reposting Settings.repost_incorrect_valuation_entries = 1`)
- **HRMS Daily:** `shift_assignment.mark_expired_shift_assignments_as_inactive` — auto-sets expired Shift Assignments to `Inactive`

## regional_overrides

```python
# hooks.py:591
regional_overrides = {
    "United Arab Emirates": {
        "erpnext.controllers.taxes_and_totals.update_itemised_tax_data":
            "erpnext.regional.united_arab_emirates.utils.update_itemised_tax_data",
        "erpnext.accounts.doctype.purchase_invoice.purchase_invoice.make_regional_gl_entries":
            "erpnext.regional.united_arab_emirates.utils.make_regional_gl_entries",
    },
    "Italy": {...}, "Saudi Arabia": {...}, "France": {...},
}
```

Keyed by `Company.country` — ERPNext swaps a specific dotted function for a
country-specific implementation without an `if country ==` branch in the
core function itself. This is the pattern for country-specific tax/GL
behaviour in a custom app too: keep the country variant in its own module
and register it here rather than branching inside the shared function.

## Utility entry points

```python
from erpnext import get_default_company
get_default_company(user=None)  # erpnext/__init__.py:12
# reads the user's default via frappe.defaults.get_user_default_as_list("company", user),
# falling back to Global Defaults.default_company
```

`erpnext.normalize_ctx_input(T: type)` (`erpnext/__init__.py:170`) is the
decorator behind `get_item_details`'s `ctx` normalization (see
[erpnext-selling-buying.md](erpnext-selling-buying.md#get_item_details)): it
accepts a `Document`, `dict`, or JSON string as the first argument and casts
it to the given `frappe._dict` subclass before calling the wrapped function —
reuse it on your own "row context" functions that need to accept any of
those three shapes from client-side calls.

## v15 → v16 → 16.51 hooks.py key changes (extender-relevant)

Diffed top-level `hooks.py` keys between the v15.119.0 baseline, v16.6.1, and 16.51:

- **Renamed/split (v15→v16):** `advance_payment_doctypes` → split into
  `advance_payment_payable_doctypes` + `advance_payment_receivable_doctypes`.
- **Renamed (v16→16.51):** `user_privacy_documents` → `user_data_fields`; child dict keys
  `match_field` → `filter_by`, `personal_fields` → `redact_fields`. Custom apps declaring
  `user_privacy_documents` will silently stop GDPR erasure — rename all three.
- **Added (v16):** `extend_doctype_class`, `app_home`, `app_include_icons`,
  `web_include_icons`, `ignore_links_on_delete`, `naming_series_variables_list`, `page_js`.
- **Added (16.51):** `repost_allowed_doctypes` (see [erpnext-accounting.md](erpnext-accounting.md)),
  `subscription_doctypes`, `code_only_modules`, `sqlite_search`, `data_import_providers`,
  `after_app_install`/`after_app_uninstall`, `never_skip_patches`.
- **Removed (16.35→16.51):** `before_tests`; `setup_wizard_complete`/`setup_wizard_test`
  (ERPNext's own usage); `"0/30 * * * *"` cron bucket (contents moved to `0/15`).

**`subscription_doctypes` (16.51):** declares which DocTypes can be linked to a
`Subscription`. ERPNext seeds `["Sales Invoice", "Purchase Invoice", "Payment Request",
"POS Invoice"]`. Custom apps adding a subscription-capable DocType should append here.

**`code_only_modules` (16.51):** hides modules from the Dock/sidebar, surfacing them
only within a named parent module. Pattern:
```python
code_only_modules = {"Subcontracting": ["Manufacturing"], "Regional": ["Accounts"]}
```
Both ERPNext and HRMS use this to keep setup-only modules out of the module list.

`override_doctype_class` and `extend_doctype_class` are both still real, supported
Frappe-core hooks — only ERPNext's own choice of which one to set for `Address` changed.


## deprecation_dumpster.py

`erpnext/deprecation_dumpster.py` (163 lines) is where ERPNext parks
deprecated functions/methods behind versioned warning decorators instead of
deleting them outright: each entry records the deprecation date, the version
range in which it becomes a hard error and then is removed, and a
user-facing alternative. It imports `Color`/`_deprecated`/`colorize` from
`frappe.deprecation_dumpster` — the same pattern exists in Frappe core. If a
custom app calls something and gets an `ERPNextDeprecationError`/
`ERPNextDeprecationWarning`, check this file for the documented replacement
before assuming the API was removed without a path forward.

## Sources

Verified against ERPNext v16.6.1 (coale_v16) and ERPNext 16.50.0 / Frappe 16.51.1 (16.51.1 bench):

- `apps/frappe/frappe/model/base_document.py` — `override_doctype_class` (:110), `extend_doctype_class` (:190)
- `apps/frappe/frappe/installer.py` — override-collision check (:325-329)
- `apps/erpnext/erpnext/hooks.py` (16.51.1 bench) — `extend_doctype_class`, `override_whitelisted_methods`, `doc_events`, `scheduler_events` (:468 cron), `regional_overrides`, `code_only_modules` (:26), `subscription_doctypes` (:627), `repost_allowed_doctypes` (:728), `user_data_fields` (:657)
- coale_v16 `apps/erpnext/erpnext/hooks.py` — `scheduler_events` (:420 `0/15`, :423 `0/30`), `user_privacy_documents` (:605)
- `apps/erpnext/erpnext/__init__.py` — `get_default_company` (:12), `normalize_ctx_input` (:170)
- `apps/erpnext/erpnext/deprecation_dumpster.py` — module docstring and structure (:1-40)
