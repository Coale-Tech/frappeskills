<!-- Adapted from addyosmani/agent-skills (MIT): references/accessibility-checklist.md and skills/frontend-ui-engineering/SKILL.md -->
# Accessibility Checklist — Frappe Desk, Portal & frappe-ui

WCAG 2.1 AA checklist applied to Frappe Desk form customizations, portal/website pages, and
frappe-ui Vue 3 SPAs. Check each item before shipping a new screen or custom component.

## Keyboard Navigation

- [ ] All interactive elements (buttons, links, form controls) are reachable via `Tab`
- [ ] Tab order follows the visual reading order
- [ ] Focus is always **visible** — Espresso supplies `focus-visible:ring` on Button and form
  controls; never remove it with `outline: none` without a substitute
- [ ] Custom widgets implement keyboard controls: `Enter` or `Space` to activate, `Escape` to close
- [ ] No keyboard traps — `Tab` can leave every custom component

### Dialog focus management

**frappe-ui `Dialog` (Vue / Radix):** Radix Vue's `DialogContent` traps focus inside the dialog
while open and returns focus to the trigger on close — this works automatically when you use
`frappe-ui`'s `Dialog` component. Do not suppress it.

**Frappe Desk `frappe.ui.Dialog` (jQuery):** Desk dialogs call `focus_on_first_input()` on open
and restore `last_focus` on close. If you render a fully custom modal via raw Bootstrap, add
`role="dialog"`, `aria-modal="true"`, `aria-labelledby="<title-id>"`, and a manual focus-trap
to match the Desk behavior.

## Screen Readers

- [ ] All images have `alt` text (`alt=""` for decorative icons; frappe-ui icon `aria-hidden="true"` is set automatically)
- [ ] Every form input has an associated `<label>` — Frappe Desk form fields associate labels via `for`/`id`; verify custom HTML follows the same pattern
- [ ] Icon-only Buttons pass `aria-label` via the `ariaLabel` prop (`Button.vue` exposes it)
- [ ] Dynamic content changes (live regions, toast notifications) are announced: frappe-ui `toast` injects into a `role="status"` region
- [ ] Tables have `<th scope="col">` headers; do not use `<div>`-based grids for tabular data

## Visual Contrast — Espresso Tokens

Espresso semantic tokens are designed for WCAG AA contrast. Use semantic tokens; raw palette
values can fail contrast requirements in dark mode or under custom themes.

| Token pair | Use | Expected ratio |
|---|---|---|
| `text-ink-gray-9` on `bg-surface-base` | Body text | ≥ 7:1 (AAA) |
| `text-ink-gray-7` on `bg-surface-base` | Secondary text | ≥ 4.5:1 (AA) |
| `text-ink-gray-5` on `bg-surface-base` | Placeholder text | May fall below AA — prefer `ink-gray-6` |
| `text-ink-white` on `bg-surface-red-2` | Destructive button | Verify at design time |

Rules:
- [ ] Normal text contrast ≥ 4.5:1 (WCAG 1.4.3)
- [ ] Large text (18px+ or 14px+ bold) contrast ≥ 3:1
- [ ] Interactive components (inputs, buttons) against background ≥ 3:1 (WCAG 1.4.11)
- [ ] Color is never the **only** indicator of state — pair color with an icon, label, or border

## Forms and Error Handling

- [ ] Every `<input>`, `<select>`, `<textarea>` has a visible `<label>` or `aria-label`
- [ ] Required fields have `aria-required="true"` (or native `required`); do not rely on color alone
- [ ] Validation errors are associated with their field via `aria-describedby`
- [ ] Error summary placed above the form and programmatically focused on submit failure
- [ ] frappe-ui `FormControl` wraps inputs with labels; custom controls must replicate this pattern

```vue
<!-- frappe-ui pattern — label is associated automatically -->
<FormControl label="Customer" :modelValue="customer" @update:modelValue="customer = $event" />

<!-- Custom control — wire aria-describedby for error -->
<input :id="fieldId" :aria-describedby="errorId" aria-required="true" />
<p :id="errorId" role="alert" v-if="error">{{ error }}</p>
```

## Portal / Website Pages

Portal and `www/` pages are server-rendered HTML — accessible by default if semantic markup is used:

- [ ] `<html lang="<code>">` matches the site's default language
- [ ] One `<h1>` per page; headings do not skip levels
- [ ] `<nav>` landmarks for navigation regions
- [ ] Frappe's `frappe.website.utils.get_langs()` provides `lang` for multi-language pages
- [ ] Links are descriptive — not "Click here" or bare URLs
- [ ] Touch targets ≥ 44 × 44 px on mobile

## Desk Custom UI

When adding custom controls to Desk forms or Desk Pages:

- [ ] Use `frappe.ui.Dialog` instead of building raw modals — it manages focus correctly
- [ ] `frm.add_custom_button(label, fn)` renders a `<button>` — accessible by default
- [ ] Custom list-view columns that show icons or status indicators include text equivalents
- [ ] Avoid `$("div").on("click", fn)` for actions — use `<button>` to get keyboard support free

## Screen Reader Testing

```bash
# macOS — VoiceOver
# Press Cmd + F5 to enable; Tab through the page; verify announcements
# Chrome → DevTools → Accessibility tree for the ARIA tree

# Automated (CLI)
npx axe-core@latest --browser chrome <url>
npx pa11y <url>

# In-browser
# Chrome DevTools → Lighthouse → Accessibility (score + issues)
# Firefox → Accessibility Inspector → Check for issues
```

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| `<div @click="fn">` as a button | Not focusable, no keyboard | Use `<Button>` or `<button>` |
| `frappe.ui.Dialog` with raw `<div>` title | No `aria-labelledby` | Always pass `title:` option |
| Color-only error state | Invisible to color-blind users | Add icon + text beside the color |
| `focus: outline-none` without a substitute | Users cannot see focus | Use `focus-visible:ring` tokens |
| Icon-only Button with no `ariaLabel` | "Button" with no description | Pass `ariaLabel` prop |
| `tabindex="2"` or higher | Breaks natural order | Use `tabindex="0"` / `"-1"` only |
| Desk custom filter bar as `<span>` elements | Not keyboard-reachable | Use `<button>` or `<input>` |

## Sources

- `apps/frappe/frappe/public/js/frappe/ui/dialog.js` — `handle_focus`, `focus_on_first_input`, `last_focus` restore
- `apps/frappe/frappe/public/js/frappe/form/control.js` — label association for Desk form controls
- `apps/frappe/frappe/public/js/frappe/ui/toolbar/toolbar.js` — Desk nav `<button>` patterns
- `node_modules/frappe-ui/src/components/Dialog/Dialog.vue` — Radix Vue `DialogRoot` / `DialogContent` (ARIA managed by `@radix-vue/dialog`)
- `node_modules/frappe-ui/src/components/Button/Button.vue` — `ariaLabel` prop, `focus-visible:ring` classes
- `node_modules/frappe-ui/src/components/FormControl` — label-to-input wiring in frappe-ui form controls
- `apps/frappe/frappe/website/` — portal page rendering and `lang` utilities
