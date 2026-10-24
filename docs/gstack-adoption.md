# gstack adoption

What was taken from [gstack](https://github.com/garrytan/gstack) (Garry Tan, MIT, licence in `LICENSES/gstack-garrytan-MIT.txt`), what was rewritten for Frappe, and what was left out. Everything adopted is re-derived for Frappe/ERPNext in our own words and verified against installed source; no gstack prose or code is vendored. Nothing from gstack's Apache-2.0 derived design material (`NOTICE.md`: `lib/design-catalog.ts`, `scripts/resolvers/design.ts`, `design-consultation/sections/proposal-and-preview.md.tmpl`) is used.

## Verdicts

| gstack | Verdict | Lands in | Why |
|---|---|---|---|
| `review` confidence calibration + pre-emit gate | ADAPT | `frappe-code-review/references/finding-format-and-gates.md`, the three auditors | Findings carry `(confidence: N/10)`; Frappe-specific gate (attribute exists in source, field exists in DocType JSON, permission path traced) replaces gstack's ORM checks |
| `review` scope-drift check | ADOPT | `frappe-code-review` step 0, `/frappe-review`, `/frappe-ship` | Intent vs diff first; Frappe drift signals (stray fixtures, `patches.txt`, `hooks.py`) |
| Completion status, confusion protocol, claimed limitations need evidence | ADAPT | agents, commands, debugging, deep-research | `DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT` |
| `review/specialists/*` | ADAPT (2 of 8 new) | `frappe-migration-auditor`, `frappe-api-contract-auditor`, `frappe-code-review/references/specialist-passes.md` | Security, performance, testing, simplification already have agents/skills; migration and API-contract had none. Red-team is a checklist, not a persona |
| `qa`, `qa-only`, `health` | ADAPT | `frappe-testing/references/qa-tiers-and-health-score.md`, `frappe-testing/scripts/qa-score.js` | Tiers, weighted score, baseline diff, one fix per commit |
| `canary`, `land-and-deploy`, `setup-deploy` | ADAPT | `frappe-shipping-and-launch/references/post-deploy-verification.md`, CI/CD job | Read-only post-migrate checks; mutating steps staging-only |
| `document-release` | ADAPT | `frappe-documentation-and-adrs` step 8 | Docs match what shipped |
| `careful`, `freeze`, `guard` | ADAPT | `scripts/bench-guard.sh`, `scripts/bench-guard.omp.ts`, `docs/bench-guard.md` | Frappe rules (`drop-site`, core-app edits). Advisory, not a security boundary |
| `office-hours` | ADAPT | `frappe-plan-review` Mode A | "Does stock ERPNext already do this?" replaces the startup diagnostic. Requirements interview already existed (`frappe-requirements-interview`) |
| `plan-ceo-review` | ADAPT | `frappe-plan-review` Mode A | Hold / Reduce / Expand / Defer scope verdicts, upgrade cost as a scored dimension |
| `plan-eng-review` | ADAPT | `frappe-plan-review` Mode D | DocType boundaries, permissions, patch safety, test plan |
| `plan-devex-review` | ADAPT | `frappe-plan-review` Mode C | Whitelisted-API time-to-first-success, error clarity |
| `autoplan` | ADAPT | `/frappe-plan-review` | Chain with auto-decision principles; stops at an approval gate |
| `plan-design-review` | ADAPT | `frappe-design-mockup-review` | 0-10 per dimension with "what a 10 looks like", Frappe slop list written fresh |
| `design-shotgun`, `design-html` | ADAPT | `frappe-design-mockup-review/scripts/generate-mockup.py` | Variants + comparison board, built from real frappe-ui tokens instead of gstack's image tooling |
| `design-review` | ADAPT | `frappe-design-review` | Post-build audit: lint, viewport/theme/state matrix, scored findings, fix loop |
| `ios-design-review`, `ios-qa`, `ios-fix` | ADAPT (method only) | `frappe-design-review`, `frappe-ui-patterns/references/mobile-patterns.md` | Evidence-first loop and state matrix port to PWA/iOS Safari review. SwiftUI/DebugBridge/xcodebuild mechanics do not |
| `ios-clean`, `ios-sync` | SKIP | — | Swift/SPM artefact cleanup and accessor regeneration; no Frappe equivalent |
| `design-consultation` | ADAPT | `frappe-design-consultation` | Scoped to surfaces where no design system is given: website/portal themes, print/email branding, SPA theme overrides. Stock Desk and frappe-ui screens stay on fixed tokens |
| `devex-review` | ADAPT | `frappe-devex-review` | Live curl-driven audit of a built API/onboarding with timing and a six-dimension scorecard; dev sites only. Plan-time DX stays in `frappe-plan-review` Mode C |
| `plan-tune` | SKIP | — | gstack question-preference persistence; omp memory covers it |
| `browse`, `scrape`, `context-save`, `retro`, `learn`, template generation | SKIP | — | omp has a browser tool, sessions and memory |
| "Boil the Ocean" (`ETHOS.md`) | SKIP | — | Conflicts with this pack's minimum-that-works stance. Verification is never skipped; completeness for its own sake is |

## Known limits

- `bench-guard` is advisory. A shell can always route around it; see `docs/bench-guard.md`.
- `frappe-design-mockup-review` renders CSS approximations of frappe-ui tokens, not the real components. Fidelity limits are stated in the skill.
- Eval coverage is Tier 2 (trigger ranking). The new skills' dialogue evals have not been graded.
