---
name: frappe-plan-review
description: "Reviews a Frappe/ERPNext plan or spec before implementation: checks whether stock ERPNext already covers the need (configure vs customise vs build), validates DocType boundaries and permission model, scores upgrade risk, and evaluates API developer experience. Use when a spec is ready and scope, architecture, or API design is still open — not for requirements gathering (frappe-requirements-interview) and not for whole-app audits (frappe-app-audit)."
---

# Frappe Plan Review

Catch wrong assumptions before any code lands. Default bias: configure first, build only what stock ERPNext cannot deliver.

<!-- Adapted from gstack office-hours, plan-ceo-review, plan-eng-review, plan-devex-review, autoplan (MIT) — ideas rewritten for Frappe/ERPNext; no gstack prose copied verbatim -->

## When to use

- Spec or plan is drafted; scope, architecture, or DX needs a quality gate before task breakdown
- Need to confirm whether ERPNext standard features cover the requirement
- DocType boundaries, permission matrix, or upgrade risk needs validation
- A whitelisted API is planned and time-to-first-success needs scoring

Not for open requirements → [`frappe-requirements-interview`](../frappe-requirements-interview/SKILL.md).  
Not for existing running apps → [`frappe-app-audit`](../frappe-app-audit/SKILL.md).  
Not for task ordering → [`frappe-planning-and-task-breakdown`](../frappe-planning-and-task-breakdown/SKILL.md).

## Inputs required

- The plan, spec, or mockup brief to review
- Installed apps and Frappe version (`bench --site <site> version`)
- Whether the plan touches UI, API, or backend-only scope (determines which modes run)

## Procedure

Ask **one question per finding**. Wait for the user's answer before the next mode.

### Mode A — Scope / Standard-first (always runs first)

Read [`references/frappe-standard-capabilities.md`](references/frappe-standard-capabilities.md) and check every custom-code proposal against it. Common cases that don't need custom Python:

- Approval routing → Frappe Workflow DocType
- Auto-assignment → Assignment Rule
- Recurring documents → Auto Repeat
- Email/in-app notification → Notification DocType
- Outbound HTTP → Webhook DocType
- Per-document logic without redeploy → Server Script
- Tabular data query → Report Builder / Query Report
- Dashboard tiles → Dashboard + Dashboard Chart
- Portal data entry → Web Form
- Extra fields on core DocTypes → Custom Field

Issue one of four scope verdicts: **Hold scope** (minimum required, proceed), **Reduce scope** (custom code where stock config suffices — cut those parts), **Expand scope** (addressing a symptom; standard-first delivers more for less maintenance), **Defer** (missing information; list what is needed).

State the trade-off: what the custom approach costs through 16.x upgrades vs what stock configuration cannot do.

Score three dimensions (0 = worst, 10 = best): **Standard Coverage** (10 = fully covered by stock), **Configure Ratio** (10 = zero custom Python in scope), **Upgrade Risk** (10 = isolated custom app, no core overrides).

### Mode B — Design handoff (only if UI scope detected)

If the plan includes Desk form layout, portal pages, frappe-ui components, or print format design: hand off to the `frappe-design-mockup-review` skill before continuing. Skip for API-only or backend-only plans.

### Mode C — DX review (only if `@frappe.whitelist()` API scope detected)

Goal: a developer new to this API makes a successful call within 10 minutes.

Score four dimensions (0–10): **TTHW** (10 = ≤10 min with docs + curl, no Desk session needed), **Error clarity** (10 = `frappe.throw` names the record and the fix), **Auth discoverability** (10 = permission error names the missing role), **Idempotency** (10 = re-calling with identical inputs returns the same result).

Flag: bare `raise`/unhandled exceptions that surface as a generic 500 with no actionable message. Tracebacks reach the response only for System Users when System Settings `allow_error_traceback` is on, or on a dev server (`frappe/utils/response.py` `is_traceback_allowed`); do not rely on that for consumers.

### Mode D — Architecture / Eng (always runs last)

| Check | Pass condition |
|---|---|
| DocType boundary | Single responsibility; child tables for owned rows, linked DocTypes for shared entities |
| Controller placement | `validate/on_submit/on_cancel` in controller; cross-DocType side effects in `doc_events` via `hooks.py` |
| Server Script vs controller | Server Script for low-frequency untested logic; controller for performance-critical, tested paths |
| Submittable + Workflow | `is_submittable` + Workflow DocType together; creating a Workflow adds the `workflow_state` Custom Field on the target DocType if it is missing (`workflow.py` `create_custom_field_for_workflow_state`), so it ships as a fixture |
| Permission completeness | Every role × every DocType listed; `if_owner`, User Permissions and any `permission_query_conditions` stated for row-scoped access |
| Patch safety | `pre_model_sync` for destructive column ops; `post_model_sync` for backfills; every patch idempotent |
| Upgrade risk | No `override_doctype_class` or core monkey-patch without documented justification |
| Test plan | Happy path + rejection path + at least one edge case per DocType → hand to `frappe-testing` |

Finding format: `[SEVERITY] (confidence: N/10) section:element — description` (P0–P2; suppress ≤6/10 to appendix).

### /frappe-plan-review chain (autoplan-lite)

Running `/frappe-plan-review` executes all modes in strict order:
`Mode A → Mode B (if UI) → Mode C (if API) → Mode D (always last)`

Auto-decision principles (non-interactive runs):

1. **Delete first** — standard Frappe capability covers it → Reduce scope; no exceptions
2. **Minimum code** — equal scope, fewer Python files wins
3. **Explicit permission** — incomplete permission matrix → P1 finding; never guess roles
4. **Test plan required** — absent test plan → P2 finding on any non-trivial plan
5. **Upgrade safe** — core override without documented justification → P1 Reduce
6. **One question per finding** — taste decisions always stop for user approval

User approval gate: after Mode D, present a findings table with scores and unresolved taste decisions. Do not signal plan is ready for task breakdown until user dismisses or approves each finding.

## Verification

- [ ] Mode A scope verdict produced with explicit configure-vs-build trade-off and three scores
- [ ] Standard capabilities checked against `references/frappe-standard-capabilities.md`
- [ ] Mode B triggered only if UI scope present; design handoff link provided
- [ ] Mode C triggered only if `@frappe.whitelist()` API scope present; four DX dimensions scored
- [ ] Mode D ran last; findings produced at P0–P2 with confidence ≥ 7/10
- [ ] Each finding resolved via a separate question with a recommendation
- [ ] User approval gate presented before signalling plan is ready for task breakdown
- [ ] Test plan artefact cross-linked to `frappe-testing`

## Failure modes / debugging

- **Mode A skipped** — reviewer jumps to DocType design without checking stock capabilities; restart from Mode A
- **Capability check from memory** — standard Frappe features are verified against source; always read `references/frappe-standard-capabilities.md`
- **Findings batched** — multiple issues in one question hide recommendations; split and re-ask
- **Mode D before Mode A** — architecture review before scope is settled produces contradictory findings; fix mode order
- **DX review skipped** — plan includes `@frappe.whitelist()` but Mode C was omitted; re-run Mode C
- **"No issues found" without evidence** — Mode D must show it read the permission matrix; claim findings only from artifact text

## Escalation

- Requirements still open → [`frappe-requirements-interview`](../frappe-requirements-interview/SKILL.md)
- DocType implementation → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Task breakdown → [`frappe-planning-and-task-breakdown`](../frappe-planning-and-task-breakdown/SKILL.md)
- Architecture decision record → [`frappe-documentation-and-adrs`](../frappe-documentation-and-adrs/SKILL.md)
- Design mockup → [`frappe-design-mockup-review`](../frappe-design-mockup-review/SKILL.md)
- Test plan execution → [`frappe-testing`](../frappe-testing/SKILL.md)

## References

- [references/frappe-standard-capabilities.md](references/frappe-standard-capabilities.md) — Verified list of stock ERPNext capabilities (Workflow, Assignment Rule, Auto Repeat, Notification, Webhook, Server Script, Dashboard, Web Form, Custom Field) with source citations

## Guardrails

- **No code during review** — output is findings and scores; no DocType JSON, no Python
- **One question per finding** — batch questions hide recommendations and confuse approval tracking
- **Mode A before Mode D** — scope must be settled before architecture decisions are evaluated
- **Read the reference file** — standard capability scores must be based on `references/frappe-standard-capabilities.md`, not memory
- **Never skip Mode D** — permission completeness and patch safety issues appear on simple plans as often as complex ones
- **Confidence required** — a finding with no confidence score (1–10) must not appear in the main report

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "ERPNext is too limiting — we need custom code" | Server Scripts, Workflows and Assignment Rules cover a large share of "custom" logic without a deploy cycle; list what is genuinely left over |
| "We'll add the permission matrix later" | Row-scoping (`if_owner`, User Permissions, query conditions) designed late leaves a gap between what users can open and what lists show; gaps ship silently |
| "Simple DocType, no test plan needed" | A missing submit/cancel test leaves the permission model unverified in CI |
| "API errors will be obvious to consumers" | An unhandled exception returns a generic 500; only a `frappe.throw` with a specific message and `exc_type` gets a consumer to a fix, which is what TTHW ≤ 10 min needs |
| "We can refactor post-sprint" | `override_doctype_class` calls accumulate and block minor 16.x upgrades |
| "Plan review is overhead" | Scope calls at review cost minutes; the same call at implementation costs days |
| "The scope is obvious, Mode A is a formality" | Assignment Rules and Server Scripts often replace custom controllers; the check costs minutes |

## Red Flags

- Mode A skipped; reviewer starts at DocType boundaries without checking stock capabilities
- Capability score given without reading `references/frappe-standard-capabilities.md`
- Permission matrix reviewed but row-scoping (`if_owner`, User Permissions) not mentioned for any DocType
- DX review skipped when plan includes `@frappe.whitelist()` methods
- Mode D run before Mode A scope verdict is produced
- Findings listed in a block without per-finding questions and recommendations
- "No issues found" in Mode D with no evidence of reading the plan's permission matrix
- Common Rationalizations accepted without a rebuttal

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Checking standard capabilities from memory | New automation DocTypes appear between versions; memory goes stale | Always read `references/frappe-standard-capabilities.md` first |
| Giving a single combined DX score | Masks which specific dimension is failing (TTHW vs error clarity vs auth) | Score all four DX dimensions separately |
| Skipping row-scope review | Owner- or company-scoped access gaps are data-leak bugs on multi-company installs | List `if_owner`, User Permission and query-condition rules for every DocType in the permission matrix |
| Using `pre_model_sync` for a backfill | Backfills run before the new column exists, causing column-not-found errors | Use `post_model_sync` for backfills; `pre_model_sync` only for destructive ops |
| Architecture review without scope verdict | Reviewing controller design before confirming custom code is necessary wastes review time | Always issue a scope verdict in Mode A before Mode D |
