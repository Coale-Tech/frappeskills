<!-- Adapted from addyosmani/agent-skills (MIT): skills/test-driven-development/SKILL.md -->
# TDD Workflow for Frappe

Red-green-refactor discipline, Prove-It pattern, and test pyramid applied to
Frappe's Python test infrastructure.

## When a test is warranted

See [SKILL.md step 0](../SKILL.md) — a test earns its place when a plausible
bug would fail it: behaviour, boundaries, invariants, transitions, precedence,
real errors. Wiring, defaults, and field copies do not need tests; use a
throwaway script instead.

## Test classes

| Class | When to use | Rollback |
|---|---|---|
| `frappe.tests.UnitTestCase` | Pure logic with no database side-effects | None needed |
| `frappe.tests.IntegrationTestCase` | Controller behaviour, ORM, lifecycle hooks, API | Each class rolls back its writes automatically |

Always import from the canonical path:

```python
from frappe.tests import IntegrationTestCase, UnitTestCase
```

`from frappe.tests.utils import FrappeTestCase` is a deprecated compat shim
(removed in v17). Do not use it.

## Red-Green-Refactor

```
RED                      GREEN                    REFACTOR
Write a test that   →   Write the minimum code   →   Clean the
FAILS                    to make it PASS               implementation
```

### RED — write the failing test first

```python
from frappe.tests import IntegrationTestCase
import frappe

class TestInvoiceValidation(IntegrationTestCase):
    def test_negative_amount_rejected(self):
        doc = frappe.get_doc({"doctype": "My Invoice", "amount": -50})
        with self.assertRaises(frappe.ValidationError):
            doc.insert()
```

Run it before writing implementation and confirm it **fails for the right
reason**. A test that passes immediately proves nothing.

### GREEN — minimum implementation

Write only enough to make the test pass. Do not gold-plate.

### REFACTOR — clean up while green

Extract helpers, rename, remove duplication, then re-run:

```bash
bench --site <site> run-tests --module <app>.tests.test_invoice_validation
```

## The Prove-It Pattern (bug fixes)

Never start a bug fix by editing code. Write a test that **reproduces the
bug and fails first**:

```
Bug arrives
    │
    ▼
Write a test that demonstrates it  → must FAIL (confirms the bug exists)
    │
    ▼
Fix the code
    │
    ▼
Test PASSES → bug fixed, regression guarded
```

Verify the test fails **for the right reason** before fixing: a test that
fails for the wrong reason will pass after an unrelated change and give false
confidence.

## Test pyramid for Frappe

```
          ╱╲
         ╱  ╲        Browser / Cypress (~5%)
        ╱    ╲       Full Desk flows, form submissions, list actions
       ╱──────╲
      ╱        ╲     IntegrationTestCase (~15%)
     ╱          ╲    Controller lifecycle, ORM, API endpoints
    ╱────────────╲
   ╱              ╲  UnitTestCase (~80%)
  ╱                ╲ Pure service/util logic, no database, milliseconds
 ╱──────────────────╲
```

Decision guide:

| Question | Test type |
|---|---|
| Pure Python logic, no DB or hooks? | `UnitTestCase` (small) |
| DocType lifecycle, permissions, ORM? | `IntegrationTestCase` (medium) |
| Desk UI flow a Python test cannot cover? | Cypress / browser test (large) |

## Test sizes

| Size | Constraints | Frappe example |
|---|---|---|
| Small | No DB, no network, no I/O | Utility function, amount rounding |
| Medium | Local DB, no external services | Controller `validate`, permission check |
| Large | Browser, full Desk flow | Cypress form-submit flow |

Small tests should make up the vast majority of the suite.

## DAMP over DRY

In tests, **DAMP (Descriptive And Meaningful Phrases)** beats DRY. Each test
should read as a complete specification without requiring the reader to trace
shared helpers:

```python
# DAMP — each test tells its own story
def test_overdue_flag_set_on_past_due_date(self):
    doc = frappe.get_doc({"doctype": "Task", "due_date": "2020-01-01"})
    doc.insert()
    doc.check_overdue()
    self.assertTrue(doc.is_overdue)

def test_overdue_flag_absent_on_future_due_date(self):
    doc = frappe.get_doc({"doctype": "Task", "due_date": "2099-12-31"})
    doc.insert()
    doc.check_overdue()
    self.assertFalse(doc.is_overdue)
```

Duplication is acceptable when it makes each test independently understandable.

## The Beyoncé Rule

If you liked it, you should have put a test on it. A refactor or migration
is not responsible for catching your bugs — your tests are. If a change
breaks behaviour you care about and no test existed, that is a gap, not a
regression.

## Sources

- `apps/frappe/frappe/tests/__init__.py` — `IntegrationTestCase`, `UnitTestCase` base classes (v16)
- `apps/frappe/frappe/commands/testing.py` — `run-tests` CLI flags (`--module`, `--doctype`, `--app`)
- `apps/frappe/frappe/testing/environment.py` — test rollback and site-config isolation
- Upstream: `skills/test-driven-development/SKILL.md` (addyosmani/agent-skills, MIT)
