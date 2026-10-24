# UI Testing: Playwright and Cypress

`bench run-ui-tests` uses **Playwright** (≥1.63.0, `PLAYWRIGHT_VERSION = "1.63.0"`) when it
finds `playwright.config.{js,ts,mjs,cjs,mts,cts}` at the app root, or **Cypress 13** for
apps that only have `cypress.config.*` (deprecated — will be removed in v17). New apps MUST
ship a Playwright config. (16.51+)

Old behaviour (≤16.35): `bench run-ui-tests` always used Cypress; `cypressargs`,
`--with-coverage`, `--ci-build-id`, and `--parallel` flags were accepted.

---

## Playwright (default — 16.51+)

### Prerequisites and auto-install

`bench run-ui-tests` installs `@playwright/test@1.63.0` into Frappe's `node_modules`
automatically the first time it runs, if not already present.

### Directory structure

```
my_app/
├── playwright.config.ts       # required — triggers Playwright runner
└── tests/
    └── ui/
        └── test_sample_doc.ts
```

### Minimal `playwright.config.ts`

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  use: {
    baseURL: process.env.BASE_URL || "http://test_site:8000",
    headless: true,
  },
  retries: 1,
});
```

Env vars set by `bench run-ui-tests` at runtime:

| Env var | Purpose |
|---------|---------|
| `BASE_URL` | Site URL (e.g. `http://test_site:8000`) |
| `ADMIN_PASSWORD` | Administrator password |
| `NODE_PATH` | Points to Frappe's `node_modules` (lets specs import `@playwright/test`) |
| `PARALLEL_BASE_URLS` | Comma-separated list of extra site URLs for parallel workers |

### Running tests

```bash
# All tests
bench --site <site> run-ui-tests <app-name>

# Headless
bench --site <site> run-ui-tests <app-name> --headless

# Specific spec
bench --site <site> run-ui-tests <app-name> --spec "tests/ui/sample_doc.ts"

# Shard across parallel sites (16.51+)
bench --site <site> run-ui-tests <app-name> \
  --parallel-site extra1.localhost --parallel-site extra2.localhost \
  --headless --shard 1/3

# Pass extra Playwright args (after --)
bench --site <site> run-ui-tests <app-name> -- --project=chromium
```

> **Flags hidden for Playwright:** `--parallel`, `--with-coverage`, `--ci-build-id` emit a
> warning and are ignored when the app has a Playwright config.

### Sample test

```typescript
import { test, expect } from "@playwright/test";

test("creates a Customer", async ({ page }) => {
  await page.goto("/app/customer/new");
  await page.fill("[data-fieldname='customer_name'] input", "Playwright Corp");
  await page.click(".primary-action");
  await expect(page.locator(".page-title")).toContainText("Playwright Corp");
});
```

---

## Cypress (legacy — apps still on `cypress.config.*`)

Frappe shows a yellow deprecation warning at runtime. Cypress 13 support is removed in v17.
Migrate existing test suites to Playwright using `bench --site <site> run-ui-tests <app>` once
you drop `cypress.config.*` and add `playwright.config.*`.

Old CLI flags still accepted (Cypress path only):

```bash
bench --site <site> run-ui-tests <app-name> --headless     # → Cypress headless
bench --site <site> run-ui-tests <app-name> --parallel     # → Cypress Cloud sharding
bench --site <site> run-ui-tests <app-name> --with-coverage
bench --site <site> run-ui-tests <app-name> --ci-build-id <id>
```

For Cypress test patterns, the `cy.*` command set, and writing Cypress specs, see
[cypress.md](cypress.md) (legacy reference, Frappe ≤16.35).

---

## Sources

Verified against Frappe 16.51.1 and 16.35.0:

- `apps/frappe/frappe/commands/testing.py` — `PLAYWRIGHT_VERSION = "1.63.0"`;
  `_has_config()` dispatch; `_run_playwright()` (env vars, `--shard`, `--parallel-site`);
  `_run_cypress()` (legacy Cypress packages list, `--parallel`/`--with-coverage`/`--ci-build-id`);
  deprecation warning on Cypress path
- `apps/frappe/frappe/commands/test_commands.py:997-1061` — `TestRunUITests`:
  `test_runs_playwright_when_the_app_has_its_config`, `test_runs_cypress_for_an_app_that_still_uses_it`,
  `test_fails_for_an_app_without_ui_tests`
- `apps/frappe/cypress.config.js` (16.35 bench) — `defineConfig` options (Cypress 13)
