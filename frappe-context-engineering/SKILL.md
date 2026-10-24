---
name: frappe-context-engineering
description: "Feeds a Frappe coding agent the right context for a bench: bench-scoped AGENTS.md or CLAUDE.md, rules files, skill selection via frappe-router, code search and MCP setup, context ordering, and context hygiene. Use when starting a new bench session, when agent output quality drops, or when setting up a new Frappe project for AI-assisted development."
---

# Frappe Context Engineering

Give the agent exactly the context it needs to work correctly on a Frappe bench — no more, no less.

## When to use

- Starting a new bench session or onboarding an agent to an unfamiliar bench
- Agent output quality is declining (wrong hooks, invented APIs, ignoring permission model, `frappe.db.sql` in code that should use `frappe.qb`)
- Setting up a new Frappe project for AI-assisted development
- Switching between apps or modules within a session

Not for diagnosing broken bench commands → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md).

## Inputs required

- Bench layout: installed apps, Frappe / ERPNext / HRMS versions
- Default site name and `developer_mode` status
- Available MCP servers or code-search tools
- Skills needed for the current task (routed via `frappe-router`)

## Procedure

### 0) Create or update the bench AGENTS.md / CLAUDE.md

Place at the bench root (the directory containing `apps/`, `sites/`, `Procfile`).
See `assets/bench-AGENTS.md` for a complete template.

Required sections:
- **Bench layout**: app names and versions (read from `apps/<app>/<app>/__init__.py`, never hardcoded)
- **Default site** and `developer_mode` value
- **Key commands**: the exact `bench --site <site> ...` invocations used on this bench, with `<site>` placeholder filled in
- **Skills**: instruct the agent to read `frappe-router` first and follow its routing to the relevant skill
- **Boundaries**: what the agent must ask a human before doing (schema changes, dropping data, enabling permissions)

### 1) Order context by persistence

```
← session start                                    generation point →
[bench AGENTS.md / CLAUDE.md]  [active spec / task card]  [current file, error]
       always loaded                 per feature               per iteration
```

Stable rules load first. Active task material and current error go **last** — models recall end-of-context more reliably than the middle.

### 2) Select skills via frappe-router

Load `frappe-router` at session start. It maps intent to skill and prevents loading irrelevant skills. In bench AGENTS.md:

```markdown
## Skills
Read frappe-router/SKILL.md first. It routes you to the correct skill for each task type.
Load only the skill relevant to the current task.
```

Per-task, load the one relevant skill (e.g. `frappe-doctype-development` for a schema task). Never load all skills at once — agent context budget is finite.

### 3) Configure the per-bench append system prompt

In Claude Code, the append-system-prompt (or equivalent config) injects bench AGENTS.md automatically without requiring the human to paste it each session.

For multi-site benches: include the default site name and list other sites. Always use `bench --site <site> ...`; bare `bench migrate` is ambiguous and forbidden.

### 4) Wire code-search tools selectively

| Tool | What it provides | When to add |
|---|---|---|
| `codegraph` MCP | Symbol graph, call paths, blast-radius queries | When grep produces too much noise across large codebases |
| `bench --site <site> console` | Live Python REPL on the site | Per-session one-off lookups; not a replacement for reading source |
| `frappe-deep-research` skill | Verified source-code tracing for hooks and APIs | Before claiming any hook name or API behaviour is correct |

Load only the tool needed for the current task. Multiple active MCPs add latency and noise.

### 5) Trim context proactively

Start trimming at ~75% context capacity — do not wait until the window is full.

| Cut first | Keep until the end |
|---|---|
| Past failed attempts and their tracebacks | Original task definition and acceptance criteria |
| Verbose bench output — keep only the error line | The current failing test or error |
| Earlier drafts of code replaced by the current version | The file currently being edited |
| Conversational back-and-forth once a decision is reached | Hard constraints (permission rules, `frappe.qb` convention, naming) |

Summarize before dropping: "Import error traced to circular dependency in `utils.py` — fixed by moving the shared type to `types/__init__.py`." Detail gone; decision preserved.

### 6) Recognize and reset context rot

**Symptoms — stop and reset if you see any of these:**
- Agent uses a hook name that does not exist (`after_save` is not a valid Frappe hook in v16)
- Agent calls `frappe.db.sql` in code that should use `frappe.qb`
- Agent proposes editing a core Frappe or ERPNext DocType instead of using Custom Fields
- Agent omits `bench migrate` from a task plan that changes a DocType JSON
- Agent invents a `frappe.get_*` function without verifying it in source

**Reset procedure:**
1. Do not continue in the degraded session — errors compound
2. Commit or stash current work so nothing is lost
3. Start a fresh session
4. Re-read in order: bench AGENTS.md → active spec → `git status` → task card
5. Do not re-read the previous conversation — it is the source of the rot

## Verification

- [ ] `AGENTS.md` or `CLAUDE.md` exists at the bench root with app versions, default site, and key commands
- [ ] App versions read from `apps/<app>/<app>/__init__.py`, not hardcoded
- [ ] `frappe-router` loaded at session start before task-specific skills
- [ ] Only task-relevant skill loaded per session (not all 45)
- [ ] Context ordered: stable rules first, active task last, error at generation point
- [ ] Agent output follows `frappe.qb`, extends via Custom Fields, names hooks correctly
- [ ] Context trimming begins before the window fills

## Failure modes / debugging

- **Agent ignores AGENTS.md rules**: confirm the file is at the bench root and the tool loads it automatically; if not, paste the key sections into the session opener
- **Agent uses wrong bench commands**: add the exact commands with the `<site>` placeholder filled in to the AGENTS.md `## Commands` section
- **MCP tool causing latency**: disable unused MCP servers; load one tool per task at a time
- **Context rot detected**: stop, stash, reset — do not continue reasoning in a degraded session

## Escalation

- Deep source tracing to verify a hook or API → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Bench broken and needs recovery → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- Routing to the right Frappe skill for a task → [`frappe-router`](../frappe-router/SKILL.md)

## References

- [assets/bench-AGENTS.md](assets/bench-AGENTS.md) — complete bench AGENTS.md / CLAUDE.md template

## Guardrails

- **Machine-agnostic**: AGENTS.md must use `<bench>`, `<site>`, `<app>` placeholders; no absolute host paths, no client-specific app names
- **Versions from source**: read `apps/<app>/<app>/__init__.py` for `__version__`; never hardcode or guess versions
- **Never load all skills at once**: route through `frappe-router` per task; context budget is finite
- **Context rot reset is non-negotiable**: a fresh session with re-read AGENTS.md always beats continuing in a degraded session

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The agent will infer the conventions" | It cannot read your mind; if it is not in AGENTS.md, it does not exist for the agent |
| "More context is always better" | Attention degrades with overloaded context; focused, task-scoped context outperforms large unfocused context |
| "I'll fix it when the agent goes wrong" | Prevention via AGENTS.md is cheaper than correction after three wrong turns |
| "Codegraph adds latency, skip it" | Codegraph latency is one call; grep loops without it cost far more in agent turns on a large codebase |
| "I'll reset if it gets really bad" | Start trimming at 75%, not 100%; by 100% quality is already fragmenting mid-task |
| "I don't need to re-read AGENTS.md in a fresh session" | Fresh sessions carry no memory of prior context; AGENTS.md re-read is mandatory, not optional |

## Red Flags

- Agent uses `frappe.db.sql` when the bench rules mandate `frappe.qb`
- Agent proposes editing a core Frappe or ERPNext DocType instead of extending with Custom Fields
- Agent uses a hook name without verifying it in `apps/frappe/frappe/model/document.py`
- No `AGENTS.md` or `CLAUDE.md` at the bench root
- All 45 skills loaded simultaneously in the context
- Context rot detected but session continues without a reset
- AGENTS.md contains absolute host paths or client-specific app names

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Hardcoding app versions in AGENTS.md | Drifts when apps upgrade; agent uses wrong API | Read from `apps/<app>/<app>/__init__.py` and regenerate on upgrade |
| Loading frappe-testing when only doing schema work | Pollutes context with irrelevant test patterns | Route through frappe-router; load only the skill for the current task |
| Keeping full tracebacks in context after the error is resolved | Fills context budget with noise | Keep only the error line; drop the stack once resolved |
| Placing active task file content early in context | Lost-in-the-middle: model attends to start and end more reliably | Put current file and error last, closest to the generation point |
| Skipping reset on context rot | Compounds hallucinations in the same session | Stop, stash current work, start fresh session, re-read AGENTS.md |
