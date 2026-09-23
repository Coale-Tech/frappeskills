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
- Inherit from `frappe.tests.IntegrationTestCase` (not `unittest.TestCase`)
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

## Common pitfalls

- If tests fail with "DocType not found", run `bench --site <site> migrate` first.
- Test files must be named `test_*.py` to be discovered.


---

## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `testing/SKILL.md`.

### Frappe Testing

Write and run tests for Frappe applications using the built-in testing framework.

#### When to use

- Writing unit tests for DocType controllers
- Writing integration tests for workflows and APIs
- Running existing test suites
- Debugging test failures
- Setting up CI pipelines for Frappe apps

#### Inputs required

- App name to test
- Site name for test execution
- Specific module/DocType to test (optional)
- Test environment (dev site, dedicated test site)

#### Procedure

##### 0) Setup test environment

```bash
# Install dev dependencies
bench setup requirements --dev

# Ensure site is ready
bench --site <site> migrate
```

##### 1) Run tests

```bash
# Run all tests for an app
bench --site <site> run-tests --app my_app

# Run tests for specific module
bench --site <site> run-tests --module my_app.my_module.tests

# Run tests for specific DocType
bench --site <site> run-tests --doctype "My DocType"

# Verbose output
bench --site <site> run-tests --app my_app -v

# Run single test file
bench --site <site> run-tests --module my_app.doctype.sample_doc.test_sample_doc
```

##### 2) Write DocType tests

Create `test_<doctype_name>.py` alongside the DocType:

```python
# my_app/doctype/sample_doc/test_sample_doc.py
import frappe
from frappe.tests.utils import FrappeTestCase

class TestSampleDoc(FrappeTestCase):
    def setUp(self):
        # Create test data
        self.doc = frappe.get_doc({
            "doctype": "Sample Doc",
            "title": "Test Document"
        }).insert()
    
    def tearDown(self):
        # Cleanup
        frappe.delete_doc("Sample Doc", self.doc.name, force=True)
    
    def test_creation(self):
        self.assertEqual(self.doc.title, "Test Document")
    
    def test_validation(self):
        doc = frappe.get_doc({
            "doctype": "Sample Doc",
            "title": ""  # Invalid - required field
        })
        self.assertRaises(frappe.ValidationError, doc.insert)
    
    def test_workflow(self):
        self.doc.status = "Approved"
        self.doc.save()
        self.assertEqual(self.doc.status, "Approved")
```

##### 3) Write API tests

```python
# my_app/tests/test_api.py
import frappe
from frappe.tests.utils import FrappeTestCase

class TestAPI(FrappeTestCase):
    def test_whitelist_method(self):
        from my_app.api import process_order
        
        # Create test order
        order = frappe.get_doc({
            "doctype": "Sales Order",
            "customer": "_Test Customer"
        }).insert()
        
        # Test the API
        result = process_order(order.name, "approve")
        
        self.assertEqual(result["status"], "success")
        
        # Cleanup
        frappe.delete_doc("Sales Order", order.name, force=True)
    
    def test_permission_denied(self):
        # Test as restricted user
        frappe.set_user("guest@example.com")
        
        from my_app.api import sensitive_action
        self.assertRaises(frappe.PermissionError, sensitive_action, "doc-001")
        
        # Reset user
        frappe.set_user("Administrator")
```

##### 4) Test permissions

```python
def test_role_permissions(self):
    # Create user with specific role
    user = frappe.get_doc({
        "doctype": "User",
        "email": "test_user@example.com",
        "roles": [{"role": "Sales User"}]
    }).insert()
    
    frappe.set_user("test_user@example.com")
    
    # Test permission
    self.assertTrue(frappe.has_permission("Sales Order", "read"))
    self.assertFalse(frappe.has_permission("Sales Order", "delete"))
    
    # Cleanup
    frappe.set_user("Administrator")
    frappe.delete_doc("User", user.name, force=True)
```

##### 5) Use fixtures

```python
# my_app/doctype/sample_doc/test_records.json
[
    {
        "doctype": "Sample Doc",
        "title": "Test Record 1"
    },
    {
        "doctype": "Sample Doc",
        "title": "Test Record 2"
    }
]
```

Reference in tests:
```python
class TestSampleDoc(FrappeTestCase):
    def test_fixture_loaded(self):
        doc = frappe.get_doc("Sample Doc", "Test Record 1")
        self.assertIsNotNone(doc)
```

##### 6) Run UI tests (Cypress)

```bash
# Run UI tests for an app
bench --site <site> run-ui-tests my_app

# Headless mode
bench --site <site> run-ui-tests my_app --headless
```

#### Verification

- [ ] All tests pass: `bench --site <site> run-tests --app my_app`
- [ ] No test pollution (tests are isolated)
- [ ] Tests run in < 5 minutes for fast feedback
- [ ] CI pipeline runs tests on each commit

#### Failure modes / debugging

- **Test not found**: Ensure filename starts with `test_` and class/method names follow conventions
- **Database errors**: Tests may not be isolated—check for missing cleanup
- **Permission errors in tests**: Use `frappe.set_user("Administrator")` in setup
- **Slow tests**: Avoid unnecessary fixtures, mock external services

#### Escalation

- For complex fixtures, see [references/fixtures.md](./fixtures.md)
- For UI testing patterns, see [references/cypress.md](./cypress.md)
- For CI setup, see [references/ci-testing.md](./ci-testing.md)

#### References

- [references/test-patterns.md](./test-patterns.md) - Common test patterns
- [references/fixtures.md](./fixtures.md) - Test data management
- [references/cypress.md](./cypress.md) - UI testing

#### Guardrails

- **Use test fixtures**: Load test data via fixtures, not manual creation in each test
- **Clean up test data**: Delete created records in `tearDown()` or use `frappe.db.rollback()`
- **Mock external services**: Never call real APIs in tests; mock HTTP calls
- **Isolate tests**: Each test should be independent; no reliance on test execution order
- **Set user context explicitly**: Use `frappe.set_user()` to test as specific users

#### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Not using `FrappeTestCase` | Missing test setup/teardown | Extend `frappe.tests.utils.FrappeTestCase` |
| Missing db rollback | Test pollution, flaky tests | Use `frappe.db.rollback()` in tearDown or transactions |
| Flaky async tests | Intermittent failures | Use `frappe.tests.utils.run_until()` or proper async handling |
| Testing implementation not behavior | Brittle tests | Test outcomes, not internal method calls |
| Hardcoded test data | Conflicts with existing data | Use unique names like `_Test Record {uuid}` |
| Skipping permission tests | Security holes | Test with different user roles, not just Administrator |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `testing/references/testing.md`.

### Testing (expanded)

#### Running tests
- Install dev dependencies: `bench setup requirements --dev`.
- Run all tests: `bench --site <site> run-tests`.
- Run tests for an app: `bench --site <site> run-tests --app <app_name>`.
- Run tests for a module: `bench --site <site> run-tests --module <module_path>`.
- Run tests for a DocType: `bench --site <site> run-tests --doctype "DocType"`.

#### Test types
- **Unit tests**: focus on DocType controller logic and utility functions.
- **Integration tests**: validate workflows, permissions, and API calls.
- **UI tests**: use Cypress for end-to-end flows.

#### Test structure
- Tests must start with `test_` and be Python files.
- DocType tests live in `doctype/<doctype_name>/test_<doctype_name>.py`.
- Module tests live in `<app>/<module>/tests/`.

#### Writing tests
- Use `frappe.get_doc` to construct test documents.
- Use `self.assertRaises` or `frappe.throw` assertions for validation errors.
- Keep tests deterministic: no network, no random data without seeding.
- Use minimal fixtures and create test data in setup.

#### Fixtures and test data
- Use fixtures for metadata required by tests.
- Use test records with clear naming to avoid collisions.

#### Database isolation
- Tests run inside transactions; keep tests idempotent.
- Avoid shared state between tests; clean up test data when needed.

#### Permissions testing
- Use `frappe.set_user` to test role-based access.
- Assert permission errors for restricted actions.

#### UI testing (Cypress)
- Run UI tests: `bench --site <site> run-ui-tests <app>`.
- Headless UI tests: `bench --site <site> run-ui-tests <app> --headless`.

#### CI considerations
- Run tests against a fresh site and database.
- Seed only required fixtures for speed.
- Keep test suite runtime small and parallelize if possible.

Sources: Testing, Unit Testing, UI Testing (official docs)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `testing/references/fixtures.md`.

```markdown
# Test Fixtures Reference

## Overview
Fixtures provide test data for Frappe tests. They can be JSON records, Python setup functions, or programmatically created data.

## Types of Fixtures

### 1. JSON Test Records
Automatically loaded before tests run.

```json
// my_app/doctype/sample_doc/test_records.json
[
    {
        "doctype": "Sample Doc",
        "name": "Test Record 1",
        "title": "First Test Document",
        "status": "Open"
    },
    {
        "doctype": "Sample Doc", 
        "name": "Test Record 2",
        "title": "Second Test Document",
        "status": "Closed"
    }
]
```

**File location:** `<app>/<module>/doctype/<doctype>/test_records.json`

### 2. Dependency Fixtures
Specify DocTypes that must be loaded first.

```python
### my_app/doctype/sales_order/test_sales_order.py
test_dependencies = ["Customer", "Item", "Warehouse"]
```

### 3. Programmatic Fixtures
Create in setUp method.

```python
class TestSalesOrder(FrappeTestCase):
    @classmethod
    def setUpClass(cls):
        """Run once before all tests in this class."""
        super().setUpClass()
        cls.customer = create_test_customer()
        cls.items = create_test_items(5)
    
    def setUp(self):
        """Run before each test method."""
        self.order = create_test_order(self.customer, self.items)
    
    def tearDown(self):
        """Run after each test method."""
        frappe.delete_doc("Sales Order", self.order.name, force=True)
    
    @classmethod
    def tearDownClass(cls):
        """Run once after all tests in this class."""
        frappe.delete_doc("Customer", cls.customer.name, force=True)
        for item in cls.items:
            frappe.delete_doc("Item", item.name, force=True)
        super().tearDownClass()
```

## Creating Test Data

### Factory Functions
```python
### my_app/tests/fixtures.py
import frappe
from frappe.utils import random_string

def create_test_customer(name=None, **kwargs):
    """Create a test customer with defaults."""
    customer = frappe.get_doc({
        "doctype": "Customer",
        "customer_name": name or f"Test Customer {random_string(5)}",
        "customer_type": "Company",
        "territory": "_Test Territory",
        **kwargs
    })
    customer.insert(ignore_permissions=True)
    return customer

def create_test_item(name=None, **kwargs):
    """Create a test item with defaults."""
    item = frappe.get_doc({
        "doctype": "Item",
        "item_code": name or f"TEST-ITEM-{random_string(5)}",
        "item_name": name or f"Test Item {random_string(5)}",
        "item_group": "Products",
        "stock_uom": "Nos",
        **kwargs
    })
    item.insert(ignore_permissions=True)
    return item

def create_test_order(customer, items, **kwargs):
    """Create a test sales order."""
    order = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer.name if hasattr(customer, 'name') else customer,
        "delivery_date": frappe.utils.add_days(frappe.utils.nowdate(), 7),
        "items": [
            {"item_code": item.name if hasattr(item, 'name') else item, "qty": 1, "rate": 100}
            for item in items
        ],
        **kwargs
    })
    order.insert(ignore_permissions=True)
    return order
```

### Using Factory Functions
```python
from my_app.tests.fixtures import create_test_customer, create_test_item, create_test_order

class TestSalesWorkflow(FrappeTestCase):
    def test_order_submission(self):
        customer = create_test_customer()
        items = [create_test_item() for _ in range(3)]
        order = create_test_order(customer, items)
        
        order.submit()
        self.assertEqual(order.docstatus, 1)
```

## Fixture Best Practices

### Use Unique Names
```python
from frappe.utils import random_string

def create_unique_customer():
    # ✅ Unique name prevents collisions
    return create_test_customer(name=f"Test Cust {random_string(8)}")

def create_collision_prone_customer():
    # ❌ Fixed name may collide with other tests
    return create_test_customer(name="Test Customer")
```

### Cleanup After Tests
```python
class TestWithCleanup(FrappeTestCase):
    def setUp(self):
        self.created_docs = []
    
    def tearDown(self):
        for doctype, name in self.created_docs:
            frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
    
    def track_for_cleanup(self, doc):
        self.created_docs.append((doc.doctype, doc.name))
        return doc
    
    def test_something(self):
        customer = self.track_for_cleanup(create_test_customer())
        # Test uses customer, cleanup handled automatically
```

### Minimal Fixtures
```python
### ❌ Bad: Loading too much data
def setUpClass(cls):
    # Creates 1000 orders - slow!
    cls.orders = [create_test_order() for _ in range(1000)]

### ✅ Good: Load minimum needed
def setUpClass(cls):
    cls.sample_order = create_test_order()
    
def test_pagination(self):
    # Create specific data for this test
    for _ in range(25):
        create_test_order().insert()
    # Test pagination
```

## Shared Fixtures Module

```python
### my_app/tests/fixtures/__init__.py
from .customers import create_test_customer, get_test_customer
from .items import create_test_item, get_test_items
from .orders import create_test_order

__all__ = [
    "create_test_customer",
    "get_test_customer", 
    "create_test_item",
    "get_test_items",
    "create_test_order"
]
```

```python
### my_app/tests/fixtures/customers.py
_test_customers = {}

def create_test_customer(key=None, **kwargs):
    """Create a test customer, optionally cached by key."""
    if key and key in _test_customers:
        return _test_customers[key]
    
    customer = frappe.get_doc({...})
    customer.insert(ignore_permissions=True)
    
    if key:
        _test_customers[key] = customer
    
    return customer

def get_test_customer(key):
    """Get a cached test customer."""
    return _test_customers.get(key)

def cleanup_test_customers():
    """Delete all cached test customers."""
    for name in list(_test_customers.keys()):
        frappe.delete_doc("Customer", _test_customers[name].name, force=True)
        del _test_customers[name]
```

## Loading External Data

### From CSV
```python
import csv

def load_test_data_from_csv(csv_path, doctype):
    """Load test records from CSV file."""
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            doc = frappe.get_doc({"doctype": doctype, **row})
            doc.insert(ignore_permissions=True)
```

### From JSON
```python
import json

def load_test_data_from_json(json_path):
    """Load test records from JSON file."""
    with open(json_path) as f:
        records = json.load(f)
    
    for record in records:
        doc = frappe.get_doc(record)
        doc.insert(ignore_permissions=True)
```

## Fixture Isolation

### Transaction Rollback
```python
class TestWithRollback(FrappeTestCase):
    def setUp(self):
        frappe.db.savepoint("test_start")
    
    def tearDown(self):
        frappe.db.rollback(save_point="test_start")
    
    def test_something(self):
        # Changes rolled back after test
        customer = create_test_customer()
```

### Database Isolation
```python
class TestIsolated(FrappeTestCase):
    """Tests that need complete isolation."""
    
    @classmethod
    def setUpClass(cls):
        # Use a separate test database if needed
        pass
```

Sources: Testing, Unit Tests, Fixtures (official docs)
```
