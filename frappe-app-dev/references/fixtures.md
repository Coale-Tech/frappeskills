# Fixtures Guide

This guide covers using fixtures for custom fields in Frappe/ERPNext applications.

## Overview

Fixtures are the recommended way to add custom fields to standard DocTypes. They provide:
- Migration-safe field additions
- Version control for customizations
- Easy deployment across environments
- Proper uninstall/cleanup

## Why Use Fixtures?

| Approach | Pros | Cons |
|----------|------|------|
| **Direct DB** | Quick | Not migration-safe, no version control |
| **Manual UI** | Visual | Not replicable, hard to track |
| **Fixtures** | Migration-safe, version controlled, replicable | Requires setup |

## Recommended: `create_custom_fields` (framework helper)

Rather than hand-rolling the create/update/exists loop shown later, use Frappe's built-in helper — this is how
ERPNext and HRMS register their own custom fields. It creates **or updates** in one idempotent call and rebuilds
the DB schema for you.

```python
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup_custom_fields():
    create_custom_fields({
        "Customer": [
            dict(fieldname="custom_region", fieldtype="Link", label="Region",
                 options="Region", insert_after="territory"),
        ],
        # A tuple key applies the same fields to several DocTypes at once:
        ("Sales Order", "Sales Invoice"): [
            dict(fieldname="custom_delivery_notes", fieldtype="Small Text",
                 label="Delivery Notes", insert_after="terms"),
        ],
    }, update=True)
```

Signature (verified): `create_custom_fields(custom_fields: dict, ignore_validate=False, update=True)`. Pass
`update=True` (default) to keep existing fields in sync on every run — safe to call from `after_install` **and**
`after_migrate`. The verbose manual pattern below remains valid if you need per-field control.

## Fixture Pattern

### Basic Fixture Structure

**File Location:** `my_app/fixtures/custom_fields.py`

```python
import frappe

def get_custom_fields():
    """
    Return custom fields to be added via fixtures.

    This defines the custom fields that will be created.
    """
    return {
        # Standard ERPNext DocTypes
        "Customer": [
            {
                "fieldname": "custom_region",
                "fieldtype": "Link",
                "label": "Region",
                "options": "Region",
                "insert_after": "territory",
                "read_only": 0,
                "reqd": 0,
                "depends_on": "",
                "mandatory_depends_on": "",
                "read_only_depends_on": "",
                "hidden": 0,
                "print_hide": 0,
                "report_hide": 0,
            }
        ],
        "Supplier": [
            {
                "fieldname": "custom_vendor_code",
                "fieldtype": "Data",
                "label": "Vendor Code",
                "insert_after": "supplier_name"
            }
        ],
        "Sales Order": [
            {
                "fieldname": "custom_delivery_notes",
                "fieldtype": "Text",
                "label": "Delivery Notes",
                "insert_after": "delivery_date"
            }
        ],
        # Your Custom DocTypes
        "MyCustomDocType": [
            {
                "fieldname": "custom_field_1",
                "fieldtype": "Data",
                "label": "Custom Field 1",
                "insert_after": "name"
            }
        ]
    }

def setup_custom_fields():
    """
    Create custom fields via fixture pattern.

    This function checks if fields exist before creating them,
    preventing duplicate errors during updates.
    """
    custom_fields = get_custom_fields()

    for doctype, fields in custom_fields.items():
        # Verify DocType exists
        if not frappe.db.exists("DocType", doctype):
            frappe.msgprint(f"DocType {doctype} does not exist. Skipping custom fields.")
            continue

        for field_data in fields:
            field_name = field_data.get("fieldname")

            # Check if field already exists
            if frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": field_name}):
                # Field exists, optionally update it
                continue

            # Create custom field
            try:
                custom_field = frappe.new_doc("Custom Field")
                custom_field.dt = doctype
                custom_field.update(field_data)
                custom_field.insert()
                frappe.db.commit()
                frappe.msgprint(f"Created custom field {field_name} for {doctype}")
            except Exception as e:
                frappe.db.rollback()
                frappe.log_error(f"Failed to create custom field {field_name} for {doctype}: {str(e)}")

def remove_custom_fields():
    """
    Remove custom fields - for uninstall/cleanup.

    This function removes all custom fields defined in fixtures.
    """
    custom_fields = get_custom_fields()

    for doctype, fields in custom_fields.items():
        for field_data in fields:
            field_name = field_data.get("fieldname")

            # Check if custom field exists
            custom_field_name = frappe.db.get_value("Custom Field", {
                "dt": doctype,
                "fieldname": field_name
            })

            if custom_field_name:
                try:
                    frappe.delete_doc("Custom Field", custom_field_name)
                    frappe.db.commit()
                except Exception as e:
                    frappe.db.rollback()
                    frappe.log_error(f"Failed to remove custom field {field_name}: {str(e)}")

def sync_custom_fields():
    """
    Sync custom fields - update existing, create new.

    Use this when you need to update field properties.
    """
    custom_fields = get_custom_fields()

    for doctype, fields in custom_fields.items():
        if not frappe.db.exists("DocType", doctype):
            continue

        for field_data in fields:
            field_name = field_data.get("fieldname")

            # Check if field exists
            custom_field_name = frappe.db.get_value("Custom Field", {
                "dt": doctype,
                "fieldname": field_name
            })

            if custom_field_name:
                # Update existing field
                custom_field = frappe.get_doc("Custom Field", custom_field_name)
                custom_field.update(field_data)
                custom_field.save()
            else:
                # Create new field
                custom_field = frappe.new_doc("Custom Field")
                custom_field.dt = doctype
                custom_field.update(field_data)
                custom_field.insert()

            frappe.db.commit()
```

## Registering Fixtures in Hooks

**File Location:** `my_app/hooks.py`

### Method 1: Using after_install/before_uninstall

```python
# hooks.py

# Fixtures for custom fields
after_install = [
    "my_app.fixtures.custom_fields.setup_custom_fields"
]

before_uninstall = [
    "my_app.fixtures.custom_fields.remove_custom_fields"
]

# Optional: Sync fields on app update
# app_hooks = {
#     "after_app_install": "my_app.fixtures.custom_fields.setup_custom_fields"
# }
```

### Method 2: Using Fixtures Hook

```python
# hooks.py

# Fixtures for custom fields
fixtures = [
    {
        "dt": "Custom Field",
        "dn": "my_app.fixtures.custom_fields.get_custom_fields",
        "condition": "my_app.fixtures.custom_fields.custom_field_condition"
    }
]

# Optional condition function
# def custom_field_condition():
#     return True
```

## Field Properties Reference

```python
{
    # Required properties
    "fieldname": "custom_field_name",     # Field identifier (snake_case)
    "fieldtype": "Data",                  # Field type (Data, Link, Select, etc.)
    "label": "Custom Field Name",         # Display label

    # Positioning
    "insert_after": "existing_field",     # Insert after this field

    # Type-specific properties
    "options": "",                        # Options for Select, Link target, etc.
    "default": "",                        # Default value

    # Behavior
    "reqd": 0,                            # Required (1 or 0)
    "read_only": 0,                       # Read only (1 or 0)
    "hidden": 0,                          # Hidden (1 or 0)
    "allow_in_quick_entry": 0,            # Show in quick entry

    # Dependencies
    "depends_on": "",                     # Show/Hide condition
    "mandatory_depends_on": "",           # Required when condition met
    "read_only_depends_on": "",           # Read only when condition met

    # Display
    "print_hide": 0,                      # Hide in print
    "report_hide": 0,                     # Hide in reports
    "fetch_from": "",                     # Fetch value from linked doc
    "fetch_if_empty": 0,                  # Only fetch if empty

    # Validation
    "length": 0,                          # Max length for text fields
    "unique": 0,                          # Unique constraint

    # Translations
    "translatable": 0,                    # Field is translatable

    # Permissions
    "permlevel": 0,                       # Permission level

    # Deprecated (use insert_after instead)
    # "idx": 0,
}
```

## Common Field Types

### Data Field (Text Input)

```python
{
    "fieldname": "custom_reference",
    "fieldtype": "Data",
    "label": "Reference Number",
    "insert_after": "name",
    "length": 50,
    "unique": 1
}
```

### Link Field (Link to DocType)

```python
{
    "fieldname": "custom_region",
    "fieldtype": "Link",
    "label": "Region",
    "options": "Region",  # Target DocType
    "insert_after": "territory"
}
```

### Select Field (Dropdown)

```python
{
    "fieldname": "custom_customer_type",
    "fieldtype": "Select",
    "label": "Customer Type",
    "options": "Retail\nWholesale\nDistributor",
    "default": "Retail",
    "insert_after": "customer_type"
}
```

### Text Field (Textarea)

```python
{
    "fieldname": "custom_notes",
    "fieldtype": "Text",
    "label": "Additional Notes",
    "insert_after": "remarks"
}
```

### Date Field

```python
{
    "fieldname": "custom_date",
    "fieldtype": "Date",
    "label": "Custom Date",
    "default": "Today",
    "insert_after": "transaction_date"
}
```

### Check Field (Boolean)

```python
{
    "fieldname": "custom_is_verified",
    "fieldtype": "Check",
    "label": "Is Verified",
    "default": 0,
    "insert_after": "status"
}
```

### Currency Field

```python
{
    "fieldname": "custom_amount",
    "fieldtype": "Currency",
    "label": "Custom Amount",
    "options": "currency",  # Link to currency field
    "insert_after": "total_amount"
}
```

## Conditional Display

### Depends On (Show/Hide)

```python
{
    "fieldname": "custom_wholesale_details",
    "fieldtype": "Text",
    "label": "Wholesale Details",
    "depends_on": "eval:doc.customer_type == 'Wholesale'",
    "insert_after": "customer_type"
}
```

### Mandatory Depends On

```python
{
    "fieldname": "custom_tax_id",
    "fieldtype": "Data",
    "label": "Tax ID",
    "mandatory_depends_on": "eval:doc.tax_category == 'Taxable'",
    "insert_after": "tax_category"
}
```

## Best Practices

1. **Always use fixtures** for custom fields on standard DocTypes
2. **Check existence before creating** to avoid duplicate errors
3. **Use insert_after** for positioning (not idx)
4. **Group fields by DocType** in the fixture dictionary
5. **Commit changes** after successful creation
6. **Rollback on error** to maintain data integrity
7. **Log errors** for debugging
8. **Register in hooks** for automatic setup
9. **Provide cleanup** in before_uninstall hook
10. **Version control** fixture definitions

## Troubleshooting

### Field Not Appearing

```python
# Check if field exists
frappe.db.get_value("Custom Field", {"dt": "Customer", "fieldname": "custom_field"})

# Check DocType exists
frappe.db.exists("DocType", "Customer")

# Clear cache
frappe.clear_cache(doctype="Customer")
```

### Field Order Issues

```python
# Ensure insert_after field exists
frappe.db.exists("DocType Field", {"parent": "Customer", "fieldname": "territory"})
```

### Permission Errors

```python
# Check permissions for custom field
frappe.has_permission("Custom Field", "create")
```

## Complete Example

```python
# my_app/fixtures/custom_fields.py
import frappe

def get_custom_fields():
    return {
        "Customer": [
            {
                "fieldname": "custom_region",
                "fieldtype": "Link",
                "label": "Region",
                "options": "Region",
                "insert_after": "territory"
            },
            {
                "fieldname": "custom_customer_type",
                "fieldtype": "Select",
                "label": "Customer Type",
                "options": "Retail\nWholesale\nDistributor",
                "insert_after": "customer_type"
            }
        ],
        "Sales Order": [
            {
                "fieldname": "custom_delivery_notes",
                "fieldtype": "Text",
                "label": "Delivery Notes",
                "insert_after": "delivery_date"
            }
        ]
    }

def setup_custom_fields():
    custom_fields = get_custom_fields()

    for doctype, fields in custom_fields.items():
        if not frappe.db.exists("DocType", doctype):
            continue

        for field_data in fields:
            field_name = field_data.get("fieldname")

            if frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": field_name}):
                continue

            custom_field = frappe.new_doc("Custom Field")
            custom_field.dt = doctype
            custom_field.update(field_data)
            custom_field.insert()

    frappe.db.commit()

def remove_custom_fields():
    custom_fields = get_custom_fields()

    for doctype, fields in custom_fields.items():
        for field_data in fields:
            field_name = field_data.get("fieldname")
            custom_field_name = frappe.db.get_value("Custom Field", {
                "dt": doctype,
                "fieldname": field_name
            })

            if custom_field_name:
                frappe.delete_doc("Custom Field", custom_field_name)

    frappe.db.commit()
```

---

## Property Setters via Fixtures

Property Setters change properties of existing fields without modifying the DocType source.

### Creating Property Setters

```python
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

# Make a field required
make_property_setter("Sales Invoice", "customer_address", "reqd", 1, "Check")

# Hide a field
make_property_setter("Sales Invoice", "discount_amount", "hidden", 1, "Check")

# Change field options
make_property_setter("Sales Invoice", "status", "options",
    "Draft\nSubmitted\nPaid\nCancelled\nOverdue", "Text")

# Change default value
make_property_setter("Sales Invoice", "currency", "default", "KES", "Data")
```

---

## Export / Import Fixtures

### bench export-fixtures

```bash
# Export fixtures declared in every app's hooks.py `fixtures` list:
bench --site my-site export-fixtures

# Scope the export to one app (recommended in multi-app benches):
bench --site my-site export-fixtures --app my_app
```

### hooks.py Configuration

```python
fixtures = [
    "Custom Field",
    "Property Setter",
    "Client Script",
    {"dt": "Custom Field", "filters": [["module", "=", "My Module"]]},
    {"dt": "Role", "filters": [["name", "in", ["Custom Role 1", "Custom Role 2"]]]},
    {"dt": "Workflow", "filters": [["name", "=", "PO Approval"]]}
]
```

Fixtures are auto-imported during `bench migrate`.

---

## Fixtures vs Migration Scripts

| Scenario | Approach |
|----------|----------|
| Add custom fields to standard DocTypes | **Fixtures** (Custom Fields) |
| Change field properties | **Fixtures** (Property Setters) |
| One-time data migration | **Migration script** (patches.txt) |
| Add roles/permissions | **Fixtures** (Role, Role Permission) |
| Complex conditional changes | **Migration script** |

---

## Cleanup / Uninstall

```python
# hooks.py
after_install = "my_app.install.after_install"
before_uninstall = "my_app.install.before_uninstall"
```

```python
# my_app/install.py
def after_install():
    from my_app.fixtures.custom_fields import setup_custom_fields
    setup_custom_fields()
    frappe.db.commit()

def before_uninstall():
    from my_app.fixtures.custom_fields import remove_custom_fields
    remove_custom_fields()
    frappe.db.commit()
```

## Sources

Verified against Frappe v16.9.0 at `<bench>/apps/frappe`:
- `apps/frappe/frappe/custom/doctype/custom_field/custom_field.py` — `create_custom_fields(custom_fields, ignore_validate=False, update=True)`
- `apps/frappe/frappe/custom/doctype/property_setter/property_setter.py` — `make_property_setter(doctype, fieldname, property, value, property_type, ...)`
- `apps/frappe/frappe/commands/utils.py` — `export-fixtures` CLI (`--app` option); `apps/frappe/frappe/utils/fixtures.py`
