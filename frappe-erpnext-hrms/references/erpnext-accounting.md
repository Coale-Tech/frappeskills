# ERPNext Accounting

Chart of Accounts, GL/Payment Ledger, invoices, tax templates and the v16
withholding-tax rework. Part of [erpnext-workflows.md](erpnext-workflows.md).
Posting mechanics (who calls `make_gl_entries`, event order) are in
[erpnext-architecture.md](erpnext-architecture.md); this file covers the
Accounting DocTypes and helper APIs themselves.
ERPNext 16.50 additions/breaking changes: [erpnext-v16-50-accounts.md](erpnext-v16-50-accounts.md).

---

## Chart of Accounts

`Account` is a tree DocType (`is_group` marks a parent). `root_type` is one of
`Asset`, `Liability`, `Equity`, `Income`, `Expense`; `account_type` (e.g.
`Receivable`, `Payable`, `Bank`, `Stock`, `Tax`) drives validation elsewhere
(e.g. only a `Receivable`/`Payable` account can be a party account). A new
company can seed its tree from a template in
`accounts/doctype/account/chart_of_accounts/verified/` (country-specific
JSON/CSV charts picked in the Company setup wizard).

```python
frappe.get_all("Account", filters={"company": company, "is_group": 0},
    fields=["name", "account_type", "root_type"])
```

## GL Entry and Payment Ledger Entry

`GL Entry` is the immutable ledger row every submittable financial document
writes (never insert one directly — see
[erpnext-architecture.md](erpnext-architecture.md#general-ledger-posting-path)).
`Payment Ledger Entry` (PLE) is a second, party-centric ledger written
alongside GL Entry specifically for receivable/payable accounts; **outstanding
amounts are computed from PLE, not by summing GL Entry**, which is why
`accounting_dimension_doctypes` (`hooks.py:571` — GL Entry, Payment Ledger Entry,
Sales/Purchase Invoice, Payment Entry, Asset, Stock Entry, Budget, Delivery Note,
child item tables, and `Landed Cost Taxes and Charges` **(ERPNext 16.50)**).

```python
from erpnext.accounts.utils import get_balance_on
get_balance_on(account=None, date=None, party_type=None, party=None,
    company=None, in_account_currency=True, cost_center=None,
    ignore_account_permission=False)  # accounts/utils.py:202
```

## Sales and Purchase Invoice

Both subclass `SellingController`/`BuyingController`
([erpnext-architecture.md](erpnext-architecture.md)). Fields to know before
customizing:

| Field | Meaning |
|---|---|
| `is_return` | Credit/debit note; `return_against` links the original |
| `update_stock` | Invoice also posts a Delivery Note/Purchase Receipt-equivalent SLE |
| `is_pos` | Sales Invoice created from Point of Sale; pulls `POS Profile` |
| `debit_to` / `credit_to` | Party account resolved via `get_party_account` (`accounts/party.py:460`) |

## Payment Entry

```python
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
get_payment_entry(dt, dn, party_amount=None, bank_account=None, bank_amount=None,
    party_type=None, payment_type=None, reference_date=None,
    created_from_payment_request=False)  # payment_entry.py:2906 (ERPNext 16.50; was :2849 in <=16.6)
```

Returns a mapped, unsaved `Payment Entry` against the source document (Sales
Invoice, Purchase Invoice, Sales Order, etc.) with party, amounts and accounts
pre-filled — do not build a Payment Entry field-by-field by hand.

## Journal Entry

Generic double-entry voucher; `voucher_type` (e.g. `Journal Entry`, `Bank
Entry`, `Cash Entry`, `Contra Entry`, `Excise Entry`, `Write Off Entry`,
`Opening Entry`) is a Select on the DocType, not a hook. Used for entries that
don't map to a sales/purchase document — write-offs, contra, opening balances.

## Tax templates

`Sales Taxes and Charges Template` / `Purchase Taxes and Charges Template`
hold the rows applied to invoice/order taxes; `Item Tax Template` overrides
the rate per item. `Item Wise Tax Detail` **(v16)** is a new child table that
records the resolved tax amount per item row (previously only totals were
kept), giving reports item-level tax breakdowns without recomputation.

## Exchange rate

```python
from erpnext.setup.utils import get_exchange_rate
get_exchange_rate(from_currency, to_currency, transaction_date=None, args=None)
# setup/utils.py:62 — checks Currency Exchange records, falls back to the
# configured exchange rate provider (e.g. frankfurter.app) with caching.
```

## Accounting Dimensions

Custom dimensions (Cost Center-like fields such as Project, Territory, or a
fully custom one) attach to every doctype named in the `accounting_dimension_doctypes`
hook (`hooks.py:571` — GL Entry, Payment Ledger Entry, Sales/Purchase Invoice,
Payment Entry, Asset, Stock Entry, Budget, Delivery Note, and child item tables;
`Landed Cost Taxes and Charges` added **(ERPNext 16.50)**). A custom app adds its
own transaction doctype to this same hook list to make dimensions apply there too.

## Accounting Period and Period Closing

`Accounting Period` restricts which users can post/edit documents in a date
range. `Period Closing Voucher` transfers Income/Expense balances to a
retained-earnings account for a fiscal year. The `period_closing_doctypes`
hook (`hooks.py:354`) lists the doctypes checked for a closed period (`Sales
Invoice`, `Purchase Invoice`, `Journal Entry`, `Bank Clearance`, `Stock
Entry`, ...); add a custom financial doctype here to make it period-aware.

## Payment and Bank Reconciliation

`Payment Reconciliation` matches unreconciled Payment Entries/Journal Entries
against outstanding invoices for a party. `Bank Reconciliation Tool` matches
`Bank Transaction` rows against Payment Entries/Journal Entries using
`get_matching_queries` (`get_hooks("get_matching_queries")` — a customizable
hook list of query functions each returning candidate matches).
**Bank Transaction Rule** **(ERPNext 16.50)** adds rule-based auto-classification
of bank imports (priority, amount ranges, description conditions, account
allocation with `transaction_amount` formulae). See [erpnext-v16-50-accounts.md](erpnext-v16-50-accounts.md).

## Budget

`Budget` (company + fiscal year + cost center or Accounting Dimension) with
child table `Budget Account` (account + budgeted amount) enforces
`action_if_annual_budget_exceeded` / `action_if_accumulated_monthly_budget_exceeded`
(`Ignore`/`Warn`/`Stop`) at document validation. `Budget Distribution`
**(v16)** lets a budget be spread unevenly across months (replacing an even
12-way split) — attach it via the Budget's `budget_distribution` link, not by
overriding the monthly-check function.

## Deferred revenue/expense

Set `enable_deferred_revenue`/`enable_deferred_expense` and a schedule on an
invoice item row; the scheduled job processes bookings:

```python
from erpnext.accounts.deferred_revenue import process_deferred_accounting
process_deferred_accounting(posting_date=None)  # deferred_revenue.py:433
```

## Repost Accounting Ledger

**`repost_allowed_doctypes` hook **(ERPNext 16.50):** `hooks.py:728` declares which
voucher types may be reposted via GL. ERPNext seeds `["Sales Invoice", "Purchase
Invoice", "Journal Entry", "Payment Entry", "Purchase Receipt"]`; HRMS adds
`["Expense Claim"]`. On migrate, a patch copies these into
`Accounts Settings.repost_allowed_types` (child table `Repost Allowed Types`).
The old `Repost Accounting Ledger Settings` singleton was merged into
`Accounts Settings`. `get_allowed_types_from_settings()` still reads from
`Accounts Settings`. A custom app should declare its own `repost_allowed_doctypes`
list; it is read at install/migrate (seeding the child table) and by `_repost_vouchers` at runtime. Users can also add rows in Accounts Settings.

**(ERPNext <=16.6):** There was no `repost_allowed_doctypes` hook; allowed types
were configured only in the `Repost Accounting Ledger Settings` singleton.

**50-voucher cap (ERPNext 16.50):** `Repost Accounting Ledger` validates at most
50 vouchers per run (`MAX_VOUCHERS_PER_REPOST = 50`). New `status` field values:
`"Queued"`, `"In Progress"`, `"Partially Reposted"`, `"Completed"`, `"Failed"`,
`"Cancelled"`. New fields: `error_log` (Code), `scheduled_job` (Link).
See [erpnext-v16-50-accounts.md](erpnext-v16-50-accounts.md) for a correction on
which fields belong to `Repost Accounting Ledger` vs. `Repost Item Valuation`.

## v16 withholding-tax rework

v15 tracked TDS/TCS via `Tax Withheld Vouchers` and `Advance Tax` +
`Advance Taxes and Charges`. **v16** replaces these with `Tax Withholding
Entry` and `Tax Withholding Group` (both new DocTypes); `Tax Withholding
Category` and `Tax Withholding Rate` are unchanged. If a custom report or
integration reads `Tax Withheld Vouchers`, it must be ported to `Tax
Withholding Entry` for v16.

## v16-only reporting DocTypes

`Financial Report Template` and `Financial Report Row` **(v16)** define
reusable structured financial-statement layouts (row ordering, formulas,
account ranges) that a Financial Statement report renders from, instead of
each report hardcoding its row layout. `Account Category` **(v16)** groups
accounts for higher-level reporting cuts independent of the Chart of Accounts
tree; gained `root_type` field **(ERPNext 16.50)**.

`Sales Invoice Reference` **(v16)** is a new child table on `Payment Entry`
recording which Sales Invoices a payment specifically references, beyond the
existing `Payment Entry Reference`.

## AR/AP Ageing: Breaking Filter Rename (ERPNext 16.50)

The `calculate_ageing_with` filter key and `"Today Date"` option were renamed to
`age_as_on` / `"Today"` in Accounts Receivable/Payable/Summary reports. Saved
Dashboard Chart and Auto Email Report filters are migrated by patch; custom code
building filter dicts must be updated. `get_party_bank_account` moved from
`erpnext.accounts.party` to `erpnext.accounts.doctype.bank_account.bank_account`.

## Sources

Verified against ERPNext 16.6.1 and ERPNext 16.50.0 (frappe 16.51.1):

- `apps/erpnext/erpnext/accounts/utils.py` — `get_balance_on` (:202), `reconcile_against_document` (:508), `get_account_balances_coa` (:1417, ERPNext 16.50)
- `apps/erpnext/erpnext/accounts/doctype/payment_entry/payment_entry.py` — `get_payment_entry` (:2906 in 16.50; was :2849 in <=16.6)
- `apps/erpnext/erpnext/setup/utils.py` — `get_exchange_rate` (:62)
- `apps/erpnext/erpnext/accounts/deferred_revenue.py` — `process_deferred_accounting` (:433)
- `apps/erpnext/erpnext/accounts/doctype/repost_accounting_ledger/repost_accounting_ledger.py` — `MAX_VOUCHERS_PER_REPOST=50` (:15), `"Partially Reposted"` (:366), new `status`/`error_log`/`scheduled_job` fields (ERPNext 16.50)
- `apps/erpnext/erpnext/hooks.py` — `accounting_dimension_doctypes` (:571), `period_closing_doctypes` (:354), `repost_allowed_doctypes` (:728, ERPNext 16.50 only), `subscription_doctypes` (:627)
- `apps/erpnext/erpnext/accounts/doctype/purchase_invoice/purchase_invoice.py` — `block_invoice`/`unblock_invoice` as `@frappe.whitelist(methods=["POST"])` instance methods (ERPNext 16.50); module-level wrappers (:1987, :1980 in <=16.6) removed
- `apps/erpnext/erpnext/accounts/doctype/period_closing_voucher/period_closing_voucher.py` — `validate_stock_accounts_balance`, `validate_stock_closing_entry` in `before_submit` (:149–150)
- `apps/erpnext/erpnext/accounts/general_ledger.py` — `validate_opening_entry_against_pcv` (:826, ERPNext 16.50)
- `apps/erpnext/erpnext/accounts/party.py` — `get_party_account` (:460); `get_party_bank_account` removed (moved to `bank_account.py` in ERPNext 16.50)
- `apps/erpnext/erpnext/accounts/doctype/bank_account/bank_account.py` — `get_party_bank_account` (:104, ERPNext 16.50)
- `apps/erpnext/erpnext/patches/v16_0/merge_repost_settings_to_accounts_settings.py`
- `apps/erpnext/erpnext/patches/v16_0/rename_ar_ap_ageing_filter.py`
- DocType listings `apps/erpnext/erpnext/accounts/doctype/`: ERPNext 16.50 new: `bank_transaction_rule`, `bank_account_balance`, `bank_statement_import_log`, `ledger_health_monitor`, `payment_reference`; ERPNext 16.50 removed: `repost_accounting_ledger_settings`; v16 new: `budget_distribution`, `financial_report_template`, `financial_report_row`, `account_category`, `tax_withholding_entry`, `tax_withholding_group`, `item_wise_tax_detail`, `sales_invoice_reference`; v15-only: `tax_withheld_vouchers`, `advance_tax`
