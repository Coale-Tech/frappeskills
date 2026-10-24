# Adoption Guide

How to roll the lifecycle skills out on a Frappe codebase. Skills load on demand, so adopting more of them costs nothing until a task triggers one.

## Greenfield app: full lifecycle from day one

| Stage | Command | Skills | Output |
|---|---|---|---|
| Define | `/frappe-spec` | `frappe-requirements-interview`, `frappe-spec-driven-development`, `frappe-constraint-driven-development` | Requirements brief, approved spec, `CONSTRAINTS.md` |
| Plan | `/frappe-plan` | `frappe-planning-and-task-breakdown` | Ordered tasks with acceptance + verification |
| Build | `/frappe-build` (or `auto`) | `frappe-incremental-implementation` + task skills via `frappe-router` | One verified, committed slice at a time |
| Verify | `/frappe-test` | `frappe-testing`, `frappe-browser-testing`, `frappe-debugging-and-error-recovery` | Tests that fail first, browser evidence |
| Review | `/frappe-review`, `/frappe-simplify`, `/frappe-perf` | `frappe-code-review`, `frappe-security-hardening`, `frappe-code-simplification`, `frappe-performance-optimization` | Severity-labelled review, measured fixes |
| Ship | `/frappe-ship` | `frappe-git-workflow-and-versioning`, `frappe-ci-cd-automation`, `frappe-shipping-and-launch`, `frappe-observability` | Restore-tested backup, staged rollout, rollback plan |

Start with `/frappe-constraints`: decide the quality bar once so every later stage can enforce it.

## Established app or bench: verification first

Adopt in this order; each step is useful on its own.

1. **Constraints.** Run `/frappe-constraints` against the existing app. Record what passes today as the floor; never lower it afterwards.
2. **Triage and audit.** `frappe-project-triage` for versions and apps, then `frappe-app-audit` once for a baseline.
3. **Review and debug.** Use `frappe-code-review` on every change and `frappe-debugging-and-error-recovery` for every failure.
4. **Tests on touched code only.** `frappe-testing` + `references/tdd-workflow.md`: failing test before each bug fix; do not back-fill the whole app.
5. **Ship discipline.** `frappe-shipping-and-launch` for any change that touches patches, schema or permissions.
6. **Specs for new features only.** Full spec/plan flow for new work; leave stable legacy code alone.

## Per-bench context

Give each bench an `AGENTS.md` (template: `frappe-context-engineering/assets/bench-AGENTS.md`) naming the default site, versions read from source, and the skills to load. Local conventions in that file outrank a skill's Guardrails.

## Parallel agents

Read [agents.md](agents.md) first: fix the shared contract (the DocType JSON) before fanning out, and keep synthesis with the main agent.
