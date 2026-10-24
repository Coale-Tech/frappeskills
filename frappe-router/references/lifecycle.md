# Frappe Development Lifecycle

<!-- Adapted from addyosmani/agent-skills (MIT): skills/using-agent-skills/SKILL.md -->

The full DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP lifecycle for Frappe apps. Each stage maps to one or more `/frappe-*` commands and the skills they invoke.

## Lifecycle stages

### DEFINE

**Goal:** understand what to build before writing any code.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-spec` | `frappe-requirements-interview` → `frappe-spec-driven-development` |
| `/frappe-constraints` | `frappe-constraint-driven-development` |

Outputs: `SPEC.md` (approved by the user), `CONSTRAINTS.md`.

Run `frappe-requirements-interview` one question at a time to surface DocTypes, roles, workflow states, reports, print formats, integrations, and target version. Then `frappe-spec-driven-development` writes the spec.

Set up `CONSTRAINTS.md` at the same time: tests passing, `bench --site <site> migrate` clean, ruff lint, semgrep, patch idempotency, permission checks, i18n `_()` coverage.

---

### PLAN

**Goal:** break the approved spec into small, verifiable, ordered tasks.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-plan` | `frappe-planning-and-task-breakdown` |

Output: `tasks/plan.md` and `tasks/todo.md` (approved by the user).

Dependency order: DocType model first → controller logic → permissions → API surface → Desk UI / frontend → print formats / reports → patches / fixtures. Mark tasks parallel-safe where the contract (DocType JSON, API stub) is already defined.

---

### BUILD

**Goal:** implement each task as a thin vertical slice: code → test → migrate → verify → commit.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-build` | `frappe-incremental-implementation` + task skill via `frappe-router` |
| `/frappe-build auto` | same, autonomous after single approval |

Parallel BUILD is safe **only after a shared contract exists** (DocType JSON exported, API stub defined). See `orchestration-patterns.md`.

Invoke `frappe-doubt-driven-development` on any risky in-flight decision: permission changes, irreversible patches, GL/stock postings, data migrations. Invoke `frappe-context-engineering` when output quality drops or the agent loses track of the bench layout.

Typical task-skill combinations:

| Task type | Skill(s) |
|-----------|---------|
| New DocType + controller | `frappe-doctype-development` |
| REST/RPC endpoint | `frappe-api-development` |
| Desk form customization | `frappe-desk-customization` |
| Vue 3 frontend / SPA | `frappe-frontend-development` + `frappe-design-tokens` |
| Print format / email template | `frappe-printing-templates` |
| Script / Query report | `frappe-reports` |
| ERPNext domain (Sales, Stock, HR) | `frappe-erpnext-hrms` |
| Bulk data load from spreadsheet | `frappe-data-import` + `frappe-doctype-development` |
| Enterprise-scale architecture | `frappe-enterprise-patterns` + `frappe-doctype-development` |
| Unexplained framework behaviour | `frappe-deep-research` + the owning skill |

---

### VERIFY

**Goal:** prove each slice works before calling it done.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-test` | `frappe-testing` (TDD loop) + `frappe-browser-testing` (Desk/portal UI) |

Use `frappe-debugging-and-error-recovery` for any test failure: reproduce → localize → reduce → fix → guard. Do not suppress or skip a failing test to make a check pass.

---

### REVIEW

**Goal:** quality-gate the change before it reaches the main branch.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-review` | `frappe-code-review` + `frappe-security-hardening` |
| `/frappe-simplify` | `frappe-code-simplification` |
| `/frappe-perf` | `frappe-performance-optimization` |

For a whole-app sweep (not just a change): `frappe-app-audit`.

---

### SHIP

**Goal:** deploy safely with a tested rollback plan.

| Command | Skills invoked |
|---------|---------------|
| `/frappe-ship` | fan-out: `frappe-reviewer` + `frappe-security-auditor` + `frappe-test-engineer` → merge → GO/NO-GO |

Supporting skills: `frappe-shipping-and-launch`, `frappe-deprecation-and-migration`, `frappe-git-workflow-and-versioning`, `frappe-ci-cd-automation`, `frappe-documentation-and-adrs`, `frappe-observability`.

---

## Full lifecycle sequence

```
1.  frappe-requirements-interview         → surface what to build
2.  frappe-spec-driven-development        → write SPEC.md
3.  frappe-constraint-driven-development  → write CONSTRAINTS.md
4.  frappe-planning-and-task-breakdown    → write tasks/plan.md
5.  frappe-context-engineering            → load the right context for the bench
6.  frappe-incremental-implementation     → build slice by slice
    ├── frappe-doubt-driven-development   → on risky in-flight decisions
    └── <task skill>                      → doctype / api / desk / frontend / ...
7.  frappe-testing                        → TDD per slice
8.  frappe-browser-testing               → UI proof for Desk/portal slices
9.  frappe-debugging-and-error-recovery  → on any test failure
10. frappe-code-review                   → five-axis review
11. frappe-security-hardening            → security axis
12. frappe-code-simplification           → reduce unnecessary complexity
13. frappe-performance-optimization      → measure-first perf check
14. frappe-git-workflow-and-versioning   → clean atomic commits, patches.txt
15. frappe-ci-cd-automation              → quality-gate pipeline
16. frappe-documentation-and-adrs        → document decisions and changes
17. frappe-deprecation-and-migration     → retire old code/fields if needed
18. frappe-observability                 → instrument logging + health checks
19. frappe-shipping-and-launch           → pre-launch checklist, staged rollout, rollback
```

Not every task needs every step. A bug fix typically needs: `frappe-debugging-and-error-recovery` → `frappe-testing` → `frappe-code-review`.

## Sources

- `apps/frappe/frappe/__init__.py` — version string
- `apps/erpnext/erpnext/__init__.py` — version string
- `apps/hrms/hrms/__init__.py` — version string
- Upstream: `addyosmani/agent-skills` (MIT): `skills/using-agent-skills/SKILL.md`, `.claude/commands/build.md`, `.claude/commands/ship.md`
