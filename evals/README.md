<!-- Adapted from addyosmani/agent-skills (MIT): evals/README.md -->
# Skill Evals

How frappeskills measures whether its skills actually work: that they **trigger** when they should, **stay distinct** from each other, and **change agent behavior** the way each skill promises.

## The three tiers

| Tier | What it checks | Runs | Cost |
|---|---|---|---|
| 1. Structural | Frontmatter, naming, required sections, line budget, reference links, command parity, manifest versions | CI (`validate-skills.js`, `validate-reference-links.js`, `validate-commands.js`, `validate-versions.js`) | Free |
| 2. Trigger & routing | Positive prompts rank their skill top-k; negative prompts don't rank it #1; no two descriptions collide ≥ 75% | CI (`run-evals.js`) | Free |
| 3. Behavioral | An agent following the skill satisfies its `expectations[]` | On demand (`run-evals.js --behavioral`) | Tokens |

Tier 2 is a **lexical approximation** of routing (stemmed TF-IDF over descriptions). It catches the two dominant trigger bugs: a description missing the vocabulary users say (false negative), and an over-broad description that outranks the right skill (false positive). A Tier-2 failure means *fix the description*, not the eval.

## Running

```bash
# Tier 2 — deterministic, runs in CI
node scripts/run-evals.js
node scripts/run-evals.js --min-rank1 95     # enforce a routing quality floor

# Tier 3 — dialogue behavioral, spends tokens
node scripts/run-evals.js --behavioral frappe-testing
node scripts/run-evals.js --behavioral frappe-testing --dry-run  # print plan only
```

Results are written to `evals/results/` (gitignored).

## Eval case format

One file per skill: `evals/cases/<skill-name>.json`.

```json
{
  "skill_name": "frappe-testing",
  "trigger": {
    "positive": [
      { "prompt": "Write a failing test for the ledger reconciliation bug before fixing it", "top_k": 3 }
    ],
    "negative": [
      { "prompt": "Export all Purchase Invoices to a spreadsheet", "owner": "frappe-data-import" }
    ]
  },
  "evals": [
    {
      "id": 1,
      "kind": "dialogue",
      "prompt": "I need to write a unit test for the payment allocation logic in our custom app. Where do I start?",
      "expected_output": "A concrete step-by-step guide to writing a Frappe unit test, including test class setup, using IntegrationTestCase, and running via bench.",
      "expectations": [
        "Agent references frappe.tests.IntegrationTestCase or UnitTestCase rather than the deprecated FrappeTestCase shim",
        "Agent provides a runnable bench command to execute the test suite",
        "Agent explains how to create test records without touching production data"
      ]
    }
  ]
}
```

### Fields

- **`trigger.positive`** — realistic user prompts that should route to this skill (`top_k` defaults to 3; tighten to 1 for a skill's signature ask).
- **`trigger.negative`** — prompts that belong to a *different* skill; this skill must not rank first for them. Declare the right skill in `owner` to make the test a pairwise routing check rather than a vacuous pass-if-nothing-matches.
- **`evals`** — behavioral cases using skill-creator's shape (`id`, `prompt`, `expected_output`, `expectations[]`) plus `kind: "dialogue"`.

### Required minimums

| Field | Minimum |
|---|---|
| `trigger.positive` | 3 |
| `trigger.negative` | 2 |
| `evals` | 1 |

## Dialogue-only rationale

frappeskills evals are `kind: "dialogue"` only. Frappe skills coach agents on *how to reason and act* inside a bench — the deliverable is the quality of the agent's guidance, not a file diff or command log. Execution evals require a real Frappe bench (MariaDB, Redis, bench bootstrap), which is infeasible in a throwaway workspace. Dialogue evals capture the same signal — does the agent follow the procedure, cite the right APIs, and apply the guardrails? — without the infrastructure overhead.

If a future skill's acceptance criterion genuinely requires inspecting a tool call or file edit (e.g., an automated migration runner), add execution support then. Until that case exists, `dialogue` is not an escape hatch; it is the correct choice.

## Writing good trigger prompts

Paraphrase how Frappe developers actually talk; do not copy the description (that games the eval). If a realistic prompt cannot rank because the description lacks its vocabulary, that is a real finding — improve the description.

## Adding a skill

When you add a new `frappe-*/`, also add `evals/cases/<skill-name>.json` with at least 3 positive triggers, 2 negative triggers, and 1 behavioral eval. Missing case files are CI errors.

## Metrics to watch

Tier 2 prints a **trigger rank-1 rate** (share of positive prompts that rank their skill first). Run with `--min-rank1 95` in CI. Raise the floor as routing improves; never lower it to paper over a regression. A falling rate means descriptions are drifting toward each other — fix the descriptions.
