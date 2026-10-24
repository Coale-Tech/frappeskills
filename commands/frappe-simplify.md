---
description: Simplify Frappe code for clarity — reduce complexity without changing behaviour; honour Chesterton's Fence for hooks, overrides, and patches
---

<!-- Adapted from addyosmani/agent-skills (MIT): .claude/commands/code-simplify.md -->

Load the `frappe-code-simplification` skill (omp: `read skill://frappe-code-simplification`).

$ARGUMENTS

**Confirm bench first:** `ls apps sites` and `grep default_site sites/common_site_config.json`.

Simplify the target code (recent changes unless a broader scope is given in `$ARGUMENTS`) while preserving exact behaviour:

1. Read the code's purpose, all callers (`grep -r "function_name" apps/<app>`), and existing tests before touching anything
2. Apply Chesterton's Fence to every hook, override, monkeypatch, and patch — understand why it exists before removing it
3. Scan for simplification opportunities:
   - Deep nesting → guard clauses
   - Long controllers → extracted helpers with single responsibility
   - Duplicate hooks → shared utility
   - Dead hooks confirmed absent by grep → remove
   - `frappe.db.sql` → `frappe.qb` rewrite (check `frappe-api-development/references/database.md` for exceptions)
4. Apply each simplification; run `bench --site <site> run-tests --app <app>` after each change
5. Mark deliberate deferrals with `# frappe-simplify-ignore: <reason>` rather than silent removal
6. Run `bench --site <site> migrate` if any schema or hooks file changed; confirm clean

**Verification gate:** all tests pass, `bench migrate` is clean, and the diff is behaviour-preserving with no functional change.
