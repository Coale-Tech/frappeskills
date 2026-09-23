# frappeskills

One skill for Frappe Framework / ERPNext development: **`frappe-app-dev`**.

Merged on 2026-09-23 from four skills that had drifted apart —
`frappe-app-dev` (terse upstream-derived guidance), `frappe-design-system`
(deep source-verified references, templates, Espresso tokens),
`frappe-app-parallel-audit`, and `frappe-bench-worker-hygiene` — plus two
redirect stubs (`frappe-dev`, `frappe-deep-research`) that were deleted.

Target is **v16** (frappe 16.27.x, erpnext 16.6.x, hrms 16.4.x) with v15
compatibility notes throughout.

## Layout

```
frappe-app-dev/
  SKILL.md              routing spine — global rules, modes, reference map,
                        decision frameworks, anti-patterns
  references/           36 topic files, loaded on demand
  templates/backend/    DocType, controller, api, hooks, fixtures, workspace
  templates/frontend/   App.vue, ListPage, DetailPage, FormWizard, page.js
  scripts/              validate-compatibility.py
```

Nothing outside `SKILL.md` is read unless a task needs it — the reference map
in `SKILL.md` is the index.

## Install

```bash
git clone git@github.com:Coale-Tech/frappeskills.git ~/.claude/skills-src/frappeskills
~/.claude/skills-src/frappeskills/install.sh
```

`install.sh` symlinks `frappe-app-dev/` into `~/.claude/skills/`, which both
Claude Code and omp discover. Edits are made in the clone and committed from
there; the symlink means there is exactly one copy on disk.

## Portability

This repo is machine-agnostic on purpose. It contains no absolute paths, no
bench topology, no client app names, and no host-specific tooling. A host that
wants to layer on local conventions — bench cluster layout, delegation policy,
process management, code-search tooling — does so in its own agent context file
(`AGENTS.md` / `CLAUDE.md`) or an appended system prompt. `SKILL.md` states
explicitly that such host directives win over its Global Rules.

## Maintenance

- **Installed source outranks this repo.** Every deep reference ends with a
  `## Sources` section naming the framework files it was verified against. If a
  reference disagrees with `apps/frappe` on disk, the source is right and the
  reference is a bug.
- New discoveries go into `references/learned-patterns.md` using the entry
  format in `SKILL.md`, and get promoted into the matching topic reference once
  confirmed (`confidence: high` and used twice, or user-confirmed).
- Version claims (`16.27.1` / `16.6.1` / `16.4.1`) are checked with
  `grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py`.
