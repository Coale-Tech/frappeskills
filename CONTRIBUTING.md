# Contributing

## Add or change a skill

1. Read [docs/skill-anatomy.md](docs/skill-anatomy.md). It is the contract; the validator enforces it.
2. One skill per kind of work. A new topic is a `references/` file in the owning skill unless it is genuinely a new kind of work. Check [docs/agent-skills-parity.md](docs/agent-skills-parity.md) and the router table first.
3. Verify every Frappe-specific claim against installed v16 source (`apps/frappe`, `apps/erpnext`, `apps/hrms`). End each reference with `## Sources`.
4. Write the description as what + `Use when ...`; never summarise the procedure.
5. Add `evals/cases/<skill>.json` (>= 3 positive, >= 2 negative with `owner`, >= 1 dialogue eval).
6. Route it: add a row in `frappe-router/SKILL.md` and a combination in `frappe-router/references/lifecycle.md`.
7. Run `./install.sh` so the new directory is symlinked into every agent skill root.

## Checks (all must pass)

```bash
node scripts/selftest.js
node scripts/validate-skills.js
node scripts/validate-reference-links.js
node scripts/validate-commands.js
node scripts/validate-versions.js
node scripts/run-evals.js            # Tier 2 routing; add --min-rank1 <pct> to ratchet
```

A Tier 2 failure usually means fix the skill's description, not the eval.

## Fix a wrong fact

Installed source outranks this repo. If a reference disagrees with `apps/frappe` on disk, fix the reference and its `## Sources` entry; do not annotate the discrepancy.

## Version tagging

When a behaviour differs between the 16.35.0 baseline and the 16.51.1 delta:
tag the new form `(16.51)` and the old form `(<=16.35)` when both versions are in
production. Do not delete valid 16.35 guidance without a `(<=16.35)` tag. The
`(v16)` tag remains valid for v15/v16 splits; use `(16.51)` for the finer-grained
delta. Verified version pairs: frappe 16.35.0/erpnext 16.6.1/hrms 16.4.1 (baseline)
and frappe 16.51.1/erpnext 16.50.0/hrms 16.50.0 (delta pass).

## Provenance

Adapted third-party material carries an inline `Adapted from <repo> (<licence>): <file>` note and an entry in `NOTICE`; the licence text goes in `LICENSES/`.

## Versioning

Bump `version` identically in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `plugin.json`, `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`; `scripts/validate-versions.js` checks parity.
