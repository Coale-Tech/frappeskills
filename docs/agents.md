# Frappe Agent Personas

<!-- Adapted from addyosmani/agent-skills (MIT): docs/agents.md, references/orchestration-patterns.md -->

Specialist personas that play a single role with a single perspective. Each is a Markdown file consumed as a system prompt.

| Persona | Role | Best for |
|---------|------|----------|
| [frappe-dev](../omp/agents/frappe-dev.md) | Full-stack Frappe implementer | Any task that writes or changes Frappe app code |
| [frappe-reviewer](../omp/agents/frappe-reviewer.md) | Staff Engineer (read-only) | Five-axis review before merge |
| [frappe-security-auditor](../omp/agents/frappe-security-auditor.md) | Security Engineer (read-only) | Permission model, SQL injection, OWASP-style audit |
| [frappe-test-engineer](../omp/agents/frappe-test-engineer.md) | QA Engineer (may write tests) | Test strategy, coverage analysis, Prove-It pattern |
| [frappe-performance-auditor](../omp/agents/frappe-performance-auditor.md) | Performance Engineer (read-only) | Query count, N+1, index, cache, background-job audit |
| [frappe-migration-auditor](../omp/agents/frappe-migration-auditor.md) | Migration Engineer (read-only) | Patches, `patches.txt`, schema changes, data-loss and idempotency risk |
| [frappe-api-contract-auditor](../omp/agents/frappe-api-contract-auditor.md) | API Contract Reviewer (read-only) | Whitelisted method signature, return shape, verb and `allow_guest` changes |
| [frappe-scout](../omp/agents/frappe-scout.md) | Bench/code explorer (read-only) | Map an unknown bench or trace a flow before implementation |

## How personas relate to skills and commands

| Layer | What it is | Example | Composition role |
|-------|-----------|---------|------------------|
| **Skill** | A workflow with steps and exit criteria | `frappe-code-review` | The *how* — invoked from inside a persona or command |
| **Persona** | A role with a perspective and output format | `frappe-reviewer` | The *who* — adopts a viewpoint, produces a report |
| **Command** | A user-facing entry point | `/frappe-review`, `/frappe-ship` | The *when* — composes personas and skills |

The user (or a slash command) is the orchestrator. **Personas do not call other personas.** Skills are mandatory hops inside a persona's workflow.

### Which persona

| If the question is about | Use | Not |
|--------------------------|-----|-----|
| Whether a change is correct, readable, well-structured | `frappe-reviewer` | the auditors; they go deep on one axis |
| Permissions, SQL injection, `allow_guest`, secrets | `frappe-security-auditor` | `frappe-reviewer`, which only flags them |
| Query count, N+1, indexes, cache, background jobs | `frappe-performance-auditor` | `frappe-reviewer` |
| A patch, `patches.txt` entry or schema change | `frappe-migration-auditor` | `frappe-security-auditor` |
| A whitelisted method's signature, return shape or verb | `frappe-api-contract-auditor` | `frappe-security-auditor` |
| Missing tests, coverage, a failing test to prove | `frappe-test-engineer` | `frappe-reviewer` |
| Not knowing how the code or bench works yet | `frappe-scout` | `frappe-dev`; map first, then build |
| Writing or changing Frappe app code | `frappe-dev` | any read-only persona |
| One Critical or Required finding that needs checking | `frappe-reviewer` in Refute mode | the author of the finding |

## Decision matrix

```
Is the work a single perspective on a single artifact?
├── Yes → Direct persona invocation
└── No  → Are the sub-tasks independent (no shared mutable state, no ordering)?
          ├── Yes → /frappe-ship (parallel fan-out)
          └── No  → Sequential slash commands run by the user
                    /frappe-spec → /frappe-plan → /frappe-build → /frappe-test → /frappe-review → /frappe-ship
```

### When to use direct persona invocation

Pick this when you want one perspective on the current change and the user is in the loop.

- "Review this PR" → invoke `frappe-reviewer` directly
- "Are there security issues in `hooks.py`?" → invoke `frappe-security-auditor` directly
- "What tests are missing for the Sales Order flow?" → invoke `frappe-test-engineer` directly
- "Are there N+1 queries on the Customer list?" → invoke `frappe-performance-auditor` directly
- "Map the `on_submit` chain for this DocType" → invoke `frappe-scout` directly

### When to use a slash command (single persona behind it)

Pick this when there is a repeatable workflow you would otherwise re-explain every time.

- `/frappe-perf` → wraps `frappe-performance-auditor` for performance-focused audits
- `/frappe-review` → runs `frappe-code-review` + `frappe-security-hardening` in the main session (not a persona wrapper)
- `/frappe-test` → runs `frappe-testing` TDD loop in the main session (not a persona wrapper)

### When to use parallel fan-out (`/frappe-ship`)

Pick this only when **independent** investigations can run concurrently and a single agent then merges their reports.

```
/frappe-ship
  ├── (parallel) frappe-reviewer         → review report
  ├── (parallel) frappe-security-auditor → audit report
  └── (parallel) frappe-test-engineer    → coverage report
                  ↓
        merge phase (main agent)
                  ↓
        GO/NO-GO decision + rollback plan
```

Why this works:
- Each sub-agent operates on the same diff but produces a **different perspective**
- No ordering dependencies → genuine parallelism
- Each runs in a fresh context window → main session stays uncluttered
- The merge step is small and benefits from full context

## Orchestration rules

### Parallel-safe vs sequential

**Parallel-safe (same input, different lenses):** `frappe-reviewer` + `frappe-security-auditor` + `frappe-test-engineer` in `/frappe-ship`. They read the same diff but produce independent reports.

**Sequential (output of one feeds the next):** the lifecycle commands. `/frappe-spec` must produce `SPEC.md` before `/frappe-plan` can produce `tasks/plan.md`. Never parallelize sequential steps — you'll lose the human checkpoints that catch wrong-direction work early.

### Shared-contract-first for parallel BUILD work

When the BUILD phase fans out to multiple implementers working in parallel (e.g. DocType + API + Desk UI), define the shared contract first:

1. Export the DocType JSON (the schema is the contract)
2. Define the whitelisted API surface in a stub
3. Only then fan out parallel agents; each reads the contract, not each other

Without a contract, parallel agents collide on field names, method signatures, and permission assumptions.

### Synthesis step belongs to the main agent

The main agent always owns the merge/synthesis step. A sub-agent that tries to merge other sub-agents' reports adds paraphrasing hops and loses nuance. Keep the synthesis in the context that has the most information: the main session.

### Verification pass belongs to the lead

Before acting on Critical or Required findings, the lead starts a fresh `frappe-reviewer` in Refute mode per finding, handing it only the claim and `file:line`. It defaults to refuted when it cannot confirm the finding from code. See `frappe-code-review/references/finding-format-and-gates.md`.

## Anti-patterns

### Router persona ("meta-orchestrator")

A persona whose job is to decide which other persona to call:

```
/do-work → meta-orchestrator → "this needs a review" → frappe-reviewer → paraphrase → user
```

Why it fails: pure routing layer with no domain value; adds two paraphrasing hops (2× token cost + information loss); the user already knew they wanted a review.

What to do instead: add or refine slash commands. Document intent → command mapping in `AGENTS.md`.

### Persona-calls-persona

`frappe-reviewer` internally spawning `frappe-security-auditor` because it found a suspicious pattern.

Why it fails: on Claude Code, subagents cannot spawn other subagents — this is a platform constraint, not just a convention. Surface the concern as a recommendation in the report; the user or `/frappe-ship` decides when to act on it.

### Deep persona tree

A persona spawns a sub-persona that spawns another. Fails for the same reason: Claude Code's "subagents cannot spawn other subagents" rule blocks this by construction.

### Sequential fan-out disguised as parallel

Issuing three Agent tool calls in **separate turns** instead of a single turn. The execution becomes serial; wall-clock time doubles with no benefit.

### Skipping the shared contract in parallel BUILD

Fanning out parallel agents to implement DocType + API + Desk UI without first agreeing on the DocType JSON schema. Agents make incompatible field-name assumptions; the integration step becomes a conflict-resolution session.

## Rules for personas

1. A persona is a single role with a single output format. If you need a second role, create a second persona.
2. **Personas do not invoke other personas.** Composition is the job of slash commands or the user. On Claude Code this is also a hard platform constraint.
3. A persona may invoke skills (the *how*).
4. Every persona file ends with a "Composition" block.
5. Read-only personas declare `tools: read, bash, grep, glob` in frontmatter to prevent accidental edits. The same list has no `task` tool, so they are leaves: they cannot spawn further agents. If one needs more work done, it reports it under `Followups` and the lead decides.
