---
name: frappe-ui-patterns
description: Apply proven UI and UX patterns from Frappe CRM, Helpdesk, and HRMS including app shells, list and detail layouts, and mobile responsiveness. Use when designing app structure and interaction flows rather than wiring data.
---

# Frappe UI Patterns

Reuse the interaction patterns Frappe's own products already validated, instead
of inventing an app shell per project.

## When to use

- Deciding overall app structure: sidebar, nav, list/detail split
- Designing list, board, detail or settings screens
- Making an existing frontend work on small screens
- Reviewing an interface for consistency with the Frappe ecosystem

## Inputs required

- Primary user task and the entity they work with
- Device mix (desk-first, mobile-first, or both)
- Whether the product resembles CRM (pipeline), Helpdesk (queue), or HRMS (records)

## Procedure

### 0) Pick the closest reference product

| Product shape | Model after | Key pattern |
|---|---|---|
| Pipeline / deals | Frappe CRM | List + board toggle, side panel detail |
| Queue / tickets | Frappe Helpdesk | Filtered queue, agent view, SLA chips |
| Records / self-service | Frappe HRMS | Record list, request flows, approvals |

See [references/ui-patterns.md](references/ui-patterns.md).

### 1) Lay out the shell

Sidebar with workspace switcher, a persistent top bar, and content region —
sized and spaced with design tokens.

### 2) Design the list

Filters and search above, dense rows, an indicator column, bulk actions on
selection, pagination or infinite scroll — not both.

### 3) Design the detail

Primary actions top-right, status prominent, related records in tabs or side
panel, activity/comments last.

### 4) Make it responsive

Collapse the sidebar into a drawer, promote the primary action to a sticky
bottom bar, and swap tables for stacked cards —
[references/mobile-patterns.md](references/mobile-patterns.md).

### 5) Validate against the reference product

Open the CRM/Helpdesk equivalent screen and compare density, spacing and
affordances before shipping.

## Verification

- [ ] Shell matches one reference product's structure, not a bespoke invention
- [ ] List screen supports filter, search, bulk action and empty state
- [ ] Detail screen exposes the primary action without scrolling
- [ ] Layout works at 375 px width without horizontal scroll
- [ ] Spacing and type come from tokens
- [ ] Keyboard navigation reaches every interactive element

## Failure modes / debugging

- **Screen feels unlike the rest of the ecosystem**: usually spacing scale and font weights, not layout
- **Table unusable on mobile**: convert rows to cards below the breakpoint
- **Actions hidden behind menus**: promote the single primary action
- **Infinite scroll plus pagination**: pick one
- **Sidebar eats the screen**: drawer below the tablet breakpoint

## Escalation

- Implementing the components → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Token values and scales → [`frappe-design-tokens`](../frappe-design-tokens/SKILL.md)
- Data and workflow modelling → [`frappe-enterprise-patterns`](../frappe-enterprise-patterns/SKILL.md)

## References

- [references/ui-patterns.md](references/ui-patterns.md) - Patterns from CRM, Helpdesk, HRMS
- [references/mobile-patterns.md](references/mobile-patterns.md) - Responsive and mobile behaviour

## Guardrails

- **Copy a shipped product's pattern** before designing a new one
- **One primary action per screen**: everything else is secondary
- **Tokens for spacing and type**: bespoke values make screens feel foreign
- **Mobile is a layout change, not a separate app**
- **Empty, loading and error states are part of the design**, not an afterthought

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Custom app shell for CRUD | Inconsistent UX, more maintenance | Follow CRM/Helpdesk shells |
| Dense desktop table on mobile | Unusable | Stacked cards below breakpoint |
| Multiple competing primary buttons | Users hesitate | One primary, rest secondary |
| Ad-hoc spacing values | Visual drift | Token scale |
| No empty state | Looks broken on day one | Explicit empty state with an action |
