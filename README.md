<div align="center">
  <img src=".github/assets/logo.svg" width="96" alt="frappeskills" />

  <h1>frappeskills</h1>

  <p><b>One Agent Skill for full-stack Frappe Framework / ERPNext work — build, research, operate.</b></p>

  <p>
    <img src="https://img.shields.io/badge/frappe-v16-2490EF" alt="frappe v16" />
    <img src="https://img.shields.io/badge/skill-frappe--app--dev-1467B1" alt="skill" />
    <img src="https://img.shields.io/badge/references-64-555" alt="64 references" />
  </p>
</div>

## Why

Frappe work spans schema, controllers, permissions, jobs, Desk customization,
Vue SPAs, design tokens, bench operations and ERPNext domain logic. Split across
several skills, that guidance drifts: duplicated rules, conflicting versions,
and an agent that has to guess which skill owns the question.

This repo keeps **one** skill — `frappe-app-dev` — with a single routing spine
and on-demand references. Progressive disclosure does the job that skill
splitting was supposed to: `SKILL.md` is always loaded, everything else is read
only when the task needs it.

Every deep reference is source-verified against installed framework source and
ends with a `## Sources` section naming the files it was checked against.
**Installed source outranks this repo**; a reference that disagrees with
`apps/frappe` on disk is a bug.

## What's inside

| Area | Covers |
| --- | --- |
| **Backend** | DocTypes, field types, child tables, naming, virtual DocTypes, controllers, `hooks.py`, whitelisted APIs, REST/Python client, webhooks, OAuth, rate limiting, server scripts, `frappe.db` / `frappe.qb`, permissions, authentication, background jobs, caching, realtime, fixtures, translations, testing, semgrep rules |
| **Frontend** | Desk forms and client scripts, desk interaction patterns, list views, workspaces, portal pages, web forms, frappe-ui Vue SPAs, SPA architecture, component / page / app-shell / mobile patterns, Espresso design system and tokens, print formats, reports, charts and Insights |
| **Domain** | ERPNext (sales, purchase, stock, accounting, manufacturing), HRMS (leave, attendance, payroll, recruitment), enterprise CRM/Helpdesk-scale architecture, workflows, SLA, queues, integrations, advanced permissions |
| **Operations** | Project triage, bench CLI and site management, Frappe Manager (Docker), broken-bench recovery, whole-app standards audit, v15 ↔ v16 deltas, deep-research pipeline, learned-patterns log |

Plus `templates/` (backend, frontend, and a runnable `mini-app` skeleton) and
`scripts/validate-compatibility.py`.

## Installation

```bash
git clone git@github.com:Coale-Tech/frappeskills.git ~/.claude/skills-src/frappeskills
~/.claude/skills-src/frappeskills/install.sh
```

`install.sh` symlinks `frappe-app-dev/` into `~/.claude/skills/`, discovered by
both Claude Code and omp. Edit in the clone, commit from there — the symlink
means exactly one copy exists on disk.

For any other agent runtime, point its skill root at the same directory, or copy
`frappe-app-dev/` into it.

## How it works

1. **Trigger** — the `description` in the skill's YAML frontmatter matches the
   user's request (DocType, hook, whitelisted API, bench, workspace, audit…).
2. **Route** — `SKILL.md` triages mode (Build · Deep Research · Operate · Audit)
   and starting point (new app · existing app), then maps the task to references.
3. **Load on demand** — only the references the task needs are read.
4. **Verify** — every procedure ends in migrate + clear-cache + exercising the
   real path, with a checklist and a failure-mode table for when it goes wrong.

## Skill structure

```
frappe-app-dev/
  SKILL.md              When to use · Inputs required · Procedure ·
                        Verification · Failure modes · Escalation ·
                        References · Guardrails · Common Mistakes ·
                        Decision Frameworks · Self-Enhancement Protocol
  references/           64 topic files, loaded on demand
  templates/backend/    DocType, controller, api, hooks, fixtures, workspace
  templates/frontend/   App.vue, ListPage, DetailPage, FormWizard, page.js
  templates/mini-app/   runnable skeleton — doctypes (child / Single /
                        submittable / tree), report, workflow, dashboard,
                        background job, connector, service + util layers
  scripts/              validate-compatibility.py
```

## Compatibility

Target is **v16** — frappe 16.27.x, erpnext 16.6.x, hrms 16.4.x — with v15
notes throughout and a dedicated `references/v15-v16-compatibility.md`.

Verify the versions on any bench rather than trusting this line:

```bash
grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py
```

## Portability

The repo is machine-agnostic on purpose: no absolute paths, no bench topology,
no client app names, no host-specific tooling. A host that wants local
conventions — bench cluster layout, delegation policy, process management,
code-search tooling — puts them in its own agent context file (`AGENTS.md` /
`CLAUDE.md`) or an appended system prompt. `SKILL.md` states explicitly that
such host directives win over its guardrails.

## Authoring guidelines

- Keep it to **one skill**. New topics become a reference, not a sibling skill.
- Every deep reference ends with `## Sources` citing installed framework files.
- Adopted third-party material carries an inline provenance note naming its
  source file.
- New discoveries go into `references/learned-patterns.md` in the entry format
  defined in `SKILL.md`, and get promoted into the matching topic reference once
  confirmed (`confidence: high` and used twice, or user-confirmed).
- Run `scripts/validate-compatibility.py <app>` before claiming an app is clean.

## Credits

- Routing spine and the first terse references derive from
  [frappe/skills](https://github.com/frappe/skills) (Frappe Technologies).
- Fourteen skills' worth of procedures, references and the SKILL.md section
  format adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills),
  MIT — full licence text in `LICENSES/frappe-skills-lubusIN-MIT.txt`.
- Everything else is source-verified against installed Frappe / ERPNext / HRMS v16.

See [`NOTICE`](NOTICE) for full attribution.

## License

Private repository. Third-party material retains its original licence; see
`LICENSES/` and `NOTICE`.
