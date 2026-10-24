# Constraints

Last reviewed: YYYY-MM-DD by @___  
App: `<app>`  
Frappe version: v__ (run `bench --site <site> version` to confirm)

> This file is the quality bar for `<app>`. Read it before writing code. Do not weaken it to make a change pass — open an exception row instead.

---

## Floor (always enforced, no setup required)

Every item below is checked by `git diff` at review time. None require a tool installation.

- No new `# noqa` or `# type: ignore` in `<app>/` without an exception row in this file
- No `frappe.db.sql` in `<app>/` app code (use `frappe.qb` or `frappe.get_all`); exception only via `frappe-api-development/references/database.md`
- No skipped or deleted tests without a reason in the commit message (`@unittest.skip("issue #N")` is allowed)
- No secrets (API keys, passwords, tokens) in source
- No bare `frappe.db.sql` in patches — use parameterised queries if SQL is unavoidable
- This file (`CONSTRAINTS.md`) is not weakened to make a failing change pass; loosen only with owner + expiry

---

## Enforced with numbers

Every row names the exact command that produces the verdict. A dimension without a command is an aspiration, not a constraint.

| Dimension | Rule | Command | Runs at | Notes |
|-----------|------|---------|---------|-------|
| Ruff lint | Zero errors | `ruff check <app>/` | pre-commit | line-length 110, select F E W I UP B RUF (verified: `apps/frappe/pyproject.toml`) |
| Ruff format | Zero formatting errors | `ruff format --check <app>/` | pre-commit | indent-style tab, quote-style double |
| Trailing whitespace | None in Python/JS/Vue | `pre-commit run trailing-whitespace` | pre-commit | |
| Tests | Suite exits 0 | `bench --site <site> run-tests --app <app>` | CI | Requires `allow_tests = 1` on test site; never on production |
| Migration | `bench migrate` exits 0 on fresh site | `bench --site <site> migrate` | CI, pre-release | Run against a freshly created test site |
| Semgrep | No high findings in `<app>/` | `semgrep scan --config p/python --config p/owasp-top-ten <app>/` | CI | Scope to `<app>/` to avoid findings in core apps |
| i18n | All user strings in `_()` | `bench --site <site> build-message-files --app <app>` exits 0 | CI | Untranslated strings surfaced as warnings |
| Permissions | Every `@frappe.whitelist` method has a `frappe.has_permission` call | `grep -rn "whitelist" <app>/ | grep -v "has_permission"` (manual review) | Code review | |

---

## Measured, not yet enforced

Run `bench --site <site> run-tests --app <app> --coverage` to set the baseline.

| Metric | Today's value | Direction | Enforced since |
|--------|--------------|-----------|----------------|
| Line coverage (`<app>/`) | ___ % | must not fall | — |

*Ratchet rule: when coverage improves, update the number above. When it falls, that is the finding.*

---

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
| — | — | — | — | — | — |

*Maximum lifetime: 90 days. An exception with no expiry date is invalid.*

---

## How checks are wired

```
pre-commit  →  ruff check, ruff format, trailing-whitespace
CI          →  bench run-tests, bench migrate (fresh site), semgrep
pre-release →  full suite + patch idempotency dry-run on restored backup
```

Add to `AGENTS.md` / `CLAUDE.md` in the app root:

```
Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass.
```

---

*Sources: `apps/frappe/.pre-commit-config.yaml` (ruff hooks, hook rev v0.14.10), `apps/frappe/pyproject.toml` ([tool.ruff] section — line-length 110, select, ignore, indent-style tab), `apps/frappe/frappe/commands/testing.py` (run-tests flags: --app, --coverage, allow_tests requirement)*
