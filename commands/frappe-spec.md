---
description: Interview for Frappe requirements then write SPEC.md (DocTypes, roles, workflows, APIs, test plan) — always before writing code
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/spec.md -->

Load the `frappe-requirements-interview` skill (omp: `read skill://frappe-requirements-interview`) and the `frappe-spec-driven-development` skill (omp: `read skill://frappe-spec-driven-development`).

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Follow `frappe-requirements-interview` to surface requirements one question at a time. Produce a requirements brief covering DocTypes, roles, workflow states, reports, print formats, integrations, and target version. Then switch to `frappe-spec-driven-development` and write `SPEC.md` at the project root covering:

1. DocType model and field list
2. Permissions matrix (roles × documents × actions)
3. Workflow states and transitions
4. API surface (whitelisted methods, webhooks)
5. Reports and print formats required
6. Patches and fixtures
7. Test plan and acceptance criteria
8. Boundaries: always / ask first / never

If the request bundles several independently testable capabilities, propose a capability map and get it approved before speccing each module.

**Verification gate:** `SPEC.md` exists at the project root, the user has reviewed and approved it, and no implementation code has been written. Do not write any code in this session.
