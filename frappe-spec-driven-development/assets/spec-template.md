# Spec: [Feature / Module Name]

> Written before any DocType JSON, Python, or migration. Approved explicitly before implementation starts.  
> Source: `frappe-spec-driven-development`. Commit this file alongside the code it specifies.

---

## Objective

**What we're building:** (one sentence)  
**Why now:** (trigger or business driver)  
**Primary users:** (roles and their goal)  
**Success looks like:** (observable outcome, not "it works")

---

## Assumptions surfaced

List every assumption about schema, roles, version, and integrations. Get these confirmed before writing the rest.

1. Frappe version: v__; installed apps: frappe / erpnext / hrms / ___
2. (e.g.) Naming series is per-company
3. (e.g.) No GL posting in this phase
4. (e.g.) Frappe Workflow DocType will be used (not docstatus-only)

---

## DocType model

Repeat this block for each new or modified DocType.

### DocType: [Name]

| Property | Value |
|----------|-------|
| `is_submittable` | Yes / No |
| `autoname` | `naming_series:` / `hash` / field name |
| Naming series | (e.g. `HR-ADV-.YYYY.-`) |
| `track_changes` | Yes / No |
| Module | |

**Fields** (name · fieldtype · options / link target · mandatory · description):

| fieldname | fieldtype | options | mandatory | notes |
|-----------|-----------|---------|-----------|-------|
| naming_series | Select | (series list) | ✓ | |
| employee | Link | Employee | ✓ | |
| ... | | | | |

**Child tables** (if any):

| Child DocType | fieldname (Table) | Purpose |
|---|---|---|

**Controller hooks used** (`validate`, `before_save`, `on_submit`, `on_cancel`, `on_trash`):

| Hook | Behaviour | Raises on error |
|------|-----------|----------------|
| `validate` | Checks amount > 0; raises `frappe.ValidationError` | Yes |
| `on_submit` | Creates linked records (specify which) | Yes |

**No `frappe.db.sql`** — use `frappe.qb` or `frappe.get_all` in all controller examples.

---

## Permission matrix

| DocType | Role | Read | Write | Create | Submit | Cancel | Amend | `match` condition |
|---------|------|:----:|:-----:|:------:|:------:|:------:|:-----:|-------------------|
| | Employee | own | own | ✓ | ✓ | ✗ | ✗ | `owner` |
| | HR Manager | all | ✗ | ✗ | ✗ | ✓ | ✗ | |
| | System Manager | all | all | ✓ | ✓ | ✓ | ✓ | |

---

## Workflow

*Skip this section if docstatus-only (no Frappe Workflow DocType).*

| State | Transition | Role allowed | `next_state` |
|-------|-----------|--------------|--------------|
| Draft | Submit | Employee | Pending Approval |
| Pending Approval | Approve | HR Manager | Approved |
| Pending Approval | Reject | HR Manager | Rejected |

`document_type`: [DocType name]  
`workflow_state_field`: `workflow_state` (v16: auto-added by framework when Workflow is active)  
`is_active`: Yes

---

## Controller / hook behaviour

List every `doc_events` entry that goes in `hooks.py`:

```python
doc_events = {
    "[DocType name]": {
        "on_submit": "<app>.module.doctype.<name>.controller.on_submit_handler",
    }
}
```

Rules:
- `validate`: check data integrity; raise `frappe.ValidationError` with a translated message
- `on_submit`: create downstream records; use `frappe.qb` not `frappe.db.sql`
- `on_cancel`: reverse downstream records; must be idempotent
- All user-facing strings wrapped in `_()`

---

## API surface

| Method | Path | `allow_guest` | Permission check | Request | Response |
|--------|------|:-------------:|-----------------|---------|---------|
| `get_pending_advances` | `<app>.api.get_pending_advances` | No | `frappe.has_permission("Salary Advance", "read")` | `{"employee": str}` | list of docs |

Use `@frappe.whitelist()`. Never skip the permission check. See `frappe-api-development` for full contract design.

---

## Reports & prints

| Name | DocType | Type | Filters | Notes |
|------|---------|------|---------|-------|
| Salary Advance Report | Salary Advance | Report Builder | date_from, date_to, status | |

Print format name:  
Template type (Jinja / Web Page):

---

## Patches & fixtures

**Fixtures** exported via `bench --site <site> export-fixtures` for:
- (e.g.) Custom Fields on Employee, Role definitions, Workflow

Add to `<app>/hooks.py`:
```python
fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "<app>"]]},
]
```

**Patches** — list each patch file and its purpose:

| Patch | File | Idempotent? | Dry-run tested? |
|-------|------|:-----------:|:---------------:|
| Add `advance_balance` field to Employee | `<app>/patches/v1_0/add_advance_balance.py` | ✓ | ✓ |

Every patch must be idempotent (safe to run twice) and tested on a restored backup before release.

---

## Test plan

| Test class | DocType / feature | Scenario | Type |
|-----------|-------------------|---------|------|
| `TestSalaryAdvance` | Salary Advance | Happy path: submit advance, check status | Integration |
| `TestSalaryAdvance` | Salary Advance | Validation: amount ≤ 0 raises ValidationError | Integration |
| `TestSalaryAdvance` | Salary Advance | Rejection: HR Manager rejects pending advance | Integration |
| `TestGetPendingAdvances` | API | Returns only the requesting employee's records | Integration |

Run: `bench --site <site> run-tests --app <app> --doctype "Salary Advance"`

---

## Boundaries

**Always:**
- Run `bench --site <site> run-tests --app <app>` after any controller change
- Wrap every user-facing string in `_()`
- Use `frappe.qb` or `frappe.get_all` — never `frappe.db.sql`
- Export fixtures after any Custom Field or Workflow change

**Ask first:**
- Adding a new mandatory field to an existing DocType with data
- Changing the naming series of an existing DocType
- Adding `allow_guest=True` to any whitelisted method
- Modifying the Frappe Workflow after records exist in non-Draft states

**Never:**
- Edit files in `apps/frappe` or `apps/erpnext` directly — extend via hooks, Custom Fields, or `override_doctype_class`
- Use `frappe.db.sql` for DML in app code (documented exception: append it to `references/database.md` in `frappe-api-development` if unavoidable)
- Commit a patch without first testing it on a restored backup
- Remove a test to make CI green

---

## Success criteria

Restate every requirement as a testable condition:

- [ ] `bench --site <site> run-tests --app <app>` exits 0 with no skipped tests
- [ ] Employee role can create and submit; HR Manager can approve; Employee cannot cancel their own submitted advance
- [ ] `bench --site <site> migrate` passes on a fresh site with no errors
- [ ] All user-facing strings translatable (`ruff` passes; `_()` coverage check green)
- [ ] Print format renders without Jinja errors for a submitted record
- [ ] (Add one line per stated requirement)

---

## Open questions

- (List every unresolved question; each blocks the work it affects until answered)

---

*Spec approved by: ___ Date: ___*  
*Implementation may start only after this line is filled.*
