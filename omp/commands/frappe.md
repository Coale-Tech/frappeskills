---
description: Frappe task with the frappe-* skills loaded. A feature or change runs the whole lifecycle end to end (spec, plan, backend, frontend, browser e2e, review, ship) with an advisor checking every skill call; add "all" to load all 45 skills
---
Frappe/ERPNext task: $ARGUMENTS

Before any other tool call:
1. Read `skill://frappe-router` and follow its routing table.
2. Confirm the bench: `ls apps sites` and `grep default_site sites/common_site_config.json` (never `currentsite.txt`).
3. Classify the task.
   - **Feature or change**: a new app, module, DocType, workflow, API, report, screen, or a change touching more than one DocType, controller or endpoint. Run the lifecycle below.
   - **Anything else** (bug, question, review, audit, perf, ops, a single obvious field): read every `skill://frappe-*` skill the router maps it to, then do the task following their Procedure, Verification and Guardrails sections. If the task contains the word `all`, read all 45 `frappe-*` skills instead.

## Lifecycle (features and changes)

Resume at the first stage whose artifact is missing or unapproved: `SPEC.md` (or `docs/SPEC.md`), `tasks/plan.md`, then `tasks/skill-ledger.md`. Never skip a stage and never merge the two gates.

**Skill ledger.** Create `tasks/skill-ledger.md` with the header `| Stage | Skill | Evidence |`. Read every skill a stage names and every conditional skill SPEC.md triggers, and append a row the moment you do. Evidence is an artifact path, test name, commit or command result, or `N/A: <reason>` that SPEC.md supports. For `frappe-router` and `frappe-project-triage` it is the one-line decision they produced (skills mapped; versions and apps found). A skill you only mention does not count.

**Advisor.** After every stage, spawn `frappe-advisor` (omp: `agent: frappe-advisor`) with the stage id, the `SPEC.md` path and the ledger path. A stage is not done while it answers `BLOCK`: call the missing skill or log a valid `N/A`, then ask again. Act on each `[STEER]` or record why not. The advisor reads the ledger and artifacts; it cannot see your tool calls.

| Stage | Do | Primary skills |
|-------|----|----------------|
| S0 Triage | Versions, installed apps, site | `frappe-router`, `frappe-project-triage` |
| S1 Spec | Interview if there is no brief, then the spec skill's full Procedure: assumptions, `SPEC.md`, success criteria, cold-reader comprehension check. **Gate A:** stop for an explicit "approve". No DocType JSON, Python or migration before it. | `frappe-requirements-interview`, `frappe-spec-driven-development`, `frappe-constraint-driven-development` |
| S2 Plan review | Fix every Reduce-scope finding, including reuse of existing code, in the spec | `frappe-plan-review`, `frappe-design-mockup-review` (UI) |
| S3 Plan | `tasks/plan.md` that passes its readiness check. **Gate B:** stop for an explicit "go"; it is the only checkpoint during the build. | `frappe-planning-and-task-breakdown` |
| S4 Build | Backend tasks in dependency order: failing test, minimum code, migrate and clear-cache after DocType or hooks changes, full suite, one commit per task. Then every UI row of the spec: Desk scripts, portal pages, the Vue SPA, on the design tokens. Stop and invoke `frappe-doubt-driven-development` before anything irreversible: permission changes, patches, GL or stock postings, data migrations. | `frappe-incremental-implementation`, `frappe-doctype-development`, `frappe-api-development`, `frappe-desk-customization`, `frappe-frontend-development`, `frappe-ui-patterns`, `frappe-design-tokens`, plus the task skills the router maps |
| S5 E2E | On a development site only, walk every spec user story in a real browser as each role end to end, from the first screen to the final state, and check the database and the permission-denied path. Run `frappe-design-review` on every screen. Fix failures by reproducing first. | `frappe-testing`, `frappe-browser-testing`, `frappe-design-review`, `frappe-debugging-and-error-recovery` |
| S6 Review | Review the whole change against `SPEC.md`; run the spec skill's `scripts/spec-drift.js` against each app and clear every drift line or amend the spec with approval. Fan out `frappe-reviewer`, `frappe-security-auditor`, `frappe-test-engineer`, and the performance, migration and API-contract auditors the change calls for; synthesize them yourself. | `frappe-code-review`, `frappe-performance-optimization`, `frappe-code-simplification`, `frappe-devex-review` |
| S7 Ship | Offer the go/no-go checklist and stop. Do not deploy, push or touch a live site without being asked. | `frappe-shipping-and-launch`, `frappe-documentation-and-adrs` |

No UI row in the spec means skip the frontend half of S4, the design review and the browser walk; the advisor accepts that without a reason.

Verify APIs against the installed v16 source, not memory; tag behaviour present in 16.51.1 but absent in 16.35.0 as `(16.51)`, old form as `(<=16.35)`; tag v16-only behaviour `(v16)`.
For review tasks: start with a scope-drift check (`Scope Check: CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING`; Frappe signals: unrelated fixtures, patches.txt additions, hooks.py edits outside scope, stray bench export-fixtures churn). Emit findings as `[SEVERITY] (confidence: N/10) file:line — description`; run the pre-emit gate from `frappe-code-review/references/finding-format-and-gates.md` before including any Critical or Required finding. Close every task: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT + REASON + ATTEMPTED + RECOMMENDATION.
