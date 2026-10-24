---
name: frappe-router
description: "Route to the appropriate Frappe skill based on task type and lifecycle stage. Use as the entry point when not sure where to start, which skill to follow, which workflow or approach covers a feature from scratch through deployment, or how the full DEFINE→PLAN→BUILD→VERIFY→REVIEW→SHIP lifecycle applies."
---

# Frappe Router

Target is **v16** — baseline frappe 16.35.0/erpnext 16.6.1/hrms 16.4.1 (fully verified);
delta-verified through frappe 16.51.1/erpnext 16.50.0/hrms 16.50.0. `(16.51)` tags
changed behaviour; `(<=16.35)` tags the old form when both versions are in use. v15 notes throughout.

## When to use

- First step when starting any Frappe-related work
- To determine which specialized skill applies to your task
- To find which lifecycle command or persona to invoke
- Not for: running a specific lifecycle phase directly → use the `/frappe-*` commands

## Procedure

### 0) Identify task type

| Task | Skill |
|------|-------|
| Understand project structure, versions, apps | → `frappe-project-triage` |
| Capture requirements one question at a time | → `frappe-requirements-interview` |
| Write SPEC.md before any code | → `frappe-spec-driven-development` |
| Define quality bar + CONSTRAINTS.md | → `frappe-constraint-driven-development` |
| Decompose spec into ordered tasks | → `frappe-planning-and-task-breakdown` |
| Scaffold new app, hooks, jobs, caching, fixtures | → `frappe-app-development` |
| Create/modify DocTypes, fields, controllers, permissions | → `frappe-doctype-development` |
| Build REST/RPC APIs, webhooks, OAuth, ORM queries | → `frappe-api-development` |
| Customize Desk UI, form scripts, list views, workspaces | → `frappe-desk-customization` |
| Build Vue 3 frontends with frappe-ui, portals | → `frappe-frontend-development` |
| UI/UX patterns from CRM/Helpdesk/HRMS, mobile layouts | → `frappe-ui-patterns` |
| Espresso design tokens, color/type/spacing scales | → `frappe-design-tokens` |
| Print formats, email templates, Jinja, PDFs | → `frappe-printing-templates` |
| Reports (Builder, Query, Script), charts, Insights | → `frappe-reports` |
| Public web forms for data collection | → `frappe-web-forms` |
| Thin vertical slice: implement → test → migrate → commit | → `frappe-incremental-implementation` |
| Adversarial review of non-trivial in-flight decisions | → `frappe-doubt-driven-development` |
| Feed the agent the right context for a bench | → `frappe-context-engineering` |
| Reproduce → localize → fix → guard for Frappe errors | → `frappe-debugging-and-error-recovery` |
| Verify Desk/portal UI in a real browser | → `frappe-browser-testing` |
| Write or run tests, TDD, CI | → `frappe-testing` |
| Five-axis per-change code review | → `frappe-code-review` |
| Review a built UI: dark mode, viewports, design lint, visual QA | → `frappe-design-review` |
| Review a plan before building: configure vs build, architecture, API DX | → `frappe-plan-review` |
| Mockup before code: HTML variants on real tokens, scored design review | → `frappe-design-mockup-review` |
| Brand/theme direction for website, portal, print, email or SPA theme overrides | → `frappe-design-consultation` |
| Audit a live API or app onboarding as a new integrator (curl, timing, DX score) | → `frappe-devex-review` |
| Behaviour-preserving simplification | → `frappe-code-simplification` |
| Build-time security: perms, SQL, XSS, CSRF, secrets | → `frappe-security-hardening` |
| Query N+1, indexes, cache, background jobs, load | → `frappe-performance-optimization` |
| CRM/Helpdesk-scale architecture, SLAs | → `frappe-enterprise-patterns` |
| Docker dev environments with `fm` | → `frappe-manager` |
| Bench CLI, site management, broken bench recovery | → `frappe-bench-operations` |
| ERPNext or HRMS domain workflows | → `frappe-erpnext-hrms` |
| Frappe CRM app: Lead/Deal pipeline, telephony/WhatsApp | → `frappe-crm-app` |
| Convert Excel into Data Import CSV and bulk load records | → `frappe-data-import` |
| Assess a whole app against framework standards | → `frappe-app-audit` |
| "How does Frappe actually do X" against installed source | → `frappe-deep-research` |
| App branching, atomic commits, patches.txt, version bump | → `frappe-git-workflow-and-versioning` |
| GitHub Actions CI pipeline, deploy automation | → `frappe-ci-cd-automation` |
| Patches, schema/field removal, v15→v16 upgrade | → `frappe-deprecation-and-migration` |
| ADRs, app README, docstrings, API docs, changelogs | → `frappe-documentation-and-adrs` |
| Logging, Error Log, RQ monitoring, health checks | → `frappe-observability` |
| Pre-launch checklist, staged rollout, rollback | → `frappe-shipping-and-launch` |

### 1) Run triage first (recommended)

Before deep work, run `frappe-project-triage` to establish project type, versions
(read from `__init__.py`, not memory), installed apps, and existing conventions.

### 2) Lifecycle and commands

| Stage | Command | Primary skills |
|-------|---------|----------------|
| DEFINE | `/frappe-spec` | `frappe-requirements-interview`, `frappe-spec-driven-development` |
| DEFINE | `/frappe-constraints` | `frappe-constraint-driven-development` |
| PLAN | `/frappe-plan` | `frappe-planning-and-task-breakdown` |
| PLAN | `/frappe-plan-review` | `frappe-plan-review`, `frappe-design-consultation` (brand), `frappe-design-mockup-review` (UI) |
| BUILD | `/frappe-build [auto]` | `frappe-incremental-implementation` + task skills |
| VERIFY | `/frappe-test` | `frappe-testing`, `frappe-browser-testing` |
| REVIEW | `/frappe-review`, `/frappe-simplify`, `/frappe-perf` | `frappe-code-review`, `frappe-code-simplification`, `frappe-performance-optimization` |
| REVIEW | `frappe-design-review` (post-build UI), `frappe-devex-review` (post-build API/onboarding) | `frappe-design-review`, `frappe-devex-review` |
| SHIP | `/frappe-ship` | `frappe-shipping-and-launch`, `frappe-deprecation-and-migration` |

Full stage detail and skill combinations: `references/lifecycle.md`.

### 3) Operating rules

<!-- Adapted from addyosmani/agent-skills (MIT): skills/using-agent-skills/SKILL.md -->

1. **Read the skill before acting.** Skills are processes, not prose; follow their Procedure, Verification, and Guardrails in full.
2. **Verification is non-negotiable.** Every claim requires evidence (test output, `bench migrate` exit code, screenshot). "It should work" is not evidence.
3. **One primary skill.** Name it; state which others you are combining and why.
4. **Surface assumptions.** State what you are assuming (version, installed apps, site config) before acting. Stop and ask when requirements conflict.
5. **Do not expand scope.** Implement exactly what the current task says; defer everything else, even if it looks useful.

Full orchestration rules and anti-patterns: `references/orchestration-patterns.md`.

## Quick decision tree

```
Unknown project?                      → frappe-project-triage
Requirements / spec before code?      → frappe-requirements-interview
                                        → frappe-spec-driven-development
Plan ready, is scope/architecture right? → frappe-plan-review
Mockup / design review before code?   → frappe-design-mockup-review
Brand / theme direction (no design system given)? → frappe-design-consultation
Quality bar / CONSTRAINTS.md?         → frappe-constraint-driven-development
Task breakdown from spec?             → frappe-planning-and-task-breakdown
Thin vertical slice to implement?     → frappe-incremental-implementation
New app or app-wide plumbing?         → frappe-app-development
Data model, controllers, permissions? → frappe-doctype-development
Endpoints, ORM, external access?      → frappe-api-development
Desk screens and form scripts?        → frappe-desk-customization
Vue SPA or portal?                    → frappe-frontend-development
Look and feel?                        → frappe-design-tokens / frappe-ui-patterns
Paper, PDF, email?                    → frappe-printing-templates
Numbers on a screen?                  → frappe-reports
Public data collection?               → frappe-web-forms
Proof it works (TDD)?                 → frappe-testing / frappe-browser-testing
Something broke?                      → frappe-debugging-and-error-recovery
Code review?                          → frappe-code-review
Built UI visual / mobile / dark audit? → frappe-design-review
Built API / onboarding DX audit?      → frappe-devex-review
Security check?                       → frappe-security-hardening
Simplify code?                        → frappe-code-simplification
Performance?                          → frappe-performance-optimization
Bench broken or site ops?             → frappe-bench-operations
Docker dev env?                       → frappe-manager
Sales / stock / payroll semantics?    → frappe-erpnext-hrms
Frappe CRM Lead/Deal pipeline?        → frappe-crm-app
Whole-app quality question?           → frappe-app-audit
Bulk data load from spreadsheet?      → frappe-data-import
Branching, versioning, patches.txt?   → frappe-git-workflow-and-versioning
CI/CD pipeline?                       → frappe-ci-cd-automation
Schema removal, v15→v16 migration?    → frappe-deprecation-and-migration
Logging, observability, alerting?     → frappe-observability
Pre-launch / staged rollout?          → frappe-shipping-and-launch
"How does Frappe do X?"               → frappe-deep-research
```

## Guardrails

- **Always triage first** before changing code in an unknown project
- **Check versions from source**: `grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py` — never `bench --version`
- **Don't assume ERPNext** — many sites run Frappe Framework alone
- **Always pass `--site <site>`** — never run bare `bench migrate`
- **Never edit core apps** — extend via Custom Fields, `doc_events`, and `override_doctype_class`
- **Installed source outranks these skills** — a reference that disagrees with `apps/frappe` on disk is a bug

## Common Rationalizations

<!-- Adapted from addyosmani/agent-skills (MIT): skills/using-agent-skills/SKILL.md -->

| Rationalization | Reality |
|-----------------|---------|
| "It's only a patch; I'll skip the dry-run on a backup." | Patches that look trivial have wiped DocType tables. Dry-run on a restored backup is non-negotiable. |
| "ERPNext must be installed; all sites use it." | Many sites run Frappe Framework alone. Check `bench --site <site> list-apps` before assuming. |
| "I'll skip `bench migrate`; I only changed Python." | Controller changes touching DocType meta (child tables, permissions) require migrate even when the JSON looks unchanged. |
| "The test passed locally; no need to run the full suite." | Frappe hooks interact globally; a passing unit test misses cross-app fixture or hook conflicts. |
| "I can use `frappe.db.sql` here; it's just one quick query." | Raw SQL bypasses the permission layer and breaks with schema changes. Use `frappe.qb` or `frappe.get_all`. |
| "This endpoint is internal; I don't need `has_permission`." | 'Internal' endpoints are frequently exposed by accident. One permission check costs one line; a breach costs a customer. |
| "I know this bench; I don't need to triage the version." | Version assumptions cause silent failures when branches diverge or a bench is shared across projects. |

## Red Flags

- You are editing `apps/frappe`, `apps/erpnext`, or `apps/hrms` directly instead of extending via Custom Fields or `doc_events`
- `frappe.db.sql` appears in new code without a documented exception in `frappe-api-development/references/database.md`
- `ignore_permissions=True` is used without an explicit threat-model note in the diff
- `bench migrate` is run without `--site <site>` specified
- A test was deleted or a check suppressed to make a gate pass
- `allow_guest=True` is set on a state-changing whitelisted method
- The skill you invoked contradicts the installed source (`apps/frappe`), and you chose the skill over the source
- A patch modifies data without an idempotency guard and without a tested rollback procedure

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Skipping project triage | Wrong patterns for that version/app set | Run `frappe-project-triage` first |
| ERPNext-specific code on a Frappe-only site | `ModuleNotFoundError` at import | Check installed apps first |
| Wrong skill for the task | Incomplete or incorrect implementation | Match task type in the routing table above |
| Ignoring version differences | Deprecated or missing APIs | Check `frappe-project-triage` → `v15-v16-compatibility.md` |
| Working on the wrong site | Changes don't appear | Always specify `--site` |
| Vanilla JS/jQuery for a new frontend | Ecosystem mismatch | `frappe-ui` (Vue 3) via `frappe-frontend-development` |
| Hand-rolled CRUD shell | Inconsistent UX | Follow CRM/Helpdesk shells via `frappe-enterprise-patterns` |
| Starting to code before spec and constraints | Scope drift and rework | Run `/frappe-spec` and `/frappe-constraints` first |
