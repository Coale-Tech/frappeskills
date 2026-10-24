---
name: frappe-documentation-and-adrs
description: "Records architectural decisions (ADRs) and app documentation for Frappe apps. Use when writing or updating a README with install or configuration steps, recording an ADR to explain why a design was chosen (e.g. override vs doc_events hook), documenting a whitelisted API, writing DocType description or help text, maintaining a changelog, or creating AGENTS.md context files. Not for test authoring → frappe-testing. Not for API design → frappe-api-development."
---

<!-- Adapted from addyosmani/agent-skills (MIT): skills/documentation-and-adrs/SKILL.md -->

# Frappe Documentation and ADRs

Document the *why*, not the *what*. Code shows what was built; documentation explains the decision behind it.

## When to use

- Choosing between competing approaches (ORM strategy, permission model, integration pattern)
- Adding or changing a `@frappe.whitelist()` API surface
- Shipping a feature that changes user-visible DocType behaviour
- Writing DocType `description`, field `description`, or `__doc__` on the controller class
- Onboarding a new contributor or configuring an AI agent for the bench
- When you find yourself explaining the same design choice repeatedly

Not for: designing the API itself → `frappe-api-development`. Writing tests → `frappe-testing`.

## Inputs required

- The decision or change being documented
- Alternatives that were considered and why they were rejected
- Affected DocTypes, APIs, hooks, or modules

## Procedure

### 0) Document the why, not the what

```python
# BAD: restates the code
# Validate amount before insert
def validate(self):
    if self.amount < 0:
        frappe.throw("Amount cannot be negative")

# GOOD: explains intent and constraint
def validate(self):
    # Negative amounts reach the GL as credits on the wrong side.
    # The UI already prevents this but the controller must guard the API path too.
    if self.amount < 0:
        frappe.throw(_("Amount cannot be negative"), frappe.ValidationError)
```

### 1) Decide when to write an ADR

Write an ADR when the decision is:
- Expensive to reverse (schema design, permission model, integration architecture)
- Likely to be re-debated without a written record
- Choosing between two technically valid options

**When NOT to write one**: obvious implementation details, throwaway scripts, or decisions the code itself makes self-evident.

### 2) Write the ADR

Use the template in `assets/adr-template.md`. Store ADRs in `<app>/docs/decisions/` with sequential numbering. If the repo already has an `.adr-dir` file or another convention, match it exactly.

Lifecycle: `Proposed` → `Accepted` → `Superseded by ADR-NNN`. Never delete old ADRs; write a new one that supersedes.

### 3) DocType-level documentation in Frappe

Frappe exposes three built-in documentation surfaces on DocType JSON and controller:

**DocType `description` field** (shown in the Desk form header):
```json
{
  "description": "Records a one-time expense claimed by an employee. Requires manager approval before reimbursement.",
  ...
}
```

**Field `description` / `in_list_view` help text** (shown below a field in the form):
```json
{"fieldname": "amount", "fieldtype": "Currency", "description": "Amount in the company currency. Converted at submission time."}
```

**Controller `__doc__`** (shown by `bench --site <site> console` tab-completion and IDE introspection):
```python
class ExpenseClaim(Document):
    """Single expense claim submitted by an employee.

    Workflow: Draft → Submitted (by employee) → Approved/Rejected (by manager).
    GL entries created on approval only. See ADR-003 for the approval model.
    """
```

### 4) Documenting whitelisted APIs

Every `@frappe.whitelist()` function that is part of your public surface needs a docstring covering: what it returns, what it expects, and what exceptions it raises.

```python
@frappe.whitelist()
def get_expense_summary(employee: str, fiscal_year: str) -> dict:
    """Return total claimed and approved amounts for an employee in a fiscal year.

    Args:
        employee: Employee document name.
        fiscal_year: Fiscal Year document name (e.g. "2024-2025").

    Returns:
        {"total_claimed": float, "total_approved": float}

    Raises:
        frappe.DoesNotExistError: if employee or fiscal_year not found.
        frappe.PermissionError: if caller lacks read access to Expense Claim.
    """
```

If the API is consumed by external systems, add a changelog entry and announce breaking changes before removal (see `frappe-deprecation-and-migration`).

### 5) App README standard

Every Frappe app should have a README covering:

```markdown
# <App Name>

One-paragraph description of what the app does and which ERPNext/Frappe version it targets.

## Installation
bench get-app https://github.com/<org>/<app> --branch version-16
bench --site <site> install-app <app>

## Quick start
<Minimal steps to see the app working after installation>

## Architecture
<Brief overview of key DocTypes, hooks, and integration points. Link to docs/decisions/ for ADRs.>

## Contributing
<How to set up a development bench, run tests, and submit a PR.>
```

### 6) Changelog maintenance

Keep `CHANGELOG.md` at the repo root. Format: `## [x.y.z] - YYYY-MM-DD` with `### Added / Changed / Fixed / Deprecated / Removed` subsections. Write entries for consumers ("Task Sharing: users can now share tasks with team members") not for implementers ("Added sharing_id FK to tabTask").

### 7) AGENTS.md / CLAUDE.md for agent context

Create `AGENTS.md` (or `CLAUDE.md`) at the bench root or app root to give AI agents project conventions:

```markdown
# Agent Context — <App Name>

## Key conventions
- DocType naming: PascalCase, module prefix for internal types
- Patches go under <app>/patches/vNN_0/; always idempotent
- Fixture filters scoped to module in hooks.py

## ADRs
- ADR-001: Why we use frappe.qb over raw SQL → docs/decisions/001-qb-over-sql.md
```

This prevents agents from re-deciding settled questions. See `frappe-context-engineering` for the full context-file strategy.

### 8) Post-ship documentation sync

After code is merged: update DocType `description` fields and API docstrings for any method that changed signature; add a CHANGELOG entry covering consumer impact (step 6); verify README install steps match the release tag; flag ADRs still "Proposed" for decisions that shipped. Prevents docs from drifting from live behavior after the fact.

## Verification

- [ ] ADR exists for every significant technical decision made in this change
- [ ] DocType `description` field is non-empty and consumer-facing
- [ ] Every `@frappe.whitelist()` function in the public API surface has a docstring
- [ ] README covers installation, quick start, and architecture pointer
- [ ] CHANGELOG updated with a human-readable entry for this release
- [ ] No commented-out code committed
- [ ] AGENTS.md reflects current conventions (no stale paths or removed DocTypes)
- [ ] ADR lifecycle field is one of: Proposed / Accepted / Superseded by ADR-NNN

## Failure modes / debugging

- **ADR becomes stale**: update the status to "Superseded by ADR-NNN" rather than editing the decision body.
- **DocType description not visible in Desk**: check the `description` key is at the DocType level (not inside a field); verify with `frappe.get_meta("DocType Name").description`.
- **Whitelisted API called without docs**: the caller has no contract; add the docstring and announce the inputs/outputs before other teams integrate.
- **AGENTS.md out of date**: agents will repeat mistakes for settled decisions; review on every significant refactor.

## Escalation

- API design itself → [`frappe-api-development`](../frappe-api-development/SKILL.md)
- Announcing breaking API changes → [`frappe-deprecation-and-migration`](../frappe-deprecation-and-migration/SKILL.md)
- Wiring agent context for a bench → [`frappe-context-engineering`](../frappe-context-engineering/SKILL.md)

## References

- [`assets/adr-template.md`](assets/adr-template.md) — ADR template for Frappe apps

## Guardrails

- **Document the why, not the diff**: comments on *what* get outdated; comments on *why* are stable.
- **No absolute paths or client names** in docs or AGENTS.md.
- **Never delete old ADRs**: they preserve historical context. Supersede them with a new record.
- **Prose edits must not change the decision or its constraints**: verify commands and examples still work after rewrite.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The code is self-documenting." | Code shows what. It doesn't show why an alternative approach was rejected or what constraints apply. |
| "We'll write docs when the API stabilises." | Documenting the API is the first test of its design. Instability is a signal to document now. |
| "Nobody reads ADRs." | Future agents and engineers do — and without them they repeat the same debate. |
| "DocType description fields are cosmetic." | They surface in Desk and in `frappe.get_meta`, and they orient support staff and AI agents. |
| "I'll add AGENTS.md when the project is mature." | Agents working in a convention-less codebase invent conventions; document early. |
| "Comments get outdated." | Only *what* comments get outdated. *Why* comments are stable because intent doesn't change as often as implementation. |

## Red Flags

- Significant schema or permission decision with no ADR
- `@frappe.whitelist()` function with no docstring on a public API
- README with no installation or quick-start section
- Commented-out code committed to the repo
- CHANGELOG not updated since the last release tag
- AGENTS.md referencing DocTypes or paths that no longer exist
- ADR status stuck on "Proposed" for months without a decision

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Writing what the code does in a comment | Comment is already stale after the next refactor | Comment on the constraint or invariant instead |
| One ADR for many unrelated decisions | Impossible to supersede individual choices | One ADR per distinct decision |
| Skipping DocType `description` | Desk users and agents have no guidance on what the form is for | Add a one-sentence consumer-facing description |
| Announcing a breaking change without a migration path | Consumers are blocked until they figure out the upgrade | Provide the adapter or the patch before announcing |
| CHANGELOG entry describes the diff, not the impact | Consumers can't assess whether to upgrade | Write the entry from the consumer's perspective |
