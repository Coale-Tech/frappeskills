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

One skill for Frappe/ERPNext custom-app work: **build**, **research**, and
**operate**. Target is **v16** (frappe 16.27.x, erpnext 16.6.x, hrms 16.4.x)
with v15 compatibility notes throughout.

Reference files are source-verified against installed framework source — each
deep reference ends with a `## Sources` section citing the files it was checked
against. **Installed source always outranks this skill**; if a reference
disagrees with `apps/frappe`, `apps/erpnext` or `apps/hrms` on disk, the source
wins and the reference is a bug worth fixing.

## When to use

- Creating or modifying a DocType, controller, child table, or naming series
- Writing whitelisted APIs, REST/RPC endpoints, webhooks, or integrations
- Customizing Desk — client scripts, list views, workspaces, dialogs
- Building a frappe-ui Vue SPA, portal page, web form, print format, or report
- Writing background jobs, scheduled tasks, or queue/SLA/workflow logic
- Managing permissions, roles, user permissions, or authentication
- Bench and site operations, migrations, or diagnosing a broken bench
- Auditing an existing app against framework standards
- Answering "how does Frappe actually do X" with source citations

## Inputs required

- **Bench + site**: which bench, which site (`--site` is never optional)
- **App**: target app name and module path; whether it exists or must be created
- **Version**: frappe/erpnext/hrms versions, read from source, not memory
- **Installed apps**: is ERPNext present at all? which domain apps?
- **Scope**: the DocTypes, endpoints, or screens in play, and the roles that use
  them
- **Frontend target**: Desk, portal, or standalone Vue SPA

## Procedure

### 0) Triage and route

On an unfamiliar project, run [project-triage.md](./references/project-triage.md)
first — version, installed apps, bench vs. Frappe Manager, existing tooling.
Version dictates API availability (v13 → v16 differ substantially).

Then pick the mode:

| Mode | Trigger | Entry point |
| --- | --- | --- |
| **Build** (default) | create/modify DocTypes, APIs, fixtures, workspaces, frontends | continue with step 1 |
| **Deep Research** | "how does frappe", "trace", "find everything about", "compare", "is it possible" | [deep-research.md](./references/deep-research.md) — precedence: **installed source > official docs > web** |
| **Operate** | bench/site ops, migrations, broken bench | [bench.md](./references/bench.md) · [bench-troubleshooting.md](./references/bench-troubleshooting.md) |
| **Audit** | assess a whole app against standards | [app-audit.md](./references/app-audit.md) |

And the starting point:

| Starting point | Read first |
| --- | --- |
| Brand new app | [new-app.md](./references/new-app.md) |
| Existing app | [existing-app.md](./references/existing-app.md) |
| Any Frappe task | [learned-patterns.md](./references/learned-patterns.md) — scan for prior discoveries before starting |

Task → reference routing lives in [References](#references). Read **only** what
the current task needs.

### 1) Scan learnings

Read `learned-patterns.md`. If a pattern applies, increment its `Uses` counter
and say which pattern you applied.

### 2) DocType

JSON structure, field types, naming strategy, permissions. Decide DocType vs.
Custom Field with the [Decision Frameworks](#decision-frameworks) below.

```bash
bench --site <site> console
>>> frappe.conf.developer_mode   # must be True before schema work
```

References: [doctypes.md](./references/doctypes.md) ·
[field-types.md](./references/field-types.md) ·
[child-tables.md](./references/child-tables.md) ·
[naming.md](./references/naming.md) ·
[virtual-doctypes.md](./references/virtual-doctypes.md)

### 3) Business logic

Controller methods and `doc_events`. Respect the lifecycle order
(validate → before_save → DB write → after_insert → on_update). Never invent a
hook name — `after_save` is not one.

References: [controllers.md](./references/controllers.md) ·
[hooks.md](./references/hooks.md) ·
[background-jobs.md](./references/background-jobs.md) ·
[workflow-patterns.md](./references/workflow-patterns.md)

### 4) API

`@frappe.whitelist()` endpoints returning plain dicts. Validate every input
**including its type**, then `frappe.has_permission(..., throw=True)`.

References: [api.md](./references/api.md) ·
[database.md](./references/database.md) ·
[permissions.md](./references/permissions.md) ·
[rest-api.md](./references/rest-api.md) ·
[webhooks.md](./references/webhooks.md) ·
[oauth.md](./references/oauth.md) ·
[rate-limiting.md](./references/rate-limiting.md)

### 5) Frontend

Desk customization, a portal page, or a frappe-ui Vue page — choose with the
[Decision Frameworks](#decision-frameworks). Consume Espresso design tokens;
never hardcode colors, spacing or fonts.

References: [frontend-desk.md](./references/frontend-desk.md) ·
[frontend-vue.md](./references/frontend-vue.md) ·
[frappe-ui-components.md](./references/frappe-ui-components.md) ·
[design-tokens.md](./references/design-tokens.md) ·
[component-patterns.md](./references/component-patterns.md)

### 6) Navigation and output surfaces

Workspace (v16) or desk page (v15), plus whatever the feature actually ships:
list view, report, print format, web form, dashboard chart.

References: [workspace-patterns.md](./references/workspace-patterns.md) ·
[listview-patterns.md](./references/listview-patterns.md) ·
[reports.md](./references/reports.md) ·
[print-formats.md](./references/print-formats.md) ·
[web-forms.md](./references/web-forms.md) ·
[data-visualization.md](./references/data-visualization.md)

### 7) Migrate and verify

```bash
bench --site <site> migrate
bench --site <site> clear-cache
bench build --app <app>        # only when frontend assets changed
```

Then exercise the actual path — create a record, call the endpoint, load the
page. A green migrate is not verification.

## Verification

- [ ] `bench --site <site> migrate` succeeds and the DocType appears in the list
- [ ] Records create, save and load; every field persists
- [ ] Controller hooks fire in the expected order (log or breakpoint proves it)
- [ ] Naming series generates the intended names, uniquely
- [ ] Permissions enforced per role; a low-privilege user is actually blocked
- [ ] Every state-changing whitelisted method calls
      `frappe.has_permission(..., throw=True)`
- [ ] No string-interpolated SQL; `%s` params or `frappe.qb` only
- [ ] User-facing strings wrapped in `_()`
- [ ] Custom fields on standard DocTypes ship as fixtures, not manual edits
- [ ] Frontend: loading, error and empty states exist; tokens, not hardcoded
      values; `bench build --app <app>` run
- [ ] `scripts/validate-compatibility.py <app>` reports no errors
- [ ] Tests for the changed contract pass

## Failure modes / debugging

- **DocType changes don't export to files** — `developer_mode` is 0 in
  `site_config.json`. Set it, redo the change.
- **DocType/field missing after migrate** — wrong module path, app not installed
  on that site, or the JSON never got written. Check
  `bench --site <site> list-apps`.
- **Controller methods never fire** — class name must be the PascalCase of the
  DocType name (`SalesOrder` for "Sales Order"); the file must sit beside the
  JSON.
- **`after_save` never runs** — it is not a hook. Use `after_insert` or
  `on_update`. See [controllers.md](./references/controllers.md).
- **Whitelisted method returns 403 for a legitimate user** — role permission vs.
  user permission confusion; check
  [advanced-permissions.md](./references/advanced-permissions.md).
- **Whitelisted method works for everyone** — it has no permission gate at all;
  `@frappe.whitelist()` does not inherit DocType permissions.
- **Fixture custom fields don't appear** — the field isn't matched by the
  `fixtures` filter in `hooks.py`, or migrate wasn't re-run. See
  [fixtures.md](./references/fixtures.md).
- **Background job never runs** — scheduler disabled, no worker for that queue,
  or the job is stuck. See
  [bench-troubleshooting.md](./references/bench-troubleshooting.md) and
  [queue-patterns.md](./references/queue-patterns.md).
- **`migrate` hangs or raises `DocumentLockedError`** — stale RQ workers or a
  stale document lock. See
  [bench-troubleshooting.md](./references/bench-troubleshooting.md).
- **Frontend changes don't show** — assets not rebuilt or cache not cleared:
  `bench build --app <app>` then `bench --site <site> clear-cache`; hard-reload.
- **`ModuleNotFoundError: erpnext`** — the site runs Frappe Framework without
  ERPNext. Check installed apps before importing it.

## Escalation

- Conflict between this skill and installed source → **source wins**; fix the
  reference and note it in [learned-patterns.md](./references/learned-patterns.md).
- Behaviour you cannot explain from the references → run **Deep Research**
  ([deep-research.md](./references/deep-research.md)) against installed source.
- Whole-app quality question rather than one change → run the
  **Audit** playbook ([app-audit.md](./references/app-audit.md)).
- Security-sensitive code → check it against
  [semgrep-rules.md](./references/semgrep-rules.md) before shipping.
- Architecture at CRM/Helpdesk scale → [enterprise-patterns.md](./references/enterprise-patterns.md).
- Environment is Docker-based rather than a classic bench →
  [frappe-manager.md](./references/frappe-manager.md).
- Still ambiguous after the above → ask the user; do not guess at schema,
  permissions, or money-handling behaviour.

## References

### Backend

| Topic | File |
| --- | --- |
| DocTypes — fields, naming, child tables, Singles, layout | [doctypes.md](./references/doctypes.md) |
| DocType field types — every fieldtype, options, gotchas | [field-types.md](./references/field-types.md) |
| Child tables — grids, parent/parentfield, reordering | [child-tables.md](./references/child-tables.md) |
| Naming — `autoname`, series, hash, prompt, renaming | [naming.md](./references/naming.md) |
| Virtual DocTypes — external data sources | [virtual-doctypes.md](./references/virtual-doctypes.md) |
| Controllers — document lifecycle, valid hooks, flags | [controllers.md](./references/controllers.md) |
| Whitelisted APIs — `@frappe.whitelist()`, input/type validation | [api.md](./references/api.md) |
| REST resource API + Python client | [rest-api.md](./references/rest-api.md) |
| Webhooks | [webhooks.md](./references/webhooks.md) |
| OAuth 2.0, social login, token flows | [oauth.md](./references/oauth.md) |
| API rate limiting | [rate-limiting.md](./references/rate-limiting.md) |
| Server Scripts (no-code server logic) | [server-scripts.md](./references/server-scripts.md) |
| Database & ORM — `frappe.db`, `frappe.qb`, transactions, performance | [database.md](./references/database.md) |
| `hooks.py` — every key, `doc_events`, overrides | [hooks.md](./references/hooks.md) |
| Permissions — roles, permlevel, `has_permission` | [permissions.md](./references/permissions.md) |
| Authentication & sessions | [authentication.md](./references/authentication.md) |
| Background jobs & scheduler | [background-jobs.md](./references/background-jobs.md) |
| Caching — `frappe.cache`, decorators | [caching.md](./references/caching.md) |
| Realtime — `publish_realtime`, socket.io | [realtime.md](./references/realtime.md) |
| Fixtures — custom fields, property setters, export/import | [fixtures.md](./references/fixtures.md) |
| Translations / i18n | [translations.md](./references/translations.md) |
| Testing | [testing.md](./references/testing.md) |
| Test patterns, factories, CI, Cypress | [test-patterns.md](./references/test-patterns.md) · [ci-testing.md](./references/ci-testing.md) · [cypress.md](./references/cypress.md) |
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
| Web forms — public data collection | [web-forms.md](./references/web-forms.md) |
| Vue SPA — entry point, build wiring, when to choose it | [frontend-vue.md](./references/frontend-vue.md) |
| SPA blueprint — stores, data layer, router, sockets, TS | [frontend-architecture.md](./references/frontend-architecture.md) |
| frappe-ui component & data-layer catalog | [frappe-ui-components.md](./references/frappe-ui-components.md) |
| Page layouts | [page-patterns.md](./references/page-patterns.md) |
| App shell — sidebar, nav, layout skeleton | [app-shell-patterns.md](./references/app-shell-patterns.md) |
| Component patterns — lists, forms, dialogs, empty states | [component-patterns.md](./references/component-patterns.md) |
| Mobile / responsive patterns | [mobile-patterns.md](./references/mobile-patterns.md) |
| UI patterns from CRM / Helpdesk / HRMS | [ui-patterns.md](./references/ui-patterns.md) |
| Espresso design system | [espresso-design-system.md](./references/espresso-design-system.md) |
| Design tokens — color, type, spacing, shadow | [design-tokens.md](./references/design-tokens.md) |
| Print formats, email templates, Jinja, PDFs | [print-formats.md](./references/print-formats.md) |
| Reports — Builder, Query (SQL), Script (Python+JS) | [reports.md](./references/reports.md) |
| Charts, dashboards, Insights | [data-visualization.md](./references/data-visualization.md) |

### Domain, patterns & operations

| Topic | File |
| --- | --- |
| ERPNext — sales, purchase, stock, accounting, manufacturing | [erpnext-workflows.md](./references/erpnext-workflows.md) |
| HRMS — employee, leave, attendance, payroll, recruitment | [hrms-patterns.md](./references/hrms-patterns.md) |
| Enterprise apps — CRM/Helpdesk-scale architecture | [enterprise-patterns.md](./references/enterprise-patterns.md) |
| Workflows — states, transitions, actions | [workflow-patterns.md](./references/workflow-patterns.md) |
| SLA — targets, pause/resume, breach | [sla-patterns.md](./references/sla-patterns.md) |
| Queue patterns — long jobs, retries, idempotency | [queue-patterns.md](./references/queue-patterns.md) |
| Integration patterns — third-party sync, connectors | [integration-patterns.md](./references/integration-patterns.md) |
| Advanced permissions — user permissions, share, permission queries | [advanced-permissions.md](./references/advanced-permissions.md) |
| Project triage — version, apps, tooling | [project-triage.md](./references/project-triage.md) |
| Bench CLI & site management | [bench.md](./references/bench.md) |
| Frappe Manager — Docker dev environments (`fm`) | [frappe-manager.md](./references/frappe-manager.md) |
| Broken bench — stale workers, stuck locks | [bench-troubleshooting.md](./references/bench-troubleshooting.md) |
| Whole-app standards audit | [app-audit.md](./references/app-audit.md) |
| v15 ↔ v16 deltas | [v15-v16-compatibility.md](./references/v15-v16-compatibility.md) |
| Deep research pipeline | [deep-research.md](./references/deep-research.md) |
| Discovered patterns log | [learned-patterns.md](./references/learned-patterns.md) |

Templates live in `templates/backend/`, `templates/frontend/` and
`templates/mini-app/` — a complete runnable app skeleton (DocTypes incl. child /
Single / submittable / tree, report, workflow, dashboard, background job,
connector, service and util layers). `scripts/validate-compatibility.py` checks
an app for v15/v16 hazards.

## Guardrails

- Use bare `bench`. Not `./env/bin/bench`. Not a full path.
- Do not run `which bench`, `bench --version`, or `bench --help`. Read the
  installed version from source instead:
  `grep __version__ apps/{frappe,erpnext,hrms}/*/__init__.py`.
- Always pass `--site <site>` explicitly. Never run bare `bench migrate`.
- Never edit core apps. Extend via Custom Fields + `doc_events` + overrides.
  Custom fields ship as fixtures, never as manual DB edits.
- Do not create DocType folders with `mkdir`. Frappe creates them on
  `bench migrate`.
- Check `developer_mode` before schema work — without it, DocType changes never
  reach the filesystem.
- Run `bench start` in a background process, and check whether one is already
  running before starting a second.
- After any DocType or `hooks.py` change: `bench --site <site> migrate` then
  `bench --site <site> clear-cache`.
- Security is not optional: explicit `frappe.has_permission(..., throw=True)` on
  state-changing whitelisted code, parameterized SQL only, `_()` on every
  user-facing string. See [semgrep-rules.md](./references/semgrep-rules.md).
- Never assume ERPNext is installed. Many sites run Frappe Framework alone —
  check the installed apps before importing `erpnext.*` or reusing its DocTypes.
- On an unfamiliar project, triage before changing code. Version dictates API
  availability.

> **Host overrides.** A workstation may append its own directives (bench
> topology, delegation policy, process management). Where a host directive and
> a guardrail above disagree, the host directive wins — it knows the machine.

## Common Mistakes

| Mistake | Why It Fails | Fix |
| --- | --- | --- |
| Modifying core DocTypes | Breaks upgrades | Custom Fields + hooks |
| Skipping `bench migrate` | Schema drift | Always migrate after DocType changes |
| Schema edits with `developer_mode = 0` | Changes never export to files | Enable it first |
| `frappe.db.sql(f"…")` | SQL injection (`frappe-sql-format-injection`) | `%s` params or `frappe.qb` |
| Ignoring `has_permission()` return | Silent security bypass (`unchecked-frappe-permission-call`) | `throw=True` |
| Trusting a whitelisted arg's type | Filter-list injection bypasses checks | `isinstance` at the boundary |
| `frappe.throw("text")` | No i18n (`frappe-missing-translate-function-python`) | `_("text")` |
| `def after_save(self)` | Not a real hook (`frappe-after-save-controller-hook`) | `after_insert` / `on_update` |
| Controller class name mismatch | Methods never called | PascalCase of the DocType name |
| `frappe.db.commit()` mid-transaction | Exposes partial state (`frappe-manual-commit`) | Let the request transaction commit |
| Module-level `frappe.get_all(...)` | Breaks multitenancy (`frappe-breaks-multitenancy`) | Call inside a function |
| `frappe.db.get_value(DT, None, …)` for a Single | Not type-safe (`frappe-single-value-type-safety`) | `frappe.db.get_single_value()` |
| `frappe.cache.flushall()` | Flushes every Redis DB (`frappe-redis-flush`) | `flushdb()` |
| Hardcoding company/warehouse | Breaks multi-tenant | Read from settings |
| Returning a `Response` object | Breaks `createResource` | Return a dict |
| Raw `fetch` in Vue | No error handling | `createResource` |
| Vue Options API | Inconsistent with ecosystem | Composition API, `<script setup>` |
| Skipping project triage | Wrong patterns for that version/app set | Triage first |
| ERPNext-specific code on a Frappe-only site | `ModuleNotFoundError` at import | Check installed apps |
| Vanilla JS / jQuery for a new frontend | Ecosystem mismatch | frappe-ui (Vue 3) |
| Hand-rolled app shell for CRUD | Inconsistent UX | Follow CRM/Helpdesk shells — [app-shell-patterns.md](./references/app-shell-patterns.md) |

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
