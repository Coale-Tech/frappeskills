---
name: frappe-erpnext-hrms
description: "Work with ERPNext and HRMS domain workflows including sales orders, purchase orders, stock, accounting, manufacturing, payroll (generate payslips for employees by department via background job), leave balance, attendance, and ERPNext CRM Lead/Opportunity scoring. Use when extending ERPNext/HRMS business documents or customising ERPNext sales or HR module fields."
---

# ERPNext & HRMS Domain Workflows

Extend ERPNext and HRMS without breaking the accounting, stock or payroll
semantics they enforce.

## When to use

- Extending sales, purchase, stock, accounting or manufacturing flows
- Hooking into payroll, leave, attendance or recruitment
- Reading domain data correctly for reports or integrations
- Deciding where in a document chain a customization belongs

## Inputs required

- Confirmation that ERPNext (and HRMS, if relevant) is installed on the site
- The document chain in scope (e.g. Quotation → Sales Order → Delivery Note → Sales Invoice)
- Company, fiscal year and currency context
- Whether the change touches ledger entries or stock ledger entries

## Procedure

### 0) Confirm the apps exist

```bash
bench --site <site> list-apps
```

Never `import erpnext` on a Frappe-only site.

### 1) Locate the point in the chain

| Chain | Documents |
|---|---|
| Sell | Quotation → Sales Order → Delivery Note → Sales Invoice → Payment Entry |
| Buy | Material Request → Purchase Order → Purchase Receipt → Purchase Invoice |
| Stock | Stock Entry, Stock Reconciliation, Batch/Serial |
| Make | BOM → Work Order → Job Card → Stock Entry |
| People | Employee → Attendance / Leave Application → Salary Slip → Payroll Entry |

Details: [references/erpnext-workflows.md](references/erpnext-workflows.md),
[references/hrms-patterns.md](references/hrms-patterns.md),
[references/hrms-payroll-and-talent.md](references/hrms-payroll-and-talent.md).

### 2) Extend, never edit

Add Custom Fields via fixtures and behaviour via `doc_events` on the standard
DocType. Core edits are lost on upgrade
([`frappe-app-development`](../frappe-app-development/SKILL.md)).

### 3) Respect ledger invariants

GL Entries and Stock Ledger Entries are derived, not authored. Change the source
document and let ERPNext post entries; never insert ledger rows directly, and
never mutate a submitted document's amounts outside amend.

### 4) Handle submit/cancel/amend

Domain documents are submittable. Hook `on_submit`, `on_cancel` and
`on_update_after_submit` deliberately, and make side effects reversible on
cancel.

### 5) Test with real domain data

Create the upstream documents (customer, item, warehouse, fiscal year) rather
than mocking them — validation depends on them.

## Verification

- [ ] Customization fires at the intended document in the chain
- [ ] Submit, cancel and amend all behave — side effects reverse on cancel
- [ ] GL and stock entries match expectations for a worked example
- [ ] Multi-company and multi-currency cases behave correctly
- [ ] Nothing in core ERPNext/HRMS was edited
- [ ] Works on a site with only Frappe installed, or fails with a clear message

## Failure modes / debugging

- **`ModuleNotFoundError: erpnext`**: the site has no ERPNext — guard the import
- **Ledger out of balance**: manual GL insertion, or amounts changed after submit
- **Stock quantity wrong**: posting date/time ordering, or a cancelled entry not reversed
- **Hook fires twice**: handler registered both in `doc_events` and in a controller override
- **Payroll amounts off**: salary structure assignment or attendance data, not the formula
- **Hardcoded company/warehouse**: breaks on the second company

## Escalation

- Controller/hook mechanics → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Reporting on domain data → [`frappe-reports`](../frappe-reports/SKILL.md)
- Print output for domain documents → [`frappe-printing-templates`](../frappe-printing-templates/SKILL.md)
- Undocumented core behaviour → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Tracing unexpected domain document behaviour → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)

## References

- [references/erpnext-workflows.md](references/erpnext-workflows.md) - Sales, purchase, stock, accounting, manufacturing (index)
- [references/erpnext-architecture.md](references/erpnext-architecture.md) - Controller hierarchy, transaction lifecycle, GL/SLE posting, link-field query overrides
- [references/erpnext-accounting.md](references/erpnext-accounting.md) - GL/Payment Ledger, invoices, Payment/Journal Entry, tax templates, Accounting Dimensions, Budget, withholding tax
- [references/erpnext-stock.md](references/erpnext-stock.md) - Stock Entry, Bin, valuation APIs, Serial and Batch Bundle, Repost Item Valuation, Landed Cost Voucher
- [references/erpnext-selling-buying.md](references/erpnext-selling-buying.md) - Sell/buy document chains, mapper functions, `get_item_details`, Pricing Rule, POS Invoice
- [references/erpnext-manufacturing.md](references/erpnext-manufacturing.md) - BOM, Work Order, Job Card, Production Plan, Subcontracting
- [references/erpnext-projects-assets-support.md](references/erpnext-projects-assets-support.md) - Projects, Assets and depreciation, Quality Management, Support, Maintenance
- [references/erpnext-extending.md](references/erpnext-extending.md) - Hook points ERPNext uses to extend itself: `extend_doctype_class`, `doc_events`, `scheduler_events`, `regional_overrides`
- [references/hrms-patterns.md](references/hrms-patterns.md) - Organization, Employee, Leave, Attendance
- [references/hrms-payroll-and-talent.md](references/hrms-payroll-and-talent.md) - Payroll, Recruitment, Performance, Expense Claims

## Guardrails

- **Never edit ERPNext or HRMS core**: Custom Fields + `doc_events` only
- **Never write GL or Stock Ledger Entries directly**: they are derived
- **Never assume ERPNext is installed**: check `list-apps`
- **Never hardcode company, warehouse, or account**: read from settings
- **Reverse side effects on cancel**: a cancelled document must leave no residue
- **Use the framework's rounding and currency helpers** for money


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just edit this one core ERPNext file for this change" | Core file edits are overwritten on the next `bench update`; the fix disappears silently. |
| "Inserting GL Entries directly is faster than going through the document" | Manual GL insertion bypasses reconciliation, rounding helpers and Payment Ledger consistency; the ledger corrupts. |
| "There is only one company, so hardcoding it is fine" | The second company is added six months later; hardcoded names break every report and stock move. |
| "The hook handles cancel automatically" | `on_cancel` must be implemented explicitly; omitting it leaves side effects (linked docs, GL entries) as orphan data. |
| "Payroll amounts are off — must be a formula error" | Payroll computation depends on salary structure assignment, attendance records and leave deductions; check those first. |
| "I'll import `erpnext` at the top of every file" | A Frappe-only site raises `ModuleNotFoundError` on first import; guard with `if 'erpnext' in frappe.get_installed_apps()`. |

## Red Flags

- Direct edits to any file under `apps/erpnext/` or `apps/hrms/`
- `frappe.db.sql("INSERT INTO \`tabGL Entry\`...")` or any manual GL/SLE row insertion
- Hardcoded company name, warehouse name, or account name in Python or JavaScript
- `on_cancel` not implemented when `on_submit` creates linked documents or sends notifications
- `import erpnext` at module level without an installed-app guard
- Same event handler registered in both `doc_events` in `hooks.py` and in a controller method

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Editing core ERPNext files | Lost on upgrade | Custom Fields + hooks |
| Inserting GL Entries manually | Ledger corruption | Post via the source document |
| Hardcoded company/warehouse | Breaks multi-company | Read from settings |
| Side effects not reversed on cancel | Orphan data | Implement `on_cancel` |
| Mocking domain masters in tests | Validation fails | Create real records |
| Importing `erpnext` unconditionally | Crash on Frappe-only sites | Guard the import |
