# Print Formats, Email Templates & Jinja

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `printing-templates/SKILL.md`.

## Worked examples

### Choose format type

| Type | How to Create | Version Controlled | Customizable by User |
|------|--------------|-------------------|---------------------|
| Standard | Developer Mode, saved as JSON | Yes | No |
| Print Format Builder | Drag-and-drop UI | No (DB) | Yes |
| Custom HTML (Jinja) | Type "new print format" in awesomebar | Optional | Depends |

### Create a Jinja print format

Create via awesomebar → "New Print Format":
1. Set a unique name
2. Link to the target DocType
3. Set "Standard" = "No" (or "Yes" for dev mode export)
4. Check "Custom Format"
5. Set Print Format Type = "Jinja"
6. Write your Jinja HTML

```jinja
<div class="print-format">
    <h1>{{ doc.name }}</h1>
    <p><strong>{{ _("Customer") }}:</strong> {{ doc.customer }}</p>
    <p><strong>{{ _("Date") }}:</strong> {{ frappe.format_date(doc.transaction_date) }}</p>

    <table class="table table-bordered">
        <thead>
            <tr>
                <th>{{ _("Item") }}</th>
                <th>{{ _("Qty") }}</th>
                <th class="text-right">{{ _("Rate") }}</th>
                <th class="text-right">{{ _("Amount") }}</th>
            </tr>
        </thead>
        <tbody>
            {% for item in doc.items %}
            <tr>
                <td>{{ item.item_name }}</td>
                <td>{{ item.qty }}</td>
                <td class="text-right">{{ frappe.format(item.rate, {'fieldtype': 'Currency'}) }}</td>
                <td class="text-right">{{ frappe.format(item.amount, {'fieldtype': 'Currency'}) }}</td>
            </tr>
            {% endfor %}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3" class="text-right"><strong>{{ _("Total") }}</strong></td>
                <td class="text-right"><strong>{{ frappe.format(doc.grand_total, {'fieldtype': 'Currency'}) }}</strong></td>
            </tr>
        </tfoot>
    </table>

    {% if doc.terms %}
    <div class="terms">
        <h4>{{ _("Terms & Conditions") }}</h4>
        <p>{{ doc.terms }}</p>
    </div>
    {% endif %}
</div>

<style>
    .print-format { font-family: Arial, sans-serif; }
    .print-format h1 { color: #333; }
    .print-format table { width: 100%; margin-top: 20px; }
</style>
```

### Use Frappe Jinja API

**Data fetching in templates:**

```jinja
{# Fetch a document #}
{% set customer = frappe.get_doc('Customer', doc.customer) %}
{{ customer.customer_name }}

{# List query (ignores permissions) #}
{% set open_orders = frappe.get_all('Sales Order',
    filters={'customer': doc.customer, 'status': 'To Deliver and Bill'},
    fields=['name', 'grand_total'],
    order_by='creation desc',
    page_length=5) %}

{# Permission-aware list query #}
{% set my_tasks = frappe.get_list('Task',
    filters={'owner': frappe.session.user}) %}

{# Single value lookup #}
{% set company_abbr = frappe.db.get_value('Company', doc.company, 'abbr') %}

{# Settings value #}
{% set timezone = frappe.db.get_single_value('System Settings', 'time_zone') %}
```

**Formatting:**

```jinja
{{ frappe.format(50000, {'fieldtype': 'Currency'}) }}
{{ frappe.format_date('2025-01-15') }}
{{ frappe.format_date(doc.posting_date) }}
```

**Session and context:**

```jinja
{{ frappe.session.user }}
{{ frappe.get_fullname() }}
{{ frappe.lang }}
{{ _("Translatable string") }}
```

**URLs:**

```jinja
<a href="{{ frappe.get_url() }}/app/sales-order/{{ doc.name }}">View Order</a>
```

### Build email templates

```jinja
Dear {{ doc.customer_name }},

Your order {{ doc.name }} has been confirmed.

Items:
{% for item in doc.items %}
- {{ item.item_name }} x {{ item.qty }}
{% endfor %}

Total: {{ frappe.format(doc.grand_total, {'fieldtype': 'Currency'}) }}

Thank you,
{{ frappe.get_fullname() }}
```

### Generate PDFs programmatically

```python
import frappe

# Generate PDF
pdf_content = frappe.get_print(
    doctype="Sales Invoice",
    name="SINV-001",
    print_format="Custom Invoice",
    as_pdf=True
)

# Attach PDF to document
frappe.attach_print(
    doctype="Sales Invoice",
    name="SINV-001",
    print_format="Custom Invoice",
    file_name="invoice.pdf"
)

# Send with email
frappe.sendmail(
    recipients=["customer@example.com"],
    subject="Your Invoice",
    message="Please find attached your invoice.",
    attachments=[{
        "fname": "invoice.pdf",
        "fcontent": pdf_content
    }]
)
```

### Configure Letter Head

1. Navigate to Letter Head list → New
2. Upload company logo and header image
3. Set as default for the company
4. Letter Head appears automatically on print formats

### Use Jinja filters

```jinja
{{ doc.customer_name|upper }}        {# UPPERCASE #}
{{ doc.notes|truncate(100) }}        {# Truncate text #}
{{ doc.description|striptags }}      {# Remove HTML #}
{{ doc.html_content|safe }}          {# Render raw HTML (trusted only!) #}
{{ items|length }}                   {# Count items #}
{{ items|first }}                    {# First item #}
{{ names|join(', ') }}               {# Join list #}
{{ amount|round(2) }}               {# Round number #}
{{ value|default('N/A') }}          {# Default if undefined #}
{{ data|tojson }}                    {# Convert to JSON #}
```

### Template inheritance and macros

```jinja
{# macros/fields.html #}
{% macro field_row(label, value) %}
<tr>
    <td class="label"><strong>{{ _(label) }}</strong></td>
    <td>{{ value }}</td>
</tr>
{% endmacro %}

{# In print format #}
{% from "macros/fields.html" import field_row %}
<table>
    {{ field_row("Customer", doc.customer_name) }}
    {{ field_row("Date", frappe.format_date(doc.posting_date)) }}
    {{ field_row("Total", frappe.format(doc.grand_total, {'fieldtype': 'Currency'})) }}
</table>
```


## Pitfalls

- **Missing fields**: guard with `{{ doc.field or '' }}` or `{% if doc.field %}`; `None` otherwise prints as the string `None`.
- **User-generated content**: escape with `{{ value | e }}`; use `|safe` only on trusted HTML.
- **Absolute URLs**: build with `{{ frappe.utils.get_url() }}`, never hardcode a host.
- **PDF styling**: prefer inline styles and `<table>` layout; the PDF engine lags modern browsers.
- **Template syntax errors**: check `{{ }}` / `{% %}` delimiters and unclosed blocks; preview in Print View before exporting PDF.

## Printing and Print Formats

### Overview
Frappe has first-class support for generating print formats for documents and converting them to PDF. Print formats use Jinja templating.

### Print View
Every document has a Print View accessible from the form. Frappe generates a Standard print format based on the form layout and mandatory fields.

### Print Format Builder
Customize print formats using the Print Format Builder:
1. Create a copy of the Standard Print format
2. Customize using the drag-and-drop builder
3. These formats are user-editable and stored in the database (not files)

#### Custom HTML
Drag and drop "Custom HTML" into your Print Format Editor. Use:
- Valid HTML with Bootstrap 3 classes
- Jinja templating for dynamic content

#### Custom CSS
Add custom CSS via Customize > Edit Properties.

### Advanced Print Formats
For complete layout control, write your own HTML:
1. Type "new print format" in awesomebar
2. Set a unique name
3. Set "Standard" as "No"
4. Check "Custom Format"
5. Select Print Format Type as "Jinja"
6. Write your custom HTML

If Standard is "Yes" with Developer Mode enabled, a JSON file will be generated for version control.

### Jinja in Print Formats
```jinja
<div class="print-format">
    <h1>{{ doc.name }}</h1>
    <p><strong>Customer:</strong> {{ doc.customer }}</p>
    
    <table>
        <tr>
            <th>Item</th>
            <th>Qty</th>
        </tr>
        {% for item in doc.items %}
        <tr>
            <td>{{ item.item_name }}</td>
            <td>{{ item.qty }}</td>
        </tr>
        {% endfor %}
    </table>
    
    <p><strong>Total:</strong> {{ frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'}) }}</p>
</div>
```

### Print Formats for Reports
Create HTML files named `{report-name}.html` in the Report folder for custom report printing. These use JS templating (similar to Jinja but client-side).

### PDF Generation
Use `frappe.get_print()` for server-side PDF generation:
```python
pdf = frappe.get_print(doctype, docname, print_format, as_pdf=True)
```

### Letter Head
Configure Letter Head for company branding on print formats.

Sources: Printing, Print Formats, Jinja API (official docs)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `printing-templates/references/jinja.md`.

## Jinja Templating in Frappe

### Overview
Jinja is Frappe's templating engine for rendering HTML in Print Formats, Email Templates, Portal Pages, and Web Views. Frappe provides a set of whitelisted methods accessible in Jinja templates.

### Syntax Basics

#### Delimiters
```jinja
{{ variable }}              {# Output expression #}
{% if condition %}...{% endif %}   {# Statement/control structure #}
{# This is a comment #}     {# Comment (not rendered) #}
```

#### Variables
```jinja
{{ doc.title }}             {# Attribute access #}
{{ doc['title'] }}          {# Item access (equivalent) #}
{{ name|upper }}            {# Filter: transform value #}
{{ items|length }}          {# Filter: get list length #}
```

#### Control Structures
```jinja
{# For loop #}
{% for item in items %}
  {{ item.name }}
  {{ loop.index }}          {# 1-indexed iteration #}
  {{ loop.first }}          {# True on first iteration #}
  {{ loop.last }}           {# True on last iteration #}
{% else %}
  No items found
{% endfor %}

{# Conditionals #}
{% if doc.status == 'Open' %}
  Open
{% elif doc.status == 'Closed' %}
  Closed
{% else %}
  Unknown
{% endif %}

{# Set variable #}
{% set total = 0 %}
{% set total = total + item.amount %}
```

#### Template Inheritance
```jinja
{# base.html #}
<!DOCTYPE html>
<html>
<head>{% block head %}{% endblock %}</head>
<body>{% block content %}{% endblock %}</body>
</html>

{# child.html #}
{% extends "base.html" %}
{% block content %}
  <h1>Hello</h1>
  {{ super() }}  {# Include parent block content #}
{% endblock %}
```

#### Include and Import
```jinja
{# Include another template #}
{% include "templates/includes/header.html" %}

{# Import macros #}
{% from "templates/macros.html" import input_field %}
{{ input_field('email') }}
```

#### Macros (Reusable Functions)
```jinja
{% macro input(name, value='', type='text') %}
  <input type="{{ type }}" name="{{ name }}" value="{{ value }}">
{% endmacro %}

{{ input('username') }}
{{ input('password', type='password') }}
```

### Frappe Jinja API

These are whitelisted methods available in Frappe Jinja templates:

#### Data Fetching

##### frappe.get_doc
```jinja
{% set task = frappe.get_doc('Task', 'TASK00002') %}
{{ task.title }} - {{ task.status }}
```

##### frappe.get_all / frappe.get_list
```jinja
{# get_all: ignores permissions #}
{% set tasks = frappe.get_all('Task', 
    filters={'status': 'Open'}, 
    fields=['title', 'due_date'],
    order_by='due_date asc',
    page_length=10) %}

{% for task in tasks %}
  {{ task.title }} - {{ frappe.format_date(task.due_date) }}
{% endfor %}

{# get_list: respects permissions #}
{% set my_tasks = frappe.get_list('Task', filters={'owner': frappe.session.user}) %}
```

##### frappe.db.get_value
```jinja
{# Single field #}
{% set abbr = frappe.db.get_value('Company', 'My Company', 'abbr') %}

{# Multiple fields #}
{% set title, status = frappe.db.get_value('Task', 'TASK001', ['title', 'status']) %}
```

##### frappe.db.get_single_value
```jinja
{% set timezone = frappe.db.get_single_value('System Settings', 'time_zone') %}
```

##### frappe.get_system_settings
```jinja
{% if frappe.get_system_settings('country') == 'India' %}
  INR Currency
{% endif %}
```

#### Formatting

##### frappe.format
```jinja
{# Format value based on fieldtype #}
{{ frappe.format('2019-09-08', {'fieldtype': 'Date'}) }}
{{ frappe.format(50000, {'fieldtype': 'Currency'}) }}
```

##### frappe.format_date
```jinja
{{ frappe.format_date('2019-09-08') }}
{# Output: September 8, 2019 #}
```

#### Metadata

##### frappe.get_meta
```jinja
{% set meta = frappe.get_meta('Task') %}
Task has {{ meta.fields|length }} fields.
{% if meta.get_field('status') %}
  Has status field
{% endif %}
```

#### URLs and Rendering

##### frappe.get_url
```jinja
<a href="{{ frappe.get_url() }}/task/{{ doc.name }}">View Task</a>
```

##### frappe.render_template
```jinja
{# Render a template file #}
{{ frappe.render_template('templates/includes/footer.html', {}) }}

{# Render a template string #}
{{ frappe.render_template('Hello {{ name }}', {'name': 'World'}) }}
```

#### Translation

##### frappe._ or _()
```jinja
{{ _('Hello World') }}
{{ frappe._('This will be translated') }}
```

#### Session Context

```jinja
{# Current user #}
{{ frappe.session.user }}

{# User's full name #}
{{ frappe.get_fullname() }}
{{ frappe.get_fullname('user@example.com') }}

{# CSRF token (for forms) #}
<input type="hidden" name="csrf_token" value="{{ frappe.session.csrf_token }}">

{# Current language (e.g., 'en', 'de') #}
{{ frappe.lang }}

{# Query parameters in web requests #}
{{ frappe.form_dict.get('search') }}
```

### Common Use Cases

#### Print Format
```jinja
<h1>{{ doc.name }}</h1>
<p>Customer: {{ doc.customer }}</p>

<table>
  <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
  {% for item in doc.items %}
  <tr>
    <td>{{ item.item_name }}</td>
    <td>{{ item.qty }}</td>
    <td>{{ frappe.format(item.amount, {'fieldtype': 'Currency'}) }}</td>
  </tr>
  {% endfor %}
</table>

<p>Total: {{ frappe.format(doc.grand_total, {'fieldtype': 'Currency'}) }}</p>
```

#### Email Template
```jinja
Dear {{ doc.customer_name }},

Your order {{ doc.name }} has been confirmed.

Items:
{% for item in doc.items %}
- {{ item.item_name }} x {{ item.qty }}
{% endfor %}

Total: {{ frappe.format(doc.grand_total, {'fieldtype': 'Currency'}) }}

Thank you,
{{ frappe.get_fullname() }}
```

#### Web Page
```jinja
{% extends "templates/web.html" %}

{% block page_content %}
<h1>{{ title }}</h1>

{% set posts = frappe.get_all('Blog Post', 
    filters={'published': 1},
    fields=['title', 'route', 'published_on'],
    order_by='published_on desc',
    page_length=5) %}

{% for post in posts %}
<article>
  <h2><a href="/{{ post.route }}">{{ post.title }}</a></h2>
  <time>{{ frappe.format_date(post.published_on) }}</time>
</article>
{% endfor %}
{% endblock %}
```

### Built-in Filters

Common Jinja filters available:
```jinja
{{ name|upper }}          {# UPPERCASE #}
{{ name|lower }}          {# lowercase #}
{{ name|title }}          {# Title Case #}
{{ name|capitalize }}     {# First letter uppercase #}
{{ text|truncate(50) }}   {# Truncate to 50 chars #}
{{ text|striptags }}      {# Remove HTML tags #}
{{ text|safe }}           {# Mark as safe HTML (no escaping) #}
{{ list|join(', ') }}     {# Join list items #}
{{ list|length }}         {# List length #}
{{ list|first }}          {# First item #}
{{ list|last }}           {# Last item #}
{{ value|default('N/A') }} {# Default if undefined #}
{{ dict|dictsort }}       {# Sort dictionary #}
{{ number|round(2) }}     {# Round to 2 decimals #}
{{ number|int }}          {# Convert to integer #}
{{ data|tojson }}         {# Convert to JSON string #}
```

### Security Notes
- Frappe auto-escapes HTML in templates to prevent XSS
- Use `{{ value|safe }}` only for trusted HTML content
- The `frappe.get_all` method ignores permissions; use `frappe.get_list` for permission-aware queries

### References
- https://frappeframework.com/docs/user/en/api/jinja
- https://jinja.palletsprojects.com/en/3.1.x/templates/
