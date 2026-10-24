---
name: frappe-design-tokens
description: "Apply the Espresso design system and Frappe design tokens for color, typography, spacing, radius, and shadow in Desk and frappe-ui interfaces. Use when styling any Frappe UI or auditing a screen for hardcoded values."
---

# Frappe Design Tokens (Espresso)

Style Frappe interfaces with the Espresso design system's tokens so screens
match Desk and frappe-ui without bespoke CSS.

## When to use

- Styling a Desk customization, portal page, or frappe-ui SPA
- Replacing hardcoded colors, spacing or fonts with tokens
- Adding dark-mode-safe styling
- Reviewing a screen for design-system compliance

## Inputs required

- Surface being styled (Desk, portal, SPA)
- Frappe version — Espresso is the v16 system
- Whether the app ships its own Tailwind config, and its pinned frappe-ui
  version (1.0 renames tokens — see the v2 migration reference)

## Procedure

### 0) Find the token, don't invent a value

Color, typography, spacing, radius and shadow scales, with the CSS variable and
Tailwind class for each: [references/design-tokens.md](references/design-tokens.md).

### 1) Use CSS variables in plain CSS/SCSS

```css
.summary-card {
  background: var(--bg-color);
  color: var(--text-color);
  padding: var(--padding-md);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
}
```

### 2) Use the Tailwind preset in frappe-ui apps

```js
// tailwind.config.js (Tailwind v3)
import frappeUIPreset, { content as frappeUIContent } from 'frappe-ui/tailwind'
// frappe-ui 1.0: use the exported `content` array — authoritative glob list
// frappe-ui 0.1.x: no `content` export; hand-write the glob instead
export default { presets: [frappeUIPreset], content: ['./src/**/*.{vue,js,ts}', ...frappeUIContent] }
```

```html
<div class="bg-surface-base text-ink-gray-8 border border-outline-gray-2 p-4 rounded-5">
<!-- 0.1.x: bg-surface-white … rounded-md (no numbered radius, no surface-base) -->
```

Import `frappe-ui/tailwind`, not `frappe-ui/src/...` (outside the package
`exports` map). Semantic families: `ink-*`, `surface-*`, `outline-*`; icons are
`lucide-<name>` classes; dark mode is `[data-theme="dark"]` driven by `useColorScheme()` —
[references/frappe-ui-tailwind-tokens.md](references/frappe-ui-tailwind-tokens.md).
Migrating an app to the v2 token names:
[references/frappe-ui-tokens-v2-migration.md](references/frappe-ui-tokens-v2-migration.md).

`useColorScheme()` stamps `data-theme="dark"` on `<html>` and briefly adds `.no-transition`
during the swap to suppress a full-page cross-fade. `frappe-ui/style.css` provides that rule —
apps that skip the import lose the suppression. Do not roll a custom theme switcher.
The preset also includes `future.hoverOnlyWhenSupported: true` so `hover:` styles activate
only on pointer-capable devices (no ghost fills on touch).

**Chart tokens**: components from `frappe-ui/charts` read `--chart-*` CSS vars for series colors.
Use `useChartTokens(plotEl)` and `paletteColors()` for custom ECharts plots — never hardcode hex.
See [../frappe-reports/references/data-visualization.md](../frappe-reports/references/data-visualization.md).

### 3) Respect the semantic layer

Use semantic tokens (`--text-color`, `--bg-color`, `surface-*`, `ink-gray-*`)
rather than raw palette values, so dark mode and theming keep working —
[references/espresso-design-system.md](references/espresso-design-system.md).

### 4) Audit for drift

```bash
grep -rnE "#[0-9a-fA-F]{6}|font-family:|px\)" apps/<app>/<app>/public apps/<app>/frontend/src 2>/dev/null
```

Every hit is a candidate token replacement.

## Verification

- [ ] No hardcoded hex colors in app CSS/SCSS or Vue components
- [ ] Spacing uses the scale, not arbitrary pixel values
- [ ] Typography uses token sizes and weights
- [ ] Screen renders correctly in dark mode
- [ ] Component matches the equivalent Desk/frappe-ui element side by side

## Failure modes / debugging

- **Colors look right in light mode, wrong in dark**: a raw palette value was used instead of a semantic token
- **Tailwind class has no effect**: the frappe-ui preset is missing, frappe-ui source is not in `content`, or the app is on Tailwind v4
- **Class existed before a frappe-ui upgrade, now unstyled**: renamed by the v2 tokens; run the migration codemod
- **CSS variable resolves to nothing**: the variable is v16-only, or it was removed in 16.51 (see removed list below), or the element is outside the Desk/app root
- **Component looks heavier than Desk's**: wrong shadow or radius step
- **(16.51) Removed CSS variables**: `--appreciation-color`, `--appreciation-bg`, `--criticism-color`, `--criticism-bg`, `--error-bg`, `--error-border`, `--date-active-text`, `--date-active-bg`, `--date-range-bg`, `--timeline-badge-color`, `--timeline-badge-bg`, `--user-mention-bg-color`, `--group-mention-bg-color`, `--skeleton-bg`, `--progress-bar-bg` — removed from `css_variables.scss`. Replace with direct palette tokens: `--red-50` for old `--error-bg`, `--red-400` for `--error-border`, `--gray-100` for `--skeleton-bg`, `--primary` for `--progress-bar-bg`, etc.

## Escalation

- Layout and interaction design → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- Component implementation → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Visual regression after token changes → [`frappe-browser-testing`](../frappe-browser-testing/SKILL.md)
- Desk-specific styling → [`frappe-desk-customization`](../frappe-desk-customization/SKILL.md)

## References

- [references/design-tokens.md](references/design-tokens.md) - Desk CSS variables: color, typography, spacing, radius, shadow
- [references/espresso-design-system.md](references/espresso-design-system.md) - Espresso structure, Desk vs frappe-ui comparison
- [references/frappe-ui-tailwind-tokens.md](references/frappe-ui-tailwind-tokens.md) - frappe-ui preset classes: colors, type scale, radius, shadow, icons, dark mode, `data-*` hooks
- [references/frappe-ui-tokens-v2-migration.md](references/frappe-ui-tokens-v2-migration.md) - `migrate-tokens-v2` codemod and rename tables

## Guardrails

- **Never hardcode color, spacing, radius or font**: tokens only
- **Semantic tokens over palette values**: keeps theming and dark mode working
- **Extend the frappe-ui Tailwind preset**, never replace it
- **Check the token exists in the installed version** before using it
- **Match the Desk equivalent** — compare side by side before shipping

<!-- Adapted from addyosmani/agent-skills (MIT): anti-rationalization pattern -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know the hex value, it's just one hardcoded color" | One hardcoded value breaks dark mode; every additional hardcode compounds the drift. |
| "The token doesn't look quite right, I'll nudge it with an inline style" | Nudging tokens defeats theming; pick the nearest semantic token or propose a system change. |
| "Dark mode is a stretch goal, I'll handle it later" | Semantic tokens give dark mode for free; raw palette values require a full revisit when it comes. |
| "I'll replace the Tailwind preset with my own, the Frappe one is too opinionated" | Replacing the preset drops the entire Espresso token scale; use `extend:` to add project-specific values. |
| "The spacing is close enough, I'll use `12px` instead of the scale step" | Arbitrary pixel values accumulate into visible drift from Desk and across every component. |
| "I'll import directly from `frappe-ui/src/tailwind/preset`" | That path is outside the package `exports` map and silently breaks on any frappe-ui upgrade. |

## Red Flags

- Hex colors (`#...`), `rgb(...)`, or named CSS colors in any app CSS, SCSS, or Vue `<style>` block
- Arbitrary pixel values for `padding`, `margin`, or `border-radius` outside the Espresso token scale
- `import ... from 'frappe-ui/src/...'` deep imports anywhere in the app
- Tailwind `presets:` array replaced rather than extended
- `rounded-md` or `rounded-lg` in a frappe-ui 1.0 app (deprecated aliases; use `rounded-5` / `rounded-6`)
- A CSS variable used without confirming it exists in the installed frappe version

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Hardcoded hex values | Breaks theming and dark mode | CSS variable / Tailwind token |
| Raw palette token in components | Dark mode inverts incorrectly | Semantic token |
| Replacing the Tailwind preset | Loses the whole scale | Extend it |
| `import … from 'frappe-ui/src/tailwind/preset'` | Not in `exports`; breaks on upgrade | `frappe-ui/tailwind` |
| Named radius (`rounded-md`, `rounded-lg`) in 1.0 apps | Deprecated aliases (ADR 0006) | Numbered scale: `rounded-5`, `rounded-6` |
| Arbitrary `px` spacing | Visual drift from Desk | Spacing scale |
| Custom shadows | Screens feel foreign | Shadow scale |
