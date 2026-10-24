---
name: frappe-app-audit
description: "Audit or security-review a whole Frappe app against framework standards covering permissions, SQL safety, i18n, hooks correctness, fixtures, and tests. Use when assessing a custom app for production readiness, running a pre-live security sweep, or doing a comprehensive review rather than a single fix."
---

# Frappe App Audit

Assess an entire app against framework standards and report findings by
severity, with file:line evidence.

## When to use

- Inheriting or reviewing an app you did not write
- Pre-release quality gate
- Recurring bugs suggest systemic problems, not one defect
- Security review of custom Frappe code

## Inputs required

- App path and the site it runs on
- Frappe/ERPNext versions (from [`frappe-project-triage`](../frappe-project-triage/SKILL.md))
- Whether the app is in production (changes severity thresholds)

## Procedure

### 0) Triage first

Versions, installed apps, module layout, frontend model. An audit without
version context produces wrong findings.

### 1) Sweep security

```bash
grep -rnE "frappe\.db\.sql\(f|\.format\(|% *\(" apps/<app> --include=*.py
grep -rn "@frappe.whitelist" apps/<app> --include=*.py
grep -rn "allow_guest=True" apps/<app> --include=*.py
```

Each whitelisted method: does a state-changing path call
`frappe.has_permission(..., throw=True)`? Are argument types validated? Rule
catalog: [references/semgrep-rules.md](references/semgrep-rules.md).

### 2) Sweep correctness

```bash
grep -rn "def after_save" apps/<app> --include=*.py
grep -rn "frappe.db.commit()" apps/<app> --include=*.py
grep -rn "flushall" apps/<app> --include=*.py
```

Plus module-level queries (multitenancy breakage) and Single-value reads via
`get_value` instead of `get_single_value`.

### 3) Sweep i18n

```bash
grep -rnE "frappe\.throw\(\"|frappe\.msgprint\(\"" apps/<app> --include=*.py
```

### 4) Sweep customization hygiene

Custom fields exported as fixtures? Core apps untouched? `hooks.py` handlers
resolvable? Workspaces/desk pages correct for the version?

### 5) Sweep the frontend

Hardcoded colors, raw `fetch`, Options API, missing empty/error states,
unbuilt assets.

### 6) Sweep tests

Do tests exist for the app's real contracts? List every `@frappe.whitelist()` method and every scheduler entry with no test touching it; absence is a Required finding, not a count. Do any tests pin implementation details
or exact strings? Those are liabilities — flag them for deletion.

### 7) Report by severity

Full procedure and report template:
[references/app-audit.md](references/app-audit.md). Every finding needs
`file:line`, the rule it violates, and the concrete fix.

## Verification

- [ ] Every whitelisted method reviewed for a permission gate
- [ ] No string-interpolated SQL remains unflagged
- [ ] i18n gaps listed with file:line
- [ ] Fixture coverage confirmed against the site's Custom Fields
- [ ] Frontend findings reproduced in a browser, not assumed
- [ ] Findings ranked by severity with concrete fixes
- [ ] No finding asserted without evidence

## Failure modes / debugging

- **Grep noise**: comments and tests match the patterns — verify each hit in context
- **False "missing permission" findings**: the gate may live in a service the method calls
- **Version-inappropriate findings**: a v15 app audited against v16 rules
- **Findings without fixes**: unusable report — always name the replacement
- **Audit scope creep**: an audit reports, it does not refactor

## Escalation

- Fixing what the audit found → the owning skill via [`frappe-router`](../frappe-router/SKILL.md)
- Architectural problems rather than defects → [`frappe-enterprise-patterns`](../frappe-enterprise-patterns/SKILL.md)
- Unclear framework behaviour behind a finding → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Fixing security findings → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Fixing performance findings → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)
- Per-change review after remediation → [`frappe-code-review`](../frappe-code-review/SKILL.md)
- Error log and monitoring gaps → [`frappe-observability`](../frappe-observability/SKILL.md)

## References

- [references/app-audit.md](references/app-audit.md) - Audit procedure and report format
- [references/semgrep-rules.md](references/semgrep-rules.md) - Security and correctness rule catalog

## Guardrails

- **Evidence or it isn't a finding**: `file:line` for every claim
- **Audit reports, it does not refactor**: fixes are separate, owned work
- **Severity reflects exploitability and blast radius**, not personal taste
- **Check the version before applying a rule**
- **Verify each grep hit in context**: patterns over-match


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The grep output is the finding" | Every pattern match must be verified in context; comments, test files and disabled code all match but are not findings. |
| "I'll fix the issues while I audit" | Mixed audit-and-fix produces an unreviewable diff; audit outputs a report, fixes are separate tracked work. |
| "The app has no tests; that's the developer's choice" | Absence of test coverage for real contracts is an audit finding — flag it with the risk, not just the count. |
| "`allow_guest=True` is fine; this is a dev site" | Site config is not a security control; an endpoint without a permission gate is a finding regardless of environment. |
| "I'll note the security issue without ranking it" | Unranked findings are not prioritised; severity (exploitability × blast radius) determines fix order. |
| "Auditing without checking the version first is fine" | A v15 app audited with v16 rules produces false positives and misses v16-specific patterns. |

## Red Flags

- Findings reported as raw grep output without context verification
- Audit and refactoring mixed in the same branch or PR
- Security findings without severity ranking
- `frappe-project-triage` not run before starting the audit
- `@frappe.whitelist` methods reviewed only for presence, not for a `frappe.has_permission` call
- Findings stated without a `file:line` reference

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Reporting grep hits verbatim | False positives destroy trust | Verify in context |
| Findings without fixes | Nobody can act | Name the replacement |
| Auditing without version context | Wrong rules applied | Triage first |
| Mixing audit and refactor | Unreviewable diff | Report, then fix separately |
| Flagging style as security | Noise drowns real issues | Rank by severity |
