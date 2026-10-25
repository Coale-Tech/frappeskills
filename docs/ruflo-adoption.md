# Ruflo adoption

What was taken from [ruflo](https://github.com/ruvnet/claude-flow) (ruvnet, MIT, licence in `LICENSES/ruflo-ruvnet-MIT.txt`) and what was left out. Everything adopted is rewritten for Frappe in our own words; no ruflo code is vendored. Ruflo's agent set is mostly slogans and MCP-tool wrappers; only the items below are backed by a concrete mechanism.

## Adopted

| Idea | Ruflo source | Where it lives here |
|------|--------------|---------------------|
| Pipe-to-shell, site-config exfiltration, untrusted install checks | `plugins/ruflo-protector/hooks/shapes.ts` | `scripts/bench-guard.sh`, `docs/bench-guard.md` |
| Credential-shaped content in a Write/Edit | `plugins/ruflo-protector/hooks/screen.ts` (token shapes, placeholder exemptions) | `scripts/bench-guard.sh` file tier, `scripts/bench-guard.omp.ts` |
| Independent refutation of Critical/Required findings, default to refuted | `plugins/ruflo-agent/agents/nested-reviewer.md` | `omp/agents/frappe-reviewer.md` (Refute mode), `commands/frappe-ship.md`, `frappe-code-review/references/finding-format-and-gates.md` |
| `Followups` and `Truncated` in the completion status; never invent a measured number | `nested-leaf.md`, `plugins/ruflo-goals/agents/deep-researcher.md` | all eight `omp/agents/*.md` |
| Leaf agents have no spawn tool | `nested-leaf.md` | already true: read-only personas list `read, bash, grep, glob`; stated in `docs/agents.md` |
| "Which persona" table | decision tables in ruflo agents | `docs/agents.md` |
| Test-first repair guardrails (stop if already green, never edit the test, bounded unattended run) | `plugins/ruflo-testgen/skills/tdd-repair/SKILL.md` | `frappe-debugging-and-error-recovery` Guardrails |

## Not adopted

- Root-delete shell parser (`.claude/helpers/hook-handler.cjs`): about 200 lines for a guard that targets bench directories.
- SQL migration validation: Frappe patches are Python, covered by `frappe-migration-auditor`.
- Browser skills needing RVF containers, GOAP/autopilot/daa/wasm agents, SONA/HNSW learning, swarm topologies, consensus, hive-mind: need ruflo infrastructure or have no implementation.
- Learned baselines and rate anomalies in `ruflo-protector`: stateful; the guard stays stateless.
