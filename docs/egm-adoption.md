# Elephant-Goldfish Model adoption

What was taken from the [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) (Google, Apache-2.0, licence in `LICENSES/egm-google-Apache-2.0.txt`) and what was left out. Ideas are rewritten for Frappe in our own words; the script is original code. No EGM text or code is copied.

## Adopted

| Idea | EGM source | Where it lives here |
|------|------------|---------------------|
| Comprehension check: a fresh reader restates the spec; whatever it cannot restate is an ambiguity | `agents/comprehension.md`, review stage 6 | `frappe-spec-driven-development` step 3 |
| Zero-decision readiness: no field type, patch phase, hook or signature left for the implementer | `resources/document_standards/implementation-readiness-standard.md` | `frappe-planning-and-task-breakdown` step 6 |
| Alternatives rule: a spec with one path and no rejected options is not ready | `feature-spec-standard.md` | `frappe-spec-driven-development` Objective, `assets/spec-template.md` |
| Reuse by code search before approving new code | `agents/zoom_out.md` | `frappe-plan-review` Mode A |
| Spec-vs-code drift report, differences only | `skills/egm_drift_report/SKILL.md` | `frappe-spec-driven-development/scripts/spec-drift.js` |

`spec-drift.js` is scripted where EGM's is a manual walk. It reads `### DocType:` sections of a spec written from `assets/spec-template.md` and compares DocType fields (name and type), `is_submittable` and permission roles with the app's DocType JSON. Layout fields (Section, Column, Tab Break) are ignored. Exit 0 no drift, 1 drift, 2 usage error or no DocType sections found. It does not compare permission flags, workflow, hooks or patches.

## Not adopted

- Nested synthesizer, A/B duplicate reviewers, five-stage review with a gate between stages: synthesis stays with the lead, and the refutation pass already runs one verifier per lens.
- Contest or propose-fix triage: the four-way reconcile in `frappe-doubt-driven-development` is richer.
- Anti-flattery rules (critique first, banned praise words and apologies): prompt text only; the refute-mode smoke test returned clean output without it.
- Six-lens brainstorm swarm: overlaps the performance, migration, API-contract and security agents.
- `omitClaudeMd: true` on agents: real in Claude Code 2.1.271+, but these agents install only for omp, so it has no effect today. It would also strip project notes the reviewers may need.
- Artifact-first delivery, structured-question gate rules, bootstrap documentation generator: harness-specific or out of scope.
