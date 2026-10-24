# HRMS 16.50 → Payroll & Talent Change Log

Deep detail for payroll computation, expense/advance, recruitment, and
performance changes between HRMS **16.4.1** (baseline) and **16.50.0** (target).
Tag convention: `(HRMS 16.50)` = new; `(HRMS <=16.4)` = old/removed.
Frappe-framework facts retain `(16.51)` / `(<=16.35)`.
All paths relative to `apps/hrms/hrms/` unless noted.

---

## 1. Employer Contributions — new Salary Component type

**Impact level: BREAKS existing customisations.**

`Salary Component.type` gains a third option: `"Employer Contribution"` alongside
`"Earning"` and `"Deduction"` `(HRMS 16.50)`. `(HRMS <=16.4):` two options only.

Structural consequences:

- `payroll/utils.py` exports `COMPONENT_PARENTFIELDS = ("earnings", "deductions", "employer_contributions")`.
  Every loop over component types in both `salary_structure.py` and `salary_slip.py` now
  iterates this tuple, not a hardcoded `("earnings", "deductions")`.
- **Salary Structure** gains an `employer_contributions` child table (type `Table`, options
  `Salary Detail`) — verified in `salary_structure.json`.
- **Salary Slip** gains `employer_contributions_section` + `employer_contributions` child table
  (type `Table`, options `Salary Detail`) — verified in `salary_slip.json`.
- **Salary Component Account** gains a `liability_account` field (Link → Account) `(HRMS 16.50)`.
  Employer-contribution GL entry debits an expense account and credits a liability account,
  one for each component — both stored in `Salary Component Account`.
- `SalarySlip.calculate_net_pay()` calls `calculate_component_amounts("employer_contributions")`
  after deductions at `salary_slip.py:863`.
- `PayrollEntry.make_accrual_jv_entry()` calls `make_employer_contribution_jv_entry()` after
  the standard accrual JE, posting a separate `"Employer Contribution"` JE.

**Custom subclasses that loop `("earnings", "deductions")` break.** Switch to importing
`COMPONENT_PARENTFIELDS` from `hrms.payroll.utils`.

---

## 2. `calculate_tax_by_tax_slab` — moved and return-value changed

**Impact level: BREAKS code importing from old location.**

`(HRMS <=16.4):` function lived in `payroll/utils.py`, returned a single `float` (tax_amount).

`(HRMS 16.50):` function lives in
`payroll/doctype/income_tax_slab/income_tax_slab.py:22`. It now returns a
**two-element tuple `(tax_amount, surcharge_plus_other_taxes)`**. Internal
callers in `salary_slip.py` unpack with `__, =` (e.g. line 1828).

Refactored into sub-functions: `calculate_base_tax_from_tax_slabs`,
`apply_surcharge_with_marginal_relief`, `calculate_other_charges`. The import
path also changed:

```python
# HRMS <=16.4
from hrms.payroll.utils import calculate_tax_by_tax_slab

# HRMS 16.50
from hrms.payroll.doctype.income_tax_slab.income_tax_slab import calculate_tax_by_tax_slab
tax_amount, surcharge = calculate_tax_by_tax_slab(annual_taxable_earning, tax_slab, ...)
```

Custom income-tax extensions calling `calculate_tax_by_tax_slab` must:
1. Update the import path.
2. Unpack the tuple.

---

## 3. `COMPONENT_EVAL_GLOBALS` / `_safe_eval` refactored to `payroll/utils.py`

`(HRMS <=16.4):` `whitelisted_globals` dict was defined inline in `SalarySlip.__init__`;
`_safe_eval` and `throw_error_message` lived in `payroll/utils.py`.

`(HRMS 16.50):` `COMPONENT_EVAL_GLOBALS` constant defined in `payroll/utils.py:38`:
```python
COMPONENT_EVAL_GLOBALS = {
    "int": int, "float": float, "long": int, "round": round,
    "rounded": rounded, "date": date, "getdate": getdate,
    "get_first_day": get_first_day, "get_last_day": get_last_day,
    "ceil": ceil, "floor": floor,
    "min": min,   # NEW (HRMS 16.50)
    "max": max,   # NEW (HRMS 16.50)
}
```
`SalarySlip.__init__` sets `self.whitelisted_globals = COMPONENT_EVAL_GLOBALS.copy()`.

**Formula migration:** `min(base * 0.2, 5000)` and `max(base * 0.1, 1000)` are now valid
in salary component formulas. `(HRMS <=16.4):` `min`/`max` were not available; formulas
using them would raise `NameError`.

`get_component_abbr_map()` (formerly a closure inside `SalarySlip`) and the new
`get_component_eval_context(employee, ssa_as_dict)` helper are also in `payroll/utils.py`.

---

## 4. `get_advance_deduction` → `get_advance_deductions` (bulk)

**Impact level: BREAKS custom PayrollEntry subclasses.**

`(HRMS <=16.4):` `PayrollEntry.get_advance_deduction(component_type, item)` issued one DB
query per component row.

`(HRMS 16.50):` replaced by `get_advance_deductions(component_type, salary_components) -> dict[str, dict]`
(one JOIN query for all rows at once, keyed by `Additional Salary` name).

```python
# HRMS <=16.4 pattern (now absent):
employee_advance = self.get_advance_deduction(component_type, item)

# HRMS 16.50 pattern:
advance_deductions = self.get_advance_deductions(component_type, salary_components)
employee_advance = advance_deductions.get(item.additional_salary)
```

The dict value is a row-as-dict with keys `additional_salary`, `employee_advance`,
`advance_account`. `make_employee_advance_jv_accounts()` now receives the dict row
directly.

---

## 5. Remaining sub-periods: `ceil` → `round` in tax annualization

`(HRMS 16.50):` `salary_slip.py:935,943` uses `round(self.remaining_sub_periods) - 1`
for the *taxable* earnings forward projection.
`(HRMS <=16.4):` used `ceil()`.
Non-taxable earnings projections at lines 1061 and 1114 still use `ceil()`.

Effect: at mid-period the tax annualization changes slightly — marginal impact near
period boundaries.

---

## 6. Salary Slip print formats renamed (patch)

`(HRMS <=16.4)` print format names → `(HRMS 16.50)` replacements (patch `delete_old_salary_slip_print_formats`):

| Old name | New name |
|---|---|
| Salary Slip Standard | Salary Slip Classic |
| Salary Slip with Year to Date | Salary Slip Detailed |
| Salary Slip based on Timesheet | Salary Slip Classic |

Custom code referencing print formats by old name (e.g. `default_print_format`
Property Setter) is migrated by the patch. Hard-coded references in custom
scripts must be updated manually.

---

## 7. Payroll Entry JE permission fix

`PayrollEntry.on_cancel()` now sets `flags.ignore_permissions = True` on linked
`Journal Entry` and `Payment Ledger Entry` docs before cancelling them `(HRMS 16.50)`.
`(HRMS <=16.4):` lacked the flag; cancellation could fail in permission-restricted
environments.

---

## 8. Salary Structure Assignment — `get_timesheet_config()`

`SalaryStructureAssignment.get_timesheet_config()` is a new method at
`salary_structure_assignment.py:261` `(HRMS 16.50)`. Returns:
```python
frappe._dict(based_on_timesheet=0, hour_rate=0, timesheet_component="")
```
Called by `SalarySlip.get_emp_and_working_day_details()` instead of directly
reading `_salary_structure_doc.salary_slip_based_on_timesheet`. Custom override
patterns that read `salary_slip_based_on_timesheet` directly from the structure
document are still valid.

---

## 9. Expense Claim — multi-currency and Partially Paid

**Impact: BREAKS code that only checks "Paid"/"Unpaid" status.**

### New status: `"Partially Paid"`

When `total_amount_reimbursed > 0` but `< grand_total`, status is set to
`"Partially Paid"` instead of `"Unpaid"` `(HRMS 16.50)`. Old code checking
`status == "Unpaid"` will miss partially-reimbursed claims.

Migrated retroactively by patch `update_partially_paid_expense_claim_status`.

### Multi-currency

`HR Settings.enable_multi_currency_expense_claim` (Check field) controls whether
multi-currency is active `(HRMS 16.50)`. When disabled,
`set_company_currency_if_multi_currency_disabled()` forces `currency` to
company currency and `exchange_rate` to 1.0 on every save.

Patch `enable_multi_currency_expense_claim_for_existing_users` auto-enables the
setting for sites that already have multi-currency documents.

`Expense Claim Advance` rows now use `reference_type` / `reference_name` instead of
the old `payment_entry` field. Migrated by patch `set_reference_fields_in_expense_claim_advance`.
Custom GL code reading `data.payment_entry` from advance rows breaks; use
`data.reference_type` / `data.reference_name` instead.

### Other validations

| Change | Detail |
|---|---|
| `validate_employee_scope()` `(HRMS 16.50)` | Company auto-inferred from employee if blank; throws if company mismatches employee's company |
| `is_paid` forced to 0 `(HRMS 16.50)` | When `grand_total > 0` and `total_advance_amount > 0` |
| `payable_account` mandatory removed `(HRMS 16.50)` | `(HRMS <=16.4):` submit threw if blank |
| `ROLES_ALLOWED_TO_CLAIM_FOR_OTHERS` constant `(HRMS 16.50)` | `{"HR User", "HR Manager", "Expense Approver"}` — import instead of hardcoding |
| Per-expense-line project update `(HRMS 16.50)` | `get_linked_projects()` collects `expense.project` from every expense row, not just header |

---

## 10. Employee Advance — Partially Paid status and API changes

**Impact: BREAKS code filtering only on `"Unpaid"` status.**

### New `"Partially Paid"` status

`employee_advance.json` status options: Draft → **Partially Paid** → Unpaid → Paid → …
`(HRMS 16.50)`. Migrated retroactively by patch `update_partially_paid_employee_advance_status`.

`set_pending_amount()` query now includes `"Partially Paid"` in the status filter
alongside `"Unpaid"`. Custom queries that filter `status = "Unpaid"` will miss
partially-paid advances.

`get_employee_advance_balance()` in `hrms/api/__init__.py` likewise includes
`"Partially Paid"`.

### `make_bank_entry` removed `(HRMS <=16.4 only)`

The whitelisted `make_bank_entry(dt, dn)` function in `employee_advance.py` was
**deleted** `(HRMS 16.50)`. Custom code calling
`hrms.hr.doctype.employee_advance.employee_advance.make_bank_entry` returns 404.
Use `Payment Entry` to pay advances instead.

### New API: `get_employee_advance_return(employee_advance: str)`

New whitelisted endpoint (line 394) `(HRMS 16.50)`:
```python
from hrms.hr.doctype.employee_advance.employee_advance import get_employee_advance_return
result = get_employee_advance_return("EA-0001")
# result: {"total_return_scheduled": float, "has_return_scheduled": bool}
```
Returns scheduled-but-not-yet-returned amount (sum of linked Additional Salaries).

### `create_return_through_additional_salary` — `bank_account` param added

```python
# HRMS 16.50 signature:
create_return_through_additional_salary(
    employee, company, employee_advance_name, return_amount,
    advance_account, currency, mode_of_payment=None, bank_account=None  # new
)
```

---

## 11. Full & Final Statement — automatic advance reconciliation

`(HRMS 16.50):` `get_receivable_component()` now always (re-)calls
`add_outstanding_employee_advances()` before populating receivables. This method:
- Drops placeholder rows whose `reference_document` no longer has an outstanding advance.
- Refreshes amounts for non-Settled advance rows.
- Adds newly outstanding advances automatically.

`(HRMS <=16.4):` receivable rows were added only once on first load; they were not
auto-refreshed.

**Impact:** Custom pre-populated F&F receivables for Employee Advance may be
overwritten or removed on save. Only rows with `status = "Settled"` are preserved.

F&F GL entries for Employee Advance rows now include
`reference_type = "Employee Advance"`, `reference_name = data.reference_document`,
`is_advance = "Yes"` `(HRMS 16.50)`.

---

## 12. Interview — `interview_round` → `interview_type`

**Impact: BREAKS all code referencing `interview_round`.**

`(HRMS 16.50):` `Interview.interview_type` (Link → Interview Type).
`(HRMS <=16.4):` `Interview.interview_round` (Link → Interview Round).

The patch `#hrms.patches.v16_0.merge_interview_round_with_interview_type` is
commented out in `patches.txt` (disabled/already applied), indicating the rename
happened in an earlier 16.x migration. Queries using `interview_round` fail silently.

API helpers `get_interviewers(interview_type)` and `get_expected_skill_set(interview_type)`
now require `frappe.has_permission("Interview Type", "read", interview_type, throw=True)`
`(HRMS 16.50)`.

---

## 13. HRMS API (`hrms/api/__init__.py`) — mobile/external-app breaking changes

Multiple endpoints **removed the `employee` parameter**; the employee is now
derived from `frappe.session.user` via `get_current_employee()` `(HRMS 16.50)`:

| Endpoint | Old signature | New signature |
|---|---|---|
| `get_attendance_calendar_events` | `(employee, from_date, to_date)` | `(from_date, to_date)` |
| `get_shifts` | `(employee)` | `()` |
| `get_leave_balance_map` | `(employee)` | `()` |
| `get_expense_claim_summary` | `(employee)` | `()` |
| `get_employee_advance_balance` | `(employee)` | `()` |

**`get_advance_account(company)`** endpoint **deleted** `(HRMS 16.50)`.
`(HRMS <=16.4):` returned `Company.default_employee_advance_account`. Use
`frappe.db.get_value("Company", company, "default_employee_advance_account")` directly.

**New endpoint** `get_reports_to_employee_name(employee: str) -> str` `(HRMS 16.50)`:
Returns the name string of an employee's manager. Requires the caller to be the
manager of the given employee (checks `reports_to`).

**New settings in `get_settings()` response** `(HRMS 16.50)`:
- `prevent_self_leave_approval`
- `enable_multi_currency_expense_claim`

**`get_company_details(company)` now returns** `default_payroll_payable_account`
in addition to `cost_center` and `default_expense_claim_payable_account` `(HRMS 16.50)`.

**Permission checks added** to `get_employee_info`, `get_department_employees`,
`get_holidays_for_employee`, `get_attachments`, `get_company_details` (all use
`frappe.has_permission(..., throw=True)`) `(HRMS 16.50)`.

---

## 14. hooks.py — payroll and talent wiring changes

| Key | Change | Impact |
|---|---|---|
| `setup_wizard_complete` | Now a **list** of two callables `(HRMS 16.50)`; `(HRMS <=16.4)` was a string | Custom apps extending `setup_wizard_complete` must join a list, not override a string |
| `setup_wizard_stages` + `setup_wizard_requires` | Added `(HRMS 16.50)` | — |
| `extend_bootinfo` | `hrms.utils.extend_bootinfo` added `(HRMS 16.50)` | Desk boot payload now includes HRMS data |
| `repost_allowed_doctypes` | `["Expense Claim"]` added `(HRMS 16.50)` | Expense Claim can be reposted via ERPNext GL repost |
| `export_python_type_annotations` + `require_type_annotated_api_methods` | Both `True` `(HRMS 16.50)` | Annotate params/return on all new `@frappe.whitelist()` methods |
| Telemetry `doc_events` | Dozens of `hrms.telemetry.*` hooks added `(HRMS 16.50)` | No user impact; hooks fire only when `hrms.telemetry` module is available |

---

## 15. Additional Salary — internal rename

`AdditionalSalary.update_return_amount_in_employee_advance()` renamed to
`validate_employee_advance_return()` `(HRMS 16.50)`. Internal method; only breaks
direct calls.

---

## Sources

Verified against HRMS 16.4.1 (`apps/hrms` on the 16.35 bench) and HRMS 16.50.0
(`apps/hrms` on the 16.50 bench). All diffs run with `diff` excluding `locale/`,
`__pycache__`, `*.po/pot`. Paths relative to `apps/hrms/hrms/` unless noted.

- `payroll/utils.py` (16.50) — `COMPONENT_PARENTFIELDS`, `COMPONENT_EVAL_GLOBALS` with `min`/`max`, `get_component_abbr_map`, `get_component_eval_context`, `_safe_eval`
- `payroll/doctype/income_tax_slab/income_tax_slab.py` (16.50) — `calculate_tax_by_tax_slab` returning `(tax_amount, surcharge)` tuple; `calculate_base_tax_from_tax_slabs`; `apply_surcharge_with_marginal_relief`; `calculate_other_charges`
- `payroll/doctype/salary_slip/salary_slip.py` (16.50) — `calculate_net_pay` (employer_contributions branch at :863), `calculate_component_amounts`, `remaining_sub_periods` round vs ceil
- `payroll/doctype/payroll_entry/payroll_entry.py` (16.50) — `get_advance_deductions`, `make_employer_contribution_jv_entry`, `get_employer_contribution_accounts`, JE cancel with `ignore_permissions`
- `payroll/doctype/salary_structure/salary_structure.json` (16.50) — `employer_contributions` field
- `payroll/doctype/salary_slip/salary_slip.json` (16.50) — `employer_contributions_section`, `employer_contributions` fields
- `payroll/doctype/salary_component/salary_component.json` (16.50) — `type` options include `"Employer Contribution"`
- `payroll/doctype/salary_component_account/salary_component_account.json` (16.50) — `liability_account` field added
- `payroll/doctype/salary_structure_assignment/salary_structure_assignment.py` (16.50) — `get_timesheet_config`
- `payroll/patches/v16_0/delete_old_salary_slip_print_formats.py` (16.50)
- `hr/doctype/expense_claim/expense_claim.py` (16.50) — `validate_employee_scope`, `ROLES_ALLOWED_TO_CLAIM_FOR_OTHERS`, `"Partially Paid"` status, multi-currency, GL advance fix
- `hr/doctype/expense_claim/expense_claim.json` (16.50) — no new fields; multi-currency fields pre-existed
- `hr/doctype/employee_advance/employee_advance.py` (16.50) — `"Partially Paid"` status, `make_bank_entry` deleted, `get_employee_advance_return`, `set_pending_amount(update=)`
- `hr/doctype/employee_advance/employee_advance.json` (16.50) — `"Partially Paid"` in status options
- `hr/doctype/hr_settings/hr_settings.json` (16.50) — `enable_multi_currency_expense_claim` field added
- `hr/doctype/full_and_final_statement/full_and_final_statement.py` (16.50) — `add_outstanding_employee_advances`, `create_component_row` dedup, GL advance fields
- `hr/doctype/interview/interview.py` + `interview.json` (16.50) — `interview_round` → `interview_type`
- `hr/doctype/appraisal/appraisal.py` (16.50) — `get_feedback_history` permission check
- `api/__init__.py` (16.50) — dropped `employee` params, `get_advance_account` deleted, `get_reports_to_employee_name` added, permission guards, settings additions
- `hooks.py` (16.50) — `setup_wizard_complete` list, `extend_bootinfo`, `repost_allowed_doctypes`, telemetry hooks, type annotation flags
- `patches/v16_0/update_partially_paid_expense_claim_status.py`
- `patches/v16_0/update_partially_paid_employee_advance_status.py`
- `patches/v16_0/set_currency_and_base_fields_in_expense_claim.py`
- `patches/v16_0/set_base_paid_amount_in_employee_advance.py`
- `patches/v16_0/set_reference_fields_in_expense_claim_advance.py`
- `patches/v16_0/enable_multi_currency_expense_claim_for_existing_users.py`
- `patches/v16_0/set_job_offer_in_employee.py`
