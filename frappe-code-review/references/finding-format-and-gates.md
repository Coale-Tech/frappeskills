# Frappe Finding Format and Pre-emit Verification Gate

Applies to every workflow that emits review findings: `frappe-code-review`,
`frappe-security-hardening`, `frappe-performance-optimization`, and agents
that delegate to them (`frappe-reviewer`, `frappe-security-auditor`,
`frappe-performance-auditor`).

## Confidence-calibrated finding format

```
[SEVERITY] (confidence: N/10) file:line — description
```

Examples:
```
[Critical] (confidence: 9/10) myapp/api.py:34 — @frappe.whitelist method writes to Sales Order without any frappe.has_permission call; any logged-in user can corrupt orders
[Required] (confidence: 7/10) myapp/controllers/invoice.py:88 — frappe.get_all inside a loop over child rows; N+1 queries on large invoices
[Required] (confidence: 5/10) myapp/hooks.py:22 — scheduler entry references myapp.jobs.run_report; verify the dotted path resolves (medium confidence, confirm before blocking)
```

### Confidence scoring

| Score | Meaning | Display rule |
|-------|---------|--------------|
| 9–10 | Verified by reading the specific code lines; concrete bug or exploit demonstrated | Show normally |
| 7–8 | High-confidence pattern match; very likely correct | Show normally |
| 5–6 | Moderate; could be a false positive | Show with caveat: "medium confidence — verify before acting" |
| 3–4 | Low confidence; pattern is suspicious but may be fine | Suppress from main report; include in appendix only |
| 1–2 | Speculation | Report only if severity is Critical |

Findings at confidence ≤ 4 go into a clearly marked appendix; do not present them
as confirmed issues.

### Severity mapping (Frappe)

| Label | Meaning |
|-------|---------|
| **Critical** | Exploitable or data-loss — names attacker (anonymous / any logged-in user / specific role) and what they gain |
| **Required** | Must fix before merge — correctness, security-adjacent, or Frappe lifecycle error |
| **Nit** | Minor style, optional |
| **Optional / Consider** | Suggestion, not required |
| **FYI** | Informational, no action needed |

A finding is **Critical** only if you can name the attacker and the gain.
Reachable only by a trusted role or by admin-editable data (e.g. a Department
name feeding a scheduler query) → **Required**, not Critical.

---

## Frappe pre-emit verification gate

Before any finding enters the report, the gate requires:

1. **Quote the motivating line(s).**  
   State the `file:line` and verbatim code that triggers the finding.  
   If you cannot quote it, the finding is unverified → force confidence to 4–5
   and move to appendix.

2. **Run the Frappe-specific checks** that apply to the finding type:

   | Claim | Required verification |
   |---|---|
   | "`frappe.X` doesn't exist / is wrong" | `grep -n "def X\|X =" apps/frappe/frappe/__init__.py`; if not there, search `apps/frappe/frappe/` |
   | "field `foo` missing on DocType `Bar`" | Read `apps/<app>/<app>/doctype/<bar>/<bar>.json`; confirm `"fieldname": "foo"` absent |
   | "hook key `before_save` is invalid" | `grep -n "before_save" apps/frappe/frappe/hooks.py` confirms it is a valid hook |
   | "permission check missing on `get_all`/`db.*`" | Grep controller AND `hooks.py` AND `doc_events` for `has_permission\|only_for\|ignore_permissions`; confirm none found in the call path before raising |
   | "Document API (`insert`/`save`/`submit`) skips permission" | Document API enforces DocPerm internally — this is NOT a finding unless `ignore_permissions=True` is present |
   | "SQL interpolation / injection" | Trace each variable to its origin: request input → Critical; DB value writable only by a trusted role → Required; code constant → style Nit |
   | "missing check X" | `grep -rn "X\|has_permission\|only_for" apps/<app>/` in controller, hooks, and doc_events handlers; confirm the check is genuinely absent before reporting |

3. **If the check reveals the finding is wrong, reject it** — do not lower confidence
   and publish. A rejected false positive goes into a "Rejected FP" appendix with
   the evidence that disproved it.

---

## Worked false-positive rejection

**Scenario.** Agent reviewing `myapp/api.py`:

```python
# myapp/api.py
@frappe.whitelist()
def get_open_sales_orders(user=None):
    user = user or frappe.session.user
    orders = frappe.get_list(
        "Sales Order",
        filters={"owner": user, "status": "Open"},
        fields=["name", "grand_total"],
    )
    return orders
```

**Draft finding (pre-gate).**  
`[Required] (confidence: 7/10) myapp/api.py:4 — frappe.get_list on Sales Order with no frappe.has_permission call; any logged-in user can read any open order`

**Gate applied.**

Step 1 — quote motivating lines: lines 4–9 quoted above. ✓

Step 2 — permission check: `grep -rn "has_permission\|only_for" myapp/api.py`
→ no explicit call. Continues to the next check: does `frappe.get_list` enforce
permissions? `grep -n "def get_list" apps/frappe/frappe/__init__.py`
→ line 1363 docstring: "Will also check for permissions." Confirmed:
`frappe.get_list` calls `frappe.model.qb_query.DatabaseQuery(doctype).execute()`;
`DatabaseQuery.execute` at `apps/frappe/frappe/model/db_query.py:142–143` calls
`self.check_read_permission(self.doctype)` when `ignore_permissions=False` (the
default). The `{"owner": user}` filter further limits results to the calling
user's own records. (Contrast with `frappe.get_all`, `apps/frappe/frappe/__init__.py:1386`,
which explicitly sets `ignore_permissions=True` before calling `get_list` — callers
of `frappe.get_all` must add an explicit `frappe.has_permission()` guard.)

**Gate result:** `frappe.get_list` enforces read permission for the calling
user by default. The draft finding is a false positive.

**Action:** Finding **rejected**. Moved to "Rejected FP" appendix:

> `REJECTED FP: myapp/api.py:4 — frappe.get_list enforces DocPerm by default via frappe.model.db_query.DatabaseQuery.check_read_permission (db_query.py:142–143); no explicit has_permission call is required here. Evidence: apps/frappe/frappe/__init__.py:1363 docstring "Will also check for permissions"; db_query.py:142–143 check_read_permission called when ignore_permissions=False (default).`

---

## Sources

- `apps/frappe/frappe/__init__.py` line 1363 — `frappe.get_list` "Will also check for permissions"; calls `frappe.model.qb_query.DatabaseQuery(doctype).execute()`
- `apps/frappe/frappe/__init__.py` line 1386 — `frappe.get_all` "Will **not** check for permissions"; explicitly sets `kwargs["ignore_permissions"] = True` before calling `get_list`
- `apps/frappe/frappe/model/db_query.py` lines 142–143 — `if not ignore_permissions: self.check_read_permission(self.doctype)` — permission gate
- `apps/frappe/frappe/permissions.py` line 81 — `has_permission()` signature
- Verified against Frappe 16.51.1 (installed bench source)
