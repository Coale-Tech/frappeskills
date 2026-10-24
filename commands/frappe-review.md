---
description: Five-axis review of Frappe code changes — correctness, readability, architecture, security, performance — plus Frappe-specific checks
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/review.md -->

Load the `frappe-code-review` skill (omp: `read skill://frappe-code-review`) and `frappe-security-hardening` (omp: `read skill://frappe-security-hardening`).

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Review the current changes (staged files or recent commits) across five axes:

1. **Correctness** — Matches spec? Edge cases handled (empty doc, cancelled, wrong `docstatus`)? Tests adequate?
2. **Readability** — Clear names? No deeply nested logic? Follows existing project conventions?
3. **Architecture** — Follows existing patterns? Clean DocType boundaries? No duplicate hooks? No circular imports?
4. **Security** — `has_permission` / `permission_query_conditions` in place? No `ignore_permissions=True` without justification? No raw SQL? No `allow_guest` on state-changing methods? Secrets out of code and `site_config.json`?
5. **Performance** — No `get_all`/`get_list` in loops? Indexes on filter fields? Background jobs for slow tasks? No unbounded queries?

Frappe-specific checks: fixtures exported cleanly; patches are idempotent; user-facing strings use `_()`; no v15-only APIs if v16 is the target; `bench --site <site> migrate` runs clean.

Categorize findings as Critical, Required, Optional, or Nit. Output a structured review with specific `file:line` references and fix recommendations.

**Verification gate:** every Critical and Required finding has a specific, actionable fix recommendation before yielding.
