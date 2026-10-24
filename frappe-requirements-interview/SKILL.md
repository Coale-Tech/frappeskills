---
name: frappe-requirements-interview
description: "Extracts what a Frappe project actually needs through a one-question-at-a-time interview (confidence 0–100%) and divergent/convergent idea refinement for vague requests. Outputs a structured requirements brief covering DocTypes, role/permission matrix, workflow states, naming series, reports, prints, integrations, multi-company/site, Frappe version, installed apps, data migration, and compliance. Use when an ask is underspecified (\"build me a module for X\"), when the user says \"interview me\" / \"refine this idea\", or when a vague concept needs shaping before frappe-spec-driven-development can begin. Not for already-concrete asks with a named DocType, explicit roles, and stated workflow."
---

# Frappe Requirements Interview

Determine what to build before writing any spec or DocType.

<!-- Adapted from addyosmani/agent-skills (MIT): skills/interview-me/SKILL.md, skills/idea-refine/SKILL.md -->

## When to use

- Ask is missing any of: which DocTypes, who uses them, what access they need, what success looks like
- Request is vague ("build me a claims module") — DocType model cannot be determined without guessing
- Multiple shapes are plausible (child table vs. standalone DocType vs. override of ERPNext)
- User invokes: "interview me", "grill me", "refine this idea", "stress-test my plan"

Not for concrete asks with named DocTypes, explicit roles, and stated workflow → [`frappe-spec-driven-development`](../frappe-spec-driven-development/SKILL.md).  
Not for CI, scheduled jobs, or non-interactive contexts — flag underspecification as a blocker instead.

## Inputs required

- User's raw idea or ask
- Installed apps + version: `bench --site <site> version`
- `<app>/hooks.py` and `<app>/modules.txt` to know existing DocTypes and modules

## Procedure

### 0) Detect context before asking

Run `bench --site <site> version` to record installed apps (frappe, erpnext, hrms…) and version (v15 vs v16). Read `<app>/hooks.py` for existing `doc_events`. Note v16 differences where relevant (e.g. `workflow_state` field presence, `on_submit` cascade behaviour).

### 1) State hypothesis + confidence

```
HYPOTHESIS: You want a Salary Advance DocType submitted by employees, approved by HR Manager.
CONFIDENCE: ~35% — missing: naming series, multi-company, ERPNext Cost Centre link, who can cancel
```

Confidence below ~70%: append a one-line reason (what is still unresolved).

### 2) Ask one question at a time with a guess

Draw from `references/question-bank.md`. Ask only what is still unresolved.

```
Q:     Which roles can submit, approve, and cancel this document?
GUESS: Employee submits, HR Manager approves — the common two-step. If Finance is also needed, the approval chain changes.
```

Wait for the answer before the next question. Three or more questions per turn is batching.

### 3) Divergent phase (if confidence stays below ~50% after two rounds)

Generate 4–6 Frappe-shaped variants (standalone DocType / child table on existing Doc / override of ERPNext DocType / configuration via System Settings). Cluster into 2–3 directions. For each, name: user value, feasibility on installed apps, permission complexity, and one assumption that could kill it. Ask the user which resonates.

### 4) Converge: restate as requirements brief

When confidence ≥ ~95%, complete `assets/requirements-brief.md`:
- Outcome, users, DocTypes + fields sketch, role/permission matrix, workflow states, naming series, report and print needs, integration points (ERPNext GL / HR / custom API), multi-company / multi-site flags, Frappe version, migration concerns, compliance, explicit out-of-scope.

### 5) Confirm — explicit yes only

"Whatever you think" → offer two concrete shapes as a choice.  
"Sounds good" → "Anything to refine?"  
Explicit yes → stop this turn, offer to feed `assets/requirements-brief.md` into [`frappe-spec-driven-development`](../frappe-spec-driven-development/SKILL.md).

## Verification

- [ ] `bench --site <site> version` output noted before first question
- [ ] Hypothesis + confidence stated in turn 1
- [ ] Confidence below ~70% accompanied by a stated reason
- [ ] Questions asked one at a time, each with a guess
- [ ] Divergent phase ran when confidence stalled below ~50%
- [ ] Requirements brief covers all sections in `assets/requirements-brief.md`
- [ ] Explicit yes received; turn stopped before any DocType JSON or spec was started

## Failure modes / debugging

- **Confidence stalls on buzzwords** ("best-practice Frappe setup", "standard approach"): ask "If you weren't justifying this to anyone, what would you actually want?"
- **Ambiguous roles**: offer three concrete ERPNext role names and ask which apply
- **"Like ERPNext Expense Claim"**: read the target DocType controller before continuing — don't guess its schema
- **Multi-company ambiguity**: ask whether Company link fields suffice or per-company data isolation is needed
- **v15 vs v16 gap**: workflow, submit behaviour, and naming series differ; confirm installed version first

## Escalation

- Requirements brief complete → [`frappe-spec-driven-development`](../frappe-spec-driven-development/SKILL.md)
- Existing DocType behaviour is unclear → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Installed app version affects the answer → [`frappe-project-triage`](../frappe-project-triage/SKILL.md)

## References

- [references/question-bank.md](references/question-bank.md) — Frappe-shaped question pool: DocTypes, roles, workflow, naming, reports, integration, multi-company, migration, compliance
- [assets/requirements-brief.md](assets/requirements-brief.md) — Requirements brief template consumed by frappe-spec-driven-development

## Guardrails

- **No spec, DocType JSON, or code until the requirements brief has an explicit yes**
- **One question per turn** — batching buries your assumptions
- **Every question carries your guess** — makes your assumptions visible
- **Do not save requirements-brief.md before confirmation** — saving implies a yes the user hasn't given
- Never assume the installed Frappe version matches memory; read it from the bench

## Common Rationalizations

<!-- Adapted from addyosmani/agent-skills (MIT): skills/interview-me/SKILL.md -->

| Rationalization | Reality |
|---|---|
| "The DocType name is obvious from the ask" | The name covers dozens of possible schemas; ask about the core field list first |
| "Frappe has a standard way to do this" | Three valid shapes usually exist (child table, standalone, override); pick one on evidence |
| "I'll sort the permission matrix when I build the DocType" | Permissions drive the schema — owner-only vs role-based visibility changes which fields exist |
| "The user said ERPNext handles it already" | ERPNext has 800+ DocTypes; find the right one and read its controller before assuming |
| "v15 and v16 are basically the same" | `workflow_state`, naming series behaviour, and `on_submit` cascade differ between versions |
| "I'll ask all important questions in one list" | Lists produce skim answers; one-at-a-time produces real constraints |
| "The ask mentions a report, so no DocType is needed" | Reports require a data source; the DocType design comes first |

## Red Flags

- Three or more questions in a single turn
- A question asked without a guess attached
- No Frappe version recorded before answering workflow or API questions
- DocType JSON or spec started before an explicit yes on the requirements brief
- "Standard Frappe" or "like ERPNext X" accepted without reading the referenced DocType
- Confidence below ~70% with no stated reason
- Divergent phase skipped when confidence stalled below ~50% after two rounds

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Designing DocType schema before knowing roles | Permissions alter field layout (hidden/mandatory per role) | Clarify role matrix before any field list |
| Assuming hrms or erpnext is installed | User may run a custom or minimal Frappe bench | Read `bench --site <site> version` first |
| Skipping multi-company question | Company link and naming series differ per deployment | Ask explicitly if more than one Company record is possible |
| Treating "workflow" and "submit/cancel" as the same | Frappe Workflow is a separate DocType; submit/cancel is a `docstatus` flag | Clarify whether a Frappe Workflow DocType or simple docstatus transitions are needed |
| Skipping "Out of scope" in the restate | Silent disagreement on non-goals causes post-build scope creep | Always include an explicit out-of-scope line in the requirements brief |
