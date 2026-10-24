---
description: Review a Frappe/ERPNext plan or spec for scope, architecture, DX, and design before task breakdown
---

Frappe plan review: $ARGUMENTS

Before any other tool call:
1. Read `skill://frappe-plan-review` and follow its four modes in order.
2. Confirm bench: `ls apps sites` and `grep default_site sites/common_site_config.json`.
3. Read the plan or spec at the path in `$ARGUMENTS` (or the most recent `SPEC-*.md` at the repo root).

Run the autoplan-lite chain: **Mode A (scope)** → **Mode B (design, if UI)** → **Mode C (DX, if API)** → **Mode D (architecture, always last)**.

Follow the skill's Procedure, Verification, and Guardrails sections. Verify Frappe capability claims against the installed v16 source; tag behaviour present in 16.51.1 but absent in 16.35.0 as `(16.51)`. Do not write code; this is a review-only session.

Present the user approval gate after Mode D before signalling the plan is ready for `frappe-planning-and-task-breakdown`.
