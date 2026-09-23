# DocTypes

DocTypes are the core data model in Frappe. Each DocType becomes a database table and gets auto-generated CRUD APIs, forms, and list views.

## Creating a DocType

Write the JSON definition file and let `bench migrate` create the folder structure. Do NOT `mkdir` DocType directories.

File path: `apps/<app>/<app>/<module>/doctype/<doctype_name>/<doctype_name>.json`

Minimal example:
```json
{
    "name": "Expense",
    "module": "Expense Tracker",
    "doctype": "DocType",
    "engine": "InnoDB",
    "fields": [
        {
            "fieldname": "title",
            "fieldtype": "Data",
            "label": "Title",
            "reqd": 1
        },
        {
            "fieldname": "amount",
            "fieldtype": "Currency",
            "label": "Amount",
            "reqd": 1
        },
        {
            "fieldname": "status",
            "fieldtype": "Select",
            "label": "Status",
            "options": "Draft\nApproved\nRejected",
            "default": "Draft"
        }
    ],
    "autoname": "format:EXP-{####}",
    "naming_rule": "Expression",
    "is_submittable": 0,
    "permissions": [
        {
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1
        }
    ]
}
```

Also create an empty `__init__.py` alongside the JSON:
```
apps/<app>/<app>/<module>/doctype/<doctype_name>/__init__.py
```

## Common field types

| fieldtype | Use for |
|-----------|---------|
| Data | Short text (140 chars) |
| Small Text | Multi-line text |
| Text Editor | Rich text (HTML) |
| Int / Float | Number |
| Currency | Money amounts |
| Date / Datetime | Date, or date with time |
| Select | Dropdown (options separated by `\n`) |
| Link | Foreign key to another DocType |
| Table | Child table (one-to-many) |
| Check | Boolean (0/1) |
| Attach | File attachment |

## Naming patterns

- `autoname: "format:EXP-{####}"` — sequential (EXP-0001, EXP-0002)
- `autoname: "field:title"` — use field value as name
- `autoname: "hash"` — random hash
- `autoname: "naming_series:"` — user-configurable series
- `autoname: "prompt"` — user enters name manually

## Child DocTypes

For one-to-many relationships (e.g. Expense Items inside an Expense):

1. Create a child DocType JSON with `"istable": 1`
2. Add a `Table` field in the parent pointing to it:
```json
{
    "fieldname": "items",
    "fieldtype": "Table",
    "label": "Items",
    "options": "Expense Item"
}
```

A child DocType needs no permissions. It inherits them from the parent.

## After creating/modifying DocTypes

Always run:
```bash
bench --site <site> migrate
```

## Other useful JSON keys

```json
{
    "sort_field": "modified",       // default sort column for list view
    "sort_order": "DESC",           // ASC or DESC
    "track_changes": 1,             // enable version history / timeline
    "is_submittable": 1             // enables Submit → Cancel → Amend workflow
}
```

Submittable DocTypes get a `docstatus` field automatically: `0` = Draft, `1` = Submitted, `2` = Cancelled. Users cannot edit submitted documents — they must cancel and amend.

Do NOT add `creation`, `modified`, `owner`, `modified_by`, or `docstatus` as fields — Frappe creates these automatically.

---

## DocType Architecture & Overview

### DocType Classification

| Type | Description | Use Case |
|------|-------------|----------|
| **Master** | Entity records | Customer, Item, Employee |
| **Transactional** | Business operations | Sales Order, Invoice, Payment |
| **Submittable** | Documents with workflow states | Invoice, Journal Entry |
| **Single** | Singleton (one record only) | Settings, Configuration |
| **Child** | Table rows (no standalone form) | Invoice Item, Address |
| **Tree** | Hierarchical structure | Account, Territory |
| **Virtual** | Custom data source (no DB table) | External API data |

### Standard System Fields

Every DocType automatically includes:

| Field | Type | Description |
|-------|------|-------------|
| `name` | Data | Primary key (document ID) |
| `owner` | Link | User who created the document |
| `creation` | Datetime | When document was created |
| `modified` | Datetime | Last modification time |
| `modified_by` | Link | User who last modified |
| `docstatus` | Int | 0=Draft, 1=Submitted, 2=Cancelled |
| `idx` | Int | Sort order index |

### DocType Files Structure

```
app_name/
└── module_name/
    └── doctype/
        └── doctype_name/
            ├── doctype_name.json    # DocType definition
            ├── doctype_name.py      # Server controller
            ├── doctype_name.js      # Client controller
            └── test_doctype_name.py # Test file
```

---

## Field Types Reference

### Data Input Fields

#### Data
Short text (up to 140 chars). Supports validation options.

```yaml
- fieldname: "first_name"
  label: "First Name"
  fieldtype: "Data"
  reqd: true
  options: "Email"  # Name, Email, Phone, URL, IBAN
```

#### Link
Foreign key reference to another DocType.

```yaml
- fieldname: "customer"
  label: "Customer"
  fieldtype: "Link"
  options: "Customer"
  reqd: true
  in_list_view: true
  in_standard_filter: true
```

#### Dynamic Link
Reference to any DocType (dynamic foreign key).

```yaml
- fieldname: "party_type"
  label: "Party Type"
  fieldtype: "Link"
  options: "DocType"

- fieldname: "party"
  label: "Party"
  fieldtype: "Dynamic Link"
  options: "party_type"  # References the Link field above
```

#### Select
Dropdown with predefined options.

```yaml
- fieldname: "status"
  label: "Status"
  fieldtype: "Select"
  options: "Draft\nOpen\nIn Progress\nResolved\nClosed"
  default: "Open"
```

#### Check
Boolean checkbox.

```yaml
- fieldname: "is_active"
  label: "Is Active"
  fieldtype: "Check"
  default: 1
```

#### Table
Child table (one-to-many relationship).

```yaml
- fieldname: "items"
  label: "Items"
  fieldtype: "Table"
  options: "Order Item"  # Child DocType name
  reqd: true
```

#### Table MultiSelect
Many-to-many selection using link table.

```yaml
- fieldname: "tags"
  label: "Tags"
  fieldtype: "Table MultiSelect"
  options: "Document Tag"
```

### Text Fields

| Field Type | Description | Use Case |
|-----------|-------------|----------|
| `Text` | Multi-line text | Descriptions |
| `Small Text` | Slightly larger than Data | Short bios |
| `Long Text` | Unlimited characters | Full content |
| `Text Editor` | WYSIWYG HTML editor | Rich content |
| `Markdown Editor` | Markdown with preview | Documentation |
| `Code` | Syntax highlighted editor | Scripts (options: Python, JavaScript, JSON, HTML, CSS) |

### Numeric Fields

| Field Type | Description | Example |
|-----------|-------------|---------|
| `Int` | Whole number | `non_negative: 1` |
| `Float` | Decimal number | `precision: "2"` |
| `Currency` | Money with currency | `options: "currency"` or `"Company:company:default_currency"` |
| `Percent` | Percentage value | Discount % |

### Date & Time Fields

| Field Type | Description | Default Options |
|-----------|-------------|-----------------|
| `Date` | Date only | `default: "Today"` |
| `Datetime` | Date and time | |
| `Time` | Time only | |
| `Duration` | Time duration | `options: "hours"` (days, hours, minutes, seconds) |

### Media & Visual Fields

| Field Type | Description | Options |
|-----------|-------------|---------|
| `Attach` | File upload | From File Manager |
| `Attach Image` | Image-only upload | JPEG, PNG |
| `Image` | Display from another field | `options: "photo"` (source field) |
| `Barcode` | Auto-generated barcode | |
| `Color` | Color picker | `default: "#3498db"` |
| `Rating` | Star rating | `options: "5"` (3-10 stars) |
| `Signature` | Digital signature pad | |
| `Geolocation` | Map-based GeoJSON | Polygon, line, point |

### Layout Fields

| Field Type | Description | Key Property |
|-----------|-------------|-------------|
| `Section Break` | New form section | `collapsible: 1` |
| `Column Break` | Split into columns | |
| `Tab Break` | Tabbed interface (v14+) | |
| `HTML` | Custom HTML content | `options: "<div>...</div>"` |
| `Button` | Action trigger | |

### Special Fields

| Field Type | Description | Use Case |
|-----------|-------------|----------|
| `Password` | Encrypted data | API secrets |
| `Read Only` | Non-editable fetched value | `fetch_from: "customer.customer_name"` |
| `JSON` | JSON with syntax highlighting | Metadata storage |

### Field Properties Reference

| Property | Description | Example |
|----------|-------------|---------|
| `fieldname` | Code reference name | `customer_name` |
| `label` | Display label | `Customer Name` |
| `fieldtype` | Data type | `Data`, `Link`, `Select` |
| `options` | Field-specific options | DocType name for Link |
| `reqd` | Required field | `1` or `0` |
| `default` | Default value | `Today`, `__user` |
| `unique` | Must be unique | `1` or `0` |
| `hidden` | Hidden from form | `1` or `0` |
| `read_only` | Cannot be edited | `1` or `0` |
| `in_list_view` | Show in list view | `1` or `0` |
| `in_standard_filter` | Show in filters | `1` or `0` |
| `in_global_search` | Include in search | `1` or `0` |
| `bold` | Display in bold | `1` or `0` |
| `allow_on_submit` | Editable after submit | `1` or `0` |
| `fetch_from` | Auto-fetch from linked doc | `customer.customer_name` |
| `fetch_if_empty` | Fetch only if empty | `1` or `0` |
| `depends_on` | Conditional visibility | `eval:doc.status=='Open'` |
| `mandatory_depends_on` | Conditional required | `eval:doc.type=='Sale'` |
| `read_only_depends_on` | Conditional read-only | `eval:doc.docstatus==1` |
| `permlevel` | Permission level | `0`, `1`, `2` |
| `precision` | Decimal places | `2` |
| `length` | Max character length | `140` |
| `non_negative` | Prevent negative values | `1` or `0` |
| `collapsible` | Section is collapsible | `1` or `0` |
| `collapsible_depends_on` | Conditional collapse | `eval:doc.items.length==0` |

---

## Naming & Autoname Patterns

### 9 Naming Methods

| # | Method | Config | Example Output |
|---|--------|--------|---------------|
| 1 | **Set by User** | `autoname = ""` | User enters name |
| 2 | **Autoincrement** | `autoname = "autoincrement"` | 1, 2, 3... |
| 3 | **By Fieldname** | `autoname = "field:article_name"` | Field value |
| 4 | **Naming Series** | `autoname = "naming_series:"` | REQ-2024-00001 |
| 5 | **Format Expression** | `autoname = "format:PRE-{YYYY}-{#####}"` | PRE-2024-00001 |
| 6 | **Random Hash** | `autoname = "hash"` | a1b2c3d4e5 |
| 7 | **UUID** | `autoname = "UUID"` | 550e8400-e29b... |
| 8 | **Prompt** | `autoname = "Prompt"` | User prompted |
| 9 | **Custom (autoname hook)** | Override in controller | Custom logic |

### `naming_rule` (DocType JSON field, v16)

The DocType form stores the selection in the `naming_rule` field, which sets the
corresponding `autoname` value. Verified `naming_rule` options
(`apps/frappe/frappe/core/doctype/doctype/doctype.json`):

| `naming_rule` | Equivalent `autoname` |
|---------------|-----------------------|
| `Set by user` | `""` (Prompt / user enters) |
| `Autoincrement` | `autoincrement` (integer PK, cannot be changed later) |
| `By fieldname` | `field:<fieldname>` |
| `By "Naming Series" field` | `naming_series:` |
| `Expression` | `format:...` |
| `Expression (old style)` | `PRE-.####` (legacy dot syntax) |
| `Random` | `hash` |
| `UUID` | `UUID` |
| `By script` | controller `autoname()` method / `before_naming` |

> `naming_series:.YYYY.-` style patterns support `.YYYY.`, `.MM.`, `.DD.`, `.WW.`,
> `.###` (counter) and `.{fieldname}.` tokens (`frappe/model/naming.py`).

### Format Pattern Variables

| Pattern | Description | Example |
|---------|-------------|---------|
| `{YYYY}` | 4-digit year | 2024 |
| `{YY}` | 2-digit year | 24 |
| `{MM}` | Month | 01-12 |
| `{DD}` | Day | 01-31 |
| `{#####}` | Counter (N digits) | 00001 |
| `{field_name}` | Field value | Value from field |

### Naming Series Field Setup

```yaml
- fieldname: "naming_series"
  label: "Series"
  fieldtype: "Select"
  options: "REQ-.YYYY.-\nSUP-.YYYY.-"
```

### Custom Autoname (Controller)

```python
class MyDocType(Document):
    def autoname(self):
        self.name = f"{self.customer}-{self.posting_date}"
```

---

---

## Docstatus & Document States

| Value | Status | Description |
|-------|--------|-------------|
| 0 | Draft | Fully editable |
| 1 | Submitted | Creates ledger entries, limited edits |
| 2 | Cancelled | Reversed, read-only |

```python
# Check status
if doc.docstatus == 0:  # Draft
if doc.docstatus == 1:  # Submitted
if doc.docstatus == 2:  # Cancelled

# Submit and cancel
doc.submit()
doc.cancel()

# Amend a cancelled document
amended_doc = frappe.copy_doc(doc)
amended_doc.amended_from = doc.name
amended_doc.insert()
```

---

## Child Tables

### Child DocType Definition

```yaml
# Child DocType must have istable: 1
istable: 1
fields:
  - fieldname: "item_code"
    label: "Item Code"
    fieldtype: "Link"
    options: "Item"
    in_list_view: true
    reqd: true
  - fieldname: "qty"
    label: "Quantity"
    fieldtype: "Float"
    in_list_view: true
    reqd: true
  - fieldname: "rate"
    label: "Rate"
    fieldtype: "Currency"
    in_list_view: true
  - fieldname: "amount"
    label: "Amount"
    fieldtype: "Currency"
    in_list_view: true
    read_only: true
```

### Child Table Operations (Python)

```python
# Append row
doc.append("items", {
    "item_code": "ITEM-001",
    "qty": 10
})

# Set entire table (replace all)
doc.set("items", [
    {"item_code": "ITEM-001", "qty": 10},
    {"item_code": "ITEM-002", "qty": 5}
])

# Iterate
for item in doc.get("items"):
    print(item.item_code)
```

---

## Single DocTypes

Singleton DocTypes for settings/configuration.

```yaml
issingle: 1
fields:
  - fieldname: "enable_feature"
    label: "Enable Feature"
    fieldtype: "Check"
  - fieldname: "api_key"
    label: "API Key"
    fieldtype: "Password"
```

```python
# Get single value
value = frappe.db.get_single_value("My Settings", "enable_feature")

# Get doc
settings = frappe.get_single("My Settings")
settings.enable_feature = 1
settings.save()
```

---

## Virtual DocTypes

No database table -- external APIs, files, or secondary databases.

```yaml
is_virtual: 1
```

### Required Controller Overrides

```python
class ExternalUser(Document):
    @staticmethod
    def get_list(args):
        response = requests.get("https://api.example.com/users")
        return [{"name": u["id"], "email": u["email"]} for u in response.json()]

    @staticmethod
    def get_count(args):
        response = requests.get("https://api.example.com/users/count")
        return response.json()["count"]

    def load_from_db(self):
        response = requests.get(f"https://api.example.com/users/{self.name}")
        user = response.json()
        self.email = user["email"]

    def db_insert(self, *args, **kwargs):
        response = requests.post("https://api.example.com/users", json={"email": self.email})
        self.name = response.json()["id"]

    def db_update(self):
        requests.put(f"https://api.example.com/users/{self.name}", json={"email": self.email})

    def delete(self):
        requests.delete(f"https://api.example.com/users/{self.name}")
```

---

## Tree DocTypes

Hierarchical parent-child with nested set model.

```yaml
is_tree: 1
nsm_parent_field: "parent_account"
```

### Standard Tree Fields

| Field | Description |
|-------|-------------|
| `parent_[doctype]` | Link to parent record |
| `is_group` | Whether node has children |
| `lft` | Left value (nested set) |
| `rgt` | Right value (nested set) |

### Tree API

```python
# Get ancestors
from frappe.utils.nestedset import get_ancestors_of
ancestors = get_ancestors_of("Account", "Sales Expenses")

# Get descendants
descendants = frappe.get_all("Account",
    filters={"lft": [">", doc.lft], "rgt": ["<", doc.rgt]}
)
```

---

## Actions and Links

### Server Actions

```python
# In DocType JSON
{
    "actions": [
        {
            "label": "Send Email",
            "action_type": "Server Action",
            "action": "my_app.api.send_notification"
        }
    ]
}
```

### Document Links (Dashboard)

```python
# my_app/doctype/customer_request/customer_request_dashboard.py
def get_data():
    return {
        "fieldname": "customer_request",
        "non_standard_fieldnames": {
            "Payment Entry": "reference_name"
        },
        "transactions": [
            {
                "label": "Related",
                "items": ["Task", "Payment Entry"]
            }
        ]
    }
```

---

---

## Customization Approaches

| # | Approach | Description |
|---|----------|-------------|
| 1 | **Custom Field** | Add fields to existing DocTypes |
| 2 | **Property Setter** | Override field properties |
| 3 | **Client Script** | Additional client-side handlers |
| 4 | **Server Script** | Additional server-side logic |
| 5 | **Override DocType Class** | Override controller in custom app |
| 6 | **Hooks (doc_events)** | Cross-doctype automation |

### Override DocType Class

```python
# hooks.py
override_doctype_class = {
    "Sales Invoice": "my_app.overrides.CustomSalesInvoice"
}
```

```python
# my_app/overrides.py
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice

class CustomSalesInvoice(SalesInvoice):
    def validate(self):
        super().validate()
        self.custom_validation()
```

### Extend DocType Class (v16 — mixin, preferred over full override)

`extend_doctype_class` injects a mixin into the standard controller's MRO without
replacing it, so multiple apps can layer behavior on the same DocType. Verified in
`apps/frappe/frappe/model/base_document.py` (`get_controller` reads
`get_hooks("extend_doctype_class")`).

```python
# hooks.py
extend_doctype_class = {
    "Task": "my_app.custom.task.CustomTaskMixin"
}
```

```python
# my_app/custom/task.py
class CustomTaskMixin:
    def validate(self):
        super().validate()      # runs the standard Task.validate
        self.custom_validation()
```

> Use `extend_doctype_class` (mixin, composable) when possible; use
> `override_doctype_class` (full replacement, only one app can win) only when you must
> replace the base controller entirely.

---

---

## Form & View Settings

| Setting | Description |
|---------|-------------|
| `title_field` | Field displayed as document title |
| `show_title_field_in_link` | Show title in Link fields |
| `image_field` | Image at top of form |
| `search_fields` | Searchable in list view (`"customer_name,email_id,phone"`) |
| `default_sort_field` | Default sort column |
| `default_sort_order` | `"desc"` or `"asc"` |

### DocType-Level Flags (verified Check fields)

Exact `Check` fieldnames on the DocType meta
(`apps/frappe/frappe/core/doctype/doctype/doctype.json`). Note the inconsistent
naming: `issingle` and `istable` have **no** underscore, while `is_submittable`,
`is_tree`, `is_virtual` do.

| Flag (JSON) | Description |
|-------------|-------------|
| `is_submittable` | Enable Draft/Submitted/Cancelled (docstatus workflow) |
| `issingle` | Single document only (stored in `tabSingles`) |
| `istable` | Child table DocType (no standalone form) |
| `is_tree` | Hierarchical tree (nested set: `lft`/`rgt`) |
| `is_virtual` | No DB table; controller supplies data |
| `track_changes` | Enable version history (Version doctype) |
| `track_seen` | Track which users have seen the doc |
| `track_views` | Track document views |
| `editable_grid` | Inline-editable child grid |
| `quick_entry` | Show quick-entry dialog for new docs |
| `allow_rename` | Allow renaming the document name |
| `allow_copy` | Allow "Duplicate" action |
| `allow_import` | Enable Data Import for this DocType |
| `in_create` | Only creatable via code/parent (hidden from New) |
| `custom` | Custom DocType (created in UI, stored in DB not files) |
| `read_only` | DocType is read-only |
| `has_web_view` | Has a public web view / route |
| `allow_guest_to_view` | Guests can view the web view |
| `index_web_pages_for_search` | Index web pages for website search |
| `queue_in_background` | Process submit/cancel in a background job |
| `make_attachments_public` | Attachments public by default |
| `allow_auto_repeat` | Enable Auto Repeat |
| `beta` | Marked as beta |

---

## Best Practices

### DocType Design
1. Choose appropriate type (Master, Transactional, Submittable, Single, Tree)
2. Plan relationships using Link and Table fields
3. Mark `in_list_view`, `in_standard_filter`, `in_global_search`
4. Configure `autoname` appropriately
5. Set sensible `default` values

### Controller Design
1. Validate early in `validate()`, throw on errors
2. Auto-compute values in `before_validate()` or `validate()`
3. Side effects in `on_submit()` (ledger entries, status updates)
4. Clean up in `on_cancel()` (reverse side effects)
5. Expose actions via `@frappe.whitelist()` methods

### Permission Design
1. Define role permissions for all user roles
2. Use permission levels for sensitive field groups
3. Add User Permissions for Link field restrictions
4. Test across roles

### Performance
1. Index search fields with `in_standard_filter`
2. Use `frappe.get_cached_doc()` for frequently accessed docs
3. Batch operations and commit after bulk updates
4. Use `ignore_permissions` when safe

---

## Sources

Verified against Frappe v16.9.0 (`frappe/__init__.py` `__version__ = "16.9.0"`):

- `apps/frappe/frappe/model/document.py` — `insert`, `save`/`_save`, `run_before_save_methods`, `run_post_save_methods`, `run_method`, `_submit`/`_cancel`, `_validate`, `Document.__init__`, `load_from_db`
- `apps/frappe/frappe/model/delete_doc.py` — `on_trash` / `on_change` / `after_delete` ordering
- `apps/frappe/frappe/model/rename_doc.py` — `before_rename` / `after_rename`
- `apps/frappe/frappe/model/base_document.py` — `get_controller`, `override_doctype_class` + `extend_doctype_class`
- `apps/frappe/frappe/core/doctype/doctype/doctype.json` — DocType-level Check flags, `naming_rule` options
- `apps/frappe/frappe/model/naming.py` — naming series / autoname tokens
- `apps/frappe/frappe/desk/doctype/todo/todo.json` — representative DocType JSON structure
