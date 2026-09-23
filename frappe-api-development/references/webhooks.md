# Webhooks

Outbound HTTP callbacks that fire when a document event happens on a
configured DocType. Source: `frappe/integrations/doctype/webhook/webhook.py`,
`frappe/integrations/doctype/webhook/__init__.py`,
`frappe/integrations/doctype/webhook/webhook.json`.

## Creating a webhook

Desk: **Integrations > Webhook > New**.

1. **DocType** (`webhook_doctype`, required, `set_only_once`) — the DocType to
   watch.
2. **Doc Event** (`webhook_docevent`, `set_only_once`) — one of:
   `after_insert`, `on_update`, `on_submit`, `on_cancel`, `on_trash`,
   `on_update_after_submit`, `on_change`, `workflow_transition` (v16).
   `on_submit`, `on_cancel`, and `on_update_after_submit` require the DocType
   to be submittable (`validate_docevent`); `workflow_transition` fires from
   `frappe/workflow.py` when a Workflow Transition's action is set to this
   webhook, not from the Document lifecycle.
3. **Condition** (`condition`, optional) — a `frappe.safe_eval` expression
   evaluated against `{"doc": doc, "utils": frappe.utils}`, e.g.
   `doc.status=="Open"` or `doc.total > 40000`. Empty condition always
   triggers.
4. **Request URL** (`request_url`, required) — must have a parseable network
   location or `validate_request_url` rejects it. **Is Dynamic URL?**
   (`is_dynamic_url`) renders `request_url` as a Jinja template against the
   same `{doc, utils}` context before each request.
5. **Request Method** (`request_method`): `POST` (default), `PUT`, or
   `DELETE` — no `GET`.
6. **Request Timeout** (`timeout`, default `5` seconds).
7. **Background Jobs Queue** (`background_jobs_queue`) — an Autocomplete
   populated by the whitelisted `get_all_queues` method (reads
   `frappe.utils.background_jobs.get_queues_timeout().keys()`); the webhook
   job is enqueued on this queue, or `"default"` if unset.
8. **Request Structure** (`request_structure`): empty/`Form URL-Encoded` uses
   the **Data** table (`webhook_data`, rows of `fieldname` → `key`, mapped
   from `doc.as_dict()`); `JSON` uses **JSON Request Body**
   (`webhook_json`, a Jinja-templated Code field, options `Jinja`) rendered
   against `{doc, utils}` and parsed with `json.loads`. Setting one clears the
   other (`validate_request_body`).
9. **Headers** (`webhook_headers`, child table `Webhook Header`: `key`,
   `value`) — static headers merged into the request.
10. **Enabled** (`enabled`, default checked) — unchecking disables firing.

Use the form's **Preview Request Body** action (calls the whitelisted
`preview_meets_condition` and `preview_request_body` methods against a
document you pick) to check the condition and payload before saving.

## Security: HMAC signature

**Enable Security** (`enable_security`) requires a **Webhook Secret**
(`webhook_secret`, Password field; `validate_secret` rejects an unreadable
value). When enabled, every request carries:

```
X-Frappe-Webhook-Signature: <base64(HMAC-SHA256(webhook_secret, json_body))>
```

Exact computation (`get_webhook_headers` in `webhook.py`):

```python
signature = base64.b64encode(
    hmac.new(
        webhook.get_password("webhook_secret").encode("utf8"),
        frappe.as_json(data).encode("utf8"),
        hashlib.sha256,
    ).digest()
)
```

To verify on the receiving side, HMAC-SHA256 the exact raw request body with
the shared secret, base64-encode the digest, and compare to the
`X-Frappe-Webhook-Signature` header with a constant-time comparison
(`hmac.compare_digest`). There is no timestamp or replay-nonce in the
signature — dedupe on your own idempotency key if that matters.

## Delivery

Webhooks do not fire synchronously inside the request that changed the
document:

- `Document.run_method` calls `run_webhooks(self, method)`
  (`frappe/model/document.py`) after every lifecycle hook.
- `run_webhooks` only reacts to `after_insert`, `on_update`, `on_submit`,
  `on_cancel`, `on_trash`, `on_update_after_submit`, and `on_change`
  (`on_change` is skipped on insert); it is a no-op during
  import/patch/install/migrate (`frappe.local.flags`).
- Matching webhooks are queued in `frappe.local._webhook_queue` and flushed by
  `flush_webhook_execution_queue`, registered once via
  `frappe.db.after_commit.add(...)` — so **nothing is sent until the DB
  transaction commits**, and if the transaction rolls back nothing is sent
  at all.
- The flush step deduplicates by `(webhook.name, doc.name)`, keeping only the
  **last** queued document state per webhook+document pulled within one
  transaction, then calls
  `frappe.enqueue("frappe.integrations.doctype.webhook.webhook.enqueue_webhook", doc=..., webhook=..., queue=webhook.background_jobs_queue or "default", now=frappe.in_test)`.
- `enqueue_webhook` retries up to 3 times with a `sleep(3 * i + 1)` back-off
  (1s, 4s) between attempts on any exception (including
  `requests.exceptions.ReadTimeout`). A `workflow_transition` webhook
  re-raises the exception after the third failure (so the workflow action
  itself fails); other doc-event webhooks swallow the final failure after
  logging it.
- Every attempt — success or failure — is logged via `log_request` into
  **Webhook Request Log** (not "Webhook Log"), with fields `webhook`,
  `reference_doctype`, `reference_document`, `headers`, `data`, `user`,
  `url`, `response`, `error`. Use this doctype for delivery debugging and
  auditing; it is linked from the Webhook form.

## Example use cases

- Notify an external service on document create/update/submit
- Sync data to a third-party system on `on_change`
- Run a webhook as a Workflow Transition action (`workflow_transition`, v16)

## See also

- [integration-patterns.md](integration-patterns.md) — inbound webhook
  receivers, retry/backoff for outbound HTTP clients, Integration Request
  logging for calls you make yourself.
- [rate-limiting.md](rate-limiting.md) — throttling a webhook *receiver*
  endpoint you expose.
