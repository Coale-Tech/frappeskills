<!-- Adapted from addyosmani/agent-skills (MIT): skills/planning-and-task-breakdown/SKILL.md -->
# Frappe Task Card Template

Use one card per task. Copy into `tasks/todo.md` or a designated tracker item.

---

## Task [N]: [Short descriptive title]

**Description:** One paragraph. What Frappe artifact does this deliver? (DocType schema change,
controller hook, whitelisted API, Desk form script, report, print format, test, fixture.)

**Acceptance criteria:**
- [ ] [Specific, testable condition — "DocType 'X' saves with mandatory field 'Y' set"]
- [ ] [Second condition]
- [ ] [Third condition — if you need a fourth, split the task]

**Verification commands:**
- [ ] `bench --site <site> migrate` exits 0  *(schema tasks only)*
- [ ] `bench --site <site> run-tests --app <app> --module <app>.<module>` passes
- [ ] Console: `bench --site <site> console` → `frappe.get_doc("DocType", "name")` returns expected values  *(optional)*
- [ ] Desk: form loads, submit/cancel works, low-privilege role is blocked  *(UI tasks only)*

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `apps/<app>/<app>/<module>/doctype/<doctype>/<doctype>.json`  *(schema tasks)*
- `apps/<app>/<app>/<module>/doctype/<doctype>/<doctype>.py`    *(controller tasks)*
- `apps/<app>/<app>/patches.txt`                                *(schema tasks on populated tables)*
- `apps/<app>/<app>/<module>/doctype/<doctype>/test_<doctype>.py`  *(test tasks)*

**Estimated size:** [S: 1-2 files | M: 3-5 files | L: 5-8 files — L must be split further]

**Parallel-safe?** [Yes / No — if No, state which file would conflict and which task owns it]

**Bench commands required after this slice:**
- [ ] `bench --site <site> migrate`     *(DocType JSON changed)*
- [ ] `bench --site <site> clear-cache` *(Python / hooks only)*
- [ ] `bench build --app <app>`         *(JS / CSS / Vue changed)*
