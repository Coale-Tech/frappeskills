<div align="center">
  <img src=".github/assets/logo.svg" width="96" alt="frappeskills" />

  <h1>frappeskills</h1>

  <p><b>Agent Skills for full-stack Frappe Framework / ERPNext development.</b></p>

  <p>
    <img src="https://img.shields.io/badge/frappe-v16-2490EF" alt="frappe v16" />
    <img src="https://img.shields.io/badge/skills-45-1467B1" alt="45 skills" />
    <img src="https://img.shields.io/badge/references-139-555" alt="139 references" />
    <img src="https://img.shields.io/badge/commands-11-555" alt="11 commands" />
    <img src="https://img.shields.io/badge/agents-8-555" alt="8 agents" />
  </p>
</div>

## Why

Frappe work spans schema, controllers, permissions, jobs, Desk customization,
Vue SPAs, design tokens, bench operations and ERPNext domain logic. One skill
covering all of it is either shallow or enormous — and an agent loads the whole
thing to answer one question.

These are **task-scoped skills**: each owns one kind of work, states its
procedure in the same eleven sections, and carries only the references that work
needs. [`frappe-router`](frappe-router/SKILL.md) is the entry point that maps a
task to its skill and lifecycle phase.

The pack covers the whole delivery lifecycle — **Define → Plan → Build → Verify → Review → Ship** —
and ports every feature of
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) to Frappe: lifecycle skills,
anti-rationalization tables, slash commands, specialist agents, a validator and an eval harness.
Mapping and the short list of deliberately unported pieces: [docs/agent-skills-parity.md](docs/agent-skills-parity.md).

Every deep reference is source-verified against installed framework source and
ends with a `## Sources` section naming the files it was checked against.
**Installed source outranks this repo**; a reference that disagrees with
`apps/frappe` on disk is a bug.

## Skills

| Phase | Skill | Use it for | Refs |
| --- | --- | --- | ---: |
| **Entry point** | [frappe-router](frappe-router/SKILL.md) | Route a task to the right skill, lifecycle phase and command | 2 |
| **Define** | [frappe-requirements-interview](frappe-requirements-interview/SKILL.md) | Turn a vague idea into a requirements brief — one question at a time | 1 |
|  | [frappe-spec-driven-development](frappe-spec-driven-development/SKILL.md) | SPEC.md before code: DocTypes, roles, workflows, APIs, test plan | 0 |
|  | [frappe-constraint-driven-development](frappe-constraint-driven-development/SKILL.md) | CONSTRAINTS.md quality bar and definition of done, enforced per change | 1 |
| **Plan** | [frappe-project-triage](frappe-project-triage/SKILL.md) | Project type, versions, installed apps, v15↔v16 deltas | 3 |
|  | [frappe-plan-review](frappe-plan-review/SKILL.md) | Pre-build plan review: stock ERPNext first, architecture, upgrade risk, API DX | 1 |
|  | [frappe-design-consultation](frappe-design-consultation/SKILL.md) | Brand direction for website/portal themes, print and email branding, SPA theme overrides; DESIGN.md hand-off | 1 |
|  | [frappe-design-mockup-review](frappe-design-mockup-review/SKILL.md) | Token-faithful HTML mockups, scored design rubric, hand-off spec before Vue code | 2 |
|  | [frappe-planning-and-task-breakdown](frappe-planning-and-task-breakdown/SKILL.md) | Approved spec → small ordered tasks with acceptance criteria | 0 |
|  | [frappe-context-engineering](frappe-context-engineering/SKILL.md) | Bench AGENTS.md/CLAUDE.md, skill selection, context hygiene | 0 |
|  | [frappe-deep-research](frappe-deep-research/SKILL.md) | "How does Frappe do X" against installed source; pattern log | 4 |
| **Build** | [frappe-incremental-implementation](frappe-incremental-implementation/SKILL.md) | Thin vertical slices: test → implement → migrate → verify → commit | 1 |
|  | [frappe-doubt-driven-development](frappe-doubt-driven-development/SKILL.md) | Fresh-context adversarial review of risky decisions (permissions, patches, ledgers) | 1 |
|  | [frappe-app-development](frappe-app-development/SKILL.md) | App scaffolding, `hooks.py`, fixtures, jobs, cache, realtime, i18n | 9 |
|  | [frappe-doctype-development](frappe-doctype-development/SKILL.md) | DocTypes, field types, child tables, naming, controllers, permissions, workflows | 12 |
|  | [frappe-api-development](frappe-api-development/SKILL.md) | Whitelisted APIs, REST, webhooks, OAuth, rate limiting, ORM, contract design | 13 |
|  | [frappe-desk-customization](frappe-desk-customization/SKILL.md) | Form scripts, list views, workspaces, desk interactions | 4 |
|  | [frappe-frontend-development](frappe-frontend-development/SKILL.md) | frappe-ui Vue SPAs, portal pages, SPA architecture | 16 |
|  | [frappe-ui-patterns](frappe-ui-patterns/SKILL.md) | App shells and UX patterns from CRM/Helpdesk/HRMS, mobile, accessibility | 3 |
|  | [frappe-design-tokens](frappe-design-tokens/SKILL.md) | Espresso design system, color/type/spacing tokens | 4 |
|  | [frappe-printing-templates](frappe-printing-templates/SKILL.md) | Print formats, email templates, Jinja, PDFs | 1 |
|  | [frappe-reports](frappe-reports/SKILL.md) | Report Builder, Query/Script reports, charts, Insights | 2 |
|  | [frappe-web-forms](frappe-web-forms/SKILL.md) | Public data collection without a frontend | 1 |
|  | [frappe-erpnext-hrms](frappe-erpnext-hrms/SKILL.md) | Sales, purchase, stock, accounting, payroll, leave | 10 |
|  | [frappe-crm-app](frappe-crm-app/SKILL.md) | Frappe CRM: Lead/Deal pipeline, org-hierarchy permissions, SLAs, telephony/WhatsApp | 5 |
|  | [frappe-data-import](frappe-data-import/SKILL.md) | Raw Excel → Data Import CSV/XLSX and bulk load | 2 |
|  | [frappe-enterprise-patterns](frappe-enterprise-patterns/SKILL.md) | CRM/Helpdesk-scale architecture, service layers, SLAs | 2 |
| **Verify** | [frappe-testing](frappe-testing/SKILL.md) | Unit tests, factories, TDD workflow, Cypress | 5 |
|  | [frappe-browser-testing](frappe-browser-testing/SKILL.md) | Prove Desk/portal/SPA behaviour in a real browser | 1 |
|  | [frappe-debugging-and-error-recovery](frappe-debugging-and-error-recovery/SKILL.md) | Stop-the-line triage: reproduce, localize, fix root cause, guard | 1 |
|  | [frappe-bench-operations](frappe-bench-operations/SKILL.md) | Bench CLI, site management, broken-bench recovery | 2 |
|  | [frappe-manager](frappe-manager/SKILL.md) | Docker dev environments with `fm` | 5 |
| **Review** | [frappe-code-review](frappe-code-review/SKILL.md) | Five-axis per-change review with Frappe checklist | 1 |
|  | [frappe-devex-review](frappe-devex-review/SKILL.md) | Live integrator-experience audit of a built API or app onboarding: curl evidence, time-to-first-success, DX scorecard | 1 |
|  | [frappe-design-review](frappe-design-review/SKILL.md) | Post-build UI QA: design lint, viewport/theme/state matrix, iOS PWA, scored findings | 1 |
|  | [frappe-code-simplification](frappe-code-simplification/SKILL.md) | Behaviour-preserving simplification; advisory ignore markers | 0 |
|  | [frappe-security-hardening](frappe-security-hardening/SKILL.md) | Permissions, `allow_guest`, injection, XSS, CSRF, secrets, file privacy | 1 |
|  | [frappe-performance-optimization](frappe-performance-optimization/SKILL.md) | Measure-first: query count, N+1, indexes, cache, jobs, bundles | 1 |
|  | [frappe-app-audit](frappe-app-audit/SKILL.md) | Whole-app standards and security audit | 2 |
| **Ship** | [frappe-git-workflow-and-versioning](frappe-git-workflow-and-versioning/SKILL.md) | Trunk-based branches, atomic commits, semver, release branches | 0 |
|  | [frappe-ci-cd-automation](frappe-ci-cd-automation/SKILL.md) | GitHub Actions quality gates for Frappe apps | 0 |
|  | [frappe-deprecation-and-migration](frappe-deprecation-and-migration/SKILL.md) | Patches, `patches.txt` phases, deprecations, data migration | 1 |
|  | [frappe-documentation-and-adrs](frappe-documentation-and-adrs/SKILL.md) | ADRs, app README, changelog, in-product docs | 0 |
|  | [frappe-observability](frappe-observability/SKILL.md) | Logs, Error Log, Sentry, monitoring, alerts, runbooks | 1 |
|  | [frappe-shipping-and-launch](frappe-shipping-and-launch/SKILL.md) | Go/no-go checklist, backup, rollback, staged rollout | 1 |

**Commands** (`commands/`): `/frappe-spec` · `/frappe-plan` · `/frappe-plan-review` · `/frappe-build` (`auto` for unattended slices) · `/frappe-test` · `/frappe-constraints` · `/frappe-review` · `/frappe-simplify` · `/frappe-perf` · `/frappe-ship`, plus `/frappe` (router).

**Agents** (`omp/agents/`): `frappe-dev`, `frappe-reviewer`, `frappe-security-auditor`, `frappe-test-engineer`, `frappe-performance-auditor`, `frappe-migration-auditor`, `frappe-api-contract-auditor`, `frappe-scout`. See [docs/agents.md](docs/agents.md).

**Safety hook** (optional): `scripts/bench-guard.sh` plus an omp adapter blocks `bench drop-site`, core-app edits and similar. Advisory only; setup in [docs/bench-guard.md](docs/bench-guard.md).

**Provenance**: plan-review, design-review, QA/ship and guard ideas are adapted from gstack (MIT). Per-skill verdicts, including what was skipped and why: [docs/gstack-adoption.md](docs/gstack-adoption.md).

Guard rules, the refutation pass and the status-protocol fields are adapted from ruflo (MIT): [docs/ruflo-adoption.md](docs/ruflo-adoption.md).

## Installation

```bash
git clone git@github.com:Coale-Tech/frappeskills.git ~/.claude/skills-src/frappeskills
~/.claude/skills-src/frappeskills/install.sh
```

`install.sh` symlinks every `frappe-*` skill into each skill root that exists:
`~/.claude/skills` (Claude Code), `~/.agents/skills` (Codex and other
`.agents`-aware runtimes) and `~/.omp/agent/skills` (omp).
Edit in the clone, commit from there — the symlinks mean exactly one copy exists
on disk.

It also links the lifecycle commands from `commands/` into `~/.claude/commands`
and `~/.omp/agent/commands`, and for omp the `/frappe` command and the
`frappe-*` agents from `omp/` into `~/.omp/agent/`. `frappe-dev` preloads the 25
core skills; the rest load on demand through `frappe-router`.

**Plugin install** (manifests: `.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/`, `plugin.json`):
`/plugin marketplace add Coale-Tech/frappeskills` then `/plugin install frappeskills@coale-frappeskills` in Claude Code.

For any other agent runtime, point its skill root at this directory or copy the
skill folders into it. Adoption walkthrough: [docs/adoption-guide.md](docs/adoption-guide.md).

**Context cost:** 45 descriptions are always in context. Prune with your host's ignore list
(omp: `skills.ignoredSkills`) and keep `frappe-router` plus the phases you use.

## How it works

1. **Route** — `frappe-router` maps the task to one skill (and names the
   combinations complex work needs).
2. **Trigger** — each skill's `description` frontmatter matches the request
   directly, so an agent can also enter without the router.
3. **Load on demand** — a skill's `SKILL.md` is ~100–200 lines; its
   `references/` are read only when that step needs them.
4. **Verify** — every skill ends its procedure in migrate + clear-cache +
   exercising the real path, with a Verification checklist and a Failure-modes
   table.

## Skill structure

Every skill follows the same eleven sections (full anatomy: [docs/skill-anatomy.md](docs/skill-anatomy.md)):

```
<skill>/
  SKILL.md        When to use · Inputs required · Procedure ·
                  Verification · Failure modes / debugging · Escalation ·
                  References · Guardrails · Common Rationalizations ·
                  Red Flags · Common Mistakes
  references/     topic files owned by this skill, loaded on demand
  assets/         templates for this skill's work (where applicable)
  scripts/        executable checks (where applicable)
```

Assets ship where they are used: DocType and controller templates in
`frappe-doctype-development/assets`, the Vue templates and Tailwind preset in
`frappe-frontend-development/assets`, the runnable `mini-app/` skeleton in
`frappe-app-development/assets`, and `validate-compatibility.py` in
`frappe-project-triage/scripts`.

## Compatibility

| Version set | Status |
|---|---|
| frappe 16.35.0 / erpnext 16.6.1 / hrms 16.4.1 | Baseline — all v16 skills fully source-verified |
| frappe 16.51.1 / erpnext 16.50.0 / hrms 16.50.0 | Delta pass — breaking changes tagged `(16.51)` |
| frappe v15 | Notes throughout; dedicated v15/v16 delta in compatibility reference |

Skills and references use two version tags:
- **`(16.51)`** — behaviour verified present in 16.51.1 and absent in 16.35.0.
- **`(<=16.35)`** — the old form, tagged when both versions are in production and the difference matters.

Both versions are in use; old guidance is not deleted without a `(<=16.35)` tag unless
it is simply wrong on both versions. The v15/v16 and 16.51 deltas live in
[v15-v16-compatibility.md](frappe-project-triage/references/v15-v16-compatibility.md).

Verify the versions on any bench rather than trusting this table:

```bash
grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py
```

## Portability

The repo is machine-agnostic on purpose: no absolute paths, no bench topology,
no client app names, no host-specific tooling. A host that wants local
conventions — bench cluster layout, delegation policy, process management,
code-search tooling — puts them in its own agent context file (`AGENTS.md` /
`CLAUDE.md`) or an appended system prompt, which wins over a skill's Guardrails.

## Authoring guidelines

- **One skill per kind of work.** New topics become a reference inside the
  owning skill, or a new skill with its own references — never a second skill
  covering the same work.
- **Keep `SKILL.md` lean** (~100–200 lines) and in the eleven-section order. Depth
  belongs in `references/`.
- **Every deep reference ends with `## Sources`** citing installed framework
  files.
- **Adopted third-party material carries inline provenance** naming its source
  file.
- **Cross-skill links are relative**: `../frappe-x/SKILL.md`,
  `../frappe-x/references/y.md`.
- New discoveries go into
  [learned-patterns.md](frappe-deep-research/references/learned-patterns.md) or
  [learned-patterns-ops.md](frappe-deep-research/references/learned-patterns-ops.md)
  (by category, see `frappe-deep-research`), and get promoted into the owning
  skill's reference once confirmed.
- **A new skill directory needs `./install.sh` re-run.** Symlinking is not
  automatic — the script only links what exists in each root at run time, so
  a freshly added `frappe-*/` is invisible to every agent until it runs again.

## Validation

```bash
node scripts/selftest.js            # linter self-check
node scripts/validate-skills.js     # frontmatter, 11 sections, budgets, ## Sources
node scripts/validate-reference-links.js
node scripts/validate-commands.js
node scripts/validate-versions.js   # plugin manifests agree
node scripts/run-evals.js           # Tier 2 trigger/routing evals over evals/cases/
```

CI runs the same in `.github/workflows/validate.yml`. Eval format: [evals/README.md](evals/README.md). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

- Structure, SKILL.md section format, router pattern, and a large share of the
  procedures and references are adopted from
  [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) —
  full licence text in `LICENSES/frappe-skills-lubusIN-MIT.txt`.
- Lifecycle skills, anti-rationalization pattern, commands, personas, validator and eval design are
  adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT) —
  licence in `LICENSES/agent-skills-addyosmani-MIT.txt`.
- Earlier routing material derives from
  [frappe/skills](https://github.com/frappe/skills) (Frappe Technologies).
- Everything else is source-verified against installed Frappe / ERPNext / HRMS v16.

See [`NOTICE`](NOTICE) for full attribution.

## License

Private repository. Third-party material retains its original licence; see
`LICENSES/` and `NOTICE`.
