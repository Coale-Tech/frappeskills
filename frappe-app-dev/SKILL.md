---
name: frappe-app-dev
description: >-
  Builds, reviews and operates full-stack Frappe Framework / ERPNext
  applications end-to-end. Use this skill any time the user mentions: creating
  or modifying a DocType, writing a controller or lifecycle hook, adding a
  whitelisted API, setting up a new Frappe app or bench site, building a desk
  form, list view, workspace or portal page, building a frappe-ui Vue SPA,
  applying Espresso design tokens, writing custom-field fixtures, writing
  background jobs or scheduled tasks, managing permissions or roles, writing
  Frappe tests, auditing an app against framework standards, or working with
  frappe.db / frappe.qb. Also covers ERPNext/HRMS workflows (sales, purchase,
  stock, accounting, payroll, leave), v15 to v16 migration, and "how does
  Frappe do X" deep research. Triggers on
  phrases like "how do I hook into save", "add a field to a DocType", "create a
  REST endpoint in Frappe", "run bench migrate", "install an app on a site",
  "why is my job failing", or "audit this app" — even without the word Frappe.
---

# Frappe Full-Stack App Builder

Single skill for Frappe/ERPNext custom-app work: **build**, **research**, and
**operate**. Target is **v16** (frappe 16.27.x, erpnext 16.6.x, hrms 16.4.x)
with v15 compatibility notes throughout.

Reference files are source-verified against installed framework source — each
deep reference ends with a `## Sources` section citing the files it was checked
against. **Installed source always outranks this skill**; if a reference
disagrees with `apps/frappe`, `apps/erpnext` or `apps/hrms` on disk, the source
wins and the reference is a bug worth fixing.

## Global Rules

- Use bare `bench`. Not `./env/bin/bench`. Not a full path.
- Do not run `which bench`, `bench --version`, or `bench --help`. Read the
  installed version from source instead:
  `grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py`.
- Always pass `--site <site>` explicitly. Never run bare `bench migrate`.
- Never edit core apps. Extend via Custom Fields + `doc_events` + overrides.
  Custom fields ship as fixtures, never as manual DB edits.
- Do not create DocType folders with `mkdir`. Frappe creates them on
  `bench migrate`.
- Run `bench start` in a background process, and check whether one is already
  running before starting a second.
- After any DocType or `hooks.py` change: `bench --site <site> migrate` then
  `bench --site <site> clear-cache`.
- Security is not optional: explicit `frappe.has_permission(..., throw=True)` on
  state-changing whitelisted code, parameterized SQL only, `_()` on every
  user-facing string. See [semgrep-rules.md](./references/semgrep-rules.md).

> **Host overrides.** A workstation may append its own directives (bench
> topology, delegation policy, process management). Where a host directive and
> a Global Rule above disagree, the host directive wins — it knows the machine.

## Modes

- **Build** (default) — create or modify DocTypes, APIs, fixtures, workspaces
  and frontends. Follow the Backend-First Workflow below.
- **Deep Research** — understand / trace / compare / verify how Frappe works,
  with citations. Triggers: "how does frappe", "trace", "find everything
  about", "compare", "is it possible". Run
  [deep-research.md](./references/deep-research.md). Precedence on conflict:
  **installed source > official docs > web**.
- **Operate** — bench and site operations, migrations, diagnosing a broken
  bench. See [bench.md](./references/bench.md) and
  [bench-troubleshooting.md](./references/bench-troubleshooting.md).
- **Audit** — assess a whole app against framework standards. See
  [app-audit.md](./references/app-audit.md).

## Flow Selection

Read **only** what the current task needs.

| Starting point | Read first |
| --- | --- |
| Brand new app | [new-app.md](./references/new-app.md) |
| Existing app | [existing-app.md](./references/existing-app.md) |
| Any Frappe task | [learned-patterns.md](./references/learned-patterns.md) — scan for prior discoveries before starting |

## Reference Map

### Backend

| Topic | File |
| --- | --- |
| DocTypes — fields, naming, child tables, Singles, layout | [doctypes.md](./references/doctypes.md) |
| Controllers — document lifecycle, valid hooks, flags | [controllers.md](./references/controllers.md) |
| Whitelisted APIs — `@frappe.whitelist()`, input/type validation | [api.md](./references/api.md) |
| Database & ORM — `frappe.db`, `frappe.qb`, transactions, performance | [database.md](./references/database.md) |
| `hooks.py` — every key, `doc_events`, overrides | [hooks.md](./references/hooks.md) |
| Permissions — roles, permlevel, `has_permission` | [permissions.md](./references/permissions.md) |
| Authentication & sessions | [authentication.md](./references/authentication.md) |
| Background jobs & scheduler | [background-jobs.md](./references/background-jobs.md) |
| Caching — `frappe.cache`, decorators | [caching.md](./references/caching.md) |
| Realtime — `publish_realtime`, socket.io | [realtime.md](./references/realtime.md) |
| Fixtures — custom fields, property setters, export/import | [fixtures.md](./references/fixtures.md) |
| Testing | [testing.md](./references/testing.md) |
| Security rule catalog (semgrep) | [semgrep-rules.md](./references/semgrep-rules.md) |

### Frontend

| Topic | File |
| --- | --- |
| DocType → API → frontend, end to end | [integration-quickstart.md](./references/integration-quickstart.md) |
| Desk UI — forms, client scripts | [frontend-desk.md](./references/frontend-desk.md) |
| Desk interaction patterns — grids, datatables, keyboard | [desk-ui-interactions.md](./references/desk-ui-interactions.md) |
| List views | [listview-patterns.md](./references/listview-patterns.md) |
| Workspaces (v16) and desk pages (v15) | [workspace-patterns.md](./references/workspace-patterns.md) |
| Portal / website pages | [frontend-portal.md](./references/frontend-portal.md) |
| Vue SPA — entry point, build wiring, when to choose it | [frontend-vue.md](./references/frontend-vue.md) |
| SPA blueprint — stores, data layer, router, sockets, TS | [frontend-architecture.md](./references/frontend-architecture.md) |
| frappe-ui component & data-layer catalog | [frappe-ui-components.md](./references/frappe-ui-components.md) |
| Page layouts | [page-patterns.md](./references/page-patterns.md) |
| Espresso design system | [espresso-design-system.md](./references/espresso-design-system.md) |
| Design tokens — color, type, spacing, shadow | [design-tokens.md](./references/design-tokens.md) |
| Charts, dashboards, Insights | [data-visualization.md](./references/data-visualization.md) |

### Domain & operations

| Topic | File |
| --- | --- |
| ERPNext — sales, purchase, stock, accounting, manufacturing | [erpnext-workflows.md](./references/erpnext-workflows.md) |
| HRMS — employee, leave, attendance, payroll, recruitment | [hrms-patterns.md](./references/hrms-patterns.md) |
| Bench CLI & site management | [bench.md](./references/bench.md) |
| Broken bench — stale workers, stuck locks | [bench-troubleshooting.md](./references/bench-troubleshooting.md) |
| Whole-app standards audit | [app-audit.md](./references/app-audit.md) |
| v15 ↔ v16 deltas | [v15-v16-compatibility.md](./references/v15-v16-compatibility.md) |
| Deep research pipeline | [deep-research.md](./references/deep-research.md) |
| Discovered patterns log | [learned-patterns.md](./references/learned-patterns.md) |

Templates live in `templates/backend/` and `templates/frontend/`.
`scripts/validate-compatibility.py` checks an app for v15/v16 hazards.

## Backend-First Workflow

0. **Scan learnings** — read `learned-patterns.md`; if a pattern applies,
   increment its `Uses` counter and say which pattern you applied.
1. **DocType** — JSON structure, controller, permissions.
2. **Business logic** — controller methods and `doc_events`.
3. **API** — `@frappe.whitelist()` endpoints returning plain dicts.
4. **Frontend** — Desk customization, or a frappe-ui Vue page.
5. **Workspace** — v16 workspace or v15 desk page.
6. **Migrate & verify** — `bench --site <site> migrate && clear-cache`, then
   exercise the actual path.

## Decision Frameworks

### DocType vs Custom Field

| Scenario | Approach |
| --- | --- |
| New business entity | New DocType |
| Extending a standard entity | Custom Field via fixtures |
| One-to-many child data | Child Table DocType |
| Many-to-many | Table MultiSelect |
| Transient/session data | `frappe.cache`, not a DocType |

### Customization approach

| Scenario | Approach | Reference |
| --- | --- | --- |
| Add field to existing DocType | Custom Field + fixtures | `fixtures.md` |
| Change a field property | Property Setter + fixtures | `fixtures.md` |
| Add server validation | `doc_events` in `hooks.py` | `hooks.md` |
| Add form behaviour | Client Script | `frontend-desk.md` |
| Replace controller logic | `override_doctype_class` | `hooks.md` |

### Naming strategy

| Goal | `autoname` | Example |
| --- | --- | --- |
| Human-readable | `field:name` | `CUST-John Smith` |
| Sequential | `naming_series` | `INV-2026-00001` |
| Opaque unique | `hash` | `a1b2c3d4e5` |
| Compound | `format_string` | `{customer}-{date}` |
| User-entered | `prompt` | — |

### Frontend choice

| Scenario | Choice |
| --- | --- |
| Simple CRUD | Standard Desk — write no frontend |
| Custom dashboard | Vue + frappe-ui |
| Customer-facing portal | Vue + frappe-ui, or website pages |
| Complex multi-step workflow | Vue + frappe-ui + a store |
| Mobile | Vue + frappe-ui, responsive |

### Visualization

| Scenario | Choice |
| --- | --- |
| Embedded chart in Desk | Frappe Charts |
| Live-updating chart | Frappe Charts + realtime |
| BI dashboard / ad-hoc exploration | Frappe Insights |

## Checklists

**DocType** — naming strategy set · field layout planned (section/column
breaks) · `in_list_view` / `in_standard_filter` chosen · permissions per role ·
controller hooks wired · `bench migrate` run.

**API** — `@frappe.whitelist()` · every input validated **including its type** ·
`frappe.has_permission(..., throw=True)` · returns a plain dict · errors via
`frappe.throw(_("…"))` · accepts `fields` rather than hardcoding them.

**Vue page** — data layer via `createResource` / `createListResource` ·
loading, error and empty states · design tokens, not hardcoded values ·
`bench build --app <app>`.

## Anti-Patterns

| Anti-pattern | Why | Instead |
| --- | --- | --- |
| Modifying core DocTypes | Breaks upgrades | Custom Fields + hooks |
| Skipping `bench migrate` | Schema drift | Always migrate after DocType changes |
| `frappe.db.sql(f"…")` | SQL injection (`frappe-sql-format-injection`) | `%s` params or `frappe.qb` |
| Ignoring `has_permission()` return | Silent security bypass (`unchecked-frappe-permission-call`) | `throw=True` |
| Trusting a whitelisted arg's type | Filter-list injection bypasses checks | `isinstance` at the boundary |
| `frappe.throw("text")` | No i18n (`frappe-missing-translate-function-python`) | `_("text")` |
| `def after_save(self)` | Not a real hook (`frappe-after-save-controller-hook`) | `after_insert` / `on_update` |
| `frappe.db.commit()` mid-transaction | Exposes partial state (`frappe-manual-commit`) | Let the request transaction commit |
| Module-level `frappe.get_all(...)` | Breaks multitenancy (`frappe-breaks-multitenancy`) | Call inside a function |
| `frappe.db.get_value(DT, None, …)` for a Single | Not type-safe (`frappe-single-value-type-safety`) | `frappe.db.get_single_value()` |
| `frappe.cache.flushall()` | Flushes every Redis DB (`frappe-redis-flush`) | `flushdb()` |
| Hardcoding company/warehouse | Breaks multi-tenant | Read from settings |
| Returning a `Response` object | Breaks `createResource` | Return a dict |
| Raw `fetch` in Vue | No error handling | `createResource` |
| Vue Options API | Inconsistent with ecosystem | Composition API, `<script setup>` |

## Self-Enhancement Protocol

Capture a pattern into [learned-patterns.md](./references/learned-patterns.md)
when, after debugging / implementing / exploring, the answer was non-obvious and
another agent would hit the same wall.

```
### [category] Short title
- **Discovered**: YYYY-MM-DD
- **Confidence**: low|medium|high
- **Uses**: 0
- **Flagged**:
- **Context**: what was being built or debugged
- **Pattern**: the finding
- **Evidence**: error message, source file, or test that confirmed it
```

Categories: Debugging · API & ORM · Frontend · Version Compatibility · Build &
Deployment. Confidence: `high` = confirmed by source or test, `medium` = worked
in practice, `low` = observed once.

**Promote** when `(confidence == high AND uses >= 2)` or the user confirms and
confidence is at least medium — move it into the matching reference
(`api.md`, `database.md`, `frappe-ui-components.md`, `v15-v16-compatibility.md`,
`bench.md`), search for similar content first, update in place if found, and
leave a `<!-- promoted from learned-patterns YYYY-MM-DD -->` marker.

**Prune** low-confidence entries older than 90 days with 0 uses by setting
`Flagged: YYYY-MM-DD`; surface them before deleting. If the file passes 400
lines at session start, surface prune/promote candidates first. Flag malformed
entries rather than skipping them silently.
