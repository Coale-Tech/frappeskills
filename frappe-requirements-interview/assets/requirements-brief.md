# Requirements Brief: [Feature / Module Name]

> Fill this template during `frappe-requirements-interview`. Hand it to `frappe-spec-driven-development` as the spec input.  
> Every section is required. Remove placeholder text before handing off; blank sections are not permitted.

---

## Outcome

One sentence: what will be different for which user when this is built?

---

## Users

| Role | What they do with this feature |
|------|-------------------------------|
| (e.g. Employee) | Creates and submits Salary Advance requests |
| (e.g. HR Manager) | Reviews and approves/rejects requests |
| (e.g. System Manager) | Manages configuration and exceptions |

---

## DocTypes involved

| DocType name | New / existing / extend | Purpose |
|---|---|---|
| (e.g. Salary Advance) | New | Primary transaction record |
| (e.g. Salary Advance Detail) | New child | Line-item breakdown (if needed) |
| (e.g. Employee) | Existing (link) | Links each advance to an employee |

*If extending an existing ERPNext/HRMS DocType, name it here and note which fields / hooks change.*

---

## Role / permission matrix

| DocType | Role | Read | Write | Create | Submit | Cancel | Amend | Notes |
|---------|------|------|-------|--------|--------|--------|-------|-------|
| Salary Advance | Employee | own | own | ✓ | ✓ | ✗ | ✗ | `match = owner` |
| Salary Advance | HR Manager | all | ✗ | ✗ | ✗ | ✓ | ✗ | Approve/reject via Workflow |

---

## Workflow states

| State | Entered by | Exited by (transition) | Role allowed |
|-------|-----------|----------------------|--------------|
| Draft | (initial) | Submit | Employee |
| Pending Approval | on_submit | Approve / Reject | HR Manager |
| Approved | — | — | — |
| Rejected | — | — | — |

*Frappe Workflow DocType needed? Yes / No*  
*If No: describe `docstatus` flow only (0 = Draft, 1 = Submitted, 2 = Cancelled).*

---

## Naming series

Format: `[PREFIX]-.YYYY.-` (e.g. `HR-ADV-.YYYY.-`)  
Per-company? Yes / No  
`autoname` value: `naming_series:`

---

## Reports & prints

| Name | Type | Filters | Audience |
|------|------|---------|---------|
| (e.g. Salary Advance Report) | Report Builder | Date range, Status, Employee | HR Manager |

Print format needed? Yes / No  
If yes: name and primary audience:

---

## Integration points

| System | Direction | Trigger | Notes |
|--------|-----------|---------|-------|
| (e.g. ERPNext GL) | out | on_submit | Journal Entry for advance disbursement |
| (e.g. HRMS Payroll) | out | on_submit | Deduction recovery in next payroll |

No integrations: ☐

---

## Multi-company / multi-site

Multi-company (same site): Yes / No  
Multi-site (one app, N sites): Yes / No  
Notes (per-company naming, data isolation):

---

## Frappe version & installed apps

Frappe version: (from `bench --site <site> version`)  
Installed apps: frappe / erpnext / hrms / custom: ___

v15-specific notes (if applicable):  
v16-specific notes (if applicable):

---

## Data migration

Existing data to import: Yes / No  
Volume estimate:  
Source format (CSV, previous DocType, external system):  
One-time import or ongoing sync:

---

## Compliance & audit

Audit trail required (track who changed what): Yes / No  
PII / sensitive data (salary, national ID, payment): Yes / No  
Regulatory constraints (GDPR, KRA eTIMS, local tax):  
Data-residency requirements:

---

## Explicit out of scope

- (e.g.) GL posting is out of scope for this phase; a separate spec will cover it
- (e.g.) Mobile app / portal access is not in this requirement

---

## Open questions

- (List anything that remained unresolved at interview close; each item becomes an assumption or open question in the spec)

---

*Confirmed by user: [ ] Yes — date: ___*
