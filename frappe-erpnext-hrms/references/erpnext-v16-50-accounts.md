# ERPNext 16.50 Accounting Changes

Detailed change-log for the accounting module between ERPNext 16.6.1 (baseline)
and 16.50.0. See [erpnext-accounting.md](erpnext-accounting.md) for the stable
API reference.

---

## New DocTypes (ERPNext 16.50)

| DocType | Kind | Purpose |
|---|---|---|
| `Bank Transaction Rule` | Submittable | Rules-based auto-matching for bank import |
| `Bank Transaction Rule Accounts` | Child | Account rows per rule |
| `Bank Transaction Rule Description Conditions` | Child | Regex/keyword filters per rule |
| `Bank Account Balance` | Regular | Daily bank-account balance snapshots (bank_account, date, balance, company) |
| `Bank Statement Import Log` | Regular | Import run log with detected dates, amounts, column mapping, status |
| `Bank Statement Import Log Column Map` | Child | Column-level mapping per import run |
| `Payment Reference` | Child | Links a Payment Request row to a specific Payment Schedule row |
| `Ledger Health Monitor` | Single | Monitors debit-credit mismatch and GL-vs-Payment-Ledger discrepancy |

## Removed DocTypes (ERPNext 16.50)

| DocType | Replacement |
|---|---|
| `Repost Accounting Ledger Settings` | Merged into `Accounts Settings` (patch `v16_0/merge_repost_settings_to_accounts_settings`) |

---

## Bank Transaction Rule (ERPNext 16.50)

A new doctype that replaces manual matching with saved rules.

```
Rule Name, Company, Priority
Transaction Type (Debit/Credit), Min Amount, Max Amount
Classify As: "Bank Entry" | "Payment Entry" | "Transfer"
Bank Entry Type: "Single Account" | "Multiple Accounts"

Description Rules (child): check (Contains/Regex/…), value
Accounts (child): account, party_type, party, debit formula, credit formula, user_remark
```

Rules are evaluated in ascending priority order. `Bank Transaction.is_rule_evaluated`
and `Bank Transaction.matched_transaction_rule` record the outcome.
The `accounts[].debit`/`.credit` accept numeric literals **or** formulae using
`transaction_amount` as the only variable (e.g., `transaction_amount * 0.18`).
`validate_amount_formula` in `accounts/doctype/bank_transaction_rule/bank_transaction_rule.py`
enforces the safe subset.

`Accounts Settings.automatically_run_rules_on_unreconciled_transactions` (Check)
and `transfer_match_days` (Int) control the scheduled reconciliation job.

---

## Accounts Settings: New Fields (ERPNext 16.50)

All fields below are NEW vs. ERPNext 16.6.1.

| Fieldname | Type | Effect |
|---|---|---|
| `repost_allowed_types` | Table | Replaced the deleted `Repost Accounting Ledger Settings` singleton |
| `book_stock_expense_gl_entries` | Check | Book GL entries for stock expense accounts (also needs `Company.expenses_added_to_stock_account` and `Company.expenses_added_to_stock_contra_account`) |
| `disable_include_dimensions` | Check | Hides the "Consider Accounting Dimension" filter from Receivable/Payable reports |
| `pcv_job_timeout` | Int | Timeout in seconds for the Period Closing Voucher background job (patch sets it to 3600) |
| `enable_discounts_and_margin` | Check | Enables the Discounts and Margin section on Sales/Purchase documents |
| `fetch_payment_schedule_in_payment_request` | Check | Lets Payment Requests populate `payment_reference` rows per payment schedule |
| `transfer_match_days` | Int | Window for matching bank transfers (used by auto-reconcile rules) |
| `automatically_run_rules_on_unreconciled_transactions` | Check | Triggers Bank Transaction Rules job automatically |
| `enable_overdue_billing_threshold` | Check | Blocks Sales Invoice submission if customer overdue > `Customer Credit Limit.overdue_billing_threshold` |
| `role_allowed_to_bypass_overdue_billing` | Link→Role | Role that can override the overdue-billing block |

**Removed from Accounts Settings**: `drop_ar_procedures` button.

**Account Freezing** was already in Company as `accounts_frozen_till_date` /
`role_allowed_for_frozen_entries` (since before 16.6.1); the singleton keys
`acc_frozen_upto` / `frozen_accounts_modifier` were in `Accounts Settings` in
older versions and migrated by patch `v16_0/migrate_account_freezing_settings_to_company`.

---

## Repost Accounting Ledger: New Fields (ERPNext 16.50)

The following fields are NEW on `Repost Accounting Ledger` in 16.50.0 (absent in 16.6.1):

| Field | Type | Notes |
|---|---|---|
| `error_log` | Code | Captured traceback when repost fails |
| `status` | Select | `"" / Queued / In Progress / Partially Reposted / Completed / Failed / Cancelled` |
| `scheduled_job` | Link | Link to the background job that runs the repost |

> **Correction note:** `total_vouchers`, `vouchers_posted`, `affected_transactions`,
> and `distinct_item_and_warehouse` belong to `Repost Item Valuation` (stock module),
> **not** to `Repost Accounting Ledger`. In 16.50.0, `Repost Item Valuation` dropped
> `distinct_item_and_warehouse` and `affected_transactions` and added `total_vouchers`
> and `vouchers_posted` for progress tracking.

---

## Journal Entry: New Fields (ERPNext 16.50)

| Field | Effect |
|---|---|
| `custom_remark` (Check) | When checked, the remark is user-entered instead of auto-generated |
| `tax_withholding_tab` | New tab housing `tax_withholding_entries` (Table), `tax_withholding_category`, `tax_withholding_group`, `override_tax_withholding_entries`, `ignore_tax_withholding_threshold` |

---

## Payment Request: Payment Reference Child Table (ERPNext 16.50)

When `Accounts Settings.fetch_payment_schedule_in_payment_request` is on, Payment
Requests include a `payment_reference` child table (DocType `Payment Reference`)
with columns: `payment_term`, `description`, `due_date`, `amount`, `currency`,
`payment_schedule`. This maps each request to a specific payment schedule row and
validates that the total of all `payment_reference` rows equals `Payment Request.grand_total`.

---

## AR/AP Ageing Filter Rename (ERPNext 16.50) — BREAKING

The filter key used by Accounts Receivable, Accounts Payable, Accounts Receivable
Summary, and Accounts Payable Summary changed:

| Old (<=16.6.1) | New (16.50.0) |
|---|---|
| `calculate_ageing_with` | `age_as_on` |
| option `"Today Date"` | option `"Today"` |

Patch `v16_0/rename_ar_ap_ageing_filter` migrates saved `Auto Email Report`,
`Dashboard Chart`, and `Number Card` filter JSON. Any custom code that builds
filter dicts for these reports must be updated.

---

## `get_party_bank_account` Import Path Change (ERPNext 16.50) — BREAKING

The function was moved from `erpnext.accounts.party` to
`erpnext.accounts.doctype.bank_account.bank_account`.

```python
# OLD (16.6.1, breaks in 16.50)
from erpnext.accounts.party import get_party_bank_account

# NEW (16.50.0)
from erpnext.accounts.doctype.bank_account.bank_account import get_party_bank_account
```

Signature unchanged: `get_party_bank_account(party_type, party)`.

---

## `get_permitted_price_lists` / `get_usable_price_list` (ERPNext 16.50)

Two new helper functions in `erpnext.accounts.party`:

```python
get_permitted_price_lists(doctype=None)   # party.py:388
get_usable_price_list(price_lists, party_doctype)  # party.py:397
```

`set_price_list` gained a new optional `doctype=None` parameter (party.py:408).

---

## `accounting_dimension_doctypes` Additions (ERPNext 16.50)

`Landed Cost Taxes and Charges` was added to `hooks.accounting_dimension_doctypes`
(patch `v16_0/create_accounting_dimensions_in_landed_cost_taxes_and_charges`).
Accounting dimensions are now propagated to this child table automatically.

---

## Ledger Health Monitor (ERPNext 16.50)

New single-record tool (`Ledger Health Monitor`, hooks into the Desk UI) that
monitors:
- `debit_credit_mismatch` — sums debits vs credits per voucher in GL Entry
- `general_and_payment_ledger_mismatch` — compares GL Entry outstanding vs
  Payment Ledger Entry outstanding

`monitor_for_last_x_days` (Int) limits the date window. Companies to monitor are
listed in the `companies` child table (`Ledger Health Monitor Company`).

---

## Receivable/Payable Fetch Method: "Raw SQL" Removed (ERPNext 16.50)

`Accounts Settings.receivable_payable_fetch_method` option `"Raw SQL"` was removed
(patch `v16_0/clear_procedures_from_receivable_report`). Existing rows with `"Raw SQL"`
are migrated to `"UnBuffered Cursor"`. Any site using the old method must re-select
a valid option after upgrade.

---

## Account Category: `root_type` Field (ERPNext 16.50)

`Account Category` gained a `root_type` field. Patch
`v16_0/set_root_type_in_account_categories` back-fills it from the bundled
`accounts/financial_report_template/account_categories.json`. Custom categories
must be updated manually.

---

## Sources

Verified against ERPNext 16.6.1 (the 16.35 bench) vs. ERPNext 16.50.0 (16.51 bench):

- `apps/erpnext/erpnext/patches.txt` (519 lines new vs. 467 lines old)
- `apps/erpnext/erpnext/hooks.py` (:354 period_closing_doctypes, :571 accounting_dimension_doctypes, :728 repost_allowed_doctypes, :627 subscription_doctypes)
- `apps/erpnext/erpnext/accounts/doctype/bank_transaction_rule/bank_transaction_rule.py` — `validate_amount_formula`; `BankTransactionRule` class
- `apps/erpnext/erpnext/accounts/doctype/bank_transaction_rule/bank_transaction_rule.json`
- `apps/erpnext/erpnext/accounts/doctype/bank_transaction_rule_accounts/bank_transaction_rule_accounts.json`
- `apps/erpnext/erpnext/accounts/doctype/bank_transaction_rule_description_conditions/bank_transaction_rule_description_conditions.json`
- `apps/erpnext/erpnext/accounts/doctype/bank_account_balance/bank_account_balance.json`
- `apps/erpnext/erpnext/accounts/doctype/bank_statement_import_log/bank_statement_import_log.json`
- `apps/erpnext/erpnext/accounts/doctype/payment_reference/payment_reference.json`
- `apps/erpnext/erpnext/accounts/doctype/ledger_health_monitor/ledger_health_monitor.json`
- `apps/erpnext/erpnext/accounts/doctype/accounts_settings/accounts_settings.json` — new fields verified line-by-line
- `apps/erpnext/erpnext/accounts/doctype/accounts_settings/accounts_settings.py` — `toggle_overdue_billing_threshold_field` (:158)
- `apps/erpnext/erpnext/accounts/doctype/repost_accounting_ledger/repost_accounting_ledger.json` (new: `status`, `error_log`, `scheduled_job`)
- `apps/erpnext/erpnext/accounts/doctype/repost_accounting_ledger/repost_accounting_ledger.py` — `MAX_VOUCHERS_PER_REPOST=50` (:15), `_derive_status` (:357), `Partially Reposted` (:366)
- `apps/erpnext/erpnext/accounts/doctype/journal_entry/journal_entry.py` — `custom_remark` (:65), `TaxWithholdingEntry` import (:21)
- `apps/erpnext/erpnext/accounts/doctype/payment_request/payment_request.py` — `payment_reference` validation (:120–143)
- `apps/erpnext/erpnext/accounts/doctype/bank_account/bank_account.py` — `get_party_bank_account` (:104, moved from party.py)
- `apps/erpnext/erpnext/accounts/party.py` — `get_permitted_price_lists` (:388), `get_usable_price_list` (:397), `set_price_list` (:408); `get_party_bank_account` absent
- `apps/erpnext/erpnext/accounts/utils.py` — `get_account_balances_coa` (:1417)
- `apps/erpnext/erpnext/accounts/general_ledger.py` — `validate_opening_entry_against_pcv` (:826)
- `apps/erpnext/erpnext/accounts/report/accounts_receivable/accounts_receivable.py` — `age_as_on` (:58)
- `apps/erpnext/erpnext/patches/v16_0/backfill_repost_accounting_ledger_status.py`
- `apps/erpnext/erpnext/patches/v16_0/create_accounting_dimensions_in_landed_cost_taxes_and_charges.py`
- `apps/erpnext/erpnext/patches/v16_0/rename_ar_ap_ageing_filter.py`
- `apps/erpnext/erpnext/patches/v16_0/clear_procedures_from_receivable_report.py`
- `apps/erpnext/erpnext/patches/v16_0/enable_book_stock_expense_gl_entries.py`
- `apps/erpnext/erpnext/patches/v16_0/set_root_type_in_account_categories.py`
- `apps/erpnext/erpnext/patches/v16_0/remove_all_role_from_payment_terms_template.py`
- `apps/erpnext/erpnext/stock/doctype/repost_item_valuation/repost_item_valuation.json` — `total_vouchers`, `vouchers_posted` new; `distinct_item_and_warehouse`, `affected_transactions` removed
