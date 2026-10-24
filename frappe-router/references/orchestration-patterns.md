# Frappe Orchestration Patterns

<!-- Adapted from addyosmani/agent-skills (MIT): references/orchestration-patterns.md -->

Reference catalog of agent orchestration patterns endorsed for Frappe projects, and anti-patterns to avoid. Read this before adding a new `/frappe-*` command that coordinates multiple personas, or before introducing a new persona that "wraps" existing ones.

Governing rule: **the user (or a slash command) is the orchestrator. Personas do not invoke other personas.** Skills are mandatory hops inside a persona's workflow.

---

## Endorsed patterns

### 1. Direct invocation (no orchestration)

Single persona, single perspective. The default and cheapest option.

```
user → frappe-reviewer → report → user
```

Use when: one perspective on one artifact, describable in one sentence.

Examples:
- "Review this PR" → `frappe-reviewer`
- "Find security issues in `hooks.py`" → `frappe-security-auditor`
- "What tests are missing for the Submit flow?" → `frappe-test-engineer`
- "Trace the `on_submit` chain for this DocType" → `frappe-scout`

---

### 2. Single-persona slash command

A slash command that wraps one skill with the project's context.

```
/frappe-perf → frappe-performance-auditor → report
```

Use when: the same single-persona invocation repeats with the same setup.

Anti-signal: if the command body is mostly "decide which persona to call," delete it and let the user call the persona directly.

---

### 3. Parallel fan-out with merge (`/frappe-ship`)

Multiple personas on the same input concurrently; a merge step synthesizes them.

```
                      ┌─→ frappe-reviewer         ─┐
/frappe-ship → fanout─┼─→ frappe-security-auditor ─┤→ merge → GO/NO-GO + rollback
                      └─→ frappe-test-engineer    ─┘
```

Use when:
- Sub-tasks are genuinely independent (no shared mutable state, no ordering)
- Each sub-agent benefits from a fresh context window
- The merge step is small enough to stay in the main context
- Wall-clock latency matters

Issue all Agent tool calls in **a single assistant turn** for true parallelism. Sequential turns serialize execution.

Checklist before adopting:
- [ ] Can all sub-agents run at the same time without ordering issues?
- [ ] Does each produce a different *kind* of finding?
- [ ] Will the merge step fit in remaining context?

---

### 4. Sequential pipeline (user-driven slash commands)

The user runs slash commands in order, carrying context between them. No orchestrator agent — **the user IS the orchestrator**.

```
/frappe-spec → /frappe-plan → /frappe-build → /frappe-test → /frappe-review → /frappe-ship
```

Use when: each step needs the previous step's output, and human judgment between steps adds value.

Why not automate: an LLM "lifecycle orchestrator" loses nuance in hand-off summaries, skips human checkpoints that catch wrong-direction work early, and doubles token cost via paraphrasing turns.

---

### 5. Research isolation with `frappe-scout`

When a task requires reading large amounts of bench code that shouldn't pollute the main context, invoke `frappe-scout`. It returns only a compressed digest.

```
main agent → frappe-scout (reads 30+ files) → digest → main agent continues
```

Use when:
- The main session needs to stay focused on downstream work
- The investigation result is much smaller than the input it consumes

---

### 6. Shared-contract-first for parallel BUILD

When the BUILD phase fans out to multiple implementers in parallel:

```
1. Export DocType JSON (the schema contract)
2. Define whitelisted API stubs
        ↓
3. Fan out agents in parallel, each reading the contract
        ↓
4. Integrate
```

Without the contract, parallel agents collide on field names, method signatures, and permission assumptions. The integration step becomes a conflict-resolution session.

---

## Anti-patterns

### A. Router persona ("meta-orchestrator")

```
/do-work → meta-orchestrator → "this needs review" → frappe-reviewer → paraphrase → user
```

Fails: pure routing with no domain value; 2× token cost; information loss; the user already knew what they wanted.

What to do instead: add or refine slash commands. Document intent → command mapping in `AGENTS.md`.

---

### B. Persona-calls-persona

`frappe-reviewer` internally spawning `frappe-security-auditor` because it found a suspicious pattern.

Fails: on Claude Code, subagents cannot spawn other subagents — platform constraint, not convention. Surface the concern as a recommendation in the report; the user or `/frappe-ship` decides when to act.

---

### C. Sequential fan-out disguised as parallel

Issuing three Agent tool calls in **separate turns** instead of a single turn.

Fails: execution is serial; wall-clock time increases with no benefit.

---

### D. Skipping the shared contract in parallel BUILD

Fanning out parallel agents without first agreeing on the DocType JSON schema and API stubs.

Fails: agents make incompatible assumptions on field names, method signatures, and permission logic. Integration step becomes a conflict-resolution session.

---

### E. Lifecycle orchestrator persona

A persona that steps through DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP on behalf of the user.

Fails: loses the human checkpoints between phases; cannot handle the ambiguity that makes human review between steps valuable; paraphrasing summaries between phases cause information loss that compounds across six phases.

What to do instead: the lifecycle is user-driven slash commands (Pattern 4). Document the sequence in `AGENTS.md` as a suggested workflow, not as an automated pipeline.

---

## Frappe-specific orchestration notes

- **`bench migrate` is synchronous and sequential.** Never run it from a parallel sub-agent — it locks the site. Migrate belongs in the main session after all parallel work is merged.
- **DocType JSON is the natural contract boundary.** When parallel agents must share a data model, exporting the DocType JSON first gives a machine-readable, version-controlled contract that all agents can read independently.
- **Patches are always sequential.** Patches modify data in dependency order. Never parallelize patch execution even when the individual patch files look independent.
- **The main agent always owns the GO/NO-GO verdict.** `/frappe-ship`'s merge step must happen in the main context with full access to all three persona reports.

## Sources

- Upstream: `addyosmani/agent-skills` (MIT): `references/orchestration-patterns.md`, `docs/agents.md`, `agents/code-reviewer.md`, `.claude/commands/ship.md`
- `apps/frappe/frappe/patches/` — patch execution order reference
- `apps/frappe/frappe/model/document.py` — `bench migrate` locking behaviour
