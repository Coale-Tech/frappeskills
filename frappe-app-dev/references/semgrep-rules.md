# Frappe Semgrep Rules Reference

Rules path: `<bench>/apps/semgrep-rules/rules`
Source: https://github.com/frappe/semgrep-rules
Verified against the `semgrep-rules` app on this bench for Frappe v16
(`frappe.__version__ == "16.9.0"`), pinned to **HEAD `3011799`** (branch
`develop`, remote `upstream`) as of 2026-07-15. The repo is fast-forwarded on
every OMP start via `a build script`, so treat the
live `rules/*.yml` as authoritative if this catalog drifts.

---

## Running Semgrep

```bash
# Check all generated files
semgrep --config=<bench>/apps/semgrep-rules/rules <app_folder>

# Errors only (block completion)
semgrep --config=<bench>/apps/semgrep-rules/rules --severity=ERROR <app_folder>

# Single file
semgrep --config=<bench>/apps/semgrep-rules/rules path/to/file.py
```

---

## Rule Categories

### Security — `rules/security/`

| Rule ID | Severity | What It Catches |
|---------|----------|-----------------|
| `frappe-sql-format-injection` | WARNING | `.format()` or f-string in `frappe.db.sql()` — SQL injection |
| `frappe-codeinjection-eval` | ERROR | `eval()`, `exec()`, `safe_exec()`, `safe_eval()` — RCE |
| `frappe-ssti` | ERROR | `render_template($ARG)` — template injection |
| `frappe-security-file-traversal` | WARNING | `open(...)` — file traversal risk |
| `relaxed-permissions` | WARNING | `"role": "All"` in JSON perms |
| `frappe-setuser` | WARNING | `frappe.set_user(...)` — privilege escalation |
| `missing-argument-type-hint` | WARNING | `@frappe.whitelist()` args missing type hints |
| `guest-whitelisted-method` | WARNING | `allow_guest=True` endpoints |
| `frappe-format-string-injection` | ERROR | Exception object in `.format()` on `_()` — use `str(e)` |

### Frappe Correctness — `rules/frappe_correctness.yml`

| Rule ID | Severity | What It Catches |
|---------|----------|-----------------|
| `frappe-breaks-multitenancy` | ERROR | `frappe.db.*` / `frappe.get_all` assigned to global var |
| `frappe-cache-breaks-multitenancy` | ERROR | `frappe.cache().set/get()` — use `set_value/get_value` |
| `frappe-modifying-but-not-comitting` | ERROR | `self.attr = x` in hooks without `db_set()` or `save()` |
| `frappe-modifying-but-not-comitting-other-method` | ERROR | A method calls `self.$OTHER()` after setting `self.$attr` — verify the change is committed (`db_set()`/`save()`) |
| `frappe-modifying-child-tables-while-iterating` | ERROR | `self.append/remove` inside `for row in self.table` |
| `frappe-same-key-assigned-twice` | ERROR | Dict literal with duplicate keys |
| `frappe-redis-flush` | ERROR | `frappe.cache.flushall()` — use `flushdb()` |
| `frappe-overriding-local-proxies` | ERROR | `frappe.db = ...` etc. — breaks proxies |
| `frappe-single-value-type-safety` | ERROR | `frappe.db.get_value(DocType, None, ...)` — use `get_single_value` |
| `frappe-set-value-semantics` | ERROR | `frappe.db.set_value(DocType, None, ...)` — use `set_single_value` |
| `frappe-after-save-controller-hook` | ERROR | `def after_save(self)` — not a valid hook |
| `frappe-qb-incorrect-order-usage` | ERROR | `.orderby("field", "asc")` — `order` must be keyword arg |
| `frappe-incorrect-debounce` | ERROR | `frappe.utils.debounce(fn)(...)` called inline |
| `frappe-realtime-pick-room` | ERROR | `frappe.publish_realtime()` without room/user scoping |
| `frappe-monkey-patching-not-allowed` | ERROR | Overwriting imported module properties |
| `frappe-test-whitelist-missing-protection` | ERROR | `@frappe.whitelist()` in test files — use `@whitelist_for_tests()` |
| `frappe-print-function-in-doctypes` | WARNING | `print()` in DocType files |
| `frappe-no-functional-code` | WARNING | `map()` / `filter()` — use list comprehensions |
| `frappe-query-debug-statement` | WARNING | `debug=True` left in queries |
| `frappe-manual-commit` | WARNING | `frappe.db.commit()` outside try/except |
| `frappe-cur-frm-usage` | WARNING | `cur_frm` in JS — deprecated |

### Code Quality — `rules/code_quality.yml`

| Rule ID | Severity | What It Catches |
|---------|----------|-----------------|
| `unchecked-frappe-permission-call` | ERROR | `frappe.has_permission()` return value ignored without `throw=True`. Exempt: assigned to a var, used in `return`/`if`/`assert`, or as a comprehension predicate (list/set/dict/generator); `test_*.py` excluded (refined in HEAD 3011799, #43) |
| `overusing-args` | WARNING | `def func(args)` — use explicit params |
| `use-vanilla-js-include` | WARNING | `in_list(list, item)` — use `list.includes(item)` |
| `useless-get-doc-dict` | WARNING | `frappe.get_doc(dict(k=v))` — use `frappe.get_doc(k=v)` |

### Translations — `rules/translate.yml` + `rules/ux.yml`

| Rule ID | Severity | What It Catches |
|---------|----------|-----------------|
| `frappe-missing-translate-function-python` | WARNING | `frappe.throw/msgprint("text")` not wrapped in `_()` |
| `frappe-missing-translate-function-js` | WARNING | Same in JS — not wrapped in `__()` |
| `frappe-missing-translation-button-text` | WARNING | `frm.add_custom_button("text")` not wrapped in `__()` |
| `frappe-translation-empty-string` | WARNING | `_("")` or `__("")` |
| `frappe-translation-variable-only` | WARNING | `_("{0}")` — translating placeholder only |
| `frappe-translation-trailing-spaces` | WARNING | Whitespace in translate strings |
| `frappe-translation-python-formatting` | WARNING | `_("...".format(...))` — format before translate |
| `frappe-translation-js-formatting` | WARNING | Template literal in `__()` |
| `frappe-translation-python-splitting` | WARNING | Concatenating translated strings |
| `frappe-translation-js-splitting` | WARNING | Splitting/concatenating strings inside `__()` — e.g. `__('a') + __('b')` |
| `frappe-untranslated-label-in-translated-message` | WARNING | `self.meta.get_label()` inside `_()` not translated |

### Reports — `rules/report.yml`

(Scoped to `**/report` paths — query/script reports.)

| Rule ID | Severity | What It Catches |
|---------|----------|-----------------|
| `frappe-missing-translate-function-in-report-python` | WARNING | Report column `label="..."` not wrapped in `_()` |
| `frappe-translated-values-in-business-logic` | WARNING | Translated string used as an option *value* — pass `{label: __("x"), value: "x"}` instead so business-logic comparisons stay on untranslated values |

---

## Common Fix Patterns

```python
# SQL injection -> parameterize
# BAD
frappe.db.sql(f"SELECT * FROM tabItem WHERE name = '{name}'")
# GOOD
frappe.db.sql("SELECT * FROM tabItem WHERE name = %s", (name,))

# Unchecked permission -> throw=True or check return
# BAD
frappe.has_permission("Sales Order", doc=doc)
# GOOD
frappe.has_permission("Sales Order", doc=doc, throw=True)

# Single DocType values
# BAD
frappe.db.get_value("System Settings", "System Settings", "field")
# GOOD
frappe.db.get_single_value("System Settings", "field")

# Wrong controller hook name
# BAD: def after_save(self)
# GOOD: def after_insert(self) or def on_update(self)

# Translate all user-facing text
# BAD
frappe.throw("Not permitted")
# GOOD
frappe.throw(_("Not permitted"))

# Exception in format string
# BAD
frappe.throw(_("Error: {}").format(e))
# GOOD
frappe.throw(_("Error: {}").format(str(e)))

# Child table iteration
# BAD: self.remove(row) inside for row in self.items
# GOOD: collect first, then remove
to_remove = [r for r in self.items if condition(r)]
for row in to_remove:
    self.remove(row)

# Multitenancy — never at module level
# BAD: CACHE = frappe.get_all("Item", ...)
# GOOD: def get_items(): return frappe.get_all("Item", ...)
```

```javascript
// Translate all JS user-facing text
// BAD
frappe.throw("Not permitted")
frm.add_custom_button("Submit", fn)
// GOOD
frappe.throw(__("Not permitted"))
frm.add_custom_button(__("Submit"), fn)

// Vanilla JS over Frappe wrappers
// BAD: in_list(arr, item)
// GOOD: arr.includes(item)

// Debounce — create once, don't call inline
// BAD: frappe.utils.debounce(fn)(arg)
// GOOD: const debouncedFn = frappe.utils.debounce(fn, 300); debouncedFn(arg)
```

---

## Semgrep Reviewer Protocol

The `semgrep review subagent` agent MUST:

1. **Run semgrep** on all generated Python, JS, and JSON files
2. **Block on any ERROR** — fix before marking task complete
3. **Report WARNINGs** with file, line, rule ID, and suggested fix
4. **Re-run after fixes** to confirm clean
5. Use `# nosemgrep: rule-id` sparingly with justification comment

### Severity thresholds

| Severity | Action |
|----------|--------|
| ERROR | Must fix — blocks completion |
| WARNING | Surface to user — fix or add `# nosemgrep` with justification |

---

## Recommended Checks (not in the upstream `semgrep-rules` catalog)

These patterns are NOT enforced by the official `frappe/semgrep-rules` app, but
are high-value to grep for in review. Verified against Frappe v16 source.

| Pattern | Why it's dangerous | Fix |
|---------|--------------------|-----|
| `ignore_permissions=True` in a `@frappe.whitelist()`-reachable path driven by user input | Bypasses ALL permission checks (`document.py:375-376` short-circuits `doc.has_permission()`) → privilege escalation | Remove it, or gate behind `frappe.only_for(...)` / `frappe.has_permission(..., throw=True)` first |
| `doc.flags.ignore_permissions = True` set from a request value | Same as above — user-controlled bypass | Only set in trusted jobs/migrations, never from `frappe.form_dict` |
| Interpolated value in a `permission_query_conditions` return string without `frappe.db.escape(...)` | SQL injection into the row-filter `WHERE` clause (`db_query.py:1149`) | Wrap every interpolated value in `frappe.db.escape(...)` |
| `frappe.db.sql(f"... {var} ...")` / `.format()` | SQL injection — same class as `frappe-sql-format-injection` but also covers `execute`/`multisql` | Parameterize: `frappe.db.sql("... %s", (var,))` or use `frappe.qb` |
| `@frappe.whitelist()` with no `methods=` on a state-changing endpoint | Accepts GET/PUT/DELETE too; CSRF and caching implications | `@frappe.whitelist(methods=["POST"])` |
| User-facing `frappe.throw(...)`/`frappe.msgprint(...)` without `_()` | Untranslatable UI text — same class as `frappe-missing-translate-function-python` | Wrap message in `_(...)` (JS: `__(...)`) |

## Sources

All rule IDs verified present in `apps/frappe/../semgrep-rules/rules` on this bench:

- `rules/security/` — `authorization.yml` (`relaxed-permissions`, `frappe-setuser`), `filesystem.yml`, `format_string_injection.yml`, `rce.yml`, `sql.yml`, `whitelisted.yml`
- `rules/frappe_correctness.yml` — 21 rules incl. `frappe-modifying-but-not-comitting-other-method`
- `rules/code_quality.yml` — `unchecked-frappe-permission-call`, `overusing-args`, `use-vanilla-js-include`, `useless-get-doc-dict`
- `rules/translate.yml` — incl. `frappe-translation-js-splitting`; `rules/ux.yml`; `rules/report.yml`
- Framework API confirmations: `apps/frappe/frappe/model/document.py` (`ignore_permissions`, l.375), `apps/frappe/frappe/model/db_query.py` (`permission_query_conditions`, l.1149), `apps/frappe/frappe/__init__.py` (`whitelist` l.417, `has_permission` l.577), `apps/frappe/frappe/database/database.py` (`escape`, l.1385)
