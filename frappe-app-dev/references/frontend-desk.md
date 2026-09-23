# Desk UI (Client Scripts)

Frappe auto-generates Desk forms and list views for each DocType. Usually no custom UI code is needed.

## Client scripts

Add client-side logic to DocType forms:

File: `apps/<app>/<app>/<module>/doctype/<doctype>/<doctype>.js`

```javascript
frappe.ui.form.on("Expense", {
    // When form loads
    refresh(frm) {
        if (frm.doc.status === "Draft") {
            frm.add_custom_button("Submit", () => {
                frm.call("submit");
            });
        }
    },

    // When a field value changes
    amount(frm) {
        frm.set_value("tax", frm.doc.amount * 0.1);
    },

    // Before save
    validate(frm) {
        if (frm.doc.amount <= 0) {
            frappe.throw("Amount must be positive");
        }
    }
});
```

## Child table events

```javascript
frappe.ui.form.on("Expense Item", {
    // When a row field changes
    item_amount(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "tax", row.item_amount * 0.1);
        calculate_total(frm);
    },

    // When a row is removed
    items_remove(frm) {
        calculate_total(frm);
    }
});

function calculate_total(frm) {
    let total = 0;
    frm.doc.items.forEach(row => { total += row.item_amount; });
    frm.set_value("total", total);
}
```

## Common client API

```javascript
// Call server method
frm.call("get_summary").then(r => console.log(r.message));

// Call whitelisted API
frappe.call({
    method: "myapp.api.get_expenses",
    args: { status: "Draft" },
    callback(r) { console.log(r.message); }
});

// Show dialog
frappe.prompt("Enter reason", (values) => {
    console.log(values.value);
});

// Show message
frappe.msgprint("Done!");
frappe.show_alert({ message: "Saved", indicator: "green" });

// Set field properties
frm.set_df_property("amount", "read_only", 1);
frm.toggle_display("notes", frm.doc.status === "Rejected");

// Set query filter for Link field
frm.set_query("category", () => {
    return { filters: { "enabled": 1 } };
});
```

---

## Client Scripts

### Form Events

```javascript
frappe.ui.form.on('Customer Request', {
    setup(frm) {
        frm.set_query('item', 'items', () => ({
            filters: {'is_sales_item': 1}
        }));
    },

    refresh(frm) {
        if (frm.doc.status === 'Open') {
            frm.add_custom_button(__('Start Work'), () => {
                frm.set_value('status', 'In Progress');
                frm.save();
            });
        }
    },

    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('posting_date', frappe.datetime.get_today());
        }
    },

    validate(frm) {
        if (frm.doc.items.length === 0) {
            frappe.throw(__('Please add at least one item'));
        }
    },

    // Field change event
    customer(frm) {
        if (frm.doc.customer) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Customer',
                    fieldname: 'territory',
                    filters: {name: frm.doc.customer}
                },
                callback: (r) => {
                    if (r.message) {
                        frm.set_value('territory', r.message.territory);
                    }
                }
            });
        }
    }
});
```

### Child Table Events

```javascript
frappe.ui.form.on('Customer Request Item', {
    items_add(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        row.warehouse = frm.doc.default_warehouse;
    },

    items_remove(frm, cdt, cdn) {
        frm.trigger('calculate_total');
    },

    qty(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        frappe.model.set_value(cdt, cdn, 'amount', row.qty * row.rate);
        frm.trigger('calculate_total');
    }
});
```

### Field Manipulation

```javascript
frm.set_value('field', 'value');
frm.toggle_display('field', true);
frm.toggle_reqd('field', true);
frm.toggle_enable('field', true);
frm.set_df_property('field', 'hidden', 1);
frm.set_df_property('field', 'options', 'Option1\nOption2');

// Link field query filter
frm.set_query('customer', () => ({ filters: {'disabled': 0} }));
frm.set_query('item_code', 'items', () => ({ filters: {'is_sales_item': 1} }));
```

### Server Calls from Client

```javascript
// Call controller method
frm.call({
    method: 'get_customer_summary',
    args: {include_invoices: true},
    callback: (r) => { frm.set_value('outstanding', r.message.outstanding); }
});

// Call whitelisted method
frappe.call({
    method: 'my_app.api.calculate_totals',
    args: {customer: frm.doc.name},
    freeze: true,
    freeze_message: __('Calculating...'),
    callback: (r) => { console.log(r.message); }
});
```

---
