# QA Tiers and Health Score

Adapted from gstack/qa (MIT): qa/sections/qa-patterns.md — Health Score Rubric and tier model.
Frappe-specific categories, weights, and scoring math.

## QA Tiers

| Tier | When to use | Issue severities fixed | Typical runtime |
|------|-------------|------------------------|-----------------|
| **Quick** | Pre-merge smoke test; CI on every PR | Critical only | < 5 min |
| **Standard** | Release candidate; post-deploy wave-1 check | Critical + High | 15–30 min |
| **Exhaustive** | Major release; quarterly review; onboarding a new site | Critical + High + Medium | 1–2 h |

Low / cosmetic findings are recorded but never block a tier. Fix them in a follow-up sweep.

**Tier selection rules:**
- Quick: run it always. A failing Quick means stop and fix before anything else proceeds.
- Standard: run it before any production deploy wave advances.
- Exhaustive: run it before a public launch or after a significant refactor of the UI layer.

---

## Frappe Health Score Rubric

### Category weights

| Category | Weight | Scoring method | What counts |
|----------|--------|----------------|-------------|
| Console/JS errors | 15% | count-based | Uncaught exceptions, `frappe.call` callback errors, CSP violations on Desk pages |
| Network 4xx/5xx | 15% | count-based | Failed `frappe.call` POSTs, broken static assets, 500 responses |
| Permission surprises | 10% | deduction | Permission-denied where access was expected, role bypass, or missing `@frappe.whitelist()` |
| Form/submit flow | 15% | deduction | Validation failures, submit/amend/cancel broken, mandatory field not enforced |
| List/report/dashboard | 10% | deduction | List view errors, Query Report failures, Dashboard chart load errors |
| Print format/PDF | 5% | deduction | Print Preview blank, Jinja errors in template, PDF missing fields |
| Workflow transitions | 10% | deduction | State machine stuck, approval buttons missing, notification not firing |
| Accessibility basics | 5% | deduction | Missing labels, keyboard-unreachable actions, contrast failures |
| Mobile viewport | 5% | deduction | Overflow at 375 px, unclickable targets, table overflow |
| Performance budget | 10% | deduction | Desk page > 3 s to interactive, list view > 2 s, report > 5 s |

### Count-based scoring (console, network)

Deduplicate by root cause before counting.

| Error count | Score |
|-------------|-------|
| 0 | 100 |
| 1–3 | 70 |
| 4–10 | 40 |
| 11+ | 10 |

### Deduction-based scoring (all other categories)

Start at 100; deduct per finding:

| Severity | Deduction | Definition |
|----------|-----------|------------|
| Critical | −25 | Data loss, security exposure, or core feature unusable for all users |
| High | −15 | Core task blocked with no workaround |
| Medium | −8 | Task impaired; a workaround exists |
| Low | −3 | Cosmetic, copy, or friction; task completion unaffected |

Floor: 0 (a category cannot go negative).

### Final score

```
final = Σ (category_score × weight) / Σ tested_weights
```

Round to the nearest integer. Exclude untested categories from both numerator and denominator — label their contribution "provisional" and note coverage in the report.

### Grade mapping

| Score | Grade |
|-------|-------|
| 90–100 | A |
| 80–89 | B |
| 65–79 | C |
| 50–64 | D |
| < 50 | F |

**Example (hand calculation):**
- Console: 2 errors → 70 × 0.15 = 10.5
- Network: 0 failures → 100 × 0.15 = 15.0
- Forms: 1 critical → 75 × 0.15 = 11.25
- All others: 100 × 0.55 = 55.0
- Total (print/a11y/mobile untested; tested weight = 0.85):
  `(10.5 + 15.0 + 11.25 + 55.0) / 0.85 = 91.75 / 0.85 ≈ 108 → capped at weights, recalculate:`

Correct form — untested categories removed from denominator:
`(10.5 + 15.0 + 11.25 + 10 + 10 + 10 + 10) / 0.85 = 76.75 / 0.85 ≈ 90` → grade A

---

## findings.json schema

Save one file per QA session next to the site's `.qa/` folder (e.g. `<bench>/.qa/findings-2024-01-15.json`):

```json
{
  "date": "YYYY-MM-DD",
  "site": "<site>",
  "tester": "browser-tester@example.com",
  "tier": "standard",
  "findings": [
    {
      "id": "F-001",
      "category": "console",
      "severity": "high",
      "title": "Uncaught TypeError on Task list load",
      "page": "/app/task",
      "notes": "task_list.js:47 — cannot read property 'status' of undefined"
    }
  ],
  "untested": ["print", "a11y", "mobile"]
}
```

`severity` accepts: `critical|high|medium|low` or `P0|P1|P2|P3` (design-review findings compat).
`category` accepts: `console|network|permissions|forms|lists|print|workflow|a11y|mobile|performance`.

---

## baseline.json schema

Written by `qa-score.js --save-baseline`. Lives at `<bench>/.qa/baseline.json`:

```json
{
  "date": "YYYY-MM-DD",
  "site": "<site>",
  "healthScore": 84,
  "categoryScores": {
    "console": 70,
    "network": 100,
    "permissions": 100,
    "forms": 75,
    "lists": 85,
    "print": null,
    "workflow": 100,
    "a11y": null,
    "mobile": null,
    "performance": 80
  },
  "findingIds": ["F-001", "F-002"]
}
```

`null` = untested that session. Compare only identical coverage sets across runs.

---

## Regression mode

Run with `--baseline` after every deploy or branch merge to detect regressions:

```bash
node frappe-testing/scripts/qa-score.js .qa/findings-post-deploy.json \
  --baseline .qa/baseline.json
```

Output shows:
- Per-category score delta (e.g. `console: 70 → 40, Δ−30`)
- `Resolved:` finding IDs present in baseline but absent now (fixed)
- `New:` finding IDs present now but absent from baseline (regressions)
- Final score delta vs baseline

A regression (new Critical or High) means the deploy wave must not advance.

---

## Atomic fix commits + regression tests

**One fix = one atomic commit.** Never batch unrelated fixes in a single commit.

Commit message pattern:
```
fix(qa): <symptom> on <page/doctype>

Category: <category>  Severity: <severity>  Finding: <id>
<one-line root cause>
```

**Every High or Critical fix must ship with a regression test** — the smallest test that would have caught the bug. If it's a JS/browser issue, an assertion in the Playwright/Cypress suite; if it's a server-side bug, an `IntegrationTestCase` assertion.

**Clean-tree rule:** commit only files directly related to the fix. Run `git diff --name-only HEAD~1` to verify scope. Never mix a fix with unrelated refactors.

---

## Report-only mode

To capture findings without fixing anything (staging review, stakeholder sign-off):
1. Run `qa-score.js <findings.json>` — no `--save-baseline` flag.
2. Attach the printed table and the findings.json to the PR or release ticket.
3. Set the baseline only after the team has decided which findings to address.

Report-only mode: read findings, print score, no file writes.

---

## Running qa-score.js

Script lives at `frappe-testing/scripts/qa-score.js` (zero npm dependencies).

```bash
# Basic score
node frappe-testing/scripts/qa-score.js .qa/findings.json

# Regression mode
node frappe-testing/scripts/qa-score.js .qa/findings.json --baseline .qa/baseline.json

# Save baseline after a clean deploy
node frappe-testing/scripts/qa-score.js .qa/findings.json --save-baseline

# Verify the script itself
node frappe-testing/scripts/qa-score.js --selftest
```

`--selftest` exits 0 on pass, 1 on failure. Run it once after install or after editing the script.

---

## Sources

- `apps/frappe/frappe/core/doctype/error_log/error_log.json` — Error Log fields
- `apps/frappe/frappe/core/doctype/error_log/error_log.py` — `frappe.qb.DocType("Error Log")` usage pattern
- `apps/frappe/frappe/commands/scheduler.py` — `bench doctor` command (16.51)
- `apps/frappe/frappe/commands/site.py` — `bench --site <site> list-apps` (16.51)
- `apps/frappe/frappe/commands/utils.py` — `bench version` (16.51)
- Adapted from gstack/qa (MIT): `qa/sections/qa-patterns.md` — Health Score Rubric and tier model
