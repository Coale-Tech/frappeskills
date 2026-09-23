# Testing

## File location

Tests live alongside the code they test:
```
apps/<app>/<app>/<module>/doctype/<doctype>/test_<doctype>.py
```

For feature-wise tests, place in the tests directory:
```
apps/<app>/<app>/tests/test_<feature>.py
```

## Writing tests

```python
import frappe
from frappe.tests import IntegrationTestCase

class TestExpense(IntegrationTestCase):
    def test_expense_creation(self):
        doc = frappe.get_doc(doctype="Expense", title="Test", amount=100)
        doc.insert()
        self.assertEqual(doc.amount, 100)

    def test_validation(self):
        doc = frappe.get_doc(doctype="Expense", title="Test", amount=-1)
        self.assertRaises(frappe.ValidationError, doc.insert)
```

Key patterns:
- Inherit from `frappe.tests.IntegrationTestCase` (not `unittest.TestCase`). `frappe.tests.utils.FrappeTestCase` is a deprecated alias for the same class — use `IntegrationTestCase` in new code.
- Tests run inside a transaction that rolls back — no manual cleanup needed

## Unit tests (no database)

For pure logic that doesn't need Frappe context or database:

```python
from frappe.tests import UnitTestCase

class TestExpenseUtils(UnitTestCase):
    def test_calculate_tax(self):
        self.assertEqual(calculate_tax(100, 0.1), 10)
```

`UnitTestCase` is faster — no DB setup/teardown. Use for utility functions, calculations, parsing logic.

## Test fixtures

For test data that multiple tests need, create `test_records` or use `setUp`:

```python
class TestExpense(IntegrationTestCase):
    def setUp(self):
        self.category = frappe.get_doc(doctype="Expense Category", category_name="Travel").insert()
```

Fixture helpers below insert with `ignore_permissions=True` because factory setup runs before
any permission scenario is under test; that bypass is expected in test code and does not need
a comment on every call (unlike application code, where each bypass needs its own justification).

### JSON test records

Automatically loaded before tests run, from `<app>/<module>/doctype/<doctype>/test_records.json`:

```json
[
    {"doctype": "Sample Doc", "name": "Test Record 1", "title": "First Test Document", "status": "Open"},
    {"doctype": "Sample Doc", "name": "Test Record 2", "title": "Second Test Document", "status": "Closed"}
]
```

```python
class TestSampleDoc(IntegrationTestCase):
    def test_fixture_loaded(self):
        doc = frappe.get_doc("Sample Doc", "Test Record 1")
        self.assertIsNotNone(doc)
```

### Dependency fixtures

Declare DocTypes that must be loaded first:

```python
# my_app/doctype/sales_order/test_sales_order.py
test_dependencies = ["Customer", "Item", "Warehouse"]
```

### Factory functions

```python
# my_app/tests/fixtures.py
import frappe
from frappe.utils import random_string

def create_test_customer(name=None, **kwargs):
    customer = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": name or f"Test Customer {random_string(5)}",
        "customer_type": "Company",
        "territory": "_Test Territory",
        **kwargs
    })
    customer.insert(ignore_permissions=True)
    return customer

def create_test_order(customer, items, **kwargs):
    order = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer.name,
        "delivery_date": frappe.utils.add_days(frappe.utils.nowdate(), 7),
        "items": [{"item_code": item.name, "qty": 1, "rate": 100} for item in items],
        **kwargs
    })
    order.insert(ignore_permissions=True)
    return order
```

```python
from my_app.tests.fixtures import create_test_customer, create_test_order

class TestSalesWorkflow(IntegrationTestCase):
    def test_order_submission(self):
        customer = create_test_customer()
        order = create_test_order(customer, items=[])
        order.submit()
        self.assertEqual(order.docstatus, 1)
```

### Fixture best practices

Use unique names to avoid collisions with existing or parallel test data:

```python
from frappe.utils import random_string

# Do: unique name prevents collisions
create_test_customer(name=f"Test Cust {random_string(8)}")

# Don't: fixed name may collide with other tests
create_test_customer(name="Test Customer")
```

Track and clean up ad hoc records instead of leaking them:

```python
class TestWithCleanup(IntegrationTestCase):
    def setUp(self):
        self.created_docs = []

    def tearDown(self):
        for doctype, name in self.created_docs:
            frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)

    def track_for_cleanup(self, doc):
        self.created_docs.append((doc.doctype, doc.name))
        return doc
```

Load the minimum data a test needs — a `setUpClass` that creates a thousand records to test
pagination is slow for every test in the class; create the bulk data inside the one test that
needs it instead.

### Shared fixtures module

```python
# my_app/tests/fixtures/__init__.py
from .customers import create_test_customer, get_test_customer
from .items import create_test_item, get_test_items
from .orders import create_test_order

__all__ = [
    "create_test_customer", "get_test_customer",
    "create_test_item", "get_test_items",
    "create_test_order",
]
```

Cache factory output by key when several tests in a module need the same record:

```python
# my_app/tests/fixtures/customers.py
_test_customers = {}

def create_test_customer(key=None, **kwargs):
    if key and key in _test_customers:
        return _test_customers[key]
    customer = frappe.get_doc({"doctype": "Customer", **kwargs})
    customer.insert(ignore_permissions=True)
    if key:
        _test_customers[key] = customer
    return customer
```

### Loading external data

```python
import csv
import json

def load_test_data_from_csv(csv_path, doctype):
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            frappe.get_doc({"doctype": doctype, **row}).insert(ignore_permissions=True)

def load_test_data_from_json(json_path):
    with open(json_path) as f:
        for record in json.load(f):
            frappe.get_doc(record).insert(ignore_permissions=True)
```

### Fixture isolation (savepoint rollback)

For a test that needs to roll back mid-suite instead of relying on the outer test transaction:

```python
class TestWithRollback(IntegrationTestCase):
    def setUp(self):
        frappe.db.savepoint("test_start")

    def tearDown(self):
        frappe.db.rollback(save_point="test_start")
```

## Test site

Run tests on a **separate site** from the one the user is actively working on. Tests create, modify, and delete data — running them on the development site will pollute it.

Convention: if the dev site is `expense.localhost`, create `expense-test.localhost` for tests:
```bash
bench new-site expense-test.localhost --admin-password admin
bench --site expense-test.localhost install-app <app-name>
```

Always run tests against the test site:
```bash
bench --site expense-test.localhost run-tests --app <app-name>
```

## Running tests

```bash
# All tests for an app
bench --site <site> run-tests --app <app-name>

# Specific DocType
bench --site <site> run-tests --doctype "Expense"

# Specific test file
bench --site <site> run-tests --module <app>.<module>.doctype.<doctype>.test_<doctype>

# Specific test method
bench --site <site> run-tests --module <app>.<module>.doctype.<doctype>.test_<doctype> --test test_expense_creation
```

UI tests: [references/cypress.md](cypress.md).

## Testing permissions

Switch user context to exercise role-based access, and always restore it:

```python
class TestPermissions(IntegrationTestCase):
    def test_permission_denied(self):
        doc = frappe.get_doc({"doctype": "Sales Order", "customer": "_Test Customer"}).insert()
        try:
            frappe.set_user("test_user@example.com")
            self.assertFalse(frappe.has_permission("Sales Order", "delete"))
            doc.customer = "Other"
            self.assertRaises(frappe.PermissionError, doc.save)
        finally:
            frappe.set_user("Administrator")
```

## Common pitfalls

- If tests fail with "DocType not found", run `bench --site <site> migrate` first.
- Test files must be named `test_*.py` to be discovered.
- Missing `frappe.db.rollback()`/transaction isolation causes flaky, order-dependent tests.
- Asserting on internal method calls or field wiring instead of observable behaviour makes tests brittle.
- Hardcoded fixed test-record names collide with existing or parallel test data — use unique names.
- Testing only as `Administrator` skips permission bugs — assert role-restricted behaviour too.
