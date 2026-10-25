---
name: frappe-design-mockup-review
description: "Generate token-faithful HTML mockups using real frappe-ui 1.0 Espresso tokens, score them on a Frappe-specific rubric (docstatus colours, workflow banners, permission-aware UI, screen-type choice), and produce a hand-off spec before writing frontend code. Use when designing a new Frappe screen, picking between layout variants, or validating a plan before the frontend sprint."
---

# Frappe Design Mockup Review

## Overview

Catches design problems before they become refactoring debt. Uses the real
frappe-ui 1.0.2 Espresso token vocabulary so the mockup is a token spec, not
an inspiration board. For reviewing a live implementation after code ships,
use `frappe-design-review` (POST step).

## When to use

- Starting a new screen and choosing between 2–3 layout variants
- Validating a spec that contains UI/UX components before sprint kickoff
- Choosing between list vs report vs dashboard before any Vue code is written
- Checking a wireframe against the Frappe back-office design language

**Not for:** reviewing existing code (→ `frappe-design-review`); token audit
on a live component (→ `frappe-design-tokens`); shell/pattern selection only
(→ `frappe-ui-patterns`).

## Inputs required

| Input | Required | Notes |
|---|---|---|
| Users / roles | Yes | Drives field and button visibility per role |
| Device mix | Yes | `desk-first`, `mobile-first`, or both |
| Surface type | Yes | frappe-ui SPA, Desk customisation, portal, print format |
| Doctype + docstatus flow | Yes | Determines Draft/Submitted/Cancelled badge colours |
| Workflow states | If any | Pending-approval banner, transition buttons |
| Reference product to reuse | Recommended | CRM, Helpdesk, or HRMS pattern |

## Procedure

**Step 1 — Brief and constraints.** Confirm surface type, roles, device mix,
the nearest reference product (CRM, Helpdesk, HRMS), and a tap budget per role
for the primary action at 375px (default: reachable in 2 taps or fewer). Surface determines
token layer:

| Surface | Colour tokens | Shell |
|---|---|---|
| frappe-ui 1.0 SPA | `surface-*` / `ink-*` / `outline-*` | `DesktopShell` / `MobileShell` |
| Desk customisation | `var(--bg-color)`, `var(--text-color)` | Desk layout |
| Portal / web form | Frappe portal CSS subset | Standalone |
| Print format | `@media print` only | None |

**Step 2 — Generate mockups.** Run the zero-dependency generator:

```bash
node frappe-design-mockup-review/scripts/generate-mockup.js \
  --frappe-ui /path/to/frappe-ui \   # or: export FRAPPE_UI=...
  --out /tmp/my-feature-mockup --title "My Feature"
cd /tmp/my-feature-mockup && python3 -m http.server 8765
# open http://localhost:8765/mockup.html
```

Emits `tokens.css` (real Espresso vars from token source files) and
`mockup.html` (3-variant skeleton). Fidelity limits: CSS approximations
only; `oklch()` needs Chrome 111+; Inter font via CDN; no Tailwind utilities.
Customise the skeleton for 2–3 layout variants.

**Step 3 — Score with the rubric.** Score each variant 0–10 per dimension
from [references/rubric.md](references/rubric.md). Emit findings as:
`[SEVERITY] (confidence: N/10) page:element — description`. Key Frappe-specific
dimensions: `docstatus` (Desk: Draft=red, Submitted=blue, Cancelled=red; document or match),
`workflow` (blue banner with approver name), `permission-aware` (button visibility per role),
`screen-type` (list vs report vs dashboard), `states` (empty/loading/error/denied).

**Step 4 — Comparison board.** The generator's `mockup.html` shows variants
in labelled sections. Annotate each variant with its score and decision:

```
Variant A | score 7.8 | REJECTED: density too low for power users
Variant B | score 9.1 | SELECTED: matches Helpdesk pattern, 44px rows
Variant C | score 6.2 | REJECTED: wrong screen-type (dashboard ≠ report)
```

**Step 5 — Hand-off spec.** Emit for `frappe-frontend-development`:

```
SCREEN:     <name>  SURFACE: frappe-ui 1.0 SPA
SHELL:      DesktopShell + Sidebar (MobileShell at ≤768px)
COMPONENTS: Button(variant=subtle,theme=gray), Badge(docstatus),
            TextInput, Tabs, dialog.confirm
TOKENS:     bg-surface-gray-1 sidebar, text-ink-gray-9 primary,
            border-outline-gray-2 separators, rounded-5 inputs
STATES:     empty (no records + CTA), loading (skeleton rows),
            error (toast), permission-denied (message + escalation)
DOCSTATUS:  0=red "Draft", 1=blue "Submitted", 2=red "Cancelled" (Desk convention; document if different)
WORKFLOW:   pending → blue banner + approver name + "View Workflow"
ACCEPTANCE: re-run frappe-design-review POST checklist on live code
```

## Verification

- [ ] Constraints collected: surface, device mix, roles, doctype, workflow
- [ ] Reference product consulted; reuse documented or deviation justified
- [ ] Generator ran; `mockup.html` opens in Chrome (light + dark toggled)
- [ ] Mobile viewport tested at 375px (DevTools responsive mode)
- [ ] Each variant scored on all 15 dimensions from `references/rubric.md`
- [ ] Winning variant selected with comparison board and rationale
- [ ] Hand-off spec emitted: components, tokens, states, acceptance checklist
- [ ] `frappe-design-review` linked as POST re-check step

## Failure modes / debugging

- **Generator fails to parse colors.js**: strip trailing whitespace and check
  for comments (`// ...`) not caught by the regex — re-read the file raw
- **`oklch()` colours don't appear**: browser is pre-Chrome 111; use Safari 15.4+
- **Dark mode doesn't flip**: a raw hex or `rgb()` value snuck in; grep for
  `#[0-9a-fA-F]` in the mockup HTML
- **Score stalls at Pass 3**: a Frappe-specific dimension (docstatus, workflow,
  permission-aware) needs an explicit design decision — don't skip it
- **Mobile layout broken**: sidebar visible at 375px — add `@media (max-width:768px)
  { .fui-sidebar { display: none; } }`

## Escalation

- Implementing the approved design → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Token codemod on live code → [`frappe-design-tokens`](../frappe-design-tokens/SKILL.md)
- Shell / navigation pattern selection → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- POST-implementation design audit → [`frappe-design-review`](../frappe-design-review/SKILL.md)
- Desk-side CSS and client-script → [`frappe-desk-customization`](../frappe-desk-customization/SKILL.md)

## References

- [references/rubric.md](references/rubric.md) — full 0-10 rubric with "what a 10 looks like" per dimension
- [references/frappe-slop-list.md](references/frappe-slop-list.md) — 15 Frappe-specific anti-patterns
- [scripts/generate-mockup.js](scripts/generate-mockup.js) — zero-dependency mockup generator (Node >= 18)

## Guardrails

- **Tokens over invention**: every colour in the mockup spec must be a named Espresso token
- **Docstatus colour — match Desk or document**: Desk shows 0=red (Draft), 1=blue (Submitted), 2=red (Cancelled). frappe-ui Badge has no built-in docstatus convention. Screens embedded in or next to Desk must follow Desk's mapping. Standalone frappe-ui SPAs must document their mapping. Submitted must never be green; always use label + colour, never colour alone.
- **Reference product first**: if CRM/Helpdesk/HRMS already solves the pattern, copy it
- **State design is not optional**: empty, loading, error, and permission-denied must be in the mockup
- **One solid button per screen**: `variant="solid"` only on the primary action
- **`dialog.alert()` doesn't exist**: use `dialog.confirm` or `dialog.danger`

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Mockup is just communication, tokens don't matter" | Raw hex in the mockup trains the engineer to hardcode them. Use real tokens from day one. |
| "We'll design empty/permission states after launch" | They're visible on day one. Not designing them means the developer ships blank screens and "No data" in monospace. |
| "Our brand needs a custom shell" | CRM, Helpdesk, HRMS share the same shell and look on-brand. Token-customise; don't rebuild the shell. |
| "Mobile layout is out of scope for now" | Deciding the 375px layout is a constraint, not an afterthought. Document it now or the developer guesses. |
| "Docstatus colour is a minor detail" | Frappe users read the same docstatus colours across every Doctype; deviating breaks their mental model immediately. Desk shows Draft=red, Submitted=blue, Cancelled=red. |
| "We can use `intent='warning'` on the Button" | `intent` is not a frappe-ui prop; the axes are `variant` and `theme`. Silent fallback to default styles. |
| "Cards look cleaner than list rows" | OPERATE mode — users finish tasks, they don't browse cards. Dense 44px rows let operators see far more records at once. |

## Red Flags

- Mockup spec contains hardcoded hex values (`#...`) or `rgb(...)` — raw colour in any position
- Docstatus 0/1/2 badge colours undocumented, or Submitted shown as green/teal
- No empty, loading, or permission-denied state designed for any screen in the variants
- A bespoke sidebar or nav shell built instead of referencing `DesktopShell` / `MobileShell`
- More than one `variant="solid"` button visible simultaneously on the same screen
- Card grid used as the primary layout for an operational record queue (invoice list, job list)
- Hand-off spec mentions `dialog.alert()`, `intent=`, `kind=`, or `severity=` props

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Designing a Dashboard for tabular financial data | No filter-by-period, no Excel export, no row click-through | Use QueryReport or Script Report |
| Submitted docstatus shown as green badge | Submitted must never be green or teal — use blue on every surface | `Badge(theme="blue")` |
| `dialog.alert('Saved')` in the spec | Method doesn't exist — throws TypeError | `dialog.confirm(...)` for info; `toast` for outcomes |
| Uniform `rounded-full` on inputs and dialogs | Clashes with frappe-ui's contextual radius scale | `rounded-5` inputs, `rounded-6` dialogs |
| `Button(theme="amber")` or `intent="warning"` | Button themes are `gray`, `blue`, `green`, `red` only (`Button/types.ts`); `intent` is not a prop | `Button(variant="subtle", theme="red")` for destructive emphasis; amber exists for `Badge` only |
| `Badge(theme="orange")` | `orange` is not a valid Badge theme — renders default gray | Use `theme="amber"` |
| Horizontal-scroll table on mobile | Unusable; broken UX in frappe-ui-patterns guidance | Stacked cards below 768px breakpoint |
