# Specialist Review Passes

Dispatch table for `/frappe-review` and `/frappe-ship`. Run only the passes whose triggers fire on the diff — never all passes by default.

## Dispatch rule

```
For each pass in the table:
  1. Evaluate its trigger(s) against the diff file list and changed content
  2. Any one trigger hits → dispatch that pass
Run red-team pass LAST, only if its trigger fires
```

---

## Pass table

| Pass | Triggers (any one fires the pass) | Agent / Skill | Dispatch |
|------|-----------------------------------|---------------|----------|
| **migration** | `patches.txt` touched; DocType JSON with field removed/renamed/type-changed; `before_migrate` or `after_migrate` key added/changed in `hooks.py`; fixture JSON changed | `frappe-migration-auditor` | on trigger |
| **api-contract** | `@frappe.whitelist` added/changed; `override_whitelisted_methods` changed in `hooks.py`; `methods=[...]` argument changed; REST-facing module path added/removed | `frappe-api-contract-auditor` | on trigger |
| **security** | `hooks.py` changed; `@frappe.whitelist` added/changed; `has_permission` / `ignore_permissions` / `allow_guest` added; raw SQL expression in a Python file | `frappe-security-auditor` | on trigger |
| **performance** | Backend Python diff > 100 lines; `frappe.get_all` / `frappe.get_doc` / `frappe.db` calls changed; new child-table list rendered in a controller | `frappe-performance-auditor` | on trigger |
| **tests** | Any diff | `frappe-test-engineer` | always |
| **maintainability** | Diff > 30 lines | `frappe-reviewer` (maintainability section) | always (> 30 lines) |
| **red-team** | Diff > 200 lines; OR security pass finds Critical; OR `allow_guest=True` present; OR new submit/cancel/amend flow added | Red-team checklist below | after all passes |

---

## Per-pass checklists

### Migration

- [ ] Patch listed in `patches.txt` in the correct section (`[pre_model_sync]` for drops, `[post_model_sync]` for backfills)
- [ ] `execute()` guards itself: `frappe.db.exists()` before `insert()`; `frappe.db.has_column()` before `ALTER TABLE`; `frappe.db.count()` before `delete_doc()`
- [ ] Large-table update uses a `while True:` batch loop with `frappe.db.commit()` per batch
- [ ] `frappe.reload_doctype()` called before reading a field added in the same migrate cycle
- [ ] Select option removed: existing records referencing the old value identified and handled
- [ ] `is_submittable` flip: impact on existing `docstatus` values assessed
- [ ] `naming_rule` / `naming_series` changed: existing names assessed for compliance
- [ ] `before_migrate` / `after_migrate` hooks are fast (no data work, no unbounded queries)
- [ ] v15→v16 / 16.35→16.51 known hazards checked against `frappe-deprecation-and-migration/references/erpnext-16-50-upgrade-checklist.md`

### API-contract

- [ ] No required parameter added to an existing method without a default value
- [ ] No response key removed or renamed without a versioned `v2` module path
- [ ] `methods=[...]` not narrowed without updating all callers
- [ ] `allow_guest=True` addition justified, rate-limited, and state-safe
- [ ] `allow_guest=True` removal: unauthenticated callers identified and migrated
- [ ] Type annotations present on all parameters in apps with `require_type_annotated_api_methods = True`
- [ ] Server Scripts / Client Scripts in the DB referencing the old method path flagged
- [ ] `override_whitelisted_methods` conflict check across all installed apps
- [ ] Error shape change (exception class / HTTP status) documented in CHANGELOG
- [ ] Pagination defaults unchanged; if changed, old callers checked

### Security

Use `frappe-security-auditor` directly. Frappe-specific items:

- [ ] `@frappe.whitelist()` method calls `frappe.has_permission(..., throw=True)` before data access
- [ ] `allow_guest=True` justified and not on a state-changing method
- [ ] `ignore_permissions=True` has an inline justification comment
- [ ] No `frappe.db.sql()` with user-controlled values
- [ ] No `|safe` Jinja filter on user-controlled data
- [ ] Sensitive fields absent from API `fields=` lists and error responses

### Performance

Use `frappe-performance-auditor` directly. Frappe-specific items:

- [ ] No `frappe.get_doc` inside a loop — batch via `frappe.get_all`
- [ ] `frappe.get_all` specifies `fields=` (not `["*"]`) and `filters=`
- [ ] New filter fields have a DB index
- [ ] Heavy work moved to `frappe.enqueue` out of the request path
- [ ] No unbounded `frappe.get_all` without `limit_page_length`

### Tests

Use `frappe-test-engineer` directly. Frappe-specific items:

- [ ] New `@frappe.whitelist()` method has a test for the denied path (wrong role)
- [ ] Patch tested for idempotency: `execute()` called twice in the test
- [ ] DocType controller methods tested for `validate`, error cases, and edge-case field values
- [ ] `frappe.flags.in_import` / `frappe.flags.in_test` guards checked where relevant

### Maintainability

Use `frappe-reviewer` directly. Frappe-specific items:

- [ ] No dead `doc_events` or scheduler entries pointing to removed functions
- [ ] DocType names and workflow states are named constants, not bare magic strings
- [ ] No duplicate hook logic registered by multiple apps for the same event
- [ ] Commented-out code removed or explained

---

## Red-team pass (Frappe-specific)

Run AFTER all other passes when: diff > 200 lines, OR security pass finds Critical, OR `allow_guest=True` present, OR a submit/cancel/amend flow is new or changed.

This is adversarial analysis, not a checklist. Apply these probes to the changed code:

1. **Guest user via allow_guest** — Call every `@frappe.whitelist(allow_guest=True)` method without a session cookie. Does it return private data? Does it accept a mutation? Craft a request with a manipulated `doctype` or `name` argument to test for IDOR.

2. **Cross-company data leak** — Log in as a user in Company A only. Call any `@frappe.whitelist()` list method. Is there a `company=frappe.defaults.get_user_default("company")` filter? An absent company filter returns all companies' records.

3. **Concurrent submit race** — Send two simultaneous `submit` requests for the same document (same `name`, `docstatus=0`). Does the second request get a clear error, or does it silently double-submit? Check for a `docstatus` guard inside custom pre-submit hooks.

4. **Submitted doc mutation** — Call a state-changing `@frappe.whitelist()` method on a document where `docstatus=1`. Does the method check `doc.docstatus` before mutating? `doc.save()` raises on a submitted doc, but direct `frappe.db.set_value()` does not.

5. **Cancelled doc resurrection** — Call `doc.submit()` on a document where `docstatus=2`. Does the method guard `docstatus` before proceeding? Frappe base `submit()` raises, but custom submit wrappers may not.

6. **User with Read role only** — Assign only Read permission to the test user. Call every state-changing `@frappe.whitelist()` endpoint in the diff. Each must return 403, not a silent success or unhandled exception.

7. **Bulk import adversarial payload** — Use the Data Import API or a bulk endpoint with XSS payloads in text fields, SQL-fragment strings in Link fields, and negative values in Currency fields. Confirm all are rejected or escaped before storage.

8. **override_whitelisted_methods last-app-wins** — If two installed apps both override the same target, the last app in `apps.txt` wins. Can a site admin install an app that silently displaces a security-hardening override in another app?

9. **Unbounded bulk list argument** — Pass 50,000 document names to any `@frappe.whitelist()` method that accepts a list. Does it guard `len(items) <= MAX`? An unbounded list is a memory-exhaustion vector that blocks Gunicorn workers.

10. **Rapid double-click submit** — Call `doc.submit()` twice within 100 ms from separate sessions. MariaDB row-level locking should block the second commit, but custom pre-submit hooks that trigger external calls (email, payment API) may fire twice. Confirm idempotency on external side effects.

---

## Worked example: ERPNext 16.50 `co_by_product_patch.py`

**Source:** `apps/erpnext/erpnext/patches/v16_0/co_by_product_patch.py`
**What it does:** Migrates `BOMScrapItem` rows to the new `BOMSecondaryItem` DocType; renames `BOM.scrap_material_cost` → `secondary_items_cost`; calls `rename_field` on related DocTypes.

### Running the migration checklist

**[HIGH] (confidence: 9/10) co_by_product_patch.py:51 — Non-idempotent insert in `insert_into_bom`**

```python
# grouped loop over all BOM Scrap Item rows
for parent, items in grouped_data.items():
    bom = frappe.get_doc("BOM", parent)          # N+1: one get_doc per BOM
    for item in items:
        secondary_item = frappe.new_doc("BOM Secondary Item")
        # ... set fields ...
        secondary_item.insert()                  # no exists() guard
```

`BOMScrapItem` rows are not deleted by this patch. If `bench migrate` is interrupted and re-run (e.g. on a multi-site bench where one site fails), `frappe.get_all("BOM Scrap Item", ...)` returns the same rows again and `secondary_item.insert()` creates duplicate `BOMSecondaryItem` records. `auto_commit_on_many_writes = True` is set, so partial commits from the first interrupted run cannot be rolled back.

**Fix:** Guard each insert: `if not frappe.db.exists("BOM Secondary Item", {"parent": parent, "item_code": item.item_code}): secondary_item.insert()`.

**[MEDIUM] (confidence: 8/10) co_by_product_patch.py:34 — N+1 `get_doc` inside migration loop**

`frappe.get_doc("BOM", parent)` is called once per parent inside `grouped_data.items()`. For a site with thousands of BOMs, this extends migrate duration proportionally. The BOM fields used could be pulled into the initial `frappe.get_all` call.

**[INFO] (confidence: 10/10) rename_component_cost_valuation_type.py:6 — Naturally idempotent `set_value` — not a finding**

```python
frappe.db.set_value(doctype, {"valuation_type": "% of FG Cost"}, "valuation_type", "% of Component Cost", ...)
```

On re-run, no rows match `"% of FG Cost"` (already renamed). This is the correct idempotent pattern and requires no guard.

### What the checklist caught

The HIGH finding (non-idempotent insert) is exactly the failure class that corrupts a production multi-site bench when one site's migration is interrupted. The checklist item "guard `insert()` with `frappe.db.exists()`" surfaces it. The INFO entry shows how to distinguish naturally idempotent `set_value` patterns — avoiding false positives on common correct code.

---

## Sources

- `apps/frappe/frappe/migrate.py` lines 120–131, 208–210 — `before_migrate` / `after_migrate` hook invocation verified (16.51)
- `apps/frappe/frappe/hooks.py` line 175 — `require_type_annotated_api_methods = True` verified (16.51)
- `apps/frappe/frappe/hooks.py` line 419 — `override_whitelisted_methods` hook key verified (16.51)
- `apps/frappe/frappe/utils/typing_validations.py` — file path confirmed present (16.51)
- `apps/frappe/frappe/patches.txt` — `[pre_model_sync]` / `[post_model_sync]` section markers
- `apps/frappe/frappe/exceptions.py` — exception hierarchy and HTTP status code attributes
- `apps/frappe/frappe/core/doctype/doctype/doctype.py` lines 135, 283, 935–936 — `is_submittable` field and validation verified (16.51)
- `apps/erpnext/erpnext/patches/v16_0/co_by_product_patch.py` — worked-example source (ERPNext 16.50)
- `apps/erpnext/erpnext/patches/v16_0/rename_component_cost_valuation_type.py` — worked-example idempotent counter-example (ERPNext 16.50)
