---
description: Review a Frappe/ERPNext plan or spec — scope, architecture, DX, and design — before task breakdown
---

<!-- Adapted from addyosmani/agent-skills (MIT): commands/plan.md convention -->

Load the `frappe-plan-review` skill (omp: `read skill://frappe-plan-review`).

$ARGUMENTS

**Confirm bench context:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Read the plan or spec at the path in `$ARGUMENTS` (or the most recent `SPEC-*.md` at the repo root if no path is given). Enter review mode — read only, no code changes.

Run the `/frappe-plan-review` autoplan-lite chain in strict order:

1. **Mode A — Scope / Standard-first**: check the plan against standard ERPNext capabilities (Workflow, Assignment Rule, Auto Repeat, Notification, Webhook, Server Script, Dashboard, Web Form, Custom Field). Issue a scope verdict (Hold / Reduce / Expand / Defer) with a configure-vs-build trade-off statement. Score Standard Coverage, Configure Ratio, and Upgrade Risk (0–10).

2. **Mode B — Design handoff** *(if UI scope detected)*: hand off to the design-mockup-review peer skill before continuing.

3. **Mode C — DX review** *(if `@frappe.whitelist()` API scope detected)*: score TTHW, error clarity, auth discoverability, and idempotency.

4. **Mode D — Architecture / Eng** *(always last)*: check DocType boundaries, controller/hook placement, permission completeness, patch safety, and upgrade risk. Produce a findings list at P0–P2 (confidence ≥ 7/10). Raise each finding as a separate question with a recommendation.

**User approval gate:** present a summary table of scores and findings. Do not signal the plan is ready for task breakdown until the user approves or dismisses each item.

**Verification gate:** scope verdict produced, all four modes evaluated (or skipped with documented reason), each finding has an explicit recommendation, and the user has seen the approval gate.
