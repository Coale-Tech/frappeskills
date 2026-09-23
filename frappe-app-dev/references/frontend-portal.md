# Portal Pages (Public Website)

Server-rendered Jinja templates for public-facing pages.

## Jinja templates

File: `apps/<app>/<app>/www/<page_name>.html`

```html
{% extends "templates/web.html" %}
{% block page_content %}
<h1>Expenses</h1>
{% for expense in expenses %}
<div>{{ expense.title }} — {{ expense.amount }}</div>
{% endfor %}
{% endblock %}
```

Context via Python:
File: `apps/<app>/<app>/www/<page_name>.py`

```python
import frappe

def get_context(context):
    context.expenses = frappe.db.get_all("Expense",
        filters={"owner": frappe.session.user},
        fields=["title", "amount"])
```

## Portal settings

In `hooks.py`:
```python
website_route_rules = [
    {"from_route": "/expenses", "to_route": "Expense"},
]

has_website_permission = {
    "Expense": "myapp.permissions.has_website_permission"
}
```


---

## Adopted patterns (frappe-skills)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frontend-development/references/portal-development.md`.

### Portal development

#### Overview
- Portals are customer-facing or public interfaces distinct from Desk.
- Build portals with standard web views, portal pages, or custom frontends.

#### Portal pages
- Use website/portal pages to expose data with proper permissions.
- Use web forms to allow submissions without Desk access.

#### Custom frontend
- Use Frappe UI to build modern portal apps with SPA behavior.
- Authenticate using standard Frappe auth and enforce permissions server-side.

#### References
- [Desk UI](https://frappe.io/framework/desk-ui)
- [Frappe UI GitHub](https://github.com/frappe/frappe-ui)
