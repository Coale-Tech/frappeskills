# Frappe Desk — Client-Side APIs

Vanilla-JS `frappe.*` APIs for Desk (`/desk/*` (v16); `/app/*` on v15, still
redirects to `/desk/*` on v16 per `hooks.py:website_redirects`) client
scripts, form scripts,
and list view customization. See
[frappe-ui-components.md](frappe-ui-components.md) for the file index and how
this differs from the frappe-ui (Vue) SPA layer.

Verified against frappe 16.35.0 (<=16.35) and 16.51.1 (16.51) source at `apps/frappe/frappe/public/js/frappe/`:
`request.js`, `db.js`, `ui/dialog.js`, `ui/messages.js`, `form/form.js`, `form/script_manager.js`,
`desk.js`, `ui/components/toast.js`.

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
| `frappe.db.get_value(doctype, filters, fieldname, callback?)` | Fetch one or more field values |
| `frappe.db.get_single_value(doctype, fieldname)` | Fetch a field from a Single DocType |
| `frappe.db.set_value(doctype, name, fieldname, value)` | Update a single field |
| `frappe.db.insert(doc)` | Insert a new document |
| `frappe.db.delete_doc(doctype, name)` | Delete a document |
| `frappe.db.exists(doctype, nameOrFilters)` | Check existence |
| `frappe.db.count(doctype, args, cache?)` | Count matching records |
| `frappe.db.get_link_options(doctype, txt?, filters?, page_length?)` | Autocomplete-style Link search |

```javascript
const customers = await frappe.db.get_list('Customer', {
  filters: { disabled: 0 },
  fields: ['name', 'customer_name'],
  limit: 20
})

const nameResult = await frappe.db.get_value('Customer', 'CUST-001', 'customer_name')
const customerName = nameResult.message.customer_name // get_value resolves to the raw {message} response, not the value
await frappe.db.set_value('Customer', 'CUST-001', 'customer_name', 'Acme Corp')
```

`get_value` is the one `frappe.db.*` method that does **not** wrap its result
in its own `Promise` — it returns the `frappe.call()` deferred directly, so
`await`/`.then()` receive the full `{message: ...}` response (`db.js:42-56`).
Every other method here (`get_list`, `get_single_value`, `exists`, `count`,
`get_link_options`) wraps the call and resolves straight to `r.message`. The
4-arg callback form sidesteps this: `frappe.db.get_value(doctype, filters,
fieldname, (r) => ...)` invokes the callback with `r.message` already
unwrapped.

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
        // (<=16.35) frappe.show_alert({ message, indicator: 'green' }) — still works as an alias
        // (16.51+) preferred: frappe.ui.toast({ message, type: "success", duration: 3000 })
        frappe.ui.toast({ message: __('Task created'), type: 'success', duration: 3000 })
      }
  }
})
dialog.show()
```

### frappe.ui.toast (16.51)

```javascript
// New canonical API (16.51) — replaces frappe.show_alert for new code
frappe.ui.toast({ message: __('Saved'), type: 'success', duration: 3000 })
frappe.ui.toast({ message: __('Warning'), type: 'warning', description: __('Check the value') })
// Async helper
frappe.ui.toast.promise(myPromise, { loading: __('Saving...'), success: __('Done'), error: __('Failed') })

// Legacy alias still works (maps indicator colours → type)
frappe.show_alert({ message: __('Done'), indicator: 'green' })
```

Toast container changed `#alert-container` → `.es-toast-container`; CSS class changed
`.desk-alert.green` → `.es-toast[data-type="success"]` (16.51). Avoid targeting the toast DOM.

### frappe.warn (16.51)

```javascript
// New 6th parameter: secondary_label (Cancel button text)
frappe.warn(__('Confirm'), __('Are you sure?'), proceedFn, __('Yes'), false, __('No, go back'))
// Confirm button now styled with data-theme="red" (not .btn-danger)
// — CSS selectors on .btn-danger inside a confirm dialog will not match in 16.51
```

### dialog.get_primary_btn() selector (16.51)

`get_primary_btn()` returns `this.standard_actions.find(".btn-modal-primary")` (was `.btn-primary`). Use the API method, not a manual jQuery selector:
```javascript
const btn = dialog.get_primary_btn()  // stable; do NOT use .find('.btn-primary')
```

### frappe.boot.allowed_reports (16.51)

`frappe.boot.user.all_reports` is deprecated and emits a console warning in 16.51. Use `frappe.boot.allowed_reports` directly.


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
| `frm.get_field(fieldname)` | Get the field's control object; `frm.fields_dict[fieldname]` is the same object |
| `frm.fields_dict` | Map of fieldname -> control object for every rendered field |
| `frm.set_query(fieldname, [parentfield,] fn)` | Set the query/filters for a Link field (form-level or child-table-scoped with `parentfield`) |
| `frm.add_custom_button(label, fn, group?)` | Add a toolbar button |
| `frm.call(method, args?, callback?)` | Call a whitelisted doc method (`method` bound to `opts.doc` when a string) |
| `frm.trigger(event, doctype?, docname?)` | Fire an `frappe.ui.form.on` event handler manually (delegates to `script_manager.trigger`) |
| `frm.reload_doc()` | Reload the document from the server |
| `frm.set_df_property(field, prop, value)` | Change a field property at runtime (e.g. `reqd`, `read_only`, `hidden`) |
| `frm.toggle_display(field, show)` | Show/hide a field |
| `frm.refresh_field(field)` | Re-render a field after changing its data/options |
| `frm.set_intro(txt, color?)` | Show/clear an intro banner above the form |
| `frm.dashboard` | The form's `frappe.ui.form.Dashboard` instance (heatmap, indicators, transaction links) |

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

Verified against frappe 16.35.0 (<=16.35) and 16.51.1 (16.51):
- `apps/frappe/frappe/public/js/frappe/request.js` — `frappe.call`, `frappe.xcall`
- `apps/frappe/frappe/public/js/frappe/db.js` — `frappe.db.*`
- `apps/frappe/frappe/public/js/frappe/ui/dialog.js` (16.51) — `get_primary_btn()` → `.btn-modal-primary`
- `apps/frappe/frappe/public/js/frappe/ui/messages.js` (16.51) — `frappe.warn` 6-param; `frappe.show_alert` → `frappe.ui.toast` alias
- `apps/frappe/frappe/public/js/frappe/ui/components/toast.js` (16.51) — `frappe.ui.toast`, `frappe.ui.toast.promise`
- `apps/frappe/frappe/public/js/frappe/desk.js` (16.51) — `alias_removed_boot_keys()` deprecating `frappe.boot.user.all_reports`
- `apps/frappe/frappe/public/js/frappe/form/form.js` — `frm` API
- `apps/frappe/frappe/public/js/frappe/form/script_manager.js` — `frappe.ui.form.on` dispatch
- `apps/frappe/frappe/public/js/frappe/ui/form/controls/` — `Control` subclasses per fieldtype
