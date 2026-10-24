# Design QA Rubric

Ten dimensions for scoring a Frappe UI after implementation.
Score each 0–10; record what would push a 5 to a 10.

## Scoring guide

| Score | Meaning |
|---|---|
| 9–10 | No visible issues; matches or exceeds the approved mockup |
| 7–8 | Minor issues; acceptable to ship with a follow-up task |
| 5–6 | Noticeable defects; should fix before merging to main |
| 3–4 | Multiple visible failures; blocks merge |
| 0–2 | Broken; not shippable in this state |

## Dimensions

### 1. Hierarchy

Is the most important content or action visually dominant?

- **Frappe Desk:** docstatus indicator (Draft/Submitted/Cancelled) must be visible without scrolling on the form header. The workflow action button must be the most prominent action.
- **frappe-ui SPA:** one `variant="solid"` button per screen. Secondary actions use `variant="subtle"`.
- **Portal:** the page title and primary action (`<button class="btn btn-primary">`) are above the fold.

**10:** One dominant element per screen; all other elements recede proportionally.  
**5:** Two equally prominent elements compete; user must read to decide.  
**0:** No visual hierarchy; wall of equal-weight text or buttons.

### 2. Density

Row height and spacing match Frappe Desk conventions.

- List rows: `--list-row-height` = 30 px for the header row; data rows are content-driven. Match Desk density visually rather than targeting a fixed pixel value.
- Form fields: standard frappe input height (`var(--input-height)`).
- No double-stacked margins (two elements each with a 24 px margin meeting at 48 px gap).

**10:** Matches Desk density exactly side-by-side.  
**5:** Slightly more padded or tighter than Desk; noticeable but not jarring.  
**0:** Fields so dense they overlap, or padded so much they require scrolling for 4 fields.

### 3. Consistency

Selectors, dialogs, toasts, and UI language match Desk conventions.

**Verified selectors (Frappe 16.51+):**
- Dialog primary button: `.btn-modal-primary` (was `.btn-primary` ≤16.35)
- Toast container: `.es-toast-container` (was `#alert-container` ≤16.35)
- Dialog variants: `dialog.confirm`, `dialog.danger` — NOT `dialog.alert` (does not exist)
- Toast: `frappe.show_alert({ message, indicator })` or `frappe.ui.toast()` (16.51+)

**10:** Every interaction uses the Desk-standard component; new components are visually indistinguishable from built-in ones.  
**5:** Some custom dialogs or inline confirmation that bypass `dialog.confirm`.  
**0:** Custom alert boxes (native `window.alert`) or hand-built confirmation dialogs.

### 4. Tokens

No hardcoded values; all colors, spacing, radius, and shadows use the Espresso token scale.

Check via `design-lint.js`: any hex/rgb hit is a P2 finding. Each deprecated-16.51-var hit is P1.

**Deprecated CSS vars in 16.51** (moved to `legacy.css` shim; removed from `css_variables.scss` — do not use in new code):
`--appreciation-color`, `--appreciation-bg`, `--criticism-color`, `--criticism-bg`,
`--error-bg`, `--error-border`, `--date-active-text`, `--date-active-bg`,
`--date-range-bg`, `--timeline-badge-color`, `--timeline-badge-bg`,
`--user-mention-bg-color`, `--group-mention-bg-color`, `--skeleton-bg`,
`--progress-bar-bg`.

**10:** Zero lint hits; every value traces to a token.  
**5:** A handful of rgb() values in component scoped styles; easy to fix.  
**0:** Hex colors throughout; dark mode and theming are broken.

### 5. States

All four states are intentional and informative.

| State | Frappe check |
|---|---|
| Empty | `<ListEmptyState>` (frappe-ui v1) or equivalent with a CTA |
| Loading | Skeleton rows or `<LoadingIndicator>` (not blank) |
| Error / 403 | `frappe.throw()` surfaces a user message; 403 shows "Not permitted" |
| Long text | 100-character field values don't overflow containers; truncate with `text-ellipsis` |

**10:** Each state is visually distinct and guides the user's next action.  
**5:** Loading exists but empty state is blank.  
**0:** All non-loaded states show a blank page.

### 6. Accessibility

- WCAG 2.1 AA: body text contrast ≥ 4.5:1, large text/UI components ≥ 3:1.
- Every icon-only button has `aria-label` or `title`.
- Focus ring is visible (do not suppress `outline` without a replacement).
- Keyboard navigation reaches every interactive element.

Verify with `design-lint.js` (`icon-aria-label` check) and browser DevTools accessibility panel.

**10:** Zero accessibility findings; tab order is logical; screen reader announces all interactive elements.  
**5:** Most elements accessible; one or two icon-only buttons missing labels.  
**0:** No focus ring; interactive content unreachable by keyboard.

### 7. Responsive (390 px mobile)

Test at 390 × 844 logical pixels (iPhone 14). For Frappe Desk pages this
means the Responsive Desk view; for frappe-ui SPAs this means `MobileShell`.

- No horizontal scroll.
- Actions visible or collapsed into a `…` `Dropdown`.
- Data table converts to card/list view (use `frappe-ui/list`, not a raw `<table>`).
- Touch targets ≥ 44 × 44 px.

See `frappe-ui-patterns/references/mobile-patterns.md` for the desktop→mobile translation.

**10:** Mobile layout is a purposeful redesign, not a squished desktop.  
**5:** Usable but some truncated text; minor horizontal scroll on one component.  
**0:** Page is entirely unusable; horizontal scroll covers content.

### 8. Dark mode

Toggle `data-theme="dark"` on `<html>`. All custom colors should invert correctly.

Common failures:
- Raw `#FFFFFF` backgrounds that stay white in dark mode.
- `background-color: white` on a card instead of `var(--bg-color)`.
- `color: #333` on text instead of `var(--text-color)`.

**10:** Zero visible light-mode artifacts in dark theme.  
**5:** One or two elements have hardcoded backgrounds; easily fixed.  
**0:** Most of the UI is invisible (white text on white background or vice versa).

### 9. RTL

Toggle `dir="rtl"` on `<html>`. Frappe ships Arabic and Hebrew.

- Text direction flips.
- Icons that imply direction (back arrow, chevrons) flip horizontally.
- Form field labels align to the right.
- Margin/padding using `left/right` properties breaks; use `start/end` (logical properties) or Tailwind's `ms-`/`me-` utilities.

**10:** Full RTL support; layout is mirrored correctly.  
**5:** Most text flips; a few hardcoded `margin-left` values misalign elements.  
**0:** Entire layout stays LTR; text overlaps UI chrome.

### 10. Print / PDF (print formats only)

Frappe print formats render to PDF via Chrome headless print.

- Page margins: default Frappe print CSS applies `8mm` margins; custom templates must not remove them.
- Table columns must not overflow the page width.
- `@page` rule should specify `size: A4` or `size: Letter`.
- Avoid `position: fixed` elements in print view; they repeat on every page.
- Verify via `frappe.utils.print_pdf()` or Chrome `⌘P → Save as PDF`.

**10:** PDF renders cleanly on A4; no clipped columns; correct page breaks.  
**5:** Minor margin drift; one table slightly too wide.  
**0:** Content clipped by page edges; fixed elements stamped on every page.

## Viewport matrix reference

| Label | Width | Device model |
|---|---|---|
| desktop | 1440 px | Standard HD monitor |
| laptop | 1280 px | 13-inch laptop |
| tablet | 768 px | iPad portrait |
| mobile | 390 px | iPhone 14 logical |

Test mobile in iOS PWA standalone mode for safe-area inset verification
(see `frappe-ui-patterns/references/mobile-patterns.md`).

## Sources

Verified against:
- Frappe 16.51.1 (`apps/frappe/frappe/public/js/frappe/ui/dialog.js` line 196 — `.btn-modal-primary`)
- Frappe 16.51.1 (`apps/frappe/frappe/public/js/frappe/ui/components/toast.js` — `.es-toast-container`)
- Frappe 16.51.1 (`apps/frappe/frappe/public/scss/desk/css_variables.scss` line 29 — `--list-row-height: 30px`)
- Frappe 16.51.1 (`apps/frappe/frappe/public/scss/desk/list.scss` line 211 — `.list-row` class)
- Frappe 16.51.1 (`apps/frappe/frappe/public/css/espresso/legacy.css` — deprecated vars still present as compatibility shim)
- frappe-ui 1.0.2 (`apps/frappe-ui/src/components/MobileShell/MobileShell.vue` — PageHeaderTarget safe-area padding)
- frappe-ui 1.0.2 (`apps/frappe-ui/src/components/MobileNav/MobileNav.vue` — home indicator clearance)
- frappe-ui 1.0.2 (`apps/frappe-ui/src/style.css` — `html` min-height `min(100lvh, ...)` in standalone PWA)
- frappe-ui 1.0.2 (`apps/frappe-ui/src/utils/iconString.ts` — FeatherIcon removed note, ADR-0008)
- frappe-design-tokens skill — deprecated 16.51 CSS variable list
