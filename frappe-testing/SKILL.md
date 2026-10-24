---
name: frappe-testing
description: "Write and run Frappe tests including unit tests, test records and factories, CI pipelines, and Playwright or Cypress UI tests. Use when proving behaviour, preventing regressions, or wiring test automation."
---

# Frappe Testing

Prove the behaviour you changed, and keep it proven.

## When to use

- Writing unit or integration tests for controllers, APIs, or jobs
- Building test data factories and fixtures
- Wiring CI for an app
- Writing Playwright or Cypress UI tests for Desk or a portal

## Inputs required

- The contract under test (what a consumer observes)
- The site to run tests against (never production)
- Existing test conventions in the app

## Procedure

### 0) Decide whether a test is warranted

A test earns its place when a plausible bug would fail it: behaviour,
boundaries, invariants, transitions, precedence, real errors. Wiring, defaults
and field copies do not need tests — use a throwaway script instead.

### 1) Write the test

```python
import frappe
from frappe.tests import IntegrationTestCase

class TestSampleDoc(IntegrationTestCase):
    def test_negative_amount_rejected(self):
        doc = frappe.get_doc({"doctype": "Sample Doc", "amount": -5})
        with self.assertRaises(frappe.ValidationError):
            doc.insert()
```

Patterns, factories and fixtures:
[references/testing.md](references/testing.md),
[references/test-patterns.md](references/test-patterns.md).

### 2) Run it

```bash
bench --site <site> run-tests --app <app>
bench --site <site> run-tests --module <app>.tests.test_sample_doc
bench --site <site> run-tests --doctype "Sample Doc"
```

`run-tests` exits with "Testing is disabled for the site!" unless the site has
`allow_tests` set (`bench --site <site> set-config allow_tests true`) or the
`CI` env var is present. Use a dedicated test site; each test class rolls back
its writes. Parallel CI: `bench run-parallel-tests --app <app> --build-number
<n> --total-builds <n>` (there is no `--split`).

### 3) Add UI coverage where it matters

Playwright (≥1.63) is the default UI test runner in Frappe 16.51+ when `playwright.config.*` exists at the app root. Cypress 13 is still supported for apps that only have `cypress.config.*` (deprecated; will be removed in v17).
Setup and CLI reference: [references/ui-testing.md](references/ui-testing.md).

### 4) Wire CI

GitHub Actions setup with MariaDB/Redis services and bench bootstrap:
[references/ci-testing.md](references/ci-testing.md).

### 5) Score a QA session

After a manual or browser QA pass, serialize findings to `.qa/findings.json` (schema in [references/qa-tiers-and-health-score.md](references/qa-tiers-and-health-score.md)) and score them:
```bash
node frappe-testing/scripts/qa-score.js .qa/findings.json --save-baseline
```
Quick, Standard, and Exhaustive tier definitions, the weighted rubric, baseline diff, and the one-fix-one-commit rule are all in the reference.

## Verification

- [ ] The new test fails before the fix and passes after it
- [ ] Tests pass from a clean site, not only locally
- [ ] No test depends on another test's leftover data
- [ ] Tests do not hit external services (mocked or skipped)
- [ ] CI run is green on a fresh checkout
- [ ] Suite runtime stays acceptable

## Failure modes / debugging

- **`DoesNotExistError` on test data**: dependency records not created; use a factory or `test_records`
- **Tests pass alone, fail in the suite**: shared state or an uncommitted transaction leaking between tests
- **"Testing is disabled for the site!"**: `allow_tests` not set on the site
- **UI test runner can't reach the site or log in**: test user fixtures missing; or `BASE_URL` (Playwright) / `CYPRESS_baseUrl` (Cypress) env var not set
- **Slow suite**: real network calls or unnecessary document creation per test

## Escalation

- Behaviour is unclear before testing it → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- Whole-app quality sweep → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Environment isolation for tests → [`frappe-manager`](../frappe-manager/SKILL.md)
- UI flows that a Python test cannot cover → [`frappe-browser-testing`](../frappe-browser-testing/SKILL.md)
- Diagnosing a failing test where the root cause is unclear → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)

## References

- [references/testing.md](references/testing.md) - Test runner, structure, assertions
- [references/test-patterns.md](references/test-patterns.md) - Factories, fixtures, mocking
- [references/ci-testing.md](references/ci-testing.md) - CI pipelines for Frappe apps
- [references/ui-testing.md](references/ui-testing.md) - UI testing: Playwright (default, 16.51+) and Cypress (legacy)
- [references/cypress.md](references/cypress.md) - Cypress 13 command set (legacy — migrate to Playwright for new apps)
- [references/tdd-workflow.md](references/tdd-workflow.md) - Red-green-refactor, Prove-It pattern, test pyramid applied to Frappe
- [references/qa-tiers-and-health-score.md](references/qa-tiers-and-health-score.md) - QA tiers, Frappe health score rubric, baseline schema, regression mode, atomic commit rule

## Guardrails

- **Never run tests against production**: the runner writes and deletes data
- **Test observable contracts**, not implementation details or source text
- **Deterministic and isolated**: no ordering dependencies, no shared mutable state
- **No external network calls** in tests
- **Delete tests that pin wording or implementation** rather than re-pinning them


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The test passed once, ship it" | A single passing run proves nothing — flaky tests pass under some conditions and fail under others. |
| "I tested it manually" | Manual testing does not persist; tomorrow's change breaks it with no automated signal. |
| "This is too simple to test" | Simple DocType validators accumulate corner cases and translation regressions over time. |
| "Tests slow me down on tight deadlines" | Regressions discovered on a production site cost far more than tests written now. |
| "Running on the production site is the only real test" | The test runner writes and deletes data; running against production corrupts live records. |
| "I'll write the tests after the feature is done" | Tests written post-hoc verify the implementation, not the contract; the Prove-It signal is lost. |

## Red Flags

- `from frappe.tests.utils import FrappeTestCase` — deprecated shim (removed in v17); use `from frappe.tests import IntegrationTestCase`
- `allow_tests` not set on the test site — the runner exits silently without running any test
- Tests depend on documents left by a previous test class (ordering dependency)
- `assertRaisesRegex` or `assertIn` on an exact translated error string — breaks on locale change
- Real network or third-party API calls inside a test method — slow, flaky, non-deterministic
- Tests skipped with `@unittest.skip` "temporarily" with no linked issue or expiry

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Asserting on internal fields | Breaks on refactor | Assert consumer-visible behaviour |
| Tests depending on execution order | Flaky suite | Independent setup per test |
| Real API calls in tests | Slow and flaky | Mock the boundary |
| Writing a test to "have tests" | Maintenance load, no signal | Throwaway script instead |
| Running tests on the live site | Data loss | Dedicated test site |
| Pinning exact error strings | Breaks on translation | Assert the exception type |
| `from frappe.tests.utils import FrappeTestCase` | Deprecated compat shim, removed in v17 | `from frappe.tests import IntegrationTestCase` (or `UnitTestCase`) |
