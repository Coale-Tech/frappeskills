# HRMS 16.50 Core Changes

Verified delta: HRMS 16.4.1 (baseline) → HRMS 16.50.0. Scope: Employee lifecycle,
Leave, Attendance/Shift/Checkin, HR Settings, hooks.py, API surface, patches.
Payroll/Salary/Expense/Recruitment/Performance → [hrms-payroll-and-talent.md](hrms-payroll-and-talent.md).

---

## hooks.py — new and changed keys (HRMS 16.50)

| Key | Change | Value / note |
|-----|--------|-------------|
| `app_home` | changed | `/desk/hr-setup` (was `/desk/people`) |
| `setup_wizard_complete` | str → list | added `hrms.subscription_utils.set_hrms_as_default_app` |
| `setup_wizard_requires` | **new** | `"assets/hrms/js/setup_wizard.js"` |
| `setup_wizard_stages` | **new** | `"hrms.setup_wizard.get_setup_stages"` |
| `code_only_modules` | **new** | `{"HR": ["HR Setup"]}` — HR Setup excluded from module discovery |
| `audit_trail_doctypes` | **new** | `["Expense Claim", "Payroll Entry", "Salary Slip", "Leave Encashment", "Gratuity"]` |
| `extend_bootinfo` | **new** | `"hrms.utils.extend_bootinfo"` |
| `export_python_type_annotations` | **new** | `True` |
| `require_type_annotated_api_methods` | **new** | `True` — declared convention; no runtime error raised on untyped methods |
| `repost_allowed_doctypes` | **new** | `["Expense Claim"]` |
| `app_include_icons` | **new** | `["/assets/hrms/icons/module-icons.svg"]` |
| `add_to_apps_screen` | updated | entry now includes `sequence_id: 2` and `setup_wizard_text` |

### doc_events changes (HRMS 16.50)

**Company.on_update** gained `set_expense_claim_type_accounts` (auto-creates GL accounts for
expense claim types when company is saved).

**Employee.after_insert** now also calls `hrms.telemetry.on_milestone_insert`.

**Telemetry doc_events (all new)** — all call `hrms.telemetry.*`; safe to ignore in custom apps
but they run on every submit of these doctypes:

| DocType | Event | Function suffix |
|---------|-------|----------------|
| Leave Application | on_submit | on_leave_application_submit |
| Expense Claim | on_submit | on_expense_claim_submit |
| Attendance Request | on_submit | on_attendance_request_submit |
| Shift Request | on_submit | on_shift_request_submit |
| Employee Checkin | after_insert | on_employee_checkin |
| Payroll Entry | on_submit | on_payroll_entry_submit |
| Appraisal | on_submit | on_appraisal_submit |
| Interview | on_submit | on_interview_submit |
| Shift Type, Leave Type, Salary Structure, Job Opening, Appraisal Cycle, Employee Onboarding | after_insert | on_milestone_insert |
| Salary Slip | on_submit | on_milestone_submit |

**scheduler_events["daily"] new entries:**
- `hrms.hr.doctype.shift_assignment.shift_assignment.mark_expired_shift_assignments_as_inactive`
- `hrms.telemetry.capture_daily_attendance_pulse`

---

## Employee Lifecycle (HRMS 16.50)

### Employee Onboarding: job_offer becomes primary key

- `job_applicant` field: `reqd` changed `1 → None` — an onboarding without a job applicant is valid.
- `validate_onboarding_process` duplicate check now prefers `{"job_offer": ...}` when present,
  falls back to `{"job_applicant": ...}`. **Breaking:** code that queries onboarding by
  `job_applicant` only will miss records created against a job offer.
- `update_job_applicant_and_offer` (after_insert): warns (orange alert) if the linked
  Job Offer is `Rejected`/`Cancelled`, rather than silently skipping.
- Patch `set_job_offer_in_employee` creates Custom Fields `job_applicant` and `job_offer`
  on Employee and backfills `job_offer` from matching accepted Job Offers.

---

## Leave Management (HRMS 16.50)

### New methods on LeaveApplication

| Method | Trigger | Behaviour |
|--------|---------|-----------|
| `validate_leave_approver()` | `validate()` | Throws if `leave_approver` is blank and HR Settings `leave_approver_mandatory_in_leave_application` is on |
| `set_leave_approver_name()` | `validate()` | Auto-fills `leave_approver_name` from approver User record on every change |

### New whitelisted API

**`get_leave_approver_and_mandatory(employee: str) -> dict`** `@whitelist`  
Returns `{"is_mandatory": 0|1, "leave_approver": "<user>"}`. Combines what previously
required two separate calls. Requires `Employee` read permission on caller.

```python
frappe.call("hrms.hr.doctype.leave_application.leave_application.get_leave_approver_and_mandatory",
            employee="HR-EMP-001")
# → {"is_mandatory": 1, "leave_approver": "manager@example.com"}
```

**`get_employee_leave_approver(employee: str) -> str`** (internal, not whitelisted)  
Extracted from `get_leave_approver`; returns approver from Employee record or Department Approver.

**`validate_leave_access(employee, leave_application=None)`** — access guard  
Throws `PermissionError` if caller is not: the employee's user, their leave approver, or
a user with `Employee` read permission. Called internally by `get_leave_approver`,
`get_events`, `get_holidays`, `get_leave_details`. Custom code returning leave data via
direct queries should call this guard.

**`get_leave_approver(employee: str, leave_application: str | None = None) -> str`**  
Signature extended with optional `leave_application` param; now calls `validate_leave_access`
before returning.

### Patch: set_leave_approver_name_in_leave_application
Backfills `leave_approver_name` on existing Leave Applications where `leave_approver` is set
and `leave_approver_name` is blank. `bench migrate` applies it automatically.

---

## Attendance (HRMS 16.50)

### mark_bulk_attendance — enhanced (HRMS 16.50)

Changed to `@frappe.whitelist(methods=["POST"])`. New behaviour vs <=16.4:
- Calls `validate_employee_access([data.employee])` — throws if caller has no permission.
- **Async for >10 dates:** enqueues `process_bulk_attendance_in_batches` via `frappe.enqueue`
  with `deduplicate=True`; returns a job-status link. Processes synchronously for ≤10 dates.
- Uses DB savepoints per 20-date chunk — failed individual days skipped, others committed.

```python
# POST /api/method/hrms.hr.doctype.attendance.attendance.mark_bulk_attendance
data = {
    "employee": "HR-EMP-001",
    "unmarked_days": ["2024-03-01", "2024-03-04"],  # list of date strings
    "status": "Present",   # Present | Absent | Half Day | Work From Home
    "shift": None          # optional Shift Type name
}
```

### New: get_employee_shift (HRMS 16.50)

`@frappe.whitelist()` `hrms.hr.doctype.attendance.attendance.get_employee_shift`

```python
def get_employee_shift(employee: str, for_date: str | date | None = None) -> str | None
```

Returns the active Shift Type name for an employee on a date, or `None`.

### New: validate_employee_access (HRMS 16.50)

```python
def validate_employee_access(employees: list[str], company: str | None = None) -> None
```

Throws if any employee in the list belongs to a different company than the caller's default.

---

## Shift (HRMS 16.50)

### mark_expired_shift_assignments_as_inactive (HRMS 16.50)

New scheduler (`daily`). Sets all Shift Assignments with `end_date < today` and
`status == "Active"` to `Inactive`. **Breaking assumption:** do not assume past assignments
stay `Active`; filter by date range instead.

### get_valid_shifts_for_time (HRMS 16.50)

`hrms.hr.doctype.shift_assignment.shift_assignment.get_valid_shifts_for_time(shifts, for_timestamp) -> list[dict]`  
Returns **all** overlapping shifts at the timestamp. The existing `get_shift_for_time`
still returns a single dict (first match).

### ShiftType.get_scheduled_shift_at (HRMS 16.50)

`ShiftType.get_scheduled_shift_at(employee: str, for_timestamp: datetime) -> dict | None`  
Returns the Shift Schedule Assignment active at the timestamp for an employee, or `None`.

---

## Roster API (hrms/api/roster.py, HRMS 16.50)

Backend for the Roster web app (`/hr/<path>`). All endpoints in `hrms.api.roster`:

| Endpoint | Method | Key params |
|----------|--------|-----------|
| `get_default_company` | GET | — |
| `get_events` | GET | `month_start, month_end, employee_filters, shift_filters` |
| `get_schedule_from_assignment` | GET | `shift_schedule_assignment` |
| `create_shift_schedule_assignment` | POST | `employee, company, shift_type, status, start_date, end_date, repeat_on_days, frequency, shift_location?` |
| `delete_shift_schedule_assignment` | POST | `shift_schedule_assignment` |
| `swap_shift` | POST | two assignments + date |
| `break_shift` | POST | `assignment, date` |
| `insert_shift` | POST | `employee, shift_type, status, start_date, end_date?, shift_location?` |

`employee_filters` keys restricted to `{status, company, department, branch, designation, employee_name}`.
Unrecognized keys → `PermissionError`.

---

## HR Settings (HRMS 16.50)

| Field | Fieldtype | Status |
|-------|-----------|--------|
| `enable_multi_currency_expense_claim` | Check | **NEW** — enables multi-currency expense claims globally |

Fields already in <=16.4: `prevent_self_leave_approval`, `prevent_self_expense_approval`,
`allow_employee_checkin_from_mobile_app`, `allow_geolocation_tracking`.

---

## Patches (HRMS 16.50, scope areas)

| Patch | Effect on live data |
|-------|-------------------|
| `v16_0.delete_upload_attendance_doctype` | Deletes Upload Attendance DocType — use Employee Attendance Tool |
| `v16_0.set_leave_approver_name_in_leave_application` | Backfills `leave_approver_name` on Leave Applications |
| `v16_0.set_job_offer_in_employee` | Creates `job_applicant`/`job_offer` Custom Fields on Employee; backfills `job_offer` |
| `v16_0.add_default_hr_role_permissions` | Re-runs `add_default_hr_permissions()` to add new role permission rows |
| `v16_0.make_people_workspace_sidebar_standard` | Sets People workspace sidebar to `standard=1` |
| `v15_0.update_approver_custom_fields` | Ensures `leave_approver`, `expense_approver`, `shift_request_approver` Custom Fields exist on Employee |

---

## Sources

Verified against HRMS 16.4.1 (baseline bench) and HRMS 16.50.0 (frappe 16.51.1 bench).
Paths relative to `apps/hrms/hrms/`:

- `hooks.py` (both versions, top-level key diff)
- `hr/doctype/leave_application/leave_application.py` (both versions)
- `hr/doctype/leave_allocation/leave_allocation.py` (both versions)
- `hr/doctype/attendance/attendance.py` (both versions)
- `hr/doctype/shift_assignment/shift_assignment.py` (both versions)
- `hr/doctype/shift_type/shift_type.py` (both versions)
- `hr/doctype/employee_checkin/employee_checkin.py` (both versions)
- `hr/doctype/employee_onboarding/employee_onboarding.py` + `.json` (both versions)
- `hr/doctype/hr_settings/hr_settings.json` (both versions)
- `overrides/employee_master.py` (both versions)
- `api/roster.py` (HRMS 16.50)
- `patches/v16_0/delete_upload_attendance_doctype.py`
- `patches/v16_0/set_leave_approver_name_in_leave_application.py`
- `patches/v16_0/set_job_offer_in_employee.py`
- `patches/v16_0/add_default_hr_role_permissions.py`
- `patches/v16_0/make_people_workspace_sidebar_standard.py`
- `patches/v15_0/update_approver_custom_fields.py`
- `patches.txt` (both versions, comm diff for new entries)
