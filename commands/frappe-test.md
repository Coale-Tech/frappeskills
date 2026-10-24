---
description: TDD workflow for Frappe — write failing tests first, implement, verify. For bugs, reproduce first with Prove-It.
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/test.md -->

Load the `frappe-testing` skill (omp: `read skill://frappe-testing`) and follow `frappe-testing/references/tdd-workflow.md` for the TDD loop. For Desk or portal UI, also load `frappe-browser-testing` (omp: `read skill://frappe-browser-testing`).

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

## New feature (TDD loop)

1. Write tests describing the expected behaviour — they must FAIL: `bench --site <site> run-tests --app <app> --module <module>`
2. Implement the minimum code to make them pass (GREEN)
3. Refactor while keeping tests green
4. Run the full suite to check for regressions

## Bug fix (Prove-It pattern)

1. Write a test that reproduces the bug — confirm it FAILS with current code
2. Implement the fix; confirm the test PASSES
3. Run the full suite for regressions

## UI verification

When the feature has Desk or portal behaviour, follow `frappe-browser-testing`: login as a test user with the minimal required role, inspect the console and network tab, and capture a screenshot as evidence before yielding.

**Verification gate:** all tests pass, no regressions, and UI behaviour is confirmed with a screenshot or console output. Do not yield on "it should work" without evidence.
