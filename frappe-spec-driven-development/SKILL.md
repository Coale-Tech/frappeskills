---
name: frappe-spec-driven-development
description: "Writes a Frappe app or feature spec before any code: DocType model (fields, links, child tables, naming series), permission matrix per role, workflow states, controller/hook behaviour, API surface, reports/prints, patches/fixtures, test plan, and boundaries (Always/Ask first/Never). Surfaces assumptions first, rewrites requirements as verifiable success criteria, and waits for approval before any frappe-doctype-development or frappe-api-development work begins. Use when starting a new app or feature with no spec, when requirements are ambiguous, or when a requirements brief from frappe-requirements-interview is ready."
---

# Frappe Spec-Driven Development

Write the spec before the first `frappe.get_doc`.

<!-- Adapted from addyosmani/agent-skills (MIT): skills/spec-driven-development/SKILL.md -->

## When to use

- Starting a new Frappe app, module, or feature with no written spec
- Requirements exist only as a conversation or a requirements brief from `frappe-requirements-interview`
- The change touches more than one DocType, controller, or API endpoint
- An architectural decision (DocType vs. child table, Custom Field vs. fixture field) needs documenting before implementation

Not for single-field additions with obvious placement → `frappe-doctype-development` directly.  
Not for whole-app assessments → `frappe-app-audit`.

## Inputs required

- Confirmed requirements brief (from `frappe-requirements-interview`) or explicit user requirements
- Installed apps and Frappe version (`bench --site <site> version`)
- Existing DocTypes / modules that the feature extends or links to

## Procedure

### 0) Surface assumptions before writing

List what you are assuming about schema, roles, versions, and integrations:

```
ASSUMPTIONS:
1. Frappe v16; hrms installed (Cost Centre link available)
2. Naming series: ACC-ADV-.YYYY.-
3. Workflow: Draft → Pending Approval → Approved / Rejected (Frappe Workflow DocType, not just docstatus)
4. No GL posting in this phase
→ Correct these now or I'll write the spec with them.
```

### 1) Write the spec using `assets/spec-template.md`

Fill all sections:
- **Objective** — outcome, users, why now, and alternatives considered (including the stock Frappe feature) with why each was rejected; a spec with one path and no rejected options is not ready
- **DocType model** — each DocType: key fields, field types, link targets, child tables, naming series, `autoname`, submit/amend/cancel flags
- **Permission matrix** — role × (read / write / create / submit / cancel / amend) per DocType; `match` conditions for owner-scoped access
- **Workflow** — states, transitions, role allowed per transition, `workflow_state` field, `is_active`; note v16: `workflow_state` is auto-added by the framework only when a Workflow DocType is saved for that document
- **Controller / hook behaviour** — validate, on_submit, on_cancel, on_trash; `doc_events` hooks in `hooks.py`; no `frappe.db.sql` — use `frappe.qb` or `frappe.get_all`
- **API surface** — whitelisted methods, `@frappe.whitelist(allow_guest=…)`, request/response shape; link to `frappe-api-development` for full contract design
- **Reports / prints / UI** — Report DocType type (Query/Script/Report Builder), filter fields, print format name; every screen with its surface (Desk script, portal page, Vue SPA), roles and the journey step it serves
- **Patches / fixtures** — fixture DocTypes exported via `bench --site <site> export-fixtures`; patches in `<app>/patches.txt` (idempotent, no bare SQL)
- **Test plan** — which behaviours get `IntegrationTestCase` tests, which get `UnitTestCase`; happy path + at least one error/rejection path per DocType; one browser journey per user story and role when the spec has a UI
- **Boundaries** — Always / Ask first / Never (see template)
- **Success criteria** — reframe every requirement as a testable statement
- **Open questions** — anything unresolved that blocks implementation

### 2) Reframe vague requirements as success criteria

```
REQUIREMENT: "Finance should see it after approval"

REFRAMED:
- Finance User role has read permission on Salary Advance with match condition = None (all records)
- Workflow transition to Approved requires Finance Manager role
→ Correct these targets?
```

### 3) Comprehension check — can a cold reader restate it?

Spawn a fresh read-only subagent (for example `frappe-scout`) with no conversation history and hand it only the spec path. Ask it to restate, from the spec alone: each DocType and its links, who can do what (permission matrix), the workflow transitions, the API signatures, and what each patch changes. Compare its answer with your intent. Any item it cannot restate, or restates differently, is an ambiguity in the spec: fix the spec and rerun once. Do not pass your reasoning along. No subagent tool available: say so; re-reading in the same context is not this check.

### 4) Stop — get explicit approval before any code

After saving `SPEC-<feature>.md` at the repo root (or `<app>/docs/`):
1. Summarise the spec and list Open Questions.
2. Ask for approval or changes.
3. **Stop.** Do not create DocType JSON, write Python, or invoke `frappe-doctype-development` in this turn. Planning and implementation start only after an explicit yes in a later turn.

### 5) Keep the spec alive

Update it when decisions change. Commit it alongside the code. Reference the spec section in PRs. Once code exists, `node scripts/spec-drift.js <spec> <app-dir>` lists where DocType fields, `is_submittable` and permission roles in the code differ from the spec.

## Verification

- [ ] All 12 spec sections filled (no "TBD" or placeholder text)
- [ ] Assumptions surfaced and confirmed before spec was written
- [ ] Every requirement rewritten as a testable success criterion
- [ ] Boundaries (Always / Ask first / Never) defined
- [ ] A fresh reader restated the spec correctly (step 3), or each gap was fixed in the spec
- [ ] Turn stopped after spec was saved; approval came in a later turn
- [ ] `SPEC-<feature>.md` committed to the repository

## Failure modes / debugging

- **Permission matrix is incomplete**: missing a role × DocType pair → spec is ambiguous; list every DocType × role explicitly
- **Workflow vs docstatus confusion**: if submit/cancel flags are needed AND a Frappe Workflow is planned, note that the Workflow `is_active` field controls which docstatus transitions are allowed — a mismatch causes silent lock-outs
- **Naming series not agreed**: `autoname` = `naming_series:` requires the series to exist; spec must name it and state whether it is per-company
- **v15 / v16 gap missed**: `frappe.db.count` signature changed in v16; note version-specific calls in the spec

## Escalation

- Requirements unclear → [`frappe-requirements-interview`](../frappe-requirements-interview/SKILL.md)
- DocType implementation → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- API design → [`frappe-api-development`](../frappe-api-development/SKILL.md)
- Reports / prints → [`frappe-reports`](../frappe-reports/SKILL.md), [`frappe-printing-templates`](../frappe-printing-templates/SKILL.md)
- Quality bar for the spec's output → [`frappe-constraint-driven-development`](../frappe-constraint-driven-development/SKILL.md)
- Scope / architecture review before task breakdown → [`frappe-plan-review`](../frappe-plan-review/SKILL.md)

## References

- [assets/spec-template.md](assets/spec-template.md) — Frappe spec template with all 12 sections
- [scripts/spec-drift.js](scripts/spec-drift.js) — spec-to-code drift report (DocType fields, submittable flag, permission roles)

## Guardrails

- **No DocType JSON, no Python, no migration until the spec has an explicit yes**
- **No `frappe.db.sql` in any example** — use `frappe.qb` or `frappe.get_all`
- **Permission matrix must cover every role that will interact with the DocType**
- Never silently fill in an ambiguous requirement — surface it as an assumption or open question
- Spec is not documentation: write it before the code, not after

## Common Rationalizations

<!-- Adapted from addyosmani/agent-skills (MIT): skills/spec-driven-development/SKILL.md -->

| Rationalization | Reality |
|---|---|
| "This is a simple DocType, no spec needed" | Simple DocTypes still need a permission matrix and a naming series — both cause hard-to-reverse bugs if guessed wrong |
| "I'll write the spec after I scaffold the DocType" | That is documentation, not specification; the spec's value is catching wrong assumptions before any JSON is saved |
| "The user knows the field list" | Fields and their link targets imply a permission model; surface that model before creating anything |
| "Workflow can be added later" | Adding a Frappe Workflow to a DocType with existing submitted records requires a patch; designing it upfront costs nothing |
| "The permission matrix is obvious" | A missing `match` condition on a multi-company install is a data-leak bug, not an edge case |
| "I'll figure out patches during implementation" | Patches that touch existing data must be idempotent and tested on a restored backup; commit them to the spec now |
| "v15 and v16 behave the same here" | `on_submit` cascade, `workflow_state` auto-add, and `frappe.db.count` differ; note the version in the spec |
| "The deadline is tomorrow, skip the spec" | A deadline is when a wrong naming series or permission row costs most. Offer a one-page minimal spec instead: Objective with alternatives, DocType model (fields, links, naming), permission matrix, Always/Ask first/Never. Write it now, wait for the yes, then build |

## Red Flags

- Writing DocType JSON or Python before the spec is approved
- A spec section marked "TBD" or left empty
- Permission matrix that covers only the happy-path role and omits HR, Finance, System Manager
- Workflow states listed without the role allowed per transition
- Success criteria written as vague outcomes ("should work correctly") rather than testable conditions
- Spec and first DocType commit in the same turn
- Open questions left blank when the answer is needed for implementation to proceed

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Omitting `autoname` / naming series from the spec | Defaults to `hash`; looks unprofessional and hard to change post-data | Decide and name the series in the spec |
| Writing permissions as prose instead of a matrix | Implementer guesses; wrong roles ship | Use the role × permission table in the spec template |
| No test plan section | Tests get skipped "because the spec doesn't mention them" | Every DocType needs at least a validate + submit happy path test named in the spec |
| Spec stored outside version control | Spec drifts from code; team diverges | Commit `SPEC-<feature>.md` at the app root |
| Starting implementation in the same turn as approval | Agent moves before the user has read the spec | Stop the turn; wait for explicit yes in the next message |
