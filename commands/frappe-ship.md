---
description: Pre-launch checklist via parallel fan-out to frappe-reviewer + frappe-security-auditor + frappe-test-engineer, then synthesize a go/no-go with rollback plan
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/ship.md -->

Load the `frappe-shipping-and-launch` skill (omp: `read skill://frappe-shipping-and-launch`) and `frappe-deprecation-and-migration` (omp: `read skill://frappe-deprecation-and-migration`) for any data-migration or deprecation concerns.

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`. Confirm a backup exists: `bench --site <site> backup`.

**Step 0 — Scope-drift check (before fan-out):**
Confirm the release diff matches its stated intent. Frappe signals: unrelated fixture exports, `patches.txt` additions not in the task, `hooks.py` edits outside feature scope, Custom Field JSON churn. Output `Scope Check: CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING`. Block Phase A if DRIFT DETECTED until resolved.

## Phase A — Parallel fan-out

Spawn three subagents concurrently (issue all three calls in a single turn so they execute in parallel):

1. **`frappe-reviewer`** — Five-axis review of staged changes, including Frappe-specific axes: permissions, raw SQL, hooks, patches, fixtures, i18n.
2. **`frappe-security-auditor`** — Vulnerability and threat-model pass: `has_permission`, `allow_guest`, SQL injection, secrets in `site_config.json`, file privacy, CSRF, rate limiting.
3. **`frappe-test-engineer`** — Coverage analysis: happy path, edge cases, error paths, cancellation/amend flows, background-job failures.

Personas do not call each other. The main agent merges in Phase B.

## Phase B — Merge

1. Aggregate Critical/Required findings; promote any Critical security findings to blockers
2. Verify: `bench --site <site> migrate` clean; all tests pass; backup confirmed
3. Check deprecation/migration: removed fields still referenced? Patches idempotent and tested on a restored backup?
4. Infrastructure: `site_config.json` secrets correct, worker counts sized, `maintenance_mode` plan ready, post-deploy smoke test defined

## Phase C — Decision

Output:

```
## Ship Decision: GO | NO-GO
**Completion status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
REASON: [aggregated status from all three personas]

### Blockers (must fix before ship)
### Recommended fixes (should fix before ship)
### Acknowledged risks (shipping anyway)
### Rollback plan
  - Trigger: [what signals prompt rollback]
  - Steps: [exact bench commands]
  - RTO: [target]
```

If any persona returns a Critical finding, the default verdict is NO-GO unless the user explicitly accepts the risk.

**Verification gate:** the rollback plan is mandatory before any GO decision is issued.
