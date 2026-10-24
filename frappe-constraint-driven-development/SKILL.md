---
name: frappe-constraint-driven-development
description: "Establishes a Frappe app's quality bar as a written CONSTRAINTS.md — tests green via `bench --site <site> run-tests --app <app>`, ruff/pre-commit clean (Frappe's own config: line-length 110, rules F E W I UP B RUF), semgrep findings addressed, `bench --site <site> migrate` clean on a fresh site, patches idempotent, every whitelisted method permission-checked, user strings wrapped in `_()`, no `frappe.db.sql` in app code. Checks placed by cost (pre-commit < CI < pre-release). Blocks agents silencing checks or skipping tests to get green without explicit approval. Use when no quality bar exists, when \"set up constraints\" is requested, or when agents are skipping tests to go green."
---

# Frappe Constraint-Driven Development

Write the quality bar down before the agent argues about it.

<!-- Adapted from addyosmani/agent-skills (MIT): skills/constraint-driven-development/SKILL.md -->

## When to use

- Starting a new app or significant feature with no written quality bar
- Agents producing volume that is not being reviewed line by line
- CI has checks but nobody can say which ones block a merge
- User asks: "set up constraints", "define our standards", "stop the agent shipping junk"
- About to run an autonomous build loop and the only gate is a test suite the agent also wrote

Not when `CONSTRAINTS.md` already exists and is not being changed — read it and follow it.  
Not for one-off scripts or throwaway spikes.

## Inputs required

- Installed app name, Frappe/ERPNext version (`bench --site <site> version`)
- Existing pre-commit config (`<app>/.pre-commit-config.yaml`)
- Whether ERPNext / hrms is installed (affects semgrep rule set)
- Test site name for `bench --site <site> run-tests`

## Procedure

### 0) Read before asking

Check `<app>/.pre-commit-config.yaml` and `<app>/pyproject.toml` for existing ruff/eslint config. Read `<app>/patches.txt` to see if idempotency checks exist. Note the `bench --site <site> version` output. Report what is already in place in two lines, then ask only what remains open.

### 1) Four questions, each with a Frappe default

Follow one-question-at-a-time discipline. Each has a default; "I don't know" is a complete answer.

```
Q1: Beyond the floor, which dimensions do you want enforced?
    (a) Test coverage on new code  (b) Semgrep security scan
    (c) Ruff/pre-commit passing    (d) Migration clean on a fresh site
    (e) Patch idempotency check    (f) i18n: all user strings in _()
GUESS: (a) (b) (c) — you have a test runner and you're handling user data.
DEFAULT: (a) (b) (c).

Q2: When a check fails mid-task, block or warn?
GUESS: Block. An unread warning is no gate.
DEFAULT: Block on the floor; warn on coverage/semgrep for the first sprint.

Q3: Do you have target coverage numbers, or should I measure today and hold that line?
GUESS: Measure. Most apps have no baseline yet.
DEFAULT: Measure and hold (ratchet).

Q4: Which test site will the suite run against?
GUESS: A dedicated test site, not the developer's main site.
DEFAULT: Require `allow_tests true` on that site; never run against production.
```

### 2) Write CONSTRAINTS.md at the app root

Use `assets/CONSTRAINTS.md` as the template. Fill in:
- **Floor** (always enforced): no new `# noqa` / `# type: ignore` / `frappe.db.sql` in app code without documented exception; no skipped/deleted tests without commit-message reason; no secrets in source; no bare `frappe.db.sql`; `CONSTRAINTS.md` is not weakened to make a change pass
- **Enforced with numbers**: one row per dimension, including the exact command and when it runs
- **Measured / not yet enforced**: today's value + direction (ratchet)
- **Exceptions**: owner + expiry date; no open-ended exceptions

Add one line to `AGENTS.md` / `CLAUDE.md` in the app root: `Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass.`

### 3) Wire checks by cost tier

| Tier | When | Commands | Budget |
|------|------|----------|--------|
| pre-commit | every commit | `ruff`, `ruff-format`, trailing-whitespace (verified: `apps/frappe/.pre-commit-config.yaml`) | < 5 s |
| CI | every push | `bench --site <site> run-tests --app <app> --coverage`, semgrep, migrate-check | minutes |
| pre-release | before tag | full suite + patch idempotency dry-run | unlimited |

Ruff settings from Frappe's own `pyproject.toml` (verified v16): `line-length = 110`, `select = ["F","E","W","I","UP","B","RUF"]`, `indent-style = "tab"`. Custom app `pyproject.toml` should extend these or use Frappe's `.pre-commit-config.yaml` directly.

### 4) Guard the bar

At review time, compare `CONSTRAINTS.md` against its state at the branch point. Look for:
1. A threshold lowered or a check removed
2. A test `.skip`-ped, deleted, or stripped of assertions
3. New `# noqa`, `# type: ignore`, or `frappe.db.sql` without an exception row
4. An `assets/CONSTRAINTS.md` exception added without owner and expiry
5. `bench migrate` error silenced by removing the patch instead of fixing it

None of this needs tooling beyond `git diff`. Tightening the bar should be silent; loosening it should be loud.

### 5) Ratchet for missing baselines

Run `bench --site <site> run-tests --app <app> --coverage` once to get today's line coverage. Record that number in "Measured / not yet enforced". Every subsequent run must not fall below it. When coverage improves, update the number.

## Verification

- [ ] `CONSTRAINTS.md` exists; every dimension has a stated reason and a command
- [ ] Floor rules enforced and passing on current branch without changes
- [ ] `ruff` and `ruff-format` in pre-commit (line-length 110, Frappe select set)
- [ ] `bench --site <site> run-tests --app <app>` passes on a test site with `allow_tests = 1`
- [ ] `bench --site <site> migrate` passes on a fresh site (no migration errors)
- [ ] Semgrep CI step present for any whitelisted method that takes user input
- [ ] Every exception row has an owner and an expiry date
- [ ] `AGENTS.md` or `CLAUDE.md` references `CONSTRAINTS.md`
- [ ] `references/definition-of-done.md` distinguishes standing bar from per-task criteria

## Failure modes / debugging

- **`allow_tests` not set**: `bench --site <site> set-config allow_tests true`; never set on a production site
- **Migration fails on fresh site**: read `<app>/patches.txt`; find the failing patch; run it by hand and check for non-idempotent SQL or missing dependencies
- **ruff fails on import order**: pre-commit applies `--select=I --fix` automatically; commit the ruff-fixed diff before pushing
- **Semgrep no rules**: use `semgrep scan --config p/python --config p/owasp-top-ten`; scope to `<app>/` to avoid core-app findings
- **Coverage drops unexpectedly**: `--coverage` writes `.coverage`; run `coverage report --include="<app>/**"` scoped to the app

## Escalation

- Writing tests to meet the coverage ratchet → [`frappe-testing`](../frappe-testing/SKILL.md)
- Security findings from semgrep → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Patch or migration failures → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- Building the CI pipeline these constraints run in → `frappe-ci-cd-automation`

## References

- [assets/CONSTRAINTS.md](assets/CONSTRAINTS.md) — CONSTRAINTS.md template for a Frappe app
- [references/definition-of-done.md](references/definition-of-done.md) — Standing quality bar vs. per-task acceptance criteria

## Guardrails

- **Never silence a check to get green** — open an exception row with owner and expiry instead
- **Never skip or delete a failing test** — fix the code, or open a tracked issue and add `@unittest.skip("issue #N")`
- **Ruff settings must match Frappe's verified config** — do not invent stricter or looser rules that conflict with the upstream hook
- **Do not run `bench migrate` or `run-tests` against a production site**
- Every exception in CONSTRAINTS.md must have an owner and an expiry ≤ 90 days

## Common Rationalizations

<!-- Adapted from addyosmani/agent-skills (MIT): skills/constraint-driven-development/SKILL.md -->

| Rationalization | Reality |
|---|---|
| "We'll add constraints once the code settles" | Code settles around whatever was allowed while it was moving |
| "The tests are the constraints" | Tests you wrote prove you agree with yourself; they say nothing about migration safety, i18n coverage, or permission correctness |
| "We can't hit 80% coverage right now" | Don't set 80%; record today's number and hold it |
| "This will slow down the agent" | Only if slow checks are in the fast loop — that is a placement error, not an argument against constraints |
| "It's only a patch, the dry-run on a backup is overkill" | Non-idempotent patches on live data are irreversible; a dry-run on a restored backup is the cheapest insurance |
| "Semgrep has too many false positives" | Scope it to `<app>/` and filter to `p/python`; the noise drops; the whitelisted-method findings are real |
| "I'll remember what our standards are" | The agent won't, and it writes most of the code |

## Red Flags

- `CONSTRAINTS.md` changed in the same commit as the feature that was failing its checks
- A dimension listed in `CONSTRAINTS.md` has no command in the "Checked by" column
- An exception row with no expiry date or owner
- `# noqa` or `frappe.db.sql` added to app code without a corresponding exception row
- A test file deleted or `.skip`-ped without a reason in the commit message
- `bench --site <site> migrate` skipped before tagging a release
- Every constraint checked only by the app's own test suite with no external opinion (semgrep, migration check)

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Using `frappe.db.sql` in app code to avoid ruff/frappe.qb rule | Bypasses the SQL-injection safeguard the framework provides | Rewrite with `frappe.qb` or `frappe.get_all`; document the exception if truly needed |
| Setting coverage target above current baseline | Permanent red CI; team learns to ignore red | Use a ratchet: record today's value and hold it |
| Skipping `bench --site <site> migrate` on a fresh site | Patches that work on the dev site may fail on a clean install | Always test migration from scratch before release |
| Running tests on the main developer site | `allow_tests` writes and deletes data | Use a dedicated test site; never set `allow_tests` on production |
| Adding ruff ignore comments instead of fixing violations | Silences the linter; violations accumulate | Fix the code; document an exception in CONSTRAINTS.md only for intentional deviations |
