# Frappe Design Mockup Rubric

Score each dimension 0–10. A dimension scoring ≤4 is a blocker for the
hand-off spec. Full score descriptions below.

Finding format: `[SEVERITY] (confidence: N/10) page:element — description`

## Scoring Quick Key

| Score | Meaning |
|---|---|
| 10 | Specific and complete; concrete example from a Frappe product exists |
| 7–9 | Mostly there; one gap that doesn't block usage |
| 5–6 | Half-done; visible to users, needs design decision |
| 3–4 | Significant gap; engineers will guess and guess wrong |
| 0–2 | Not designed; will ship broken or confusing |

---

## D1 — Hierarchy

**What a 10 looks like in Frappe:** The CRM Deal row: document name in `font-size-sm
font-weight-medium ink-gray-9`, company in `font-size-xs ink-gray-5` below, amount
right-aligned in `font-weight-semibold`, status badge at the end. Three distinct
weights, two colour tones, no decoration. Scanning takes 200ms per row.

**What fails:** Equal-weight text for name, date, and amount. The eye has no
obvious entry point. Everything shouts equally.

**Frappe-specific check:** Does the list row's primary text (name/ID) use
`ink-gray-9 font-weight-medium`? Is metadata (dates, company) in `ink-gray-5`?
Is the status badge visually lower priority than the record name?

---

## D2 — Information Density

**What a 10 looks like in Frappe:** Helpdesk ticket queue: 44px row height,
6 columns visible at 1280px, no decorative spacing, no card borders between
rows. Power users triage 50 tickets without scrolling.

**What fails:** 80px card-style rows with large padding and a shadow per row.
Fits 6 records where 20 should be visible. Wastes vertical space on whitespace
that communicates nothing.

**Frappe-specific check:** Is row height ≤48px for list views? Are all essential
columns visible at 1280px without horizontal scroll? Is padding using the token
scale (not arbitrary px)?

---

## D3 — Consistency with frappe-ui Patterns

**What a 10 looks like in Frappe:** Uses `DesktopShell` with `Sidebar` and
`SidebarRail` exactly as Frappe CRM does. `PageHeader` component for the title
row. `dialog.confirm` for destructive actions, not a hand-built `<Dialog>`.
Anyone who's used CRM knows where everything is.

**What fails:** A bespoke left-nav with custom icons, custom padding, and a
custom "active item" indicator that differs from every other Frappe app. Looks
and feels alien to anyone who uses Frappe daily.

**Frappe-specific check:** Shell type documented (DesktopShell/MobileShell/Desk/portal)?
No hand-built confirm dialogs? Confirmation uses `dialog.confirm` or `dialog.danger`?
Component list in the hand-off spec matches components frappe-ui actually exports?

---

## D4 — Token / Semantic Colour Use

**What a 10 looks like in Frappe:** Every colour reference in the mockup spec
is a named Espresso token: `bg-surface-gray-1` for the sidebar background,
`text-ink-gray-8` for body text, `border-outline-gray-2` for separators. No
hex values appear anywhere. Dark mode works for free.

**What fails:** `background: #F5F5F5` for the sidebar. Looks identical in light
mode, but the dark mode variant is wrong because the value never flips.

**Frappe-specific check:** Run the generator's `tokens.css` and confirm every
colour class in the mockup HTML maps to a CSS var that exists in `:root`. Any
`oklch()`, hex, or `rgb()` literal in the component CSS (outside token definitions)
is a fail.

---

## D5 — Interaction States

**What a 10 looks like in Frappe:** A Purchase Invoice list in Draft state:
- Empty: "No Purchase Invoices" with a "New Invoice" button
- Loading: skeleton rows at 44px height with shimmer animation
- Error: toast "Could not load records. Retry." — no blank screen
- Submitted: all fields read-only, Edit button absent, Cancel button present with danger style
- Permission-denied: user without `Purchase Manager` role sees a grayed "You don't have
  permission to view this document" message — no blank screen, no JS error

**What fails:** The mockup only shows the happy path with data. Engineers ship
blank screens for empty, white pages for errors, and enabled buttons for users
who can't use them.

**Frappe-specific check:** For every screen type, specify: empty state (copy + CTA),
loading state (skeleton or spinner), error state (toast or inline), and
permission-denied state (message + escalation path). For submittable Doctypes,
document which fields/buttons change at each docstatus.

---

## D6 — Accessibility

**What a 10 looks like in Frappe:** Every list row has `tabindex="0"` and responds
to Enter/Space. The search input is `<input type="search">` with `aria-label`.
Focus rings use `var(--focus-ring-default-light)` (visible 2px ring). All text
meets 4.5:1 contrast against its background token value.

**What fails:** `div` rows with no tabindex. No focus indicator (the default
browser outline was removed). `aria-label` missing on icon-only buttons.
`ink-gray-4` text on `surface-base` (fails WCAG AA contrast for small text).

**Frappe-specific check:** Verify contrast for `ink-gray-5` text (placeholder, metadata):
in light mode, `ink-gray-5` = `oklch(0.586 0 0)` on `surface-base` `oklch(1 0 0)` →
ratio ≈ 5.6:1 (AA pass for normal text, but borderline for 12px). At `ink-gray-4`
(`oklch(0.83 0 0)`) the ratio drops below 3:1 — don't use for text, only for
non-informational decoration.

---

## D7 — Responsive / Mobile

**What a 10 looks like in Frappe:** At 375px:
- Sidebar is hidden (CSS media query `display: none`)
- `MobileShell` + `MobileNav` tabs used instead
- List rows convert to stacked cards with primary info prominent
- Side detail panel becomes a separate route
- Touch targets ≥44px on every button and row

**What fails:** Desktop layout shrinks. Sidebar overlaps the main content.
Horizontal scroll appears. Buttons are 28px tall on mobile.

**Frappe-specific check:** Does the mockup document what happens at 375px for
each major element? Is there a `MobileShell`/`BottomSheet` strategy? Are touch
targets sized correctly? `frappe-ui` provides `useIsMobile()` — is the shell
switch documented in the hand-off spec?

---

## D8 — Dark Mode

**What a 10 looks like in Frappe:** Toggle `data-theme="dark"` on `<html>`.
Every surface, text, border, and shadow flips to its dark-mode equivalent.
No element reads the wrong tone. The sidebar background becomes `surface-sidebar`
dark value (`oklch(0.168 0 0)` approximately), body text becomes near-white.

**What fails:** The mockup looks fine in light mode, but the developer hardcoded
`#F5F5F5` for the sidebar. In dark mode it stays gray-200, which is lighter
than the page background — the UI looks inverted.

**Frappe-specific check:** Open the generator's mockup in dark mode via the
theme toggle. Confirm sidebar, page header, list rows, badges, and buttons all
look right. Flag any element that appears obviously wrong (too light, too dark,
or same colour in both modes).

---

## D9 — RTL Support

**What a 10 looks like:** Layout flips: sidebar moves to the right, list
columns reverse order, icons (back-arrow) point the other way. CSS uses
`margin-inline-start` not `margin-left`; `text-align: start` not `text-align: left`.

**What fails:** Fixed left-positioned sidebar stays left. Text that was
right-aligned for amounts now looks wrong. Icons don't flip.

**Frappe-specific check:** Does the hand-off spec note that logical CSS
properties should be used (`padding-inline-*`, `border-inline-*`, `start/end`)?
Is `dir="rtl"` tested on the mockup?

---

## D10 — i18n Expansion

**What a 10 looks like:** A label "Submit" becomes "Einreichen" (German, 50%
longer) or "إرسال" (Arabic). All labels have at least 30% horizontal expansion
room. No label is so narrow that it truncates at two characters.

**What fails:** Sidebar items are 220px wide and show "Purchase Invoice" in
English fine. In German, "Eingangsrechnung" wraps to two lines or gets
truncated. The sidebar item height becomes inconsistent.

**Frappe-specific check:** Are all strings short enough that a 40% expansion
fits without truncation or wrapping? Are sidebar items, column headers, and
button labels tested at maximum realistic translation length?

---

## D11 — Copy / Labels

**What a 10 looks like in Frappe:** "Submit Invoice" (action + object). "No
invoices found. Click + New Invoice to create one." (specific, direct, with
action). "Cancel Invoice?" dialog title; "Cancelling will reverse journal
entries. This cannot be undone." body.

**What fails:** "Submit" (what am I submitting?). "No data." (vague).
"Are you sure?" (sure about what?). "Welcome to the Purchase Invoice module."
(marketing copy in a back-office form — gstack AI slop pattern: generic hero copy).

**Frappe-specific check:** Every button label should include the object
("New Invoice", not "New"). Every empty state should name the missing thing
and give a CTA. No dialog should say "Are you sure?" without specifying the
irreversible action.

---

## D12 — Permission-Aware UI

**What a 10 looks like in Frappe:** The Purchase Invoice list is checked against
the user's `Purchase Manager` / `Purchase User` roles at design time. The mockup
documents two views: (a) Purchase Manager: Cancel button visible, all fields
editable; (b) Purchase User: Cancel absent, fields read-only. No blank screen
for denied access — a clear "You don't have permission" message with the contact
path to request it.

**What fails:** The mockup shows one view with all buttons enabled. Engineers
code it that way, then the PM reports "Account executives can click Cancel."
Adding permission checks after code is written is significantly harder.

**Frappe-specific check:** For each role that can access this screen, document:
which buttons are visible, which fields are editable, what the user sees if
they have no access at all.

---

## D13 — Docstatus Indicators

**What a 10 looks like in Frappe (sourced from frappe/public/js/frappe/model/indicator.js, both v16.35 and v16.51):**

Desk docstatus indicator colours (the canonical reference for screens that live next to or inside Desk):

| docstatus | Desk indicator colour | frappe-ui Badge equivalent | Meaning |
|---|---|---|---|
| 0 | Red | `fui-badge-red` / `Badge theme="red"` | Draft |
| 1 | Blue | `fui-badge-blue` / `Badge theme="blue"` | Submitted |
| 2 | Red | `fui-badge-red` / `Badge theme="red"` | Cancelled |

frappe-ui Badge has no built-in docstatus convention. Standalone frappe-ui SPAs may choose a different
mapping (e.g., gray for Draft is common), but must document it explicitly. Screens embedded in or
displayed next to Desk views must follow Desk's mapping above.

Hard rules regardless of surface: **Submitted is never green or teal.** **Cancelled is never orange.**
Every status badge must carry both a label and a colour — colour alone fails accessibility and
fails users who don't know the convention.

**What fails:** Submitted shown as green (looks like "success"). Cancelled shown as orange
(ambiguous). No docstatus badge at all on a submittable DocType list. Colour without a label.

---

## D14 — Workflow State Display

**What a 10 looks like in Frappe:** A Sales Order pending "Accounts Approval"
shows a `surface-blue-1` / `ink-blue-7` info banner: "Pending Accounts Manager
approval — assigned to Priya S." + "View Workflow" button. The workflow step
name and assignee are visible without opening a side panel. Workflow action
buttons (Approve / Reject) appear in `page-header` actions, not in the banner.

**What fails:** No visual indication of workflow state. Users click "Submit"
and get an error "Document is in workflow". They don't know who to contact.
Or: workflow states shown as arbitrary custom colours not in the frappe-ui token set.

---

## D15 — Screen Type Choice

**What a 10 looks like in Frappe:**

| Use case | Correct type | Wrong choice |
|---|---|---|
| Tabular financial data (AP aging, GST summary) | QueryReport or Script Report | Dashboard |
| Key metrics overview (total AR, open POs) | Dashboard | QueryReport |
| Record queue for operators (ticket list, job list) | List view + sidebar | Dashboard |
| Search + filter heavy workflows | List view | Report view |
| End-user self-service form | Web Form | Desk DocType form |

A screen-type mismatch usually surfaces as "users can't filter this data"
or "engineers can't export this to Excel" in the first sprint after launch.

**What fails:** Using a Dashboard for data that needs to be filtered, sorted,
and exported. Using a QueryReport for a workflow where users need to open records
by clicking rows. Mixing screen types within one logical workflow.

## Sources

- frappe/frappe-ui MIT License: token values from `tailwind/tokens/colors.js`
  (verified at v1.0.2: `ink-gray-5 = lightMode/gray/600 = oklch(0.586 0 0)`)
- frappe/frappe (MIT License): `frappe/public/js/frappe/model/indicator.js` v16.35 and v16.51 —
  D13 docstatus indicator colour mapping: Draft=red, Submitted=blue, Cancelled=red
- frappe-ui-patterns/references/ui-patterns.md (in-house): P1-P14, shell anatomy,
  screen archetypes, confirmation patterns
- gstack plan-design-review v2.0.0 MIT: 0-10 scoring structure concept —
  all Frappe content and examples are original
