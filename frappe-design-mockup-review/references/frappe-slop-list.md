# Frappe Design Anti-Patterns (Slop List)

Patterns that look generic, wrong, or imported-from-a-marketing-template
inside a Frappe back-office app. All written for Frappe-specific context;
the gstack AI-slop blacklist covers the general case.

Surface classifier for Frappe: almost everything is **OPERATE** mode
(users finish a task — the interface gets out of the way). Portal pages and
report covers are **READ**. Landing-page patterns do not belong in Desk.

---

## 1. Invented Component Not in frappe-ui

**Pattern:** A bespoke `<StatusCard>`, `<MetricTile>`, or `<ActionPanel>`
built from scratch with its own shadow, radius, and colour scheme.

**Why it fails:** frappe-ui ships `Badge`, `Card` (via `surface-*` classes),
and `List`-based row patterns that Frappe users already recognise. Inventing
a new component creates visual inconsistency with CRM, Helpdesk, and HRMS.
It also doubles the maintenance surface.

**Fix:** Map the requirement to an existing component. If it genuinely cannot
be covered, document the new component in the hand-off spec and justify it.

---

## 2. Raw Hex or RGB Colors

**Pattern:** `color: #4C5A67`, `background-color: rgb(245, 245, 245)`,
`border: 1px solid rgba(0,0,0,0.1)`.

**Why it fails:** Dark mode is implemented via `[data-theme="dark"]` flipping
CSS custom property values. Any raw color value stays fixed in both modes,
breaking dark mode. It also makes it impossible to apply Frappe's system-wide
theme changes.

**Fix:** Every colour must be a `surface-*`, `ink-*`, or `outline-*` Tailwind
class (frappe-ui 1.0 SPA) or a `var(--bg-color)` / `var(--text-color)` CSS
variable (Desk). Verify the class exists in `tailwind/tokens/colors.js`.

---

## 3. Gradient Hero in a Back-Office Form

**Pattern:** A page header with a `linear-gradient` background, a large
illustration, or a brand-forward "hero" section above the form fields.

**Why it fails:** This is OPERATE mode: the user is submitting a Purchase
Invoice, approving a leave request, or reviewing a job card. They want the
data, not brand expression. The Frappe CRM, Helpdesk, and HRMS pages all use
a plain `surface-base` or `surface-gray-1` page background.

**Fix:** Use `surface-base` for the page background. Reserve `surface-blue-1`
for informational banners (workflow, announcements). Decoration-free.

---

## 4. Emoji as Design Elements

**Pattern:** 🚀 in page headings, 📋 as list item icons, ✅ as status
indicators in a form.

**Why it fails:** Emoji rendering differs across OS versions and browsers.
They cannot be styled (colour, size) with CSS. They look out of place next to
frappe-ui's consistent `lucide-*` icon set. They match the gstack AI slop pattern for
emoji as visual elements and are immediately visible as "AI generated this".

**Fix:** Use `lucide-<name>` icon references in Vue (`icon="lucide-file-text"`)
or SVG stubs in mockups. The empty-state illustration placeholder should be a
neutral SVG or Unicode character, not an emoji.

---

## 5. Over-Cards (Card Grid as Primary Layout)

**Pattern:** Every record displayed as a card with a shadow, a thick border,
and large padding. 6–8 cards visible on screen where a list would show 20.

**Why it fails:** Frappe's operational UIs (CRM, Helpdesk, HRMS) all use
dense list rows for record queues. Cards belong only when the card IS the
interaction (Kanban board, image gallery). Using cards for invoice lists or
job queues means operators scroll more and see less context.

**Fix:** Use `frappe-ui/list`-based rows (44–48px height). Reserve cards for
Kanban columns, dashboard KPI tiles, or user-facing portals where whitespace
aids scannability for non-power users.

---

## 6. Inconsistent Radius

**Pattern:** `border-radius: 9999px` on every element — pills everywhere:
buttons, badges, input fields, table cells, modals.

**Why it fails:** frappe-ui uses a contextual radius scale:
- `rounded-4` (8px): small tight containers (list row hover, sidebar item)
- `rounded-5` (10px): inputs, buttons, filter pills
- `rounded-6` (12px): dialogs, dropdowns, cards
- `rounded-full` (9999px): badges only

A uniform pill radius on inputs and dialogs clashes with the actual component
library and matches the gstack AI slop pattern for uniform pill radius.

**Fix:** Reference `rounded-{n}` from `tailwind/tokens/radius.js`. Never use
`rounded-md`, `rounded-lg` in frappe-ui 1.0 apps (deprecated aliases).

---

## 7. Invalid Prop Axes (`intent`, `kind`, `severity`)

**Pattern:** `<Button intent="warning">`, `<Button kind="ghost">`,
`<Badge severity="error">` in the mockup spec or hand-off doc.

**Why it fails:** frappe-ui components accept exactly two colour axes:
`variant` (solid | outline | subtle | ghost) and `theme` (color name).
Props like `intent`, `kind`, `severity`, `color`, and `size` don't exist
and will cause the component to silently fall back to default styles, with
no Vue warning in production builds.

**Fix:** Map intent to theme: "warning" → `theme="amber"`, "error" → `theme="red"`,
"success" → `theme="green"`. Note that `theme="orange"` is not valid for Button
or Badge (amber is the closest valid option).

---

## 8. `dialog.alert()` Call

**Pattern:** Hand-off spec or mockup notes reference `dialog.alert('message')`.

**Why it fails:** `dialog.alert` does not exist in frappe-ui 1.0. Calling it
throws `TypeError: dialog.alert is not a function`. The valid imperative helpers
are `dialog.confirm({ ... })` and `dialog.danger({ ... })`.

**Fix:** Use `dialog.confirm` for reversible actions (confirm before submit),
`dialog.danger` for destructive actions (delete, cancel). Toast for outcomes.

---

## 9. Docstatus Wrong Colour

**Pattern:** Draft shown with a green badge ("looks good"), Submitted with
teal, Cancelled with orange.

**Why it fails:** Desk uses a fixed docstatus indicator colour scheme (from
`frappe/public/js/frappe/model/indicator.js`, verified v16.35 and v16.51).
Deviating from it breaks the visual language Frappe Desk users see on every
submittable DocType. frappe-ui Badge has no built-in docstatus convention,
so every frappe-ui SPA must document its own mapping explicitly.

**Desk indicator convention:**
- `docstatus: 0` (Draft) → `"red"` indicator
- `docstatus: 1` (Submitted) → `"blue"` indicator
- `docstatus: 2` (Cancelled) → `"red"` indicator

Screens embedded in or adjacent to Desk must match this. Standalone frappe-ui
SPAs may use gray for Draft (as CRM does for its status field) but must
document the choice. **Submitted must never be green or teal. Cancelled must
never be orange. Every badge must carry a label, not colour alone.**

This applies to every submittable Doctype. Not "most". All.

---

## 10. Marketing Copy in a Back-Office Form

**Pattern:** Page header text like "Manage your invoices efficiently",
"Streamline your procurement workflow", or "Welcome to Purchase Invoice."

**Why it fails:** Users in an Accounts team open Purchase Invoice dozens of
times per day. They know what it is. Marketing copy consumes space and adds
friction. It matches the gstack AI slop pattern for generic hero copy.

**Fix:** Page title = Doctype name ("Purchase Invoice"). No subtitle unless
it carries operational information (e.g. "Company: Acme Corp" in a
company-scoped list). Copy rule: utility language only — orientation, status,
action. Never mood, brand, or aspiration in a back-office surface.

---

## 11. Hidden States (Missing Empty / Loading / Error / Permission)

**Pattern:** The mockup shows only the happy path — records visible, data
loaded, user has full permissions.

**Why it fails:** On the first day a new Frappe site is deployed, every list
is empty. On slow network days, every list loads for 2 seconds. On any given
screen, 20–40% of users may have read-only access. If these states aren't
designed, they're left to the developer — and the developer ships blank screens.

**Fix:** Every screen in the mockup must document:
1. Empty state: what text, what CTA, what illustration (if any)
2. Loading state: skeleton rows or spinner, at what granularity
3. Error state: toast message, inline error, or page error — and retry path
4. Permission-denied state: what the user sees when they have no access

---

## 12. Pagination + Infinite Scroll

**Pattern:** The list mockup notes "infinite scroll for usability" AND includes
pagination controls at the bottom.

**Why it fails:** Combining these patterns is contradictory and breaks the
browser's Back button behaviour. Frappe list views paginate (20 records per
page by default). Infinite scroll requires overriding the Frappe list
controller, which breaks bulk actions, URL sharing, and keyboard navigation.

**Fix:** Pick one. Frappe default: pagination (20 per page). Infinite scroll
is appropriate only for activity feeds and comment streams.

---

## 13. Dense Table on Mobile Without Card Fallback

**Pattern:** A 6-column data table with small text at 375px viewport width,
relying on horizontal scroll to access all columns.

**Why it fails:** Horizontal scroll on mobile is considered broken UX in the
frappe-ui-patterns skill. Frappe mobile users (HRMS self-service, CRM reps)
need to act on records, not scroll tables.

**Fix:** At ≤768px, convert dense list rows to stacked cards showing only
the 2–3 most critical fields (name, status, date). Secondary data in a
"tap to expand" row or a routed detail page.

---

## 14. Missing Workflow Banner

**Pattern:** A document that is "In Workflow" shows no indication of its
current workflow step, who it's assigned to, or what actions are available.

**Why it fails:** Users submit a document, it disappears into a workflow,
and they have no idea who has it or what happens next. Support tickets spike.

**Fix:** When `workflow_state` is set and the document is in a non-terminal
state, show a `surface-blue-1` / `ink-blue-7` banner with: step name,
assignee (if any), and a "View Workflow" link. Workflow action buttons
(Approve / Reject) go in `PageHeader` actions, not in the banner.

---

## 15. Multiple Primary Buttons

**Pattern:** Two or three `variant="solid"` buttons visible simultaneously —
"Save", "Submit", "Send for Approval" all at the same level.

**Why it fails:** frappe-ui-patterns explicitly states: one primary action per
screen. Two equally prominent buttons cause hesitation. Users don't know which
one to click. Frappe's own products always have one solid button (Submit,
Create, Save) and demote everything else to `variant="subtle"` or `variant="ghost"`.

**Fix:** One `variant="solid"` button is the primary action. Remaining actions
go in a `Dropdown` or as `variant="subtle"` secondary buttons. Destructive
actions use `variant="solid" theme="red"` and are placed last / separated visually.

## Sources

- frappe-ui-patterns/SKILL.md and references/ui-patterns.md (in-house): P1–P14
  rules, confirmation patterns, screen archetypes
- frappe-design-tokens/SKILL.md (in-house): common rationalizations and mistakes
- frappe/frappe-ui MIT License: `tailwind/tokens/radius.js` (radius values verified),
  Button component (variant/theme axes verified), Badge component (theme values verified)
- frappe/frappe (MIT License): `frappe/public/js/frappe/model/indicator.js` v16.35 and v16.51 —
  docstatus indicator colour mapping (item 9): Draft=red, Submitted=blue, Cancelled=red
- gstack design-checklist.md and design-html SKILL.md MIT: AI slop patterns referenced —
  emoji-decoration, generic hero copy, uniform pill radius — Frappe context and all examples are original
