# Skill Anatomy

Format contract for every `frappe-*` skill. `node scripts/validate-skills.js` enforces it.

## Layout

```
frappe-<name>/
  SKILL.md        required
  references/     deep topic files, read only when a step needs them
  assets/         templates the skill's work copies (specs, CI workflow, ADR ...)
  scripts/        executable checks
```

Skills are repo-root directories. `install.sh` symlinks each one into the agent skill roots, so one copy exists on disk.

## Frontmatter

```yaml
---
name: frappe-example          # must equal the directory name
description: Does X for Y. Use when Z.   # <= 1024 chars
---
```

Only `name` and `description` are allowed. The description is injected into every system prompt: say what the skill does and when to use it. Never summarise the procedure in it, or the agent follows the summary instead of reading the skill.

## Body: eleven sections, fixed order

| # | Heading | Purpose |
|---|---|---|
| 1 | `## When to use` | Positive triggers and `Not for X -> frappe-y` exclusions |
| 2 | `## Inputs required` | What the agent must have before starting |
| 3 | `## Procedure` | Numbered steps with real commands, hooks, fields |
| 4 | `## Verification` | `- [ ]` exit criteria, each provable with output |
| 5 | `## Failure modes / debugging` | Symptom -> cause -> fix |
| 6 | `## Escalation` | Sibling skills that take over |
| 7 | `## References` | Every `references/*.md` with a one-line description |
| 8 | `## Guardrails` | Hard rules |
| 9 | `## Common Rationalizations` | Excuses agents use to skip steps, each with a factual rebuttal (>= 6) |
| 10 | `## Red Flags` | Observable signs the skill is being violated (>= 6) |
| 11 | `## Common Mistakes` | Technical errors: mistake, why it fails, fix |

`frappe-router` is exempt from sections 2, 4, 5, 6 and 7: it routes, it does not build.

Rationalizations vs Common Mistakes: a rationalization is a *reason to skip process* ("it is only a patch, a dry-run is overkill"). A mistake is a *wrong technical move*. Keep both; do not merge them.

## Budgets

- `SKILL.md`: warn above 200 lines, error above 230. Depth moves to `references/`.
- References are one level deep: link from `SKILL.md`, never chain through another reference.
- Prefer a script over an inline block the agent re-reads every load.

## Hard rules

1. **Installed source outranks everything.** Every API, hook, field, CLI flag, config key and path is checked against `apps/frappe`, `apps/erpnext`, `apps/hrms`. Tag behaviour verified present in 16.51.1 and absent in 16.35.0 as `(16.51)`; tag the old form as `(<=16.35)` when both are in production. The old `(v16)` tag remains valid for v15/v16 splits; use `(16.51)` for the finer-grained 16.35→16.51 delta.
2. **Every `references/*.md` ends with `## Sources`**: the installed-source files checked, relative to the bench.
3. **Machine-agnostic.** No absolute paths, bench topology, client app names or host tooling. Use `<bench>`, `<site>`, `<app>`. Always `bench --site <site> ...`.
4. **`frappe.qb` / `frappe.get_all` / `frappe.get_list`, never `frappe.db.sql`.**
5. **Never edit core apps.** Extend via Custom Fields, fixtures, `doc_events`, `override_doctype_class`, patches.
6. **One skill per kind of work.** New depth goes into a reference of the owning skill. Link, never duplicate.
7. **Adapted third-party material** carries inline provenance naming its source file.
8. **Relative cross-links**: `../frappe-x/SKILL.md`, `../frappe-x/references/y.md`.

## Trigger evals

Each skill has `evals/cases/<skill>.json` with >= 3 positive prompts, >= 2 negative prompts naming the owning sibling, and >= 1 dialogue eval. See [../evals/README.md](../evals/README.md).
