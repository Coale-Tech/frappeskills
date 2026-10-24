<!-- Adapted from addyosmani/agent-skills (MIT): skills/doubt-driven-development/SKILL.md -->
# Doubt Protocol — Frappe Adversarial Prompt Templates

Paste one of these templates verbatim into the fresh-context reviewer invocation.
The reviewer receives **ARTIFACT + CONTRACT only** — never the CLAIM or session reasoning.

---

## Generic adversarial template

```
Adversarial review. Find what is wrong with this artifact.
Assume the author is overconfident. Look for:
- Unstated assumptions about Frappe framework behaviour
- Edge cases not handled (e.g. docstatus transitions, empty sets, concurrent saves)
- Ways the contract could be violated under normal site operation
- Existing Frappe conventions this breaks (hooks, permissions, qb vs db.sql)
- Failure modes under unexpected input or document state

Do NOT validate. Do NOT summarize. Find issues, or state explicitly
that you cannot find any after thorough examination.

ARTIFACT:
<paste artifact here>

CONTRACT:
<paste contract here>
```

---

## Patch script template

Use when the artifact is a `patches.txt` patch function.

```
Adversarial review of a Frappe patch script. Find what is wrong.
Look for:
- Non-idempotent operations (fails or corrupts if run twice)
- Operations on columns that may not exist at the time the patch runs
  (pre_model_sync patches run BEFORE schema sync — the new column does not exist yet)
- Missing NULL / empty-string guards before UPDATE statements
- frappe.db.sql usage that bypasses ORM validation (check for missing commit, wrong table name)
- No frappe.db.commit() after bulk data changes
- Side effects on documents with docstatus = 1 (submitted) or docstatus = 2 (cancelled)
  that would invalidate the GL / Stock Ledger

Do NOT validate. Find issues.

ARTIFACT:
<paste patch function body>

CONTRACT:
<paste invariant — e.g. "column renamed without data loss; idempotent; does not alter submitted documents">
```

---

## Permission model change template

Use when the artifact is a role permission matrix delta or a `has_permission` override.

```
Adversarial review of a Frappe permission model change. Find what is wrong.
Look for:
- Roles that gain unintended access to Submit, Cancel, or Delete
- Missing `if_owner` guards where row-level isolation is expected
- A `permission_query_conditions` function that returns an empty string (grants all)
  or a malformed SQL fragment
- has_permission returning True unconditionally for any ptype
- permlevel fields left readable/writable at level 0 when they should be restricted
- Guest or All Workspace roles affected

Do NOT validate. Find issues.

ARTIFACT:
<paste role matrix delta / has_permission code>

CONTRACT:
<paste permission spec — e.g. "System Manager: full; Accounts User: Read + Submit; no other role sees GL fields">
```

---

## GL / Stock / Payment posting template

Use when the artifact posts to GL Entry, Stock Ledger Entry, or Payment Entry.

```
Adversarial review of a Frappe ledger posting. Find what is wrong.
Look for:
- Debit total ≠ credit total for a GL Entry batch
- Wrong account type for the posting (e.g. using a P&L account where a Balance Sheet is required)
- Missing cost_center or project where they are mandatory for the account
- Stock Ledger Entry with qty_after_transaction that would go negative without checking
  allow_negative_stock
- Payment Entry with missing party_type / party linkage
- Postings inside a validate() hook instead of on_submit() — validate can be called multiple times

Do NOT validate. Find issues.

ARTIFACT:
<paste entry construction block>

CONTRACT:
<paste balance invariant and account requirements>
```

---

## Hook wiring template

Use when the artifact wires a `doc_events`, `override_doctype_class`, or `scheduler_events` entry.

```
Adversarial review of a Frappe hook registration. Find what is wrong.
Look for:
- Hook name that does not exist in the Frappe controller lifecycle
  (common wrong ones: after_save, before_cancel — verify in frappe/model/document.py)
- Handler that is not importable from the path listed in hooks.py
- override_doctype_class replacing a class used by a standard flow
  (submit/cancel/amend) without calling super()
- scheduler_events handler that does frappe.connect() / frappe.destroy() redundantly
  (the scheduler already provides a connection context)
- doc_events handler that unconditionally re-saves the document (infinite loop)
- Hook wired on a core ERPNext DocType without checking for the app being installed

Do NOT validate. Find issues.

ARTIFACT:
<paste hooks.py entry + handler function>

CONTRACT:
<paste expected trigger and side-effect scope>
```

---

## Contract building blocks (for the CONTRACT section)

Copy the relevant invariants into the CONTRACT block:

| Scenario | Invariant to state |
|---|---|
| Patch on populated table | "Idempotent: safe to run twice. Does not touch submitted (docstatus=1) documents. Does not drop data." |
| Column rename | "Column renamed; all existing values preserved; no NULL introduced." |
| Permission grant | "Role X: can Read and Submit; cannot Delete or Cancel. Guest: no access." |
| GL posting | "Debit total equals credit total. All accounts exist and are of the correct root type." |
| Stock posting | "qty_after_transaction never goes negative unless allow_negative_stock is enabled." |
| Hook wiring | "Handler called exactly once per trigger event. No document re-saved inside the handler." |

---

## Sources

Verified against Frappe v16.35.0:

- `apps/frappe/frappe/modules/patch_handler.py` lines 1-47 — `[pre_model_sync]` runs before schema sync; `[post_model_sync]` runs after; documents idempotency requirement
- `apps/frappe/frappe/model/document.py` — controller lifecycle hooks (validate, before_save, after_insert, on_update, on_submit, on_cancel, on_trash, before_discard, on_discard); `after_save` is NOT a valid hook in v16
- `apps/frappe/frappe/permissions.py` — `has_permission(doctype, ptype, doc, ...)` signature; `permission_query_conditions` hook contract (empty string = no restriction)
- `apps/frappe/frappe/core/doctype/system_settings/system_settings.py` — `get_system_settings(fieldname)` available via `frappe.get_system_settings`
- `apps/erpnext/erpnext/accounts/general_ledger.py` — `process_debit_credit_difference` and the "Debit and Credit not equal" validation (balance invariant)
- `apps/erpnext/erpnext/stock/stock_ledger.py` — `make_sl_entries(..., allow_negative_stock=False)` (negative-stock validation switch)
