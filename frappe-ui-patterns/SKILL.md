---
name: frappe-ui-patterns
description: "Apply the frappe-ui design language and proven patterns from Frappe CRM, Helpdesk, and HRMS including navigation structure, left nav sidebar, list-detail panels, screen archetypes, hierarchy, confirmations, and mobile layouts. Use when designing multi-entity app structure and navigation flows rather than wiring data."
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
- Pinned frappe-ui version: `DesktopShell`, `MobileShell`, `BottomSheet`,
  `useIsMobile` are 1.0 (`(v1)`); 0.1.x apps hand-build the shell

## Procedure

### 0) Pick the closest reference product

| Product shape | Model after | Key pattern |
|---|---|---|
| Pipeline / deals | Frappe CRM | List + board toggle, side panel detail |
| Queue / tickets | Frappe Helpdesk | Filtered queue, agent view, SLA chips |
| Records / self-service | Frappe HRMS | Record list, request flows, approvals |

See [references/ui-patterns.md](references/ui-patterns.md).

### 1) Lay out the shell

Desktop: `DesktopShell` + `Sidebar` (+ optional `Rail`) + `PageHeader`.
Mobile: `MobileShell` + `MobileNav` + `PageHeaderMobile`. Pick the shell with
`useIsMobile()`; desktop and mobile are two navigation models, not one
responsive component. Anatomy and geometry:
[references/ui-patterns.md](references/ui-patterns.md).

### 2) Design the list

Filters and search above, dense rows, an indicator column, bulk actions on
selection, pagination or infinite scroll — not both. Rows come from
`frappe-ui/list` (1.0 stable) or `ListView` (0.1.x).

> **(frappe-ui 1.0)** `ListView`, `CommandPalette`, `Calendar`, and `Charts` are no longer exported
> from the root `frappe-ui` barrel — import from `frappe-ui/experimental` (unstable, may change
> between minor releases). `frappe-ui/list` is the stable 1.0 list primitive.

### 3) Design the detail

Primary actions top-right, status prominent, related records in tabs or side
panel, activity/comments last. Confirm destructive actions with
`dialog.danger`, inform with `dialog.confirm`; report outcomes with `toast` —
never a hand-built confirm `Dialog`. (`dialog.alert` does not exist.)

### 4) Make it responsive

Sidebar becomes a `BottomSheet`, persistent nav becomes `MobileNav` tabs,
action clusters collapse into one `Dropdown`, side-by-side panes become
separate routes — [references/mobile-patterns.md](references/mobile-patterns.md).

### 5) Validate against the reference product

Open the CRM/Helpdesk equivalent screen and compare density, spacing and
affordances before shipping.

## Verification

- [ ] Shell matches one reference product's structure, not a bespoke invention
- [ ] List screen supports filter, search, bulk action and empty state
- [ ] Detail screen exposes the primary action without scrolling
- [ ] Layout works at 375 px width without horizontal scroll
- [ ] Color only via `variant` + `theme` and semantic tokens; one accent per screen
- [ ] Screen checked with `data-theme="dark"`
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
- Frappe CRM's actual DocTypes, permissions, SLAs and integrations behind the "Pipeline / deals" pattern → [`frappe-crm-app`](../frappe-crm-app/SKILL.md)
- Generate token-faithful HTML mockups and score a design BEFORE writing code → [`frappe-design-mockup-review`](../frappe-design-mockup-review/SKILL.md)

- Verify interaction flows in a real browser → [`frappe-browser-testing`](../frappe-browser-testing/SKILL.md)

## References

- [references/ui-patterns.md](references/ui-patterns.md) - P1–P14 summary, shell anatomy, archetypes, hierarchy, color, states, confirmations, forms
- [references/mobile-patterns.md](references/mobile-patterns.md) - `MobileShell`, `MobileNav`, `BottomSheet`, `useIsMobile`, desktop-to-mobile translation
- Component props live in [`frappe-frontend-development`](../frappe-frontend-development/references/frappe-ui-components.md); these files link there rather than repeat them

- [references/accessibility-checklist.md](references/accessibility-checklist.md) - WCAG 2.1 AA checklist for Desk custom UI, portal pages, and frappe-ui Vue components

## Guardrails

- **Copy a shipped product's pattern** before designing a new one
- **One primary action per screen**: everything else is secondary
- **Tokens for spacing and type**: bespoke values make screens feel foreign
- **Two color axes only**: `variant` + `theme`; `theme` values differ by component — Button's max is `red`, Badge adds `amber` and `violet`, no component accepts `orange`
- **Mobile is a layout change, not a separate app**
- **Empty, loading and error states are part of the design**, not an afterthought

<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Our brand needs a custom shell, the Frappe one won't fit" | CRM, Helpdesk, and HRMS all use the same shell and look on-brand; customize via tokens, not shell code. |
| "Two primary action buttons make the choices clearer" | Two equally prominent buttons cause hesitation; promote one, demote the rest to `variant="subtle"`. |
| "I'll build the confirm dialog from scratch, it's only a few lines" | Hand-built dialogs diverge in wording, button order, and keyboard behaviour; use `dialog.confirm`/`danger`. |
| "The empty state can ship after the feature is done" | On day one, every fresh install shows a blank screen; the empty state is part of the feature. |
| "The table works fine on desktop, mobile users can scroll sideways" | Horizontal scroll on mobile is considered broken UX; convert rows to stacked cards below the breakpoint. |
| "I'll pass `intent='warning'` to mark the action as risky" | `intent`, `kind`, and `severity` are not frappe-ui props; the valid axes are `variant` and `theme`. |

## Red Flags

- A bespoke sidebar or nav shell built instead of `DesktopShell` / `MobileShell`
- More than one `variant="solid"` button visible on a single screen
- Hand-built `<Dialog>` markup for confirmation instead of `dialog.confirm` or `dialog.danger`
- List view with no empty state component
- Dense data table rendered at widths below 375 px without a responsive card layout
- Props like `intent=`, `kind=`, or `severity=` passed to frappe-ui Button or Badge

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Custom app shell for CRUD | Inconsistent UX, more maintenance | Follow CRM/Helpdesk shells |
| Dense desktop table on mobile | Unusable | Stacked cards below breakpoint |
| Multiple competing primary buttons | Users hesitate | One primary, rest secondary |
| Hand-built confirm `Dialog` | Boilerplate, inconsistent | `dialog.confirm` / `dialog.danger` |
| Inventing an `ActionSheet` for mobile | No such component | `BottomSheet` or `Dropdown` |
| Ad-hoc spacing values | Visual drift | Token scale |
| No empty state | Looks broken on day one | Explicit empty state with an action |
| `<Tabs v-model:tab="…">` | `tab` is `SettingsDialog`'s model | Bare `v-model` on `Tabs` |
| `Badge theme="orange"` | `orange` does not exist; renders default gray | Use `theme="amber"` |
| `dialog.alert(...)` | Method does not exist; throws `TypeError` | `dialog.confirm` or `dialog.danger` |
