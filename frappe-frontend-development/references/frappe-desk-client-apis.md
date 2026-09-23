# Frappe Desk — Client-Side APIs

Vanilla-JS `frappe.*` APIs for Desk (`/app/*`) client scripts, form scripts,
and list view customization. See
[frappe-ui-components.md](frappe-ui-components.md) for the file index and how
this differs from the frappe-ui (Vue) SPA layer.

Verified against source (frappe `16.27.1`): `frappe/public/js/frappe/request.js`,
`model/db.js`, `ui/dialog.js`, `form/form.js`, `form/script_manager.js`,
`ui/form/controls/`.

---

## frappe.call / frappe.xcall

```javascript
// frappe.call — full options object
frappe.call({
  method: 'myapp.api.get_data',
  args: { name: 'CUST-001' },
  callback: (r) => {
    if (r.message) {
      console.log(r.message)
    }
  },
  error: (r) => {
    frappe.msgprint(__('Something went wrong'))
  },
  freeze: true,           // Show a loading overlay
  freeze_message: __('Loading...')
})

// frappe.xcall — promise-based, resolves directly to r.message
const data = await frappe.xcall('myapp.api.get_data', { name: 'CUST-001' })
```

Internally, `frappe.call` issues the request through jQuery's AJAX request
helper and resolves/rejects a jQuery deferred; you do not need to touch that
layer directly — always call through `frappe.call`/`frappe.xcall`.

## frappe.db

| Method | Description |
|--------|-------------|
| `frappe.db.get_list(doctype, args)` | Fetch a list (returns a promise) |
| `frappe.db.get_doc(doctype, name)` | Fetch a full document |
| `frappe.db.get_value(doctype, name, fieldname)` | Fetch one or more field values |
| `frappe.db.set_value(doctype, name, fieldname, value)` | Update a single field |
| `frappe.db.insert(doc)` | Insert a new document |
| `frappe.db.delete_doc(doctype, name)` | Delete a document |
| `frappe.db.exists(doctype, name)` | Check existence |
| `frappe.db.count(doctype, filters)` | Count matching records |

```javascript
const customers = await frappe.db.get_list('Customer', {
  filters: { disabled: 0 },
  fields: ['name', 'customer_name'],
  limit: 20
})

const customerName = await frappe.db.get_value('Customer', 'CUST-001', 'customer_name')
await frappe.db.set_value('Customer', 'CUST-001', 'customer_name', 'Acme Corp')
```

## frappe.ui.Dialog

```javascript
const dialog = new frappe.ui.Dialog({
  title: __('Create Task'),
  fields: [
    { fieldname: 'subject', fieldtype: 'Data', label: __('Subject'), reqd: 1 },
    { fieldname: 'priority', fieldtype: 'Select', label: __('Priority'), options: 'Low\nMedium\nHigh' }
  ],
  primary_action_label: __('Create'),
  primary_action(values) {
    frappe.call({
      method: 'myapp.api.create_task',
      args: values,
      callback: () => {
        dialog.hide()
        frappe.show_alert({ message: __('Task created'), indicator: 'green' })
      }
    })
  }
})
dialog.show()
```

## Form client scripts

```javascript
frappe.ui.form.on('Sales Order', {
  refresh(frm) {
    frm.add_custom_button(__('Custom Action'), () => {
      frappe.call({
        method: 'myapp.api.custom_action',
        args: { name: frm.doc.name },
        callback: () => frm.reload_doc()
      })
    })
  },
  customer(frm) {
    if (frm.doc.customer) {
      frappe.db.get_value('Customer', frm.doc.customer, 'customer_group').then((r) => {
        frm.set_value('customer_group', r.message.customer_group)
      })
    }
  },
  validate(frm) {
    if (frm.doc.delivery_date < frm.doc.transaction_date) {
      frappe.throw(__('Delivery date cannot be before transaction date'))
    }
  }
})
```

`frm` methods used above and in most client scripts:

| Method | Description |
|--------|-------------|
| `frm.set_value(field, value)` | Set a field value (triggers field events) |
| `frm.get_field(fieldname)` | Get the field's control object |
| `frm.add_custom_button(label, fn, group?)` | Add a toolbar button |
| `frm.reload_doc()` | Reload the document from the server |
| `frm.set_df_property(field, prop, value)` | Change a field property at runtime (e.g. `reqd`, `read_only`, `hidden`) |
| `frm.toggle_display(field, show)` | Show/hide a field |
| `frm.refresh_field(field)` | Re-render a field after changing its data/options |

`cur_frm` is the global reference to the active form. Prefer the `frm`
argument passed to handlers — it works correctly with child tables and grid
rows, where `cur_frm` can point at the wrong context.

## Form controls

Desk form fields are backed by `frappe.ui.form.Control` subclasses (one per
`fieldtype`: `ControlData`, `ControlSelect`, `ControlLink`, `ControlTable`,
…). You rarely instantiate these directly in app code — DocType field
definitions and `frappe.ui.form.on` handlers are the supported surface. Reach
for a raw `Control` only inside a standalone dialog/grid row template that
isn't backed by a DocType form.

```javascript
// Read a control's rendered value in a client script
const control = frm.get_field('status')
console.log(control.value)
```

## Sources

- `frappe/public/js/frappe/request.js` — `frappe.call`, `frappe.xcall`
- `frappe/public/js/frappe/model/db.js` — `frappe.db.*`
- `frappe/public/js/frappe/ui/dialog.js` — `frappe.ui.Dialog`
- `frappe/public/js/frappe/form/form.js` — `frm` API
- `frappe/public/js/frappe/form/script_manager.js` — `frappe.ui.form.on` dispatch
- `frappe/public/js/frappe/ui/form/controls/` — `Control` subclasses per fieldtype
