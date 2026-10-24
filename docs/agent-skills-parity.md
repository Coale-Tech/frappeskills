# Parity with addyosmani/agent-skills

Every feature of [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, commit `aeac41d`) and where it lives here. Upstream names are on the left.

## Skills

| Upstream skill | frappeskills |
|---|---|
| using-agent-skills | `frappe-router` (lifecycle map, operating rules) |
| interview-me, idea-refine | `frappe-requirements-interview` (merged: one skill per kind of work) |
| spec-driven-development | `frappe-spec-driven-development` |
| constraint-driven-development | `frappe-constraint-driven-development` |
| planning-and-task-breakdown | `frappe-planning-and-task-breakdown` |
| incremental-implementation | `frappe-incremental-implementation` |
| test-driven-development | `frappe-testing` + `references/tdd-workflow.md` |
| context-engineering | `frappe-context-engineering` |
| source-driven-development | `frappe-deep-research` + `references/source-citation-protocol.md` |
| doubt-driven-development | `frappe-doubt-driven-development` |
| frontend-ui-engineering | `frappe-frontend-development`, `frappe-ui-patterns`, `frappe-design-tokens` + `frappe-ui-patterns/references/accessibility-checklist.md` |
| api-and-interface-design | `frappe-api-development` + `references/api-contract-design.md` |
| browser-testing-with-devtools | `frappe-browser-testing` |
| debugging-and-error-recovery | `frappe-debugging-and-error-recovery` |
| code-review-and-quality | `frappe-code-review` (per change); `frappe-app-audit` (whole app) |
| code-simplification | `frappe-code-simplification` |
| security-and-hardening | `frappe-security-hardening` |
| performance-optimization | `frappe-performance-optimization` |
| git-workflow-and-versioning | `frappe-git-workflow-and-versioning` |
| ci-cd-and-automation | `frappe-ci-cd-automation` |
| deprecation-and-migration | `frappe-deprecation-and-migration` |
| documentation-and-adrs | `frappe-documentation-and-adrs` |
| observability-and-instrumentation | `frappe-observability` |
| shipping-and-launch | `frappe-shipping-and-launch` |

## Other features

| Upstream | frappeskills |
|---|---|
| Common Rationalizations + Red Flags sections | Sections 9 and 10 of every skill ([skill-anatomy.md](skill-anatomy.md)) |
| 9 slash commands | `commands/frappe-{spec,plan,build,test,constraints,review,simplify,perf,ship}.md`; `/frappe-build auto` |
| 4 agent personas | `omp/agents/frappe-{reviewer,security-auditor,test-engineer,performance-auditor}.md` plus `frappe-scout`; rules in [agents.md](agents.md) |
| Reference checklists | In the owning skill: definition-of-done (constraint-driven-development), security, performance, observability, accessibility (ui-patterns), orchestration patterns (router) |
| `validate-*.js`, `skill-lint` | `scripts/` ([skill-anatomy.md](skill-anatomy.md) rules) |
| Tier 2 routing evals, Tier 3 behavioural evals | `scripts/run-evals.js`, `evals/cases/` (Tier 3 is dialogue-graded only) |
| Plugin manifests (Claude, Codex, `.agents`) | `.claude-plugin/`, `plugin.json`, `.codex-plugin/`, `.agents/plugins/` |
| CI workflow | `.github/workflows/validate.yml` |
| Adoption guide, anatomy doc, contributing | `adoption-guide.md`, `skill-anatomy.md`, `CONTRIBUTING.md` |

## Deliberately not ported

| Upstream | Why |
|---|---|
| Shared repo-root `references/` | Per-skill installs and `skill://` resolve only inside a skill directory (upstream issue #361). Shared checklists live in the owning skill instead. |
| `hooks/session-start.sh` | Upstream says not to wire it on hosts with native description routing; omp, Claude Code and Codex all route natively. |
| `hooks/sdd-cache*` | Caches fetched web docs. Frappe's authority is installed source, which is already local. |
| `hooks/simplify-ignore*` | Needs a host hook. `frappe-code-simplification` documents the `frappe-simplify-ignore` marker as an advisory convention. |
| Gemini TOML / Antigravity command wrappers | No consumer in this workspace. The `commands/*.md` files are host-neutral; generate TOML from them if needed. |
| Tier 3 execution evals with fixtures | A throwaway workspace has no bench. Behavioural evals are `kind: dialogue`. |
| `webperf` / Core Web Vitals auditor as a separate persona command | Folded into `frappe-performance-optimization` and `frappe-performance-auditor` (Desk/portal load included). |
