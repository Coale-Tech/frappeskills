# Desk UI/UX Interaction Patterns (v16, source-verified)

How Frappe **Desk** UI actually behaves when a user interacts with it — child
tables (grids), report datatables, list views, forms, dialogs, and keyboard.
Use this to build custom Desk UI that matches native behavior, and to know what
events/APIs to hook. Scope: **Desk** (jQuery + `frappe.ui.*`). For Vue SPA
apps see [frappe-ui-components.md](../../frappe-frontend-development/references/frappe-ui-components.md); for tokens/styling see
[espresso-design-system.md](../../frappe-design-tokens/references/espresso-design-system.md).

> Terminology: a "table" inside a form is the **child-table Grid**
> (`frappe.ui.form.Grid`). A "table" in a Report/List datatable is the
> **`frappe.DataTable`** (frappe-datatable). They are different widgets with
> different interaction models — both covered below.

---

## 1. Child-table Grid — "clicking inside a table"

Source: `apps/frappe/frappe/public/js/frappe/form/grid.js`, `grid_row.js`,
`grid_row_form.js`, `grid_pagination.js`.

### Anatomy
- A grid = a header row + N data rows, each row an instance of `GridRow`.
- Each cell (`make_column`, `grid_row.js:941`) holds two layers:
  - `.static-area` — read-only ellipsized display of the value (default view).
  - `.field-area` — a real form control, shown only while the row/cell is being
    edited (`toggle(false)` by default).
- The grid is inline-editable only when the DocType meta flag
  **`editable_grid`** is set AND the field is writable: `is_editable()`
  (`grid.js:1159`) and `allow_on_grid_editing()` gate this. When not editable,
  cells stay static and editing happens in the expanded row form (§1.3).

### 1.1 Click a cell → inline edit
`grid_row.js:1069` — clicking a cell calls `toggle_editable_row()`
(`grid_row.js:1131`), which swaps `.static-area` for `.field-area`, then focuses
the first input (`trigger_focus`). Specifics:
- **Link / Dynamic Link / Autocomplete** cells open an absolutely-positioned
  dropdown (`focusin`, `grid_row.js:1042`) sized to the column, min 250px, so
  the awesomplete list isn't clipped by the row.
- **Touch** (`event.pointerType == "touch"`) focuses the input and, for `Date`,
  opens the date picker explicitly (layout-shift avoidance).
- Only one row edits at a time: `frappe.ui.form.editable_row` tracks it; opening
  another toggles the previous off (`grid_row.js:1143`).

### 1.2 Keyboard navigation inside an editing cell
`set_arrow_keys` (`grid_row.js:1239`) binds `keydown` on each cell input. Only
`TAB / UP / DOWN / ESCAPE` are intercepted; everything else types normally.

| Key | Behavior |
|---|---|
| **Tab** | Next cell. On the **last input of the last row** → auto-adds a new row (100 ms) and focuses it. Last column of a non-last row → drops to next row. (`grid_row.js:1289`) |
| **Shift+Tab** | Previous cell; at the first column → opens the previous row for editing. (`grid_row.js:1324`) |
| **↑ / ↓** | Move to same field in prev/next row. Skipped for multi-line fieldtypes (`Text, Small Text, Code, Text Editor, HTML Editor`) unless **Alt** is held — so arrows move the caret in text areas. (`grid_row.js:1264,1310,1317`) |
| **Esc** | If the row is untouched (`__unedited`) it is removed; otherwise closes edit. (`grid_row.js:1281`) |
| **Ctrl/Cmd + ↓** | Add a new row below / at end and focus it (`add_new_row_using_keys`, `grid_row.js:1349`). |
| **Ctrl/Cmd + Shift + ↓** | Add row at the **end**; **Ctrl+Shift+↑** adds at the **start**. |
| **Shift + Alt + ↓** | Duplicate the current row (`duplicate_row_using_keys`, `grid_row.js:1341`). |

Tabbing into an **empty** grid: focusing the header's first cell
(`tabIndex=0`, `grid_row.js:1112`) auto-creates the first row and focuses it.

### 1.3 Expand a row → full row detail form
Clicking the row number / the **edit (pencil)** open-form button
(`add_open_form_button`, `grid_row.js:328`; Enter also triggers) calls
`toggle_view()` (`grid_row.js:1384`), which renders `GridRowForm`
(`grid_row_form.js`) — every field of the row laid out as a normal form, used
for rows with more fields than fit as columns. Only one detail form is open at a
time. Navigate between open rows with **Ctrl+↓ / Ctrl+↑** (`open_next` /
`open_prev`, wired in `keyboard.js:260-280`). **Esc** closes it
(`close_grid_and_dialog`, `keyboard.js:337`).

### 1.4 Adding, reordering, deleting rows
- **Add Row** button and **Add Multiple** (paste/insert N) — `add_new_row`
  (`grid.js:933`); disabled when `df.cannot_add_rows` or `grid.cannot_add_rows`.
- **Drag to reorder**: `Sortable` on the rows container (`grid.js:697`),
  active only while editable; updates `idx`. Force reorder-only mode with
  `grid.only_sortable()` (`grid.js:1167`).
- **Move to position**: the row menu exposes a "Move" action writing a target
  `idx` (`grid_row.js:159`).
- **Bulk delete**: per-row checkboxes (`toggle_checkboxes`, `grid.js:884`) +
  a "Delete" action in `.grid-bulk-actions`.

### 1.5 Bulk edit / paste from spreadsheet
When a child docfield has **`allow_bulk_edit`** (`setup_allow_bulk_edit`,
`grid.js:1199`), the grid gains **Download** (CSV template) / **Upload** so
users edit many rows in a spreadsheet and paste back — the idiomatic pattern for
large child tables.

### 1.6 Configure columns (per-user)
The column-settings (gear) button (`add_column_configure_button`,
`grid_row.js:371`) opens a dialog to choose which fields show as in-line columns
and their widths — persisted per user. `configure_columns: true` is the default
(`grid.js:433`).

### 1.7 Controlling a grid from a client script / controller
Access via `frm.fields_dict[<tablefield>].grid`. Verified public methods
(`grid.js`):

```js
const grid = frm.fields_dict.items.grid;
grid.update_docfield_property("rate", "read_only", 1);   // grid.js:1349
grid.toggle_reqd("qty", true);                            // 869
grid.toggle_enable("rate", false);                        // 874
grid.toggle_display("discount", false);                   // 879
grid.set_column_disp("batch_no", true);                   // 816
grid.get_field("warehouse");                              // 912  -> docfield
grid.add_custom_button(__("Fetch"), () => {}, "bottom");  // 1328
grid.clear_custom_buttons();                              // 1344
grid.refresh();                                           // 473
// prevent adding rows:
frm.set_df_property("items", "cannot_add_rows", true);
```

Per-row: `frappe.ui.form.on(child_dt, fieldname, fn)` fires on grid-cell edits;
`frm.fields_dict.items.grid.grid_rows[i]` gives a `GridRow`.

### 1.8 Styling (Espresso)
Grids inherit Espresso tokens ([espresso-design-system.md](../../frappe-design-tokens/references/espresso-design-system.md)): row height, borders
(`--border-color`/`--outline-gray-2`), and the `.editable-row` class toggled on
editable rows (`grid_row.js:321`). Keep custom grid CSS on Espresso variables,
not hardcoded colors.

---

## 2. Report view — the DataTable

Source: `apps/frappe/frappe/public/js/frappe/ui/datatable.js` (`frappe.DataTable
= DataTable`, line 3), `views/report/report_view.js`. Report View renders the
**frappe-datatable** widget (a spreadsheet-like grid, distinct from the form
grid):
- **Click a cell** selects it; drag/Shift+click selects ranges; copy/paste works
  across cells.
- **Column** sort (click header), resize (drag border), reorder (drag header).
- **Inline edit** when the report is editable — the cell becomes an input;
  Enter/arrow keys move the active cell (spreadsheet-style).
- Checkbox column for row selection → bulk actions (see §3).
Build custom datatables with `new frappe.DataTable(el, { columns, data, ... })`.

---

## 3. List view interactions

Source: `list/list_view.js`, `list/bulk_operations.js`,
`model/indicator.js`. See also [listview-patterns.md](listview-patterns.md).
- **Row select** (checkboxes) reveals the bulk-action bar. Verified bulk ops
  (`bulk_operations.js`): `print`, `delete`, `assign` / assignment-rule apply,
  `submit`/`cancel`, `edit` (bulk field edit via
  `bulk_update.submit_cancel_or_update_docs`), `add_tags`, `export`.
- **Filters** (standard + saved), **sort** selector, **group by**, **page
  length** (load more / count), **sidebar** facets.
- **Status indicator** dot per row via `frappe.listview_settings[dt].get_indicator`
  (precedence in `model/indicator.js`).
- Inline like/comment/assignment counts per row.

---

## 4. Form interactions

Source: `form/form.js`, `form/layout.js`, `form/sidebar/`, `form/toolbar.js`.
- **Sections** collapse/expand (`collapsible`); **Tabs** across sections.
- **Dirty state**: editing sets `frm.doc.__unsaved`; the Save button and a
  "Not Saved" indicator appear; navigating away warns.
- **Docstatus** drives available actions: Draft (0) → Submit; Submitted (1) →
  Cancel / Amend; only `on_update_after_submit` fields stay editable.
- **Primary action** (Save/Submit) fires on **Ctrl+S** (§5).
- **Sidebar**: assignments (ToDo), tags, shares, likes, followers, attachments.
- **Dashboard/Connections**: linked-document counts + quick "＋" create.
- **Timeline**: comments, emails, edits, versions.
- **Quick Entry**: `frappe.ui.form.make_quick_entry` opens a minimal Dialog
  (mandatory fields only) for fast creation from Link fields / New.
- Field-level events: `frappe.ui.form.on(dt, fieldname, fn)`; row/grid events as
  in §1.7.

---

## 5. Global keyboard shortcuts

Source: `apps/frappe/frappe/public/js/frappe/ui/keyboard.js`.

| Shortcut | Action |
|---|---|
| **Ctrl/Cmd + S** | Trigger primary action (Save/Submit); blurs active input first (`keyboard.js:188`) |
| **Ctrl/Cmd + K** or **Ctrl+G** | Open Awesomebar (global search) (`:200,:210`) |
| **Ctrl/Cmd + ↓ / ↑** | In an open grid-row detail: go to next / previous row (`:260,:271`) |
| **Esc** | Close open grid row, else cancel current dialog, else blur (`:246,:337`) |
| **Enter** | Confirm the primary button of a confirm-dialog (`:254`) |
| **Alt + S** | Open Settings menu (`:220`) |
| **Alt + H** | Open Help (`:237`) |
| **Shift + /** (`?`) | Show the keyboard-shortcuts dialog (`:229`) |
| **Shift + Ctrl + R** | Clear cache and reload (`:282`) |

Register your own: `frappe.ui.keys.add_shortcut({ shortcut, action, description,
ignore_inputs, page })` (`keyboard.js:188`), or `frappe.ui.keys.on("ctrl+e",
fn)`. `frappe.ui.keyCode` exposes named codes (`:319`).

---

## 6. Conventions when building custom Desk UI

- Reuse `frappe.ui.Dialog` + `FieldGroup` for input; don't hand-roll forms
  ([frappe-ui-components.md](../../frappe-frontend-development/references/frappe-ui-components.md)).
- Feedback: `frappe.show_alert()` / `frappe.msgprint()` / `frappe.throw()` for
  errors, `frappe.confirm()` before destructive actions.
- Empty/loading states and status indicators should match native (Espresso
  tokens, `frappe.get_indicator`).
- Respect docstatus + permissions in the UI (`frm.doc.docstatus`,
  `frappe.model.can_write`) — but never rely on UI gating for security
  ([authentication.md](../../frappe-api-development/references/authentication.md)).

---

## Sources
- `apps/frappe/frappe/public/js/frappe/form/grid.js` (Grid: is_editable:1159, add_new_row:933, Sortable:697, set_column_disp:816, toggle_reqd:869, toggle_enable:874, toggle_display:879, toggle_checkboxes:884, get_field:912, only_sortable:1167, set_multiple_add:1174, add_custom_button:1328, clear_custom_buttons:1344, update_docfield_property:1349, setup_allow_bulk_edit:1199, configure_columns:433)
- `apps/frappe/frappe/public/js/frappe/form/grid_row.js` (make_column:941, click-to-edit:1069, focusin dropdown:1042, toggle_editable_row:1131, set_arrow_keys:1239, add_new_row_using_keys:1349, duplicate_row_using_keys:1341, toggle_view:1384, add_open_form_button:328, add_column_configure_button:371, empty-grid header focus:1112)
- `apps/frappe/frappe/public/js/frappe/form/grid_row_form.js` (GridRowForm expanded detail)
- `apps/frappe/frappe/public/js/frappe/ui/keyboard.js` (global shortcuts + keyCode map)
- `apps/frappe/frappe/public/js/frappe/ui/datatable.js` (`frappe.DataTable`, line 3)
- `apps/frappe/frappe/public/js/frappe/list/bulk_operations.js` (print/delete/assign/edit/submit/cancel/add_tags/export)
- `apps/frappe/frappe/public/js/frappe/model/indicator.js` (list indicators)
