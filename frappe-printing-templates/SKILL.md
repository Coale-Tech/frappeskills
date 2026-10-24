---
name: frappe-printing-templates
description: "Build print formats, email templates, and Jinja-rendered documents in Frappe, including PDF generation and letter heads. Use when creating custom print layouts, transactional emails, or any Jinja rendering."
---

# Frappe Printing & Templates

Produce paper, PDF and email output from Frappe documents with Jinja.

## When to use

- Designing a print format for a DocType (invoice, order, payslip)
- Building email templates for notifications
- Generating PDFs from server code
- Configuring letter heads or print settings

## Inputs required

- Source DocType and the fields that must appear
- Output: screen print, PDF attachment, or email body
- Paper size, orientation, letter head requirements
- Languages that must render

## Procedure

### 0) Choose the format type

| Need | Type |
|---|---|
| Drag-and-drop layout | Print Format Builder (classic) |
| Precise control | Custom (Jinja/HTML) print format |
| Structured block layout (16.51) | Print Format Builder beta with `pdf_generator = "Typst"` |
| Email body | Email Template |
| Reusable fragment | Jinja macro / included template |

### 1) Write the Jinja template

```jinja
<div class="print-heading"><h2>{{ _("Sales Order") }} {{ doc.name }}</h2></div>
<table class="table table-bordered">
  {% for item in doc.items %}
  <tr>
    <td>{{ item.item_code }}</td>
    <td>{{ item.qty }}</td>
    <td>{{ frappe.format_value(item.amount, {"fieldtype": "Currency"}, doc) }}</td>
  </tr>
  {% endfor %}
</table>
```

Context, filters, whitelisted helpers and formatting:
[references/print-formats.md](references/print-formats.md).

### 2) Format values properly

Use `frappe.format_value` (or `frappe.utils.fmt_money`) for currency and dates so
the output respects locale and the document's currency. Never format money with
f-strings.

### 3) Generate PDFs from code

```python
from frappe.utils.pdf import get_pdf

html = frappe.get_print("Sales Order", name, print_format="My Format")
pdf = get_pdf(html)
```

### 4) Attach to email

```python
frappe.sendmail(
    recipients=[doc.contact_email],
    subject=_("Your order {0}").format(doc.name),
    template="order_confirmation",
    args={"doc": doc},
    attachments=[{"fname": f"{doc.name}.pdf", "fcontent": pdf}],
)
```

### 5) Verify rendering

Print the real document in the browser, then export the PDF — HTML and PDF
renderers differ, especially on page breaks.

## Verification

- [ ] Print preview renders for a real document, not a mock
- [ ] PDF export matches the on-screen layout
- [ ] Page breaks land between rows, not through them
- [ ] Currency, dates and numbers respect locale and document currency
- [ ] Letter head appears on the intended pages only
- [ ] Labels are translated (`{{ _("…") }}`)
- [ ] Multi-page documents repeat table headers

## Failure modes / debugging

- **Blank PDF**: template raised an exception; check the error log with the print format rendered directly
- **PDF differs from HTML**: unsupported CSS in the PDF engine — simplify layout, avoid flex/grid
- **Rows split across pages**: add `page-break-inside: avoid` to row containers
- **Missing values**: child table field not fetched, or the field is empty on that document
- **Wrong currency symbol**: value formatted manually instead of via `frappe.format_value`
- **Letter head missing**: not set on the document or disabled in print settings
- **(16.51) `ImportError: cannot import name 'download_pdf' from 'frappe.utils.weasyprint'`**: import path changed to `frappe.utils.print_format_generator`
- **(16.51) WeasyPrint blocked on new format**: `validate_weasyprint_choice()` throws; set `pdf_generator = "chrome"` for new formats
- **(16.51) Chrome PDF margins wrong**: the Chrome driver reads only bare `.print-format { margin-top/left/right }` longhands; use `html body .print-format { margin: 0 !important }` to zero in-browser margin separately — see `references/print-formats.md`
- **External font missing in PDF**: `@import url(...)` in Chrome PDF makes an outbound request; self-host fonts under `public/fonts/` instead

## Escalation

- Data not available in the document → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Tabular output better served as a report → [`frappe-reports`](../frappe-reports/SKILL.md)
- Outbound delivery and automation → [`frappe-app-development`](../frappe-app-development/SKILL.md)
- Blank or error output traced to the Jinja context → [`frappe-debugging-and-error-recovery`](../frappe-debugging-and-error-recovery/SKILL.md)

## References

- [references/print-formats.md](references/print-formats.md) - Print formats, email templates, Jinja context, PDFs

## Guardrails

- **Translate every label**: `{{ _("Invoice") }}`
- **Format money and dates through the framework**: `frappe.format_value`, not string interpolation
- **Keep PDF CSS conservative**: the PDF engine is not a modern browser
- **Never expose data the user cannot read**: print formats respect document permissions, not field-level trust
- **Test with a real multi-page document** before shipping

<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The HTML looks right in the browser, the PDF will match" | The PDF engine is not a browser; flexbox, grid, and most modern CSS are silently ignored or misrendered. |
| "I'll format the currency with an f-string, it's just display" | f-strings bypass locale, currency symbol, and precision rules; `frappe.format_value` exists for this. |
| "It's untranslated for now, we only ship in English" | Untranslated templates block multi-language rollouts; wrap labels in `{{ _("…") }}` from the start. |
| "I'll hardcode the company name, there's only one on this site" | The same print format is used on multi-company sites; use `doc.company` or the Letter Head. |
| "I tested it on a short document, looks fine" | Page-break bugs only appear on multi-page documents; test with real long data before shipping. |
| "The print format can fetch its own extra data via Jinja" | Unconstrained DB queries in Jinja templates slow bulk PDF generation; fetch in the controller and pass via context. |

## Red Flags

- `display: flex` or `display: grid` in print-only CSS
- Currency or date values formatted with Python string interpolation or `str()`
- Label strings not wrapped in `{{ _("…") }}`
- Hardcoded company name, address, or logo URL in the Jinja template
- Print format tested only with a document that fits a single page
- `frappe.db.sql` or `frappe.get_all` calls inside a Jinja template

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| f-string currency formatting | Wrong symbol and precision | `frappe.format_value` |
| Untranslated labels | No i18n | `{{ _("…") }}` |
| Modern CSS layout in print | PDF engine ignores it | Tables and simple blocks |
| Testing only single-page docs | Page-break bugs ship | Test a long document |
| Hardcoded company details | Breaks multi-company | Letter head / company fields |
