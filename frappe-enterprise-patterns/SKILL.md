---
name: frappe-enterprise-patterns
description: "Apply production-grade architecture for large Frappe apps like CRM, Helpdesk, and HRMS, including multi-entity modelling, workflows, SLAs, and service layers. Use when designing complex systems rather than single features."
---

# Frappe Enterprise Patterns

Architecture for apps that outgrow a handful of DocTypes: CRM/Helpdesk-scale
systems with workflows, SLAs and integrations.

## When to use

- Designing a multi-entity product, not a single feature
- Introducing a service layer, domain events, or background pipelines
- Adding SLA tracking with pause/resume and breach handling
- Reviewing an app's architecture before it grows further

## Inputs required

- Core entities and their lifecycle states
- Roles and who acts at each state
- SLA or time-commitment requirements
- Integration points and their failure semantics
- Expected volume per entity

## Procedure

### 0) Model the domain first

Entities, ownership, and state transitions before any code. One aggregate per
business transaction; child tables for owned rows, Links for references.

### 1) Separate layers

```
doctype/…            thin controllers — validation and lifecycle only
services/…           business operations, transaction boundaries
integrations/…       outbound connectors, retries, mapping
api.py               whitelisted surface, permission gates
tasks.py             scheduled and enqueued work
```

Controllers stay thin; services are callable from API, jobs and tests alike.
See [references/enterprise-patterns.md](references/enterprise-patterns.md) and
the runnable skeleton in
[`frappe-app-development`](../frappe-app-development/SKILL.md) `assets/mini-app/`.

### 2) Make state explicit

Use a Workflow for human-driven transitions and a status field driven by code
for machine transitions — never both for the same field.

### 3) Add SLAs deliberately

Frappe core has no SLA doctype (ERPNext and Helpdesk ship their own). Build
targets per priority, business-hours calculation, pause on "waiting for
customer" and breach escalation on core primitives, and don't name the doctype
`Service Level Agreement` (collides with ERPNext):
[references/sla-patterns.md](references/sla-patterns.md).

Built-in audit and assignment primitives before custom code: `track_changes`
(Version diffs), Milestone Tracker, Assignment Rule (writes ToDo),
Notification (`Days Before`/`Value Change`/`Method` events), Log Settings
retention.

### 4) Design integrations to fail

Every outbound call: idempotency key, retry with backoff, dead-letter record,
and an operator-visible failure state. Never leave a half-applied transaction.

### 5) Plan for volume

Index the columns you filter on, paginate every list surface, and move
aggregation to scheduled rollups when tables pass millions of rows.

## Verification

- [ ] Every entity's states and transitions are documented and enforced
- [ ] Business logic is reachable from API, job and test without duplication
- [ ] SLA computation matches business hours on a worked example
- [ ] Integration retries are idempotent — replaying does not duplicate records
- [ ] Failure states are visible to an operator, not just in logs
- [ ] List surfaces paginate and stay fast on production-size data

## Failure modes / debugging

- **Business logic duplicated in controller and API**: extract to a service
- **Workflow and code both setting status**: transitions fight; pick one owner
- **SLA drifts from expectation**: business-hours calendar or pause logic, not the target
- **Duplicate records after a retry**: missing idempotency key
- **Slow list views at scale**: unindexed filter column or unbounded query
- **Silent integration failures**: exceptions swallowed in a job — surface them as a document state

## Escalation

- UI structure for the product → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- Job and queue mechanics → [`frappe-app-development`](../frappe-app-development/SKILL.md)
- Query performance → [`frappe-api-development`](../frappe-api-development/SKILL.md) → `database.md`
- Standards sweep of the result → [`frappe-app-audit`](../frappe-app-audit/SKILL.md)
- Query tuning and scalability → [`frappe-performance-optimization`](../frappe-performance-optimization/SKILL.md)
- Failure state observability → [`frappe-observability`](../frappe-observability/SKILL.md)

## References

- [references/enterprise-patterns.md](references/enterprise-patterns.md) - Layering, audit trail (Version, Milestone Tracker), assignment, notifications, retention, multi-tenancy
- [references/sla-patterns.md](references/sla-patterns.md) - Build-your-own SLA on core primitives: targets, pause/resume, breach handling

## Guardrails

- **Thin controllers, fat services**: lifecycle hooks orchestrate, they don't implement
- **One owner per status field**: workflow or code, never both
- **Every integration is idempotent and retryable**
- **Failures are documents, not log lines**: operators need to see and retry them
- **Index before volume arrives**, not after the incident
- **Don't build enterprise scaffolding for a small app**: cost without benefit


<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll put the logic in the controller; it's simpler" | Controller logic is unreachable from jobs and tests without duplication; extract to a service. |
| "The Workflow handles status, so code doesn't need to" | Unless one path is the sole owner, conflicting transitions corrupt state unpredictably. |
| "Idempotency keys are overkill for this one integration" | A single webhook retry without a key creates a duplicate record that requires manual cleanup. |
| "I'll add indexes when the queries get slow" | By the time queries are slow, millions of rows exist and `ALTER TABLE` locks the table under live traffic. |
| "We can add the service layer when the app grows" | Refactoring business logic out of controllers after ten callers exist costs 10× more. |
| "Errors in integration jobs go to logs; that's enough" | Operators cannot see or retry log-only failures; surface them as a document state. |

## Red Flags

- Business logic duplicated between the DocType controller and a whitelisted API method
- A Workflow and a code path both writing to the same status field on the same DocType
- Integration job retried by RQ with no idempotency key or duplicate-guard
- `frappe.get_all` or `frappe.qb` called inside a loop without a batch limit or pagination
- Exception swallowed with `frappe.log_error` and no document state updated for operator visibility
- `track_changes` disabled on a DocType where an audit trail is a business requirement
- `required_apps = ["erpnext"]` without the `"frappe/"` prefix — Frappe Cloud validates org prefixes and rejects bare names for non-default orgs; use `["frappe/erpnext"]`
- `override_doctype_class` used where `extend_doctype_class` (v16+) would add behaviour without replacing the upstream controller — a full override silently drops all future upstream controller improvements
- `doc_events` registered on a third-party DocType (CRM, HRMS, etc.) without guarding against the DocType being absent, renamed, or on a different version

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Business logic in controllers only | Unreachable from jobs and tests | Service layer |
| Workflow and code both own status | Conflicting transitions | Single owner |
| Retry without idempotency | Duplicate side effects | Idempotency key |
| Swallowed integration errors | Silent data loss | Failure state + alert |
| Unbounded list queries | Timeouts at scale | Paginate and index |
| Custom audit table for field history | Duplicates core | `track_changes` or Milestone Tracker |
| Premature enterprise architecture | Complexity without users | Start simple, extract later |
| `required_apps = ["erpnext"]` in hooks.py | Frappe Cloud rejects bare app names without `"frappe/"` prefix | Use `["frappe/erpnext"]` |
| `override_doctype_class` without calling `super()` for unmodified events | Drops all upstream controller event handlers silently | Subclass and delegate unmodified events to `super()`; prefer `extend_doctype_class` for additive-only changes |
| `doc_events` on a third-party DocType without version guard | Silent no-op if DocType renamed or absent after an upgrade | Check `frappe.db.table_exists("DocType Name")` or confirm with `list-apps` before registering |
