---
name: frappe-ci-cd-automation
description: "Sets up and maintains GitHub Actions CI/CD for Frappe apps, including bootstrapping the bench in the workflow runner and troubleshooting CI failures. Use when configuring quality-gate pipelines (lint, semgrep, tests, asset build), fixing a broken CI workflow, automating deploy (bench update or image-based), or handling secrets. Not for writing tests → frappe-testing. Not for bench upgrade operations → frappe-bench-operations. Not for security sweeps → frappe-app-audit."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/ci-cd-and-automation/SKILL.md -->

# Frappe CI/CD Automation

Automated quality gates so no change reaches production without passing lint, semgrep, tests, and an asset build.

## When to use

- Bootstrapping a CI pipeline for a new Frappe app
- Adding quality gates (ruff, semgrep, test coverage) to an existing pipeline
- Wiring deploy automation (`bench update` or container image build)
- Debugging CI failures and feeding output back to agents
- Managing GitHub Secrets for site_config values

Not for: test authoring → `frappe-testing`. Bench migrations and rollbacks → `frappe-bench-operations`. Full app security audit → `frappe-app-audit`.

## Inputs required

- App repo URL and target Frappe `--branch` (e.g. `version-16`)
- Python / Node version constraints from `pyproject.toml` / `package.json`
- Secrets needed (DB password, `site_config` values, deploy key)

## Procedure

### 0) Quality gate ordering

Fail fast and cheaply first:
```
lint (ruff / pre-commit)
  ↓ pass
semgrep (frappe/semgrep-rules)
  ↓ pass
tests (bench run-tests)  ← detail: frappe-testing/references/ci-testing.md
  ↓ pass
asset build (bench build --app <app>)
  ↓ pass
deploy (bench update or image push)
```

No gate can be skipped; a failing lint must be fixed, not suppressed.

### 1) Provision the workflow

Copy `assets/frappe-app-ci.yml` from this skill into `.github/workflows/ci.yml` in your app repo.
Adjust `python-version`, `node-version`, and `frappe-branch` to match your `pyproject.toml`.

The template covers:
- MariaDB 11.8 service (matches Frappe's own `_base-server-tests.yml`)
- Redis installed via `apt-get` (same approach as `frappe/.github/actions/setup/action.yml`)
- bench bootstrap → `bench init` → `bench get-app` → `bench new-site` → `bench install-app`
- Pre-commit (ruff) lint job
- Semgrep job using `frappe/semgrep-rules` (verified in `frappe/.github/workflows/linters.yml`)
- Test job via `bench run-tests` — for full test-job detail see [`../frappe-testing/references/ci-testing.md`](../frappe-testing/references/ci-testing.md)
- Asset build via `bench build --app <app>`

**Adding a UI test job (16.51+):** add `playwright.config.*` to the app root; `bench run-ui-tests`
auto-selects Playwright. Cache `~/.cache/ms-playwright` keyed on `frappe/commands/testing.py` hash
(mirrors `frappe/.github/workflows/_base-ui-tests.yml`). Cypress Cloud params (`--group`, `--record-key`,
`nyc` coverage) no longer apply to Playwright; use `--shard N/M` and `--parallel-site` instead.
Upload failures as `playwright-report-*` artifacts, not `cypress_recordings.zip`.

### 2) Secrets handling

Never hard-code credentials. Store them in GitHub → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `DB_ROOT_PASSWORD` | MariaDB root password for test site creation |
| `DEPLOY_KEY` | SSH key or token for production bench host |
| `SENTRY_DSN` | Optional: passed to `FRAPPE_SENTRY_DSN` (see `frappe/integrate_sentry.py`) |

Frappe's own CI uses `MARIADB_ROOT_PASSWORD: ${{ env.DB_ROOT_PASSWORD }}` as an env var set at the job level — avoid `secrets.*` in `services:` blocks (GitHub Actions limitation).

### 3) Lint gate (ruff + pre-commit)

```yaml
- name: Run pre-commit
  uses: pre-commit/action@v3.0.1
```

Frappe's `linters.yml` uses `pre-commit/action@v3.0.1` for the pre-commit step. Your app's `.pre-commit-config.yaml` must exist (see `frappe-git-workflow-and-versioning`).

### 4) Semgrep gate

```yaml
- name: Download Semgrep rules
  run: git clone --depth 1 https://github.com/frappe/semgrep-rules.git frappe-semgrep-rules

- name: Run Semgrep
  run: |
    pip install semgrep
    semgrep ci --config ./frappe-semgrep-rules/rules --config r/python.lang.correctness
```

This mirrors `frappe/.github/workflows/linters.yml` exactly. The `frappe/semgrep-rules` repo contains Frappe-specific rules: no raw `frappe.db.sql`, no `ignore_permissions=True` without justification.

### 5) Deploy automation

**bench-based deploy:**
```yaml
- name: Deploy
  run: |
    ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} \
      "cd <bench> && bench update --pull --reset --no-backup"
```
`bench update` handles `git pull`, `pip install`, `bench migrate`, and worker restart. Always take a site backup before deploy (step in `frappe-shipping-and-launch`).

**Image-based deploy:** build a `frappe_docker`-compatible image and push on `version-*` tag push. Trigger a downstream workflow via `workflow_dispatch` — same pattern as ERPNext's `on_release.yml`.

**Post-deploy health check job (bench-based):** run after the deploy step as a separate `needs: [deploy]` job to catch server-side regressions before users do:
```yaml
- name: Post-deploy health check
  run: |
    ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} \
      "cd <bench> && bench doctor --site ${{ secrets.SITE }} && \
       bench --site ${{ secrets.SITE }} console <<< \
         'import frappe; print(frappe.db.count(\"Error Log\")); exit()'"
```
Full diagnostic checklist (Error Log diff, Patch Log, queue depth): [`../frappe-shipping-and-launch/references/post-deploy-verification.md`](../frappe-shipping-and-launch/references/post-deploy-verification.md).

### 6) Failure feedback loop

When CI fails, paste the job log into the agent prompt:
```
The CI lint job failed:
  ruff: error: found 2 errors
  app/controllers/my_doc.py:45:5: E501 line too long

Fix the issues and push again.
```

Pattern: lint → `pre-commit run --all-files`; test → read the `bench run-tests` output traceback; semgrep → read the rule ID and the file it flagged.

## Verification

- [ ] `lint` job runs `pre-commit` and fails on ruff errors
- [ ] `semgrep` job uses `frappe/semgrep-rules` and fails on `frappe.db.sql` violations
- [ ] `test` job bootstraps a fresh bench with MariaDB 11.8 + Redis and exits non-zero on test failure
- [ ] `build` job runs `bench build --app <app>` successfully
- [ ] No secrets appear in logs or workflow YAML
- [ ] Deploy job only triggers on `push` to `version-*` or `develop` branch (not on PRs)
- [ ] YAML validates: `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml`

## Failure modes / debugging

- **`bench new-site` fails**: MariaDB service not healthy yet; add `options: --health-cmd="mysqladmin ping"`.
- **`bench run-tests` skips all tests**: `allow_tests` not set; add `bench --site test_site set-config allow_tests 1 --parse` in setup.
- **semgrep exits 1 on a false positive**: add a `# nosemgrep` comment on the line (Frappe itself does this in patches).
- **pre-commit fetches hooks slowly**: cache `~/.cache/pre-commit` with `actions/cache`.
- **Redis connection error**: `bench start` is not needed for test jobs; the `bench init` step starts Redis automatically via `redis-server` installed in the previous step.

## Escalation

- Test authoring detail → [`frappe-testing`](../frappe-testing/SKILL.md)
- Bench upgrade, backup, restore → [`frappe-bench-operations`](../frappe-bench-operations/SKILL.md)
- Pre-launch checklist → [`frappe-shipping-and-launch`](../frappe-shipping-and-launch/SKILL.md)
- Full security audit → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)

## References

- [`assets/frappe-app-ci.yml`](assets/frappe-app-ci.yml) — Complete GitHub Actions pipeline template for a Frappe app

## Guardrails

- **Test job detail stays in `frappe-testing/references/ci-testing.md`**: do not duplicate runner flags here.
- **No hardcoded `MARIADB_ROOT_PASSWORD` values** in YAML: use job-level `env:` fed from secrets.
- **Deploy job never runs on PRs**: gate with `if: github.ref == 'refs/heads/develop'` or tag push trigger.
- **`bench update --no-backup` only if a prior step took a backup**: never skip the backup step.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "semgrep is slow; I'll skip it." | `frappe/semgrep-rules` catches `frappe.db.sql` and `ignore_permissions` misuse that review misses. |
| "The test job is complex; I'll rely on local tests." | CI runs on a clean bench; local tests can pass against stale state. |
| "I'll fix the CI yaml syntax later." | A broken `.github/workflows/` file silently skips all jobs. Validate before pushing. |
| "I'll store the deploy key in the YAML file." | Secrets in YAML are exposed in PR diffs and forks. Use GitHub Secrets only. |
| "The bench bootstrap is slow; I'll cache the whole bench." | bench state ties to MariaDB data; caching breaks across schema changes. Cache only pip and npm. |
| "I'll run deploy on every push." | Deploy on tag or on merge to `version-*`/`develop` only; not on feature branches. |

## Red Flags

- No lint gate before the test gate (slow feedback)
- `frappe.db.sql` in app code with no semgrep gate to catch it
- `DB_ROOT_PASSWORD: root` or similar plaintext in workflow YAML (not just in env from secret)
- Deploy job triggered on every PR branch push
- `bench update --no-backup` without a prior backup step
- CI passes locally but fails in CI: `allow_tests` missing or MariaDB service not healthy
- No `if: always()` on a log-upload step, causing silent loss of failure evidence

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Skipping `bench --site test_site set-config allow_tests 1` | `run-tests` exits "Testing is disabled" | Add the set-config step after `install-app` |
| Using `postgres:` service instead of `mariadb:` | Frappe defaults to MariaDB; app tests may use MariaDB-specific SQL | Use `mariadb:11.8` service |
| Running `bench start` in the test job | Not needed; Redis is started via `apt-get`; `bench start` conflicts with CI port usage | Remove `bench start`; use system Redis |
| Caching the entire `frappe-bench/` directory | Stale DB state causes random test failures | Cache only `~/.cache/pip` and `~/.npm` |
| Putting secrets in `services:` env block | GitHub Actions doesn't expand `${{ secrets.* }}` in `services:` | Set them as job-level `env:` and reference `${{ env.* }}` |
