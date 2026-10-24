# Frappe Requirements Question Bank

A pool of one-at-a-time questions for `frappe-requirements-interview`. Draw from it; do not ask every question. Each question includes a Frappe-shaped guess. Ask only what is still unresolved after reading `hooks.py`, `modules.txt`, and `bench version` output.

---

## DocType model

**Q: What is the primary record the user creates and tracks?**  
GUESS: A standalone DocType (e.g. "Salary Advance", "Maintenance Request") — the most common shape.  
*Probe if vague: "Is it one record per transaction, or a persistent configuration record?"*

**Q: Does each record need line items, or is it a flat form?**  
GUESS: Flat unless the user mentioned "multiple items" or "details".  
*Flat → no child table. Line items → a Child DocType with a `Table` field.*

**Q: Which fields are mandatory, and which are optional?**  
GUESS: Date, linked document (e.g. Employee or Customer), and amount are usually mandatory; remarks are optional.

**Q: Does this DocType extend an existing ERPNext/HRMS one, or is it entirely new?**  
GUESS: New custom DocType — the user usually mentions the existing one if they mean to extend it.  
*If extending: read the target DocType's controller before asking more.*

---

## Roles & permission matrix

**Q: Who creates this document — an end-user role (Employee, Customer) or a back-office role (Accounts User, HR User)?**  
GUESS: An end-user role creates; a back-office role reviews and approves.

**Q: Who can read records they did not create (e.g. a manager seeing their team's records)?**  
GUESS: The approving role sees all; the submitting role sees only their own (`match` = `owner` or `match` = linked field).

**Q: Who can cancel or amend submitted records?**  
GUESS: System Manager or the Finance Manager role — rarely the originator.

**Q: Is there a guest/portal user who needs read access?**  
GUESS: No — most Frappe apps are Desk-only unless the user mentions a web form or portal page.

---

## Workflow states

**Q: What are the states a document moves through from creation to closure?**  
GUESS: Draft → Submitted → (Approved / Rejected) is the standard two-step for approval workflows.  
*Note: Frappe Workflow is a separate DocType; submit/cancel is a `docstatus` flag. Ask which is needed.*

**Q: Which roles can trigger each state transition?**  
GUESS: Submitter initiates; approver transitions to Approved/Rejected; System Manager can override.

**Q: Are any transitions time-triggered (auto-approve after N days, escalate if not reviewed)?**  
GUESS: No — most apps use manual transitions unless the user says "automatic" or "SLA".

---

## Naming & numbering

**Q: Should document names be human-readable (e.g. ACC-ADV-2024-00001) or system-generated hashes?**  
GUESS: Human-readable naming series — hash names are unusual for business documents.

**Q: Is the naming series per-company, per-fiscal-year, or global?**  
GUESS: Per-company if ERPNext is installed (the Company field is likely present); global otherwise.

---

## Reports & prints

**Q: What data does the user need to see at a glance — a list view with filters, or a summary dashboard?**  
GUESS: A filtered list report — the standard starting point before investing in a custom dashboard.

**Q: Is a print format needed (PDF for email/download)?**  
GUESS: Yes if the document is shared externally (invoices, approval letters); no for internal tracking docs.

**Q: Which filters will the report expose (date range, status, role-filtered)?**  
GUESS: Date range + status filter covers most cases.

---

## Integrations

**Q: Does this feature post to ERPNext General Ledger, create Journal Entries, or affect stock?**  
GUESS: No GL posting unless "payment", "expense", or "advance" appears in the ask.  
*If yes: read ERPNext's Payment Entry or Journal Entry controller before specifying the hook.*

**Q: Does it link to existing HRMS documents (Employee, Payroll Entry, Leave Application)?**  
GUESS: Employee link is likely if hrms is installed and the subject is HR-adjacent.

**Q: Are there external system integrations (REST webhooks, ERP connectors, SMS/email triggers)?**  
GUESS: No external integrations unless the user mentions a third-party system.

---

## Multi-company / multi-site

**Q: Is this a single-company deployment, or do multiple companies share the same site?**  
GUESS: Single-company — multi-company adds a `Company` mandatory field and per-company naming series.

**Q: Will the same app be installed on multiple Frappe sites (e.g. one per client)?**  
GUESS: Single site — multi-site adds constraints on fixtures and naming that need to be decided upfront.

---

## Frappe version

**Q: Is the bench running Frappe v15 or v16?** (Read from `bench --site <site> version` before asking.)  
GUESS: v16 — newer installs default to it.  
*v15 note: `workflow_state` is not auto-added by the framework; must be added as a custom field.*

**Q: Is ERPNext, HRMS, or any other official app installed?**  
GUESS: ERPNext if the user mentions accounting, stock, or purchasing terms.  
*Always verify with `bench --site <site> version` before assuming.*

---

## Data migration

**Q: Is there existing data (spreadsheets, another system, a previous version of this DocType) to import?**  
GUESS: No migration unless the user says "we already have data" or "moving from X".

**Q: If migrating: what is the volume, and is a one-time import or ongoing sync needed?**  
GUESS: One-time import — ongoing sync requires a background job and error handling.

---

## Compliance & audit

**Q: Are there regulatory or audit requirements (immutable records, full edit history, data-residency)?**  
GUESS: No special requirements — if the user mentions GDPR, KRA eTIMS, or an audit trail, ask for specifics.

**Q: Does the feature handle PII or sensitive financial data that needs field-level encryption or masking?**  
GUESS: No special handling unless the user mentions salary figures, national IDs, or payment details.

---

## Sources

- `apps/frappe/frappe/commands/testing.py` — `bench --site <site> version` output format and installed app list
- `apps/frappe/frappe/core/doctype/workflow/workflow.py` — Frappe Workflow DocType; `workflow_state` field auto-add behaviour (v16)
- `apps/frappe/frappe/permissions.py` — `match` condition for owner-scoped access
- `apps/frappe/frappe/model/naming.py` — naming series autoname format and per-company behaviour
- `apps/frappe/frappe/model/document.py` — `docstatus` flag values (0 = Draft, 1 = Submitted, 2 = Cancelled)
