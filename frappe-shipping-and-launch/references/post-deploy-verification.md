# Post-Deploy Verification

Checklist of commands and queries to run after `bench --site <site> migrate` completes and before
maintenance mode is lifted on the next wave.

**Notation:**
- 🔍 **READ-ONLY** — safe on production at any time
- ⚠️ **MUTATES** — staging only; never run against production

All `frappe.qb` snippets run inside `bench --site <site> console` (exits with `exit()`).

---

## 1. Capture baseline before deploy (run once pre-deploy)

🔍 Record the current state so you can diff after deploy:

```bash
# Installed app versions — save this output
bench version

# Apps on this site
bench --site <site> list-apps

# Error Log count before deploy (record the number)
bench --site <site> console
>>> frappe.db.count("Error Log")
>>> exit()
```

Save these outputs to a file. Compare after deploy to spot what changed.

---

## 2. Version and app inventory (post-deploy)

🔍 Verify the expected app versions landed:

```bash
bench version
```

Output lists every app in the bench with its version and branch.  
Verified: `apps/frappe/frappe/commands/utils.py` → `@click.command("version")` (16.51).

```bash
bench --site <site> list-apps
```

Confirms the app is installed on this specific site and shows its version and branch.  
Verified: `apps/frappe/frappe/commands/site.py` → `@click.command("list-apps")` (16.51).

---

## 3. Worker and scheduler health

🔍 Checks Redis connectivity, active workers, and scheduler state:

```bash
bench doctor --site <site>
```

Verified: `apps/frappe/frappe/commands/scheduler.py` → `@click.command("doctor")` (16.51).  
Prints worker count, queue status, and whether the scheduler is enabled.  
Expected: at least one worker per queue (default, short, long), scheduler enabled.

🔍 Pending job depth — high numbers indicate a backlog or stuck worker:

```bash
bench --site <site> show-pending-jobs
```

Verified: `apps/frappe/frappe/commands/scheduler.py` → `@click.command("show-pending-jobs")` (16.51).  
Normal: 0–5 pending. Investigate if > 20.

---

## 4. Migrate output scan

🔍 Review the output captured during `bench --site <site> migrate`:

Look for:
- `✗` or `Error` lines — a patch failed to apply
- `Traceback` blocks — unexpected exception during migration
- `Skipping patch` lines — patches skipped (may be intentional; verify against `patches.txt`)
- Lines containing `FAILED` or `Exception`

If any patch exited with a traceback, do **not** lift maintenance mode. Restore from backup.

---

## 5. Patch Log completeness

🔍 Verify every new patch in `patches.txt` ran successfully:

```python
# bench --site <site> console
import frappe

# List the last 20 applied patches
patches = frappe.get_list(
    "Patch Log",
    fields=["name", "patch", "creation"],
    order_by="creation desc",
    limit=20
)
for p in patches:
    print(p["creation"], p["patch"])
exit()
```

Cross-check against the new entries in your app's `patches.txt`. Every new patch must appear
with a recent `creation` timestamp. A missing entry means the patch did not run — do not proceed.

Field reference: `apps/frappe/frappe/core/doctype/patch_log/patch_log.json` — fields: `patch`, `skipped`, `traceback`.

---

## 6. Error Log — new entries since deploy

🔍 Detect server-side errors introduced by this release:

```python
# bench --site <site> console
import frappe
from frappe.utils import now_datetime
from datetime import timedelta

deploy_time = "YYYY-MM-DD HH:MM:SS"  # replace with actual deploy start time

errors = frappe.get_list(
    "Error Log",
    filters={"creation": (">", deploy_time)},
    fields=["name", "method", "creation", "error"],
    order_by="creation desc",
    limit=20
)
for e in errors:
    print(e["creation"], e.get("method", "—"), (e.get("error") or "")[:120])
print("Total new errors:", len(errors))
exit()
```

Expected: 0 new errors. Any new error is a finding. Errors in `error_log.method` matching
your app's Python path are regressions introduced by this deploy.

Field reference: `apps/frappe/frappe/core/doctype/error_log/error_log.json` — fields: `seen`, `method`, `error`, `reference_doctype`, `reference_name`.

---

## 7. Scheduled Job Log — last run status

🔍 Confirm background jobs ran after the deploy and none are failing:

```python
# bench --site <site> console
import frappe

jobs = frappe.get_list(
    "Scheduled Job Log",
    fields=["name", "scheduled_job_type", "status", "creation"],
    order_by="creation desc",
    limit=20
)
failed = [j for j in jobs if j["status"] == "Failed"]
print("Recent jobs:", len(jobs), "  Failed:", len(failed))
for j in failed:
    print("FAILED:", j["scheduled_job_type"], j["creation"])
exit()
```

Field reference: `apps/frappe/frappe/core/doctype/scheduled_job_log/scheduled_job_log.json` — fields: `status`, `details`, `scheduled_job_type`, `debug_log`.

---

## 8. Email queue depth

🔍 Check for a stuck outbound email queue:

```python
# bench --site <site> console
import frappe

pending = frappe.get_list(
    "Email Queue",
    filters={"status": ("in", ["Not Sent", "Sending"])},
    fields=["name", "recipients", "status", "retry", "creation"],
    order_by="creation desc",
    limit=10
)
print("Pending emails:", len(pending))
for e in pending:
    print(e["status"], e["retry"], e["recipients"][:60], e["creation"])
exit()
```

Normal: `Not Sent` items drain within a minute after workers restart. A large `Not Sent`
backlog with all items showing `retry ≥ 3` indicates a mail configuration issue.

DocType path: `apps/frappe/frappe/email/doctype/email_queue/email_queue.json`.

---

## 9. Smoke test (staging only)

⚠️ **Never run against production.** On a staging site only:

```python
# bench --site staging-<site> console
import frappe
frappe.set_user("Administrator")

# Create and submit a test document of the most-changed DocType
doc = frappe.get_doc({
    "doctype": "<DocType>",
    # minimal required fields
})
doc.insert()
print("Inserted:", doc.name)
doc.submit()
print("Submitted:", doc.docstatus)
doc.cancel()
print("Cancelled:", doc.docstatus)
frappe.db.rollback()  # clean up — do NOT commit in staging console
exit()
```

This verifies the full lifecycle (insert → submit → cancel) works after schema changes.
Roll back the transaction so the test document is never persisted.

---

## 10. Rollback decision tree

```
New Error Log entries since deploy?
├── Yes, in app code paths → STOP. Restore backup. Do not advance waves.
├── Yes, in Frappe core only → INVESTIGATE. Check if known upstream issue.
└── No → continue ✓

Any patch missing from Patch Log?
├── Yes → STOP. Patch did not run. Restore backup.
└── No → continue ✓

bench doctor shows no workers?
├── Yes → restart workers: bench restart
└── Workers present → continue ✓

Email queue depth > 50 and not draining?
├── Yes → check mail server config; workers may need restart
└── Normal → continue ✓

All checks green?
└── Lift maintenance mode on this site and advance to next wave ✓
```

---

## 11. Baseline-before / diff-after pattern

Record the pre-deploy baseline (step 1), then after all checks pass:

```bash
# Compare app versions before vs after
bench version  # diff against pre-deploy output

# Compare Error Log count before vs after
bench --site <site> console
>>> frappe.db.count("Error Log")  # compare against pre-deploy count
>>> exit()
```

If using `frappe-testing/scripts/qa-score.js`, save a `findings.json` snapshot before deploy
and run with `--baseline` after deploy to get a structured diff report.

---

## Sources

- `apps/frappe/frappe/commands/scheduler.py` — `bench doctor`, `bench show-pending-jobs` (16.51)
- `apps/frappe/frappe/commands/site.py` — `bench --site <site> list-apps`, `bench --site <site> migrate` (16.51)
- `apps/frappe/frappe/commands/utils.py` — `bench version` (16.51)
- `apps/frappe/frappe/core/doctype/error_log/error_log.json` — Error Log fields
- `apps/frappe/frappe/core/doctype/error_log/error_log.py` — `frappe.qb.DocType("Error Log")` pattern
- `apps/frappe/frappe/core/doctype/patch_log/patch_log.json` — Patch Log fields: `patch`, `skipped`, `traceback`
- `apps/frappe/frappe/core/doctype/scheduled_job_log/scheduled_job_log.json` — Scheduled Job Log fields
- `apps/frappe/frappe/email/doctype/email_queue/email_queue.json` — Email Queue fields: `status`, `retry`
