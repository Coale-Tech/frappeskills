---
name: frappe-doubt-driven-development
description: "Subjects every non-trivial in-flight Frappe decision to a fresh-context adversarial review before it stands. Use when about to make a permission model change, writing a patch on a populated table, posting to GL/Stock/Payment ledgers, deleting data irreversibly, or wiring hooks that alter core Frappe behaviour site-wide. Not for mechanical renames, obvious one-line fixes, or reading existing code."
---

# Frappe Doubt-Driven Development

Before a non-trivial decision lands, cross-examine it with a fresh-context reviewer biased to disprove.

## When to use

A decision is **non-trivial** when at least one is true:

- Changes the permission model: roles, `permlevel`, `has_permission`, `permission_query_conditions`
- Writes a `patches.txt [pre_model_sync]` patch on a table with live data
- Posts to GL Entry, Stock Ledger Entry, or Payment Entry (irreversible in standard Frappe accounting)
- Deletes or drops data that cannot be recovered without a backup restore
- Wires a `doc_events`, `override_doctype_class`, or `scheduler_events` hook that alters core behaviour site-wide
- Crosses a company or site boundary (inter-company vouchers, multi-site logic)
- Asserts an invariant the type system cannot verify: idempotency, ordering, ledger balance

**Not for:**
- Renaming a variable or field label
- Adding a non-required field with a safe default
- Reading or summarizing existing code
- Following a clear, unambiguous task card step

## Inputs required

- The decision or artifact (patch diff, permission matrix delta, GL posting logic, hook wiring)
- The contract it must satisfy (acceptance criteria, invariants, spec constraints)
- Site/app context if the reviewer needs it to classify findings

## Procedure

<!-- Adapted from addyosmani/agent-skills (MIT): skills/doubt-driven-development/SKILL.md -->

### 0) Doubt cycle checklist

```
- [ ] Step 1: CLAIM  — named the decision and why it matters in Frappe
- [ ] Step 2: EXTRACT — isolated artifact + contract, stripped session reasoning
- [ ] Step 3: DOUBT  — invoked fresh-context reviewer with adversarial prompt
- [ ] Step 4: RECONCILE — classified every finding against the artifact text
- [ ] Step 5: STOP   — met a stop condition
```

### 1) CLAIM — Surface what stands

Name the decision in 2-3 lines:

```
CLAIM: "The pre_model_sync patch safely renames column 'old_name' to 'new_name'
        on the Item table without data loss."
WHY IT MATTERS: if wrong, all Item records lose old_name on the next migrate.
```

If you cannot write the claim that compactly, you have a vibe, not a decision — surface it before scrutinizing it.

### 2) EXTRACT — Smallest reviewable unit

Give the reviewer the artifact and the contract. Strip your reasoning.

| Decision type | Artifact to extract | Contract to provide |
|---|---|---|
| `patches.txt` patch | The patch function body | Invariant ("column renamed without data loss; idempotent") |
| Permission change | Role matrix delta + `has_permission` override | Spec permission requirements |
| GL posting | The entry construction block | Balance invariant (debit = credit, correct account types) |
| Hook wiring | Hook name + handler + what it replaces | Expected trigger and side-effect scope |

The unit must be small enough to hold in one read. If it is a 500-line diff, decompose first.

Prompt templates → [references/doubt-protocol.md](references/doubt-protocol.md).

### 3) DOUBT — Invoke the fresh-context reviewer

The reviewer is a **read-only subagent** given only the artifact and contract — not the CLAIM, not session history.

Pass the adversarial prompt from `references/doubt-protocol.md` verbatim; it overrides the subagent's default balanced verdict.

**Do NOT pass the CLAIM.** Handing the reviewer your conclusion biases it toward agreement.

### 4) RECONCILE — Fold findings back

Classify each finding in this order (first match wins):

1. **Contract misread** — reviewer flagged something because the CONTRACT you provided was unclear. Fix the contract; re-classify next cycle.
2. **Valid + actionable** — real issue; change the artifact; re-loop.
3. **Valid trade-off** — real but cost of fixing exceeds cost of accepting; document it explicitly.
4. **Noise** — reviewer lacked context the artifact doesn't carry; note it and move on.

A fresh reviewer can be wrong because it lacks context. Do not defer just because it is "fresh."

### 5) STOP — Bounded loop

Stop when:
- Next cycle returns only trivial or already-considered findings, **or**
- 3 cycles completed → escalate to the user; do not run a fourth cycle alone, **or**
- User says "ship it"

If 3 cycles still surface unresolved findings: the artifact may not be ready. Surface to the user — three unresolved cycles is information about the artifact, not a reason to keep looping.

## Verification

- [ ] Every non-trivial Frappe trigger (permission change, patch, GL posting, irreversible op, hook wiring) named as a CLAIM
- [ ] Reviewer received ARTIFACT + CONTRACT only — not the CLAIM, not session reasoning
- [ ] Reviewer prompt was adversarial ("find what is wrong"), not validating ("is this good?")
- [ ] Every finding classified (contract misread / actionable / trade-off / noise) against the artifact text
- [ ] Stop condition met: trivial findings, 3 cycles, or user override

## Failure modes / debugging

- **Reviewer validates instead of doubts**: the prompt was not adversarial — re-run step 3 with the template from `references/doubt-protocol.md`
- **3 cycles unresolved**: the artifact is too large — return to step 2 and decompose before continuing
- **Doubt applied to a committed artifact**: doubt-driven is in-flight; use [`frappe-code-review`](../frappe-code-review/SKILL.md) post-commit
- **Reviewer lacks Frappe context**: add minimal context to the CONTRACT block, not to the artifact; never add your reasoning

## Escalation

- Post-implementation review → [`frappe-code-review`](../frappe-code-review/SKILL.md)
- Data migration safety and patch hygiene → [`frappe-deprecation-and-migration`](../frappe-deprecation-and-migration/SKILL.md)
- Permission model security review → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Behavioral test coverage → [`frappe-testing`](../frappe-testing/SKILL.md)

## References

- [references/doubt-protocol.md](references/doubt-protocol.md) — adversarial prompt templates for the doubter; Frappe-specific contract building blocks

## Guardrails

- **Runs from the main-session orchestrator**: a subagent following this skill MUST NOT spawn another subagent — surface the artifact to the main session instead
- **Never pass the CLAIM to the reviewer**: it biases toward agreement
- **Never exceed 3 cycles without escalating**: a fourth cycle alone is evidence the artifact is not ready
- **Doubt theater is a failure mode**: if zero findings across 2 cycles are classified actionable, stop and escalate; you are validating, not doubting

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'm confident in this patch" | Confidence correlates poorly with correctness on data migrations — the table has live records |
| "The reviewer will just nitpick" | Only if unscoped; constrain the prompt to issues that would fail the contract |
| "I'll do doubt after I finish the full feature" | By then the patch has run on your local site; course-correction requires a backup restore |
| "It's just a permission change" | Permission changes on live sites have immediate blast radius — users lose or silently gain access |
| "GL logic is standard; no need to doubt it" | Off-by-one in debit/credit creates irreconcilable ledger imbalance; standard ≠ correct |
| "Two opinions are always better than one" | Not when the second lacks context; classify findings against the artifact before accepting them |

## Red Flags

- Spawning a fresh-context reviewer for a one-line field-label rename
- Treating reviewer output as authoritative without re-reading the artifact text
- Looping more than 3 cycles without escalating to the user
- Prompting the reviewer with "is this good?" instead of "find what's wrong"
- Skipping doubt under time pressure on a patch or GL posting
- Running doubt after the patch already executed on a live site — that is not in-flight review
- Zero actionable findings across 2 cycles — you are validating, not doubting

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Passing the full controller to the reviewer | Too large; reviewer produces noise | Extract only the function or patch that satisfies the contract |
| Passing reasoning alongside the artifact | Reviewer validates reasoning, not the artifact | Strip all reasoning; ARTIFACT + CONTRACT only |
| Applying doubt to every single-line change | Nothing ships | Apply only when a non-trivial trigger (from "When to use") is present |
| Not classifying findings | Reviewer becomes the decision-maker | You are the orchestrator; classify each finding before changing the artifact |
| Applying from inside a subagent context | Would spawn another subagent — anti-pattern | Surface to the main session; degrade to self-questioning only as last resort |
