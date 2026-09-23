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

## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `desk-customization/SKILL.md`.

### Frappe Desk Customization

Customize the Frappe Desk admin UI with form scripts, list views, dialogs, and client-side APIs.

#### When to use

- Adding custom buttons or actions to forms
- Filtering Link fields dynamically
- Toggling field visibility based on conditions
- Customizing list view indicators and bulk actions
- Building interactive dialogs and prompts
- Adding client-side validation before save
- Injecting scripts into other apps' DocTypes via hooks

#### Inputs required

- Target DocType for customization
- Whether script is app-level (version controlled) or Client Script (site-specific)
- Events to hook into (refresh, validate, field change, etc.)
- UI behavior requirements (buttons, filters, visibility)

#### Procedure

##### 0) Choose script type

| Type | Location | Version Controlled | Use Case |
|------|----------|-------------------|----------|
| App-level form script | `<app>/<module>/doctype/<doctype>/<doctype>.js` | Yes | Standard app behavior |
| Client Script | DocType: Client Script | No (DB) | Site-specific customization |
| Hook-injected script | Via `doctype_js` in `hooks.py` | Yes | Extend other apps' DocTypes |

##### 1) Write form scripts

```javascript
frappe.ui.form.on("My DocType", {
    // Called once during form setup
    setup(frm) {
        frm.set_query("customer", function() {
            return {
                filters: { "status": "Active" }
            };
        });
    },

    // Called every time form loads or refreshes
    refresh(frm) {
        if (frm.doc.status === "Draft") {
            frm.add_custom_button(__("Submit for Review"), function() {
                frappe.call({
                    method: "my_app.api.submit_for_review",
                    args: { name: frm.doc.name },
                    callback(r) {
                        frm.reload_doc();
                    }
                });
            }, __("Actions"));
        }

        // Toggle field visibility
        frm.toggle_display("discount_section", frm.doc.grand_total > 1000);

        // Set field properties
        frm.set_df_property("notes", "read_only", frm.doc.docstatus === 1);
    },

    // Called before save — return false to cancel
    validate(frm) {
        if (frm.doc.end_date < frm.doc.start_date) {
            frappe.msgprint(__("End date must be after start date"));
            frappe.validated = false;
        }
    },

    // Field change handler (use fieldname as key)
    customer(frm) {
        if (frm.doc.customer) {
            frappe.db.get_value("Customer", frm.doc.customer, "territory",
                function(r) {
                    frm.set_value("territory", r.territory);
                }
            );
        }
    },

    // Before save hook
    before_save(frm) {
        frm.doc.full_name = `${frm.doc.first_name} ${frm.doc.last_name}`;
    },

    // After save hook
    after_save(frm) {
        frappe.show_alert({
            message: __("Document saved successfully"),
            indicator: "green"
        });
    }
});

// Child table events
frappe.ui.form.on("My DocType Item", {
    qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "amount", row.qty * row.rate);
        calculate_total(frm);
    },

    items_remove(frm) {
        calculate_total(frm);
    }
});

function calculate_total(frm) {
    let total = 0;
    (frm.doc.items || []).forEach(row => {
        total += row.amount || 0;
    });
    frm.set_value("grand_total", total);
}
```

##### 2) Build dialogs and prompts

```javascript
// Simple prompt
frappe.prompt(
    { fieldname: "reason", fieldtype: "Small Text", label: "Reason", reqd: 1 },
    function(values) {
        frappe.call({
            method: "my_app.api.reject",
            args: { name: frm.doc.name, reason: values.reason }
        });
    },
    __("Rejection Reason"),
    __("Reject")
);

// Multi-field dialog
let d = new frappe.ui.Dialog({
    title: __("Configure Settings"),
    fields: [
        { fieldname: "email", fieldtype: "Data", options: "Email", label: "Email", reqd: 1 },
        { fieldname: "frequency", fieldtype: "Select", options: "Daily\nWeekly\nMonthly", label: "Frequency" },
        { fieldname: "active", fieldtype: "Check", label: "Active", default: 1 }
    ],
    primary_action_label: __("Save"),
    primary_action(values) {
        frappe.call({
            method: "my_app.api.save_settings",
            args: values,
            callback() {
                d.hide();
                frappe.show_alert({ message: __("Settings saved"), indicator: "green" });
            }
        });
    }
});
d.show();

// Confirmation dialog
frappe.confirm(
    __("Are you sure you want to delete this?"),
    function() { /* Yes */ },
    function() { /* No */ }
);
```

##### 3) Make server calls

```javascript
// Standard call (callback)
frappe.call({
    method: "my_app.api.get_stats",
    args: { customer: frm.doc.customer },
    freeze: true,
    freeze_message: __("Loading..."),
    callback(r) {
        if (r.message) {
            frm.set_value("total_orders", r.message.total);
        }
    }
});

// Promise-based call
let result = await frappe.xcall("my_app.api.get_stats", {
    customer: frm.doc.customer
});
```

##### 4) Customize list views

```javascript
// my_app/public/js/sample_doc_list.js
// or via hooks: doctype_list_js = {"Sample Doc": "public/js/sample_doc_list.js"}

frappe.listview_settings["Sample Doc"] = {
    // Status indicator colors
    get_indicator(doc) {
        if (doc.status === "Open") return [__("Open"), "orange", "status,=,Open"];
        if (doc.status === "Closed") return [__("Closed"), "green", "status,=,Closed"];
        return [__("Draft"), "grey", "status,=,Draft"];
    },

    // Add bulk actions
    onload(listview) {
        listview.page.add_action_item(__("Mark as Closed"), function() {
            let names = listview.get_checked_items(true);
            frappe.call({
                method: "my_app.api.bulk_close",
                args: { names },
                callback() { listview.refresh(); }
            });
        });
    },

    // Hide default "New" button
    hide_name_column: true
};
```

##### 5) Use realtime events

```javascript
// Listen for server-side events
frappe.realtime.on("export_complete", function(data) {
    frappe.show_alert({
        message: __("Export complete: {0} records", [data.count]),
        indicator: "green"
    });
});
```

##### 6) Inject scripts via hooks

To extend a DocType from another app without modifying it:

```python
# hooks.py
doctype_js = {
    "Sales Order": "public/js/sales_order_custom.js"
}

doctype_list_js = {
    "Sales Order": "public/js/sales_order_list_custom.js"
}
```

```bash
# Rebuild assets after adding hook scripts
bench build --app my_app
```

##### 7) Navigation and routing

```javascript
// Navigate to a document
frappe.set_route("Form", "Sales Order", "SO-001");

// Navigate to list with filters
frappe.route_options = { "status": "Open" };
frappe.set_route("List", "Sales Order");

// Get current route
let route = frappe.get_route();
```

#### Verification

- [ ] Form script loads without JS console errors
- [ ] Custom buttons appear in correct conditions
- [ ] Field visibility toggles work
- [ ] Link field filters return correct options
- [ ] Validation prevents invalid saves
- [ ] List view indicators display correctly
- [ ] Dialogs open, collect input, and submit

#### Failure modes / debugging

- **Script not loading**: Check file path matches DocType; run `bench build`
- **Button not appearing**: Check condition logic in `refresh`; verify `frm.doc.docstatus`
- **Event not firing**: Verify event name matches exactly (case-sensitive)
- **Hook script ignored**: Check `hooks.py` path; rebuild assets
- **`frappe.call` failing**: Check method path; verify `@frappe.whitelist()` on server

#### Escalation

- For server-side controller logic → `frappe-doctype-development`
- For RPC endpoint implementation → `frappe-api-development`
- For Frappe UI (Vue 3) frontends → `frappe-frontend-development`

#### References

- [references/desk.md](frontend-desk.md) — Desk UI views and scripting
- [references/js-api.md](frontend-desk.md) — JavaScript client API reference

#### Guardrails

- **Use `frm.doc` not `doc` directly**: Always access document via `frm.doc` for consistency and reactivity
- **Validate before save**: Use `frm.validate()` in `validate` event, not `before_save`
- **Async awareness**: `frappe.call()` is async; use callbacks or async/await for sequential operations
- **Refresh after field changes**: Call `frm.refresh_field()` or `frm.refresh_fields()` after programmatic changes
- **Check `frm.is_new()` appropriately**: Some operations only make sense on saved documents

#### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Missing `frm.refresh_field()` after `set_value` | UI doesn't update | Call `frm.refresh_field('fieldname')` after `frm.set_value()` |
| Wrong event hook name | Event never fires | Use exact names: `refresh`, `validate`, `onload`, `before_save` |
| Blocking UI with sync calls | Page freezes | Use `frappe.call()` with async: true (default) |
| Using `cur_frm` instead of `frm` | Breaks in dialogs/multiple forms | Always use the `frm` parameter passed to handlers |
| Not checking `frm.doc.docstatus` | Buttons appear on submitted docs | Check `frm.doc.docstatus == 0` before showing edit actions |
| `console.log(frm.doc)` showing stale data | Debugging confusion | Use `frm.reload_doc()` or check network responses |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `desk-customization/references/desk.md`.

### Desk UI and Scripting

#### Overview
- Desk is the admin UI for System Users.
- It renders Form, List, Report, Tree, Calendar, Kanban, Dashboard, and Workspace views from DocType metadata.
- Scripts can be app-level (version controlled) or Client Scripts (per-site).

#### Workspaces
- Workspaces organize modules, shortcuts, charts, and links for navigation.
- Customize Workspace layout to highlight key DocTypes and reports.

#### Views
- **List View**: filters, sorting, indicators, bulk actions.
- **Form View**: DocType form builder and custom scripts.
- **Report View**: reports from builder, SQL, or Python.
- **Tree, Kanban, Calendar**: specialized views for hierarchical, status, or time-based data.

#### Form Scripts
- Use `frappe.ui.form.on(doctype, {...})` to hook form events.
- Common events: `setup`, `onload`, `refresh`, `validate`, `before_save`, `after_save`.
- Use `frm.add_custom_button`, `frm.set_query`, `frm.toggle_display`, `frm.toggle_enable`.
- Use `frm.set_value`, `frm.get_value`, `frm.get_field`, `frm.set_df_property`.
- Use fieldname handlers (`fieldname(frm) {}`) to handle field changes.

#### List View Scripts
- Use `frappe.listview_settings["DocType"]` to customize list actions and indicators.
- Add bulk actions and list badges via `get_indicator`.

#### Report Scripts
- Use `frappe.query_reports` to add filters and client-side formatting.
- Use `onload` and custom filter logic for dynamic reports.

#### Dashboard and Links
- Use Dashboard metadata to show related DocTypes.
- Use Links and Cards for quick access in Desk.

#### Permissions
- Use permissions to control visibility of Desk items.

#### Best Practices
- Prefer app-level scripts for reusable logic.
- Keep scripts lightweight and defer heavy work to server-side RPC methods.

#### Examples (app-level scripts)
- Form Script: `/assets/mini-app-template/your_app/doctype/sample_doc/sample_doc.js`
- List View: `/assets/mini-app-template/your_app/list_view/sample_doc_list.js`
- Query Report: `/assets/mini-app-template/your_app/report/sample_report/sample_report.js`

Sources: Form Scripts, Client Script, List View, Query Report, Dashboard, Desk UI (official docs)

References:
- [Desk UI](https://frappe.io/framework/desk-ui)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `desk-customization/references/js-api.md`.

### JavaScript API (comprehensive)

#### Core globals
- `frappe` is the global namespace for client APIs.
- `frappe.ui` contains UI helpers like dialogs and form utilities.
- `frappe.session` has user/session context.

#### Form API
- Use `frappe.ui.form.on(doctype, { ... })` to register form hooks.
- Common hooks: `setup`, `onload`, `refresh`, `validate`, `before_save`, `after_save`.
- Use `frm.set_value`, `frm.get_value`, `frm.get_field`.
- Use `frm.toggle_display`, `frm.toggle_enable`, `frm.set_df_property`.
- Use `frm.add_custom_button` for custom actions.
- Use `frm.set_query` to filter Link field options.

#### Field events
- Use fieldname handlers (`fieldname(frm) {}`) to handle field changes.

#### Dialogs and prompts
- Use `frappe.ui.Dialog` for modal inputs.
- Use `dialog.get_values()` and `dialog.set_values()`.
- Use `frappe.prompt` for quick input dialogs.

#### Client calls
- Use `frappe.call` to call whitelisted server methods.
- Use `frappe.xcall` for Promise-based calls.

#### UI feedback
- Use `frappe.msgprint` for messages.
- Use `frappe.show_alert` for transient notifications.
- Use `frappe.confirm` for confirmations.

#### List View
- Customize with `frappe.listview_settings["DocType"]`.
- Use `get_indicator` for colored status indicators and badges.

#### Report API
- Customize Query Reports with `frappe.query_reports`.
- Use `onload` and custom filter logic for dynamic reports.

#### Router and navigation
- Use `frappe.set_route` to navigate.
- Use `frappe.route_options` to pass filters.

#### Realtime
- Use `frappe.realtime.on` for realtime events.

#### Utilities
- Use `frappe.utils` for date/time formatting and helpers.

#### Permissions and session
- Use `frappe.user.has_role` for client role checks.
- Use `frappe.session.user` for current user.

#### Examples (app-level scripts)
- Form Script: `/assets/mini-app-template/your_app/doctype/sample_doc/sample_doc.js`
- List View: `/assets/mini-app-template/your_app/list_view/sample_doc_list.js`
- Query Report: `/assets/mini-app-template/your_app/report/sample_report/sample_report.js`

Sources: Form Scripts, Client Script, Dialog, List View, Query Report, Realtime, JS API (official docs)
