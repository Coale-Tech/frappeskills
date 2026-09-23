# Desk UI (Client Scripts)

Frappe auto-generates Desk forms and list views for each DocType. Usually no custom UI code is needed.

## Client scripts

File: `apps/<app>/<app>/<module>/doctype/<doctype>/<doctype>.js`

```javascript
frappe.ui.form.on("Sample Doc", {
    // Called once during form setup
    setup(frm) {
        frm.set_query("customer", () => ({ filters: { disabled: 0 } }));
    },

    // Called on load, before the first refresh
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value("posting_date", frappe.datetime.get_today());
        }
    },

    // Called every time the form loads or refreshes
    refresh(frm) {
        if (frm.doc.status === "Draft") {
            frm.add_custom_button(__("Submit"), () => frm.call("submit"));
        }
        frm.toggle_display("discount_section", frm.doc.grand_total > 1000);
        frm.set_df_property("notes", "read_only", frm.doc.docstatus === 1);
    },

    // Field change handler (fieldname as key)
    customer(frm) {
        if (!frm.doc.customer) return;
        frappe.db.get_value("Customer", frm.doc.customer, "territory", (r) => {
            frm.set_value("territory", r.territory);
        });
    },

    amount(frm) {
        frm.set_value("tax", frm.doc.amount * 0.1);
    },

    // Before save — set frappe.validated = false to cancel the save
    validate(frm) {
        if (frm.doc.amount <= 0) {
            frappe.throw(__("Amount must be positive"));
        }
    },

    before_save(frm) {
        frm.doc.full_name = `${frm.doc.first_name} ${frm.doc.last_name}`;
    },

    after_save(frm) {
        frappe.show_alert({ message: __("Saved"), indicator: "green" });
    },
});
```

`validate` and `before_save` both run before the document is saved and both
gate on the same `frappe.validated` flag — setting `frappe.validated = false`
in either one cancels the save (`frappe/public/js/frappe/form/form.js:864-879`).
There is no separate `frm.validate()` method to call from inside a handler.

## Child table events

```javascript
frappe.ui.form.on("Sample Doc Item", {
    item_amount(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, "tax", row.item_amount * 0.1);
        calculate_total(frm);
    },

    items_remove(frm) {
        calculate_total(frm);
    },
});

function calculate_total(frm) {
    let total = 0;
    frm.doc.items.forEach((row) => { total += row.item_amount; });
    frm.set_value("total", total);
}
```

## Dialogs and prompts

```javascript
// Quick single-field prompt
frappe.prompt(
    { fieldname: "reason", fieldtype: "Small Text", label: "Reason", reqd: 1 },
    (values) => frappe.call({ method: "my_app.api.reject", args: { name: frm.doc.name, reason: values.reason } }),
    __("Rejection Reason"),
    __("Reject")
);

// Multi-field modal
let d = new frappe.ui.Dialog({
    title: __("Configure Settings"),
    fields: [
        { fieldname: "email", fieldtype: "Data", options: "Email", label: "Email", reqd: 1 },
        { fieldname: "frequency", fieldtype: "Select", options: "Daily\nWeekly\nMonthly", label: "Frequency" },
    ],
    primary_action_label: __("Save"),
    primary_action(values) {
        frappe.call({ method: "my_app.api.save_settings", args: values, callback: () => d.hide() });
    },
});
d.show();

// Confirmation
frappe.confirm(
    __("Are you sure you want to delete this?"),
    () => { /* yes */ },
    () => { /* no */ }
);
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

// Promise-based call
let result = await frappe.xcall("myapp.api.get_expenses", { status: "Draft" });

// Show dialog / message
frappe.prompt("Enter reason", (values) => console.log(values.value));
frappe.msgprint("Done!");
frappe.show_alert({ message: "Saved", indicator: "green" });

// Set field properties
frm.set_df_property("amount", "read_only", 1);
frm.toggle_display("notes", frm.doc.status === "Rejected");

// Set query filter for a Link field (form-level or child-table-scoped)
frm.set_query("category", () => ({ filters: { enabled: 1 } }));
frm.set_query("item_code", "items", () => ({ filters: { is_sales_item: 1 } }));
```

### Namespacing and lazy loading

```javascript
// Create nested namespaces safely (frappe/public/js/frappe/provide.js)
frappe.provide("myapp.ui");
myapp.ui.MyWidget = class { /* ... */ };

// Load a bundle only when needed (frappe/public/js/frappe/assets.js)
frappe.require("myapp_charts.bundle.js", () => render_chart());
```

Edits to bundled JS do nothing until `bench build --app <app>` or a running `bench watch` rebuilds them.

## List view customization

```javascript
// my_app/public/js/sample_doc_list.js
// or via hooks: doctype_list_js = {"Sample Doc": "public/js/sample_doc_list.js"}

frappe.listview_settings["Sample Doc"] = {
    get_indicator(doc) {
        if (doc.status === "Open") return [__("Open"), "orange", "status,=,Open"];
        if (doc.status === "Closed") return [__("Closed"), "green", "status,=,Closed"];
        return [__("Draft"), "grey", "status,=,Draft"];
    },

    onload(listview) {
        listview.page.add_action_item(__("Mark as Closed"), () => {
            let names = listview.get_checked_items(true);
            frappe.call({ method: "myapp.api.bulk_close", args: { names }, callback: () => listview.refresh() });
        });
    },

    hide_name_column: true,
};
```

Broader list-view patterns (formatters, bulk actions, indicators): [listview-patterns.md](listview-patterns.md).

## Inject scripts via hooks

Extend a DocType from another app without modifying it:

```python
# hooks.py
doctype_js = {"Sales Order": "public/js/sales_order_custom.js"}
doctype_list_js = {"Sales Order": "public/js/sales_order_list_custom.js"}
```

```bash
bench build --app my_app
```

## Realtime events

```javascript
frappe.realtime.on("export_complete", (data) => {
    frappe.show_alert({ message: __("Export complete: {0} records", [data.count]), indicator: "green" });
});
```

## Navigation and routing

```javascript
frappe.set_route("Form", "Sales Order", "SO-001");

frappe.route_options = { status: "Open" };
frappe.set_route("List", "Sales Order");

let route = frappe.get_route();
```

### Key Desk globals

| Global | Purpose |
|---|---|
| `frappe.boot` | Login payload from `frappe/boot.py:get_bootinfo` — sysdefaults, user, lang |
| `frappe.session.user` | Current user |
| `frappe.call({method, args})` | Call a whitelisted method via `/api/method` |
| `frappe.set_route(...)` / `frappe.get_route()` | Desk routing |
| `frappe.model.get_new_doc`, `.set_value`, `.get_value` | Client-side model helpers |
| `frappe.meta.get_docfield(doctype, fieldname, name)` | Field metadata, mirrors server `Meta` |
| `frappe.datetime` | Date formatting and arithmetic |
| `__("text")` | Translation (mirrors Python `_()`) |

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Missing `frm.refresh_field()` after `set_value` | UI doesn't update | Call `frm.refresh_field('fieldname')` after `frm.set_value()` |
| Wrong event hook name | Event never fires | Use exact names: `refresh`, `validate`, `onload`, `before_save` |
| Blocking UI with sync calls | Page freezes | Use `frappe.call()` — it is async by default |
| Using `cur_frm` instead of `frm` | Breaks in dialogs/multiple forms | Always use the `frm` parameter passed to handlers |
| Not checking `frm.doc.docstatus` | Buttons appear on submitted docs | Check `frm.doc.docstatus == 0` before showing edit actions |
| `console.log(frm.doc)` showing stale data | Debugging confusion | Use `frm.reload_doc()` or check network responses |
