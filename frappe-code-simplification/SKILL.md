---
name: frappe-code-simplification
description: "Behaviour-preserving simplification of Frappe app code. Use when a working feature is harder to read or maintain than it needs to be: nested hooks, dead doc_events, hand-rolled helpers that frappe.utils already provides, raw SQL replaceable by frappe.qb, or monkeypatches with no explanation. Applies Chesterton's Fence before removing any hook, override, or patch. Documents a frappe-simplify-ignore marker convention for blocks that must not be simplified."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/code-simplification/SKILL.md -->

# Frappe Code Simplification

Remove complexity that no longer earns its place — without changing behaviour.

## When to use

- After a feature is working and tests pass, but `hooks.py` has grown unexplained entries
- When a controller has hand-rolled logic that `frappe.utils` already provides
- When `frappe.db.sql()` raw strings can be replaced with `frappe.qb`
- When a `doc_event` or `override_doctype_class` entry seems unused or vestigial
- When a patch, fixture, or monkeypatch has no documented reason in `git log`

Not for code you do not yet understand — comprehend before simplifying.
Not for performance-critical paths where the "simpler" version is measurably slower.
Not for code under active rewrite — simplifying throwaway code wastes effort.

## Inputs required

- The file or module to simplify (scope it tightly — do not roam)
- Passing test suite before you start (verify: `bench --site <site> run-tests --app <app>`)
- Access to `git log` / `git blame` for context

## Procedure

### 0) Mark blocks that must not be simplified

Before starting, scan for blocks already protected by the marker convention:

```python
# frappe-simplify-ignore-start: <reason>
... block the agent MUST skip entirely ...
# frappe-simplify-ignore-end
```

**These blocks are off-limits.** Do not read into them for simplification purposes. Skip them completely and move to the next block. The marker is advisory (no hook enforces it in this repo), but the agent's obligation to honour it is absolute.

### 1) Understand before touching (Chesterton's Fence)

**Frappe-specific fences:**

| Entry type | Check before removing |
|-----------|----------------------|
| `hooks.py` doc_event | `git log -p hooks.py` — when was it added and why? Does the referenced method still exist? |
| `override_doctype_class` | Which methods does the override change? Is the override still needed after a Frappe version upgrade? |
| Monkeypatch (`frappe.<X> = ...`) | What upstream bug or missing feature triggered it? Is it fixed in v16? |
| `patches.txt` entry | Does the patch's target still exist (field/doctype not since renamed)? Is it safe to skip on new sites? |
| Fixture JSON | Was it exported to seed data or to pin a customisation? Removing it deletes data on the next migrate. |

```bash
git log --oneline --follow -p apps/<app>/<app>/hooks.py | head -80
git blame apps/<app>/<app>/hooks.py
```

If you cannot answer **why** the entry exists, stop. Do not remove it. Add a `frappe-simplify-ignore-start: reason unclear — investigate` marker and surface the question.

### 2) Identify simplification targets

**`hooks.py` / doc_events:**
- A doc_event pointing to a method that no longer exists → remove it
- A `before_save` hook that only sets a field already auto-populated by the DocType → remove it
- Two hooks registered for the same event on the same DocType from the same app → consolidate

**Controllers:**
- Hand-rolled date arithmetic → replace with `frappe.utils.add_days()`, `date_diff()`, `getdate()`
- Manual string concatenation for a message → replace with `frappe._()`
- `frappe.db.sql("SELECT ...")` → replace with `frappe.qb` or `frappe.get_all()`

**`frappe.db.sql` rewrites:**

```python
# Before
rows = frappe.db.sql(
    "SELECT name, status FROM `tabSales Order` WHERE customer=%s AND status='Open'",
    (customer,), as_dict=True
)

# After
SalesOrder = frappe.qb.DocType("Sales Order")
rows = (
    frappe.qb.from_(SalesOrder)
    .select(SalesOrder.name, SalesOrder.status)
    .where((SalesOrder.customer == customer) & (SalesOrder.status == "Open"))
).run(as_dict=True)
```

**`frappe.utils` replacements:**

| Hand-rolled pattern | Replace with |
|--------------------|-------------|
| `(date2 - date1).days` on Python `date` objects | `frappe.utils.date_diff(date2, date1)` |
| `datetime.now()` | `frappe.utils.now_datetime()` |
| `str(date_obj)` for a Frappe date string | `frappe.utils.formatdate(date_obj)` |
| Manual email validation regex | `frappe.utils.validate_email_address()` |
| `random.choice(string.ascii_letters, ...)` | `frappe.utils.random_string(length)` |

### 3) Apply incrementally

One simplification at a time. After each:
1. Run the affected test module: `bench --site <site> run-tests --module <app>.tests.<module>`
2. Tests pass → continue
3. Tests fail → revert and reconsider

**The Rule of 500:** If a simplification touches more than 500 lines (e.g. renaming a hook across many files), use `sed` or a codemod, not manual edits — and submit it as a standalone change.

Submit refactoring separately from feature work. Never mix simplification and new behaviour in the same commit.

### 4) Verify the result

```
Compare before and after:
- Is the simplified version genuinely easier to read?
- Does it follow frappe-* skill conventions (qb, get_all, utils)?
- Is the diff clean and reviewable (~100 lines)?
- Do all tests still pass?
```

If the "simplified" version requires more mental steps to follow, revert. Fewer lines is not the goal.

## Verification

- [ ] All existing tests pass without modification before and after
- [ ] Every `frappe-simplify-ignore` block was left untouched
- [ ] No `frappe.db.sql()` raw strings introduced (only removed or rewritten to `frappe.qb`)
- [ ] No error handling removed or weakened
- [ ] No hook or doc_event removed without `git log` evidence it is safe
- [ ] Refactoring is in a separate commit from any feature or fix

## Failure modes / debugging

- **Tests fail after hook removal**: the hook had a side effect used by another DocType or workflow; restore it and add a `frappe-simplify-ignore` marker with the reason
- **`frappe.qb` rewrite changes query results**: check `WHERE` clause operator precedence — `frappe.qb` uses Python operator overloading; wrap compound conditions with `()` explicitly
- **`frappe.utils` function not available in v15**: tag as `(v16)` in the marker comment and keep the original for v15-targeted sites
- **Removing a doc_event breaks a downstream process**: the doc_event was a dependency for another app; restore it and document the dependency

## Escalation

- Identifying which code is dead requires whole-app analysis → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Hook or override purpose requires tracing framework internals → [`frappe-deep-research`](../frappe-deep-research/SKILL.md)
- A simplification changes an API surface that callers depend on → [`frappe-code-review`](../frappe-code-review/SKILL.md)

## References

- No additional reference files — the procedure above is complete.

## Guardrails

- **Honour `frappe-simplify-ignore` blocks absolutely** — do not read their contents for simplification
- **Never remove a hook without `git log` evidence** — absence of tests for a hook does not mean it is dead
- **Never simplify code you do not understand** — read more context first
- **No behaviour change** — all inputs, outputs, side effects, and error paths must remain identical
- **Scope to the assigned module** — do not roam into unrelated files
- **Separate from features** — simplification commits must contain only simplification

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This hook has no tests, so it's probably dead" | No tests means unknown coverage, not confirmed dead. Check `git log` and search callers. |
| "Fewer lines is always simpler" | A single nested `frappe.qb` chain is not simpler than a readable three-step query. Measure by comprehension speed. |
| "`frappe.db.sql` is fine for one-liners" | Raw SQL bypasses the query builder's safety, escaping, and query logging. Rewrite it. |
| "This override is probably from an old version, safe to remove" | Check the Frappe changelog. If the upstream method now behaves differently, the override may still be needed. |
| "I'll simplify this unrelated file while I'm in here" | Stay scoped. Unscoped simplification creates noisy diffs and risk of unintended regressions. |
| "The fixture export is obviously harmless" | Fixtures that export core DocType permissions can overwrite site customisations on every migrate. Investigate before removing. |
| "I'll refactor while adding this feature" | Separate the changes. Mixed commits are harder to review, revert, and bisect. |

## Red Flags

- Simplification that requires modifying tests to pass (behaviour changed)
- Removing a `hooks.py` entry without `git log` evidence it is dead
- `frappe-simplify-ignore` block modified or read despite the marker
- Introducing `frappe.db.sql()` while "simplifying" (moving complexity, not removing it)
- Removing error handling because "it makes the code cleaner"
- Simplification commit mixed with a feature or bug fix

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Removing a `doc_event` entry because the handler method is gone | The method being gone is itself a bug; removing the hook silently hides it | Restore the handler or file an issue; do not remove the hook without investigation |
| `frappe.qb` rewrite without parenthesising compound `WHERE` | Operator precedence differs from SQL; `(A) & (B)` is required | Always wrap each condition: `.where((SalesOrder.customer == x) & (SalesOrder.status == "Open"))` |
| Replacing `frappe.utils.now_datetime()` with `datetime.now()` | `frappe.utils` version respects server timezone config; `datetime.now()` does not | Keep the frappe utility |
| Removing a monkeypatch that targets a framework bug | The bug may still be present in the installed version | Verify the fix is in the installed `frappe.__version__` before removing the patch |
| Simplifying a fixture by deleting rows | Deleted rows cause `DoesNotExistError` on migrate for any doc that linked to them | Never reduce fixture content without tracing all dependents |
