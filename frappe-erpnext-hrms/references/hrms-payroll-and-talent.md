# Frappe HRMS: Payroll, Recruitment, Performance & Expenses

Payroll processing, recruitment, performance appraisal, and expense claims,
split out of [hrms-patterns.md](hrms-patterns.md) (Organization, Employee,
Leave, and Attendance). Verified against **HRMS 16.4.1** (baseline) and
**HRMS 16.50.0** (target). Paths below are relative to `apps/hrms/hrms/` unless noted.
Tag convention: `(HRMS 16.50)` = new/changed in 16.50; `(HRMS <=16.4)` = old/removed.
For full 16.50 change details see [hrms-v16-50-payroll-talent.md](hrms-v16-50-payroll-talent.md).

## Payroll Management

### Key DocTypes

| DocType | Purpose |
|---------|---------|
| Salary Component | Earnings, deductions, **employer contributions** `(HRMS 16.50)` |
| Salary Structure | Pay template (earnings + deductions + employer contributions) |
| Salary Structure Assignment | Link structure to employee |
| Payroll Entry | Bulk salary processing |
| Salary Slip | Individual pay slip |

### Salary Component

**`type` options `(HRMS 16.50)`:** `"Earning"`, `"Deduction"`, `"Employer Contribution"`.
`(HRMS <=16.4):` only `"Earning"` and `"Deduction"`.
Employer-contribution components need `liability_account` set in their
**Salary Component Account** child table (new field `(HRMS 16.50)`) alongside `account`.

```python
# Earning
earning = frappe.get_doc({
    "doctype": "Salary Component",
    "salary_component": "Basic Salary",
    "salary_component_abbr": "BS",
    "type": "Earning",
    "is_tax_applicable": 1
}).insert()

# Deduction
deduction = frappe.get_doc({
    "doctype": "Salary Component",
    "salary_component": "Health Insurance",
    "salary_component_abbr": "HI",
    "type": "Deduction",
    "is_tax_applicable": 0
}).insert()

# Employer Contribution — (HRMS 16.50)
contrib = frappe.get_doc({
    "doctype": "Salary Component",
    "salary_component": "NSSF Employer",
    "salary_component_abbr": "NSSF_E",
    "type": "Employer Contribution",
}).insert()
```

### Salary Structure

Salary Structure gains an `employer_contributions` child table `(HRMS 16.50)` alongside
`earnings` and `deductions` (all use `Salary Detail` DocType). The constant
`COMPONENT_PARENTFIELDS = ("earnings", "deductions", "employer_contributions")`
in `payroll/utils.py` drives all framework loops — custom code hardcoding the old
two-tuple breaks.

```python
ss = frappe.new_doc("Salary Structure")
ss.company = company
ss.payroll_frequency = "Monthly"
ss.append("earnings", {
    "salary_component": "Basic Salary",
    "formula": "base * 0.4",
    "amount_based_on_formula": 1
})
ss.append("deductions", {
    "salary_component": "Health Insurance",
    "amount": 2000,
    "amount_based_on_formula": 0
})
ss.append("employer_contributions", {   # (HRMS 16.50)
    "salary_component": "NSSF Employer",
    "formula": "base * 0.05",
    "amount_based_on_formula": 1
})
ss.insert()
ss.submit()
```

### Salary Structure Assignment

```python
ssa = frappe.new_doc("Salary Structure Assignment")
ssa.employee = "HR-EMP-001"
ssa.salary_structure = "Standard Structure"
ssa.from_date = "2024-01-01"
ssa.base = 100000  # Base salary
ssa.insert()
ssa.submit()
```

### Payroll Entry (Bulk Processing)

```python
pe = frappe.new_doc("Payroll Entry")
pe.company = company
pe.posting_date = frappe.utils.today()
pe.payroll_frequency = "Monthly"
pe.start_date = "2024-01-01"
pe.end_date = "2024-01-31"
pe.department = "Engineering"  # Optional filter
pe.insert()

# Get employees
pe.fill_employee_details()

# Create salary slips
pe.create_salary_slips()

# Submit salary slips
pe.submit_salary_slips()

# Create bank entry (optional)
pe.make_bank_entry()
```

### Salary Slip Query

```python
slips = frappe.get_all("Salary Slip",
    filters={
        "employee": "HR-EMP-001",
        "docstatus": 1,
        "posting_date": ["between", ["2024-01-01", "2024-12-31"]]
    },
    fields=["name", "posting_date", "gross_pay", "total_deduction", "net_pay"]
)
```

### Payroll Entry lifecycle (v16, source-verified)

`payroll/doctype/payroll_entry/payroll_entry.py`:

- `fill_employee_details()` (whitelisted) populates the `employees` child table via `get_employee_list()` filtered by company/branch/department/designation/grade and `payroll_frequency`.
- **`on_submit()` calls `create_salary_slips()` automatically** — no separate manual step after submit needed.
- `create_salary_slips()` enqueues one Salary Slip per employee.
- `submit_salary_slips()` enqueues `submit_salary_slips_for_employees()`; calls `make_accrual_jv_entry()` after all slips submit.
- `make_bank_entry(for_withheld_salaries=False)` creates the payment Journal Entry.
- **(HRMS 16.50) advance deductions:** per-row `get_advance_deduction(component_type, item)` replaced by bulk `get_advance_deductions(component_type, salary_components) -> dict[str, dict]` keyed by `Additional Salary` name. Custom subclasses calling `self.get_advance_deduction()` must switch to `self.get_advance_deductions()`. `(HRMS <=16.4):` per-row query.
- **(HRMS 16.50) type annotations:** `hooks.py` declares `require_type_annotated_api_methods = True` and `export_python_type_annotations = True`. Annotate all `@frappe.whitelist()` methods in extensions.
- **(HRMS 16.50) employer contribution JV:** `make_accrual_jv_entry()` now also posts a separate `"Employer Contribution"` Journal Entry. Each employer-contribution component maps to expense + liability account (new `liability_account` field on `Salary Component Account` child).

### Salary Slip computation flow (payroll computation entry points)

`SalarySlip` (`payroll/doctype/salary_slip/salary_slip.py`) extends `erpnext...TransactionBase`.
Computation is driven from **`validate()`** on every save:

```
SalarySlip.validate()
 ├─ get_emp_and_working_day_details()  (first load) — pulls structure + working days
 ├─ get_working_days_details()         — payment_days, LWP/PPL, absents
 ├─ set_salary_structure_assignment()  — loads active SSA (base/variable)
 ├─ calculate_net_pay()                ◄── core money computation
 ├─ compute_year_to_date() / compute_month_to_date()
 └─ add_leave_balances()
```

**`calculate_net_pay()` is the core entry point** and runs, in order:

1. `get_period_factor(...)` → remaining sub-periods (for annualized tax).
2. `calculate_component_amounts("earnings")` → `add_structure_components` + additional salary + employee benefits. Each row evaluated by `eval_condition_and_formula()` via `_safe_eval` over the eval context (employee fields, `base`, component abbreviations).
3. `set_gross_pay_and_base_gross_pay()` → `gross_pay`.
4. `calculate_component_amounts("deductions")` → structure deductions + additional salary + `add_tax_components()`. Income tax via `calculate_variable_based_on_taxable_salary` → `calculate_tax_by_tax_slab` **(now in `income_tax_slab.py`, returns `(tax_amount, surcharge)` tuple `(HRMS 16.50)`; `(HRMS <=16.4):` in `payroll/utils.py`, returned single float)**.
5. `calculate_component_amounts("employer_contributions")` **(HRMS 16.50)** — after deductions; not included in `net_pay`.
6. `set_loan_repayment(self)` (Lending app if present).
7. `set_net_pay()`: `net_pay = gross_pay − total_deduction`.
8. `compute_income_tax_breakup()`.

**Salary component eval globals `(HRMS 16.50)`:** `min()` and `max()` added to
`COMPONENT_EVAL_GLOBALS` in `payroll/utils.py`. Formula `min(base * 0.2, 5000)` now
valid. `(HRMS <=16.4):` `min`/`max` raised `NameError`.

**Tax annualization rounding `(HRMS 16.50)`:** taxable-earnings forward projection uses
`round(remaining_sub_periods)` instead of `ceil()`. Minor effect at period boundaries.

Whitelisted recompute helpers used by the form: `process_salary_based_on_working_days()`, `set_totals()`, `get_emp_and_working_day_details()`.

### Payroll GL / ERPNext accounting integration

HRMS does **not** write GL Entries directly — it creates ERPNext **Journal Entries**:

- **Accrual JE:** after slips submit, `make_accrual_jv_entry()` totals earnings/deductions per Salary Component → GL accounts, posts JE debiting expense accounts and crediting Payroll Payable. **(HRMS 16.50):** also calls `make_employer_contribution_jv_entry()` — a second JE debiting employer-contribution expense accounts and crediting liability accounts per component.
- **Bank/payment JE:** `make_bank_entry()` creates the payment JE debiting Payroll Payable and crediting the bank/payment account.
- On cancel, `PayrollEntry.on_cancel()` exempts `("GL Entry", "Salary Slip", "Journal Entry")` from auto-cancel and cancels linked slips/JEs itself. **(HRMS 16.50):** cancel sets `flags.ignore_permissions = True` on linked JEs/PLEs before cancelling.
- `hooks.py`: `period_closing_doctypes = ["Payroll Entry"]`; **(HRMS 16.50)** `repost_allowed_doctypes = ["Expense Claim"]` added.

## Recruitment

### Key DocTypes

| DocType | Purpose |
|---------|---------|
| Job Opening | Published positions |
| Job Applicant | Candidate records |
| Job Applicant Source | Recruitment channel |
| Job Offer | Formal offer letter |
| Staffing Plan | Headcount planning |

### Job Opening

```python
jo = frappe.new_doc("Job Opening")
jo.job_title = "Senior Developer"
jo.designation = "Software Engineer"
jo.department = "Engineering"
jo.company = company
jo.description = "Looking for experienced developer..."
jo.status = "Open"
jo.insert()
```

### Job Applicant

```python
ja = frappe.new_doc("Job Applicant")
ja.applicant_name = "Jane Smith"
ja.email_id = "jane@example.com"
ja.job_title = "Senior Developer"
ja.source = "Website"
ja.status = "Open"  # Open, Replied, Accepted, Rejected, Hold
ja.insert()
```

**`(HRMS 16.50)` Employee now carries `job_applicant` and `job_offer` read-only custom fields**,
populated automatically via `hooks.py after_insert` → `update_job_applicant_and_offer`.

### Job Offer

```python
from hrms.hr.doctype.job_applicant.job_applicant import make_offer_letter

offer = make_offer_letter("JA-001")
offer.offer_date = frappe.utils.today()
offer.designation = "Software Engineer"
offer.insert()
```

## Performance Management

### Appraisal

```python
appraisal = frappe.new_doc("Appraisal")
appraisal.employee = "HR-EMP-001"
appraisal.appraisal_template = "Standard Review"
appraisal.start_date = "2024-01-01"
appraisal.end_date = "2024-06-30"
appraisal.append("goals", {
    "kra": "Code Quality",
    "per_weightage": 30,
    "score": 4
})
appraisal.insert()
appraisal.submit()
```

**`(HRMS 16.50)` `get_feedback_history(employee, appraisal)`** now enforces
`frappe.has_permission("Appraisal", "read", appraisal, throw=True)`.

**Interview `interview_round` → `interview_type` `(HRMS 16.50)`:** The `Interview` DocType
field was renamed from `interview_round` (Link → Interview Round) to `interview_type`
(Link → Interview Type). `(HRMS <=16.4):` `interview_round`. All custom reports, queries,
and client scripts referencing `interview_round` break.

## Expense & Travel Claims

### Expense Claim

```python
ec = frappe.new_doc("Expense Claim")
ec.employee = "HR-EMP-001"
ec.expense_approver = "manager@example.com"
ec.append("expenses", {
    "expense_type": "Travel",
    "expense_date": frappe.utils.today(),
    "amount": 5000,
    "description": "Client meeting travel"
})
ec.insert()
ec.submit()
```

**`(HRMS 16.50)` Expense Claim — breaking changes:**
- `validate_employee_scope()`: company auto-inferred from employee if blank; mismatched company throws `MismatchError`.
- **New `"Partially Paid"` status** when `total_amount_reimbursed > 0` but `< grand_total`. `(HRMS <=16.4):` such claims stayed `"Unpaid"`. Integrations testing only `status == "Paid"` miss partially-reimbursed claims.
- `is_paid` forced to `0` when `grand_total > 0` and `total_advance_amount > 0`.
- `ROLES_ALLOWED_TO_CLAIM_FOR_OTHERS = {"HR User", "HR Manager", "Expense Approver"}` — import from module, do not hardcode.
- Multi-currency controlled by `HR Settings.enable_multi_currency_expense_claim` (new `(HRMS 16.50)`). When disabled, currency forced to company currency on every save.
- `Expense Claim Advance.payment_entry` migrated to `reference_type`/`reference_name`. Custom GL code using `data.payment_entry` breaks.
- `payable_account` is no longer mandatory to submit `(HRMS <=16.4):` threw if blank.

### Employee Advance

**`(HRMS 16.50)` breaking changes:**
- **New `"Partially Paid"` status** (when `paid_amount > 0` and `< advance_amount`). `pending_amount` query now includes `"Partially Paid"` alongside `"Unpaid"`.
- **`make_bank_entry(dt, dn)` deleted** `(HRMS <=16.4)`. Payments now go through Payment Entry.
- New `get_employee_advance_return(employee_advance: str)` whitelisted API → `{"total_return_scheduled": float, "has_return_scheduled": bool}`.

### Full & Final Statement

**`(HRMS 16.50)` `add_outstanding_employee_advances()`** auto-syncs Employee Advance
receivables on every save. Non-Settled advance receivable rows are refreshed or
replaced. Custom code pre-populating F&F Employee Advance rows will be overwritten
unless the row has `status = "Settled"`.

### HRMS Mobile / External API (`hrms/api/__init__.py`)

**`(HRMS 16.50)` BREAKING — `employee` param dropped from multiple endpoints** (derived from session):

| Endpoint | `(HRMS <=16.4)` | `(HRMS 16.50)` |
|---|---|---|
| `get_attendance_calendar_events` | `(employee, from_date, to_date)` | `(from_date, to_date)` |
| `get_shifts` | `(employee)` | `()` |
| `get_leave_balance_map` | `(employee)` | `()` |
| `get_expense_claim_summary` | `(employee)` | `()` |
| `get_employee_advance_balance` | `(employee)` | `()` |

`get_advance_account(company)` **deleted** `(HRMS 16.50)`. New: `get_reports_to_employee_name(employee) -> str`.
`get_company_details(company)` now also returns `default_payroll_payable_account`.

## Sources

Verified against HRMS 16.4.1 (`apps/hrms` on the 16.35 bench) and HRMS 16.50.0
(`apps/hrms` on the 16.50 bench). Frappe 16.51.1. Paths relative to `apps/hrms/hrms/`:

- `payroll/doctype/salary_slip/salary_slip.py` (`calculate_net_pay`, `calculate_component_amounts` incl. employer_contributions, `round` vs `ceil` for `remaining_sub_periods`)
- `payroll/doctype/payroll_entry/payroll_entry.py` (`make_accrual_jv_entry`, `make_employer_contribution_jv_entry`, `get_advance_deductions`, JE cancel with `ignore_permissions`)
- `payroll/utils.py` (16.50) — `COMPONENT_PARENTFIELDS`, `COMPONENT_EVAL_GLOBALS` with `min`/`max`
- `payroll/doctype/income_tax_slab/income_tax_slab.py` (16.50) — `calculate_tax_by_tax_slab` tuple return
- `payroll/doctype/salary_structure/salary_structure.json` — `employer_contributions` table
- `payroll/doctype/salary_slip/salary_slip.json` — `employer_contributions_section` + `employer_contributions`
- `payroll/doctype/salary_component/salary_component.json` — `type` options incl. `"Employer Contribution"`
- `payroll/doctype/salary_component_account/salary_component_account.json` — `liability_account` field
- `payroll/doctype/salary_structure_assignment/salary_structure_assignment.py` — `get_timesheet_config`
- `payroll/patches/v16_0/delete_old_salary_slip_print_formats.py`
- `hr/doctype/expense_claim/expense_claim.py` (16.50) — `validate_employee_scope`, `ROLES_ALLOWED_TO_CLAIM_FOR_OTHERS`, `"Partially Paid"`, multi-currency, `reference_type/name` for advances
- `hr/doctype/employee_advance/employee_advance.py` (16.50) — `"Partially Paid"`, `make_bank_entry` deleted, `get_employee_advance_return`
- `hr/doctype/employee_advance/employee_advance.json` (16.50) — `"Partially Paid"` in status options
- `hr/doctype/hr_settings/hr_settings.json` (16.50) — `enable_multi_currency_expense_claim` field
- `hr/doctype/full_and_final_statement/full_and_final_statement.py` (16.50) — `add_outstanding_employee_advances`
- `hr/doctype/interview/interview.py` + `.json` (16.50) — `interview_round` → `interview_type`
- `hr/doctype/appraisal/appraisal.py` (16.50) — `get_feedback_history` permission check
- `api/__init__.py` (16.50) — dropped `employee` params, `get_advance_account` deleted, `get_reports_to_employee_name`
- `hooks.py` (16.50) — `repost_allowed_doctypes`, telemetry hooks, type annotation flags
- `patches/v16_0/set_job_offer_in_employee.py`, `update_partially_paid_*.py`, `set_currency_and_base_fields_in_expense_claim.py`
