<!-- Adapted from addyosmani/agent-skills (MIT): skills/source-driven-development/SKILL.md -->
# Source Citation Protocol for Frappe

Every Frappe-specific implementation decision must be grounded in the installed
source or official docs, cited with enough precision that anyone can check it.

## Precedence order

```
Installed source  >  docs.frappe.io / frappeframework.com  >  Web
```

**Installed source is the authority.** The installed source reflects the code
actually running on the site. Official docs lag behind releases. Anything else
(blogs, memory, model training data) is tertiary and must not be cited as
primary.

## Step 1 — detect the version

Before searching, read the installed Frappe version:

```bash
# bench console
import frappe
print(frappe.__version__)   # e.g. 16.35.0
```

Or:

```bash
bench --site <site> version
```

Tag every citation with the version it was verified against. A finding from
v15 may not apply to v16.

## Step 2 — locate the mechanism in installed source

Search by behaviour, then read **whole functions**:

```bash
grep -rn "def <mechanism>" apps/frappe/frappe
grep -rln "<error string>" apps/frappe apps/erpnext apps/hrms
```

Early returns, guard clauses, and monkey-patches in custom apps change
everything. Never cite a snippet without reading the full function.

## Step 3 — implement per installed source

Write code that matches the installed API signatures. If installed source and
official docs disagree, **installed source wins**. Surface the discrepancy:

```
CONFLICT: docs.frappe.io shows `frappe.get_value` for Single DocType reads,
but the installed source uses `frappe.db.get_single_value`
(apps/frappe/frappe/db.py:<line>, v16.35.0). Using `get_single_value`.
```

## Step 4 — cite file:line

Every non-obvious Frappe-specific claim gets a citation. In code:

```python
# frappe.qb builder — apps/frappe/frappe/query_builder/builder.py:112 (v16.35.0)
result = frappe.qb.from_("Sales Order").select("name").where(
    frappe.qb.Field("status") == "Draft"
).run(as_dict=True)
```

In prose (PR description or answer):

```
Using `frappe.db.get_single_value` for Single DocType reads:
apps/frappe/frappe/db.py:384, frappe 16.35.0
```

For official docs:

```
Source: https://frappeframework.com/docs/user/en/api/document#on_update_after_submit
```

## Step 5 — flag unverified claims

If a pattern could not be confirmed in installed source or official docs, mark
it explicitly before stating it:

```
[INFERENCE] This behaviour was observed empirically but not confirmed in
installed source. Verify in bench console before relying on it in production.
```

An inference must be executed in `bench --site <site> console` before it can be
promoted to a confirmed claim.

## When installed source disagrees with docs

1. State the discrepancy with both citations.
2. Trust the installed source.
3. Check whether the docs reference a different version.
4. Correct any stale reference file that repeated the wrong information.

```
DISCREPANCY: docs.frappe.io/framework says X; installed source
apps/frappe/frappe/app.py:210 (v16.35.0) does Y.
Implementing Y per source. Correcting references/learned-patterns.md.
```

## Citation formats

**Inline code comment:**
```python
# Source: apps/frappe/frappe/model/document.py:445, frappe 16.35.0
```

**PR/answer prose:**
```
`on_update_after_submit` only fires for submitted documents that are not
being cancelled.
Source: apps/frappe/frappe/model/document.py:445, frappe 16.35.0
```

**Official docs (when source not yet checked):**
```
Source: https://frappeframework.com/docs/user/en/api/document (verify against installed source)
```

## Checklist

- [ ] Frappe/ERPNext version read from installed source before searching
- [ ] Mechanism located in installed source, not recalled from memory
- [ ] Whole function read (not a snippet) — early returns noted
- [ ] Behaviour executed in `bench --site <site> console` before asserting
- [ ] Every non-obvious claim has a `file:line` citation with version
- [ ] Anything not confirmed in source flagged as `[INFERENCE]`
- [ ] Conflicting reference files corrected when installed source disagrees
- [ ] No client/bench/app names in recorded discoveries — use `a custom app`, `a site`

## Sources

- `apps/frappe/frappe/__init__.py` — `__version__`
- `apps/frappe/frappe/model/document.py` — document lifecycle hooks
- `apps/frappe/frappe/db.py` — ORM methods, `get_single_value`
- `apps/frappe/frappe/query_builder/builder.py` — `frappe.qb` API (v16)
- Upstream: `skills/source-driven-development/SKILL.md` (addyosmani/agent-skills, MIT)
