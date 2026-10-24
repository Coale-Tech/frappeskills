---
name: frappe-web-forms
description: "Build public-facing Frappe Web Forms for data collection including field configuration, validation, and submission handling. Use when collecting data from users without Desk access, or when building logged-in pages where users can submit forms or responses online."
---

# Frappe Web Forms

Collect data from people who do not have Desk access, without writing a frontend.

## When to use

- Public applications, registrations, surveys, contact requests
- Logged-in portal users submitting a document
- Simple data capture where an SPA is overkill

## Inputs required

- Target DocType receiving the submission
- Whether the form is public (guest) or login-required
- Fields, required flags, and validation rules
- Post-submission behaviour: success message or redirect

## Procedure

### 0) Prepare the DocType

The Web Form writes to a DocType — create it first
([`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)) with the
fields the form collects.

### 1) Create the Web Form

Web Form → New: set `doc_type`, `route`, and the field list. Key flags:

| Flag | Effect |
|---|---|
| `login_required` | Guests are redirected to login |
| `allow_edit` | Submitter can edit their own response |
| `allow_multiple` | More than one submission per user |
| `apply_document_permissions` | Enforce DocType permissions on read |
| `dynamic_filters_json` | (16.51) JSON object of dynamic filter values for Link fields on the form |

### 2) Validate server-side

```python
# hooks.py → doc_events on the target DocType
def validate(doc, method=None):
    if doc.quantity and doc.quantity > 10:
        frappe.throw(_("Maximum 10 per request"))
```


> **(16.51)** The `accept` endpoint now runs `validate_submission()` server-side, which validates
> mandatory fields **and** `Data` field options (Email / Phone / URL / Name format) even when the
> underlying DocType field does not declare them. Browser-bypassed POST requests that previously
> slipped through unchecked field options will now be rejected with a validation error.
Client-side validation is convenience; the DocType controller is the boundary.

### 3) Control what guests may do

A guest-submittable form creates documents from the public internet. Keep the
DocType's guest permissions to create-only, never read-all, and rate-limit if
abuse is plausible
([`frappe-api-development`](../frappe-api-development/SKILL.md) → `rate-limiting.md`).

### 4) Handle submission

Configure the success message and redirect on the Web Form record — core Web Form
has no payment fields (`web_form.json`, v15 and v16); take payment via a separate
app. Notifications go through `doc_events` or a Notification.

### 5) Ship it as code

Export the Web Form with the app module so it survives a fresh site.

## Verification

- [ ] Form loads for the intended audience (guest vs. logged-in)
- [ ] Required fields block submission when empty
- [ ] Server-side validation rejects invalid data even when the client is bypassed
- [ ] Submission creates the document with correct owner and values
- [ ] A guest cannot read other people's submissions
- [ ] Success message or redirect behaves as configured
- [ ] Form is exported into the app, not only present in the database

## Failure modes / debugging

- **404 on the route**: route conflicts with a website page, or the form is unpublished
- **Guests see a login screen**: `login_required` is on
- **Submission fails silently**: controller `frappe.throw` message not surfaced — check the error log
- **Guest can list all submissions**: DocType guest read permission is too broad
- **Fields missing on the form**: not added to the Web Form field list, even though they exist on the DocType

## Escalation

- Richer interaction than a form → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Validation and lifecycle logic → [`frappe-doctype-development`](../frappe-doctype-development/SKILL.md)
- Public abuse concerns → [`frappe-api-development`](../frappe-api-development/SKILL.md)
- Public endpoint security rules → [`frappe-security-hardening`](../frappe-security-hardening/SKILL.md)
- Verifying the form works in a real browser → [`frappe-browser-testing`](../frappe-browser-testing/SKILL.md)

## References

- [references/web-forms.md](references/web-forms.md) - Web Form configuration, validation, client scripting

## Guardrails

- **Validate on the server**: client validation is bypassable
- **Guest forms are public endpoints**: grant create-only, never read-all
- **Never expose sensitive fields** on a public form, even read-only
- **Rate-limit public submissions** where abuse is plausible
- **Export the Web Form with the app**: database-only definitions are lost on a fresh site


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Client-side validation is enough for this simple form" | Direct POST bypasses all client validation; the DocType controller is the only real boundary. |
| "The form is internal-facing, so no rate limit is needed" | Portal users are still untrusted; abuse scripts do not respect intent. |
| "I'll export the Web Form later" | A fresh site will not have it; database-only definitions vanish on re-install. |
| "Users will only submit once; `allow_multiple` is unnecessary" | Browser refresh and back-button re-submissions are common; a double-submit creates two records. |
| "The DocType permissions cover guest access" | A public Web Form with `login_required` off creates documents under the Guest role regardless of the role table. |
| "The default success message is fine" | An ambiguous confirmation causes re-submission; set a clear message or redirect to prevent duplicates. |

## Red Flags

- Web Form not exported with the app — survives only until the next site rebuild
- Public form without rate limiting on the target route
- No server-side validation in the DocType controller (client Script is the only guard)
- Sensitive fields (email, phone, amount) visible read-only on a public form
- `login_required` off on a form intended for authenticated users only
- `apply_document_permissions` unset where logged-in users should only see their own submissions

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Trusting client-side validation | Direct POST bypasses it | Controller validation |
| Broad guest read permission | Data leak | Create-only for Guest |
| No rate limit on public forms | Spam submissions | Rate limiting |
| Form defined only in the database | Lost on fresh site | Export with the app |
| Sensitive fields on a public form | Exposure | Remove from the form |
