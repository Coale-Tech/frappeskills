# ERPNext 16.6 → 16.50 Upgrade Checklist

Verified patches and breaking changes between ERPNext 16.6.1 / HRMS 16.4.1 (frappe 16.35.0)
and ERPNext 16.50.0 / HRMS 16.50.0 (frappe 16.51.1). Always run on a restored backup first.

## Pre-upgrade: read before `bench migrate`

**1. Python ≥ 3.14 required (ERPNext 16.50).**
`pyproject.toml` `requires-python = ">=3.14"`. A bench on Python 3.10–3.13 must upgrade
the interpreter before pulling ERPNext 16.50.

**2. frappe ≥ 16.50.0 required by both ERPNext 16.50 and HRMS 16.50.**
`[tool.bench.frappe-dependencies] frappe = ">=16.50.0,<17.0.0"`.
Pull Frappe to the 16.51 line (or later within v16) before updating ERPNext/HRMS.

**3. HRMS 16.50 requires erpnext ≥ 16.0.**
`hrms/hooks.py: required_apps = ["frappe/erpnext"]` — ERPNext must already be installed.

## ERPNext 16.50 — verified breaking patches

### Account Freezing fields moved from Accounts Settings → Company

**Patch:** `v16_0.migrate_account_freezing_settings_to_company`

| Old: Accounts Settings field | New: Company field |
|---|---|
| `acc_frozen_upto` | `accounts_frozen_till_date` |
| `frozen_accounts_modifier` | `role_allowed_for_frozen_entries` |

**Action:** Update custom code reading `frappe.get_single("Accounts Settings").acc_frozen_upto`
to read from the relevant Company document instead.

### Budget DocType restructured

**Patch:** `v16_0.migrate_budget_records_to_new_structure`

All draft and submitted Budget records are re-saved through the new structure. A stale
Property Setter `naming_series = "Budget-.YYYY.-"` is removed. Verify Budget reports
display correctly after migration.

### `repost_allowed_doctypes` hook is new; the allow-list now lives in Accounts Settings

**Patch:** `v16_0.merge_repost_settings_to_accounts_settings`

`(ERPNext <=16.6):` no such hook; allowed types were configured in the `Repost Accounting Ledger Settings` singleton (removed).
`(ERPNext 16.50):` the hook is still live: it seeds `Accounts Settings.repost_allowed_types` (install via `setup_repost_defaults`, and the migrate patch above), and `_repost_vouchers` also consults it at runtime for doctypes outside the built-in set.

**Action:** a custom voucher doctype that must support Repost Accounting Ledger should be listed in `repost_allowed_doctypes` in its app's `hooks.py` (it runs `_repost_allowed_hook_doctypes`) and added to `Accounts Settings.repost_allowed_types`. Do not code against the removed singleton.

### Role permission grants expanded (two mirror patches)

**Patches:**
- `v16_0.mirror_select_perms_to_custom_docperm`
- `v16_0.mirror_release_perms_to_custom_docperm`

DocTypes that carry any Custom DocPerm row stop inheriting the shipped DocType perms.
These patches mirror new `select`/`release` grants into existing Custom DocPerm rows on:
Account, Asset, Serial and Batch Bundle, Payment Terms Template, POS Invoice, Sales Taxes
and Charges Template, and more.

**Action:** Review custom permission setups on these DocTypes; verify no unexpected grants.

### AR/AP Ageing filter renamed

**Patch:** `v16_0.rename_ar_ap_ageing_filter`

| Old | New |
|---|---|
| Filter key `calculate_ageing_with` | `age_as_on` |
| Option value `"Today Date"` | `"Today"` |

Affected: Auto Email Reports, Dashboard Charts, Number Cards that reference Accounts
Receivable, Accounts Payable, and their Summary variants. Migrated automatically.
Custom code passing the old key silently falls back to the default.

### BOM secondary items renamed

**Patches:** `v16_0.co_by_product_patch` + `v16_0.rename_component_cost_valuation_type`

| Old (≤16.6.1) | New (16.50) |
|---|---|
| `BOMScrapItem` DocType | `BOMSecondaryItem` |
| `BOM.scrap_items` child table | `BOM.secondary_items` |
| `scrap_material_cost` field | `secondary_items_cost` |
| `"% of FG Cost"` valuation type | `"% of Component Cost"` |

Custom code referencing the old child table name or valuation type literal will break.

### Frappe CRM custom fields conditionally removed

**Patch:** `v16_0.remove_frappe_crm_custom_fields`

The `crm_deal` custom fields on Quotation and Customer are deleted if
`CRM Settings.enable_frappe_crm_data_synchronization` is off and no data exists in
those fields. Sites using the sync are not affected.

### Serial/batch tracking enabled automatically

**Patch:** `v16_0.enable_serial_batch_setting`

Sites with existing Serial No or Batch records have
`Stock Settings.enable_serial_and_batch_no_for_item` set to `1` automatically.
Verify stock valuation behavior if this was previously disabled.

### Payables/Receivables workspaces deleted

**Patch:** `v16_0.remove_payables_receivables_workspace`

The `Receivables` and `Payables` Workspace Sidebar and Workspace records are deleted.
Update any saved bookmarks or navigation links that pointed to those workspace names.

## HRMS 16.50 — verified breaking patches

### Upload Attendance DocType deleted

**Patch:** `v16_0.delete_upload_attendance_doctype`

`Upload Attendance` is permanently removed. Any custom code calling
`frappe.get_doc("Upload Attendance", ...)` or `frappe.new_doc("Upload Attendance")`
raises `DoesNotExistError` after migration.
**Replacement:** Employee Attendance Tool.

### Salary Slip print formats renamed

**Patch:** `v16_0.delete_old_salary_slip_print_formats`

| Old name | New name |
|---|---|
| `Salary Slip Standard` | `Salary Slip Classic` |
| `Salary Slip with Year to Date` | `Salary Slip Detailed` |
| `Salary Slip based on Timesheet` | `Salary Slip Classic` |

Print Settings, Email Templates, Letter Heads, or custom code referencing the old names
must be updated. The patch updates linked Print Format fields automatically.

### Holiday List Assignments migrated to new DocType

**Patch:** `v16_0.create_holiday_list_assignments`

HRMS 16.50 introduces `Holiday List Assignment`. Existing employee- and company-level
holiday list settings are migrated as submitted assignments. Verify payroll calendar
after migration.

### Multi-currency Expense Claims enabled automatically

**Patch:** `v16_0.enable_multi_currency_expense_claim_for_existing_users`

Sites with existing multi-currency Expense Claim or Employee Advance records have
`HR Settings.enable_multi_currency_expense_claim = 1` set. Verify expense claim
workflows and approver flows.

### Monetary fields backfilled on advances and expense claims

**Patches:** `set_base_paid_amount_in_employee_advance`, `set_currency_and_base_fields_in_expense_claim`,
`set_reference_fields_in_expense_claim_advance`, `update_partially_paid_employee_advance_status`,
`update_partially_paid_expense_claim_status`

Base-currency fields and reference linkages are backfilled automatically; no action required.

## Post-migration checklist

- [ ] No errors in Error Log immediately after `bench migrate`
- [ ] Budget reports: existing records display correctly
- [ ] AR/AP reports: ageing works (filter renamed to `age_as_on`)
- [ ] Custom code: no reference to `acc_frozen_upto` on Accounts Settings
- [ ] Custom code: BOM `scrap_items` updated to `secondary_items`; `BOMScrapItem` → `BOMSecondaryItem`
- [ ] HRMS: no `"Upload Attendance"` references in custom imports or doc_events
- [ ] HRMS: Salary slip print format references use new names (`Salary Slip Classic` etc.)
- [ ] HRMS: Holiday List Assignment records created; payroll calendar verified
- [ ] Custom DocPerms on Account, Asset, Serial and Batch Bundle reviewed
- [ ] Custom voucher doctypes needing GL repost are in `repost_allowed_doctypes` and `Accounts Settings.repost_allowed_types`; nothing reads `Repost Accounting Ledger Settings`

## Sources

- `apps/erpnext/erpnext/patches.txt` (ERPNext 16.50.0 vs 16.6.1 — v16_0 section diff)
- `apps/hrms/hrms/patches.txt` (HRMS 16.50.0 vs 16.4.1 — v16_0 section diff)
- `apps/erpnext/erpnext/patches/v16_0/migrate_account_freezing_settings_to_company.py`
- `apps/erpnext/erpnext/patches/v16_0/merge_repost_settings_to_accounts_settings.py`
- `apps/erpnext/erpnext/patches/v16_0/migrate_budget_records_to_new_structure.py`
- `apps/erpnext/erpnext/patches/v16_0/rename_ar_ap_ageing_filter.py`
- `apps/erpnext/erpnext/patches/v16_0/enable_serial_batch_setting.py`
- `apps/erpnext/erpnext/patches/v16_0/remove_payables_receivables_workspace.py`
- `apps/erpnext/erpnext/patches/v16_0/co_by_product_patch.py`
- `apps/erpnext/erpnext/patches/v16_0/rename_component_cost_valuation_type.py`
- `apps/erpnext/erpnext/patches/v16_0/mirror_select_perms_to_custom_docperm.py`
- `apps/erpnext/erpnext/patches/v16_0/mirror_release_perms_to_custom_docperm.py`
- `apps/erpnext/erpnext/patches/v16_0/remove_frappe_crm_custom_fields.py`
- `apps/hrms/hrms/patches/v16_0/delete_upload_attendance_doctype.py`
- `apps/hrms/hrms/patches/v16_0/delete_old_salary_slip_print_formats.py`
- `apps/hrms/hrms/patches/v16_0/create_holiday_list_assignments.py`
- `apps/hrms/hrms/patches/v16_0/enable_multi_currency_expense_claim_for_existing_users.py`
- `apps/erpnext/pyproject.toml` (`requires-python = ">=3.14"`, `frappe = ">=16.50.0,<17.0.0"`)
- `apps/hrms/pyproject.toml` (`frappe = ">=16.50.0,<17.0.0"`, `erpnext = ">=16.0.0,<17.0.0"`)
