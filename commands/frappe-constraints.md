---
description: Define and enforce this Frappe project's quality bar — write CONSTRAINTS.md with Frappe-safe defaults
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/constraints.md -->

Load the `frappe-constraint-driven-development` skill (omp: `read skill://frappe-constraint-driven-development`).

$ARGUMENTS

Sub-commands: `check` (run constraints against current branch), `guard` (scan diff for a weakened bar), `ratchet` (record today's measured values as the new floor).

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Default (no sub-command): set up constraints for this repository.

1. **Detect first.** Read `pyproject.toml`, `setup.cfg`, `ruff.toml`, `.pre-commit-config.yaml`, `.semgrep.yml`, and CI workflows. Report what exists in two lines. Never ask for information you can read.

2. **Interview, at most four questions** (one at a time, each with a working default): coverage floor; block or warn on failure mid-task; target numbers or measure today's baseline; slowest check tolerated before handing work back.

3. **Write `CONSTRAINTS.md`** at the repo root with: Floor section (tests passing, `bench --site <site> migrate` clean, ruff lint, semgrep, patch idempotency guard, permission checks, i18n `_()` coverage); enforced numbers with stated reasons; measured-only metrics with today's values; exceptions table with owner and expiry date.

4. **Place checks by cost.** Ruff + semgrep in the edit loop (seconds). Relevant tests at task end (< 90 s). Full suite + migrate in CI. Scope checks to the diff, not the whole repo.

5. **Point the agent at it.** Add a line to `AGENTS.md` (or `CLAUDE.md`) instructing agents to read `CONSTRAINTS.md` and never weaken it to make a change pass.

**Verification gate:** run the constraints against the current branch. If anything fails that the user disagrees with, fix the constraint now rather than leaving a gate that people will learn to ignore.
