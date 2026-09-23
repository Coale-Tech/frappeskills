---
name: frappe-design-tokens
description: Apply the Espresso design system and Frappe design tokens for color, typography, spacing, radius, and shadow in Desk and frappe-ui interfaces. Use when styling any Frappe UI or auditing a screen for hardcoded values.
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
- Whether the app ships its own Tailwind config

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

```html
<div class="bg-surface-white text-ink-gray-8 p-4 rounded-md shadow-sm">
```

The preset ships with frappe-ui; extend it, never replace it.

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
- **Tailwind class has no effect**: the frappe-ui preset is not in the app's Tailwind config
- **CSS variable resolves to nothing**: the variable is v16-only, or the element is outside the Desk/app root
- **Component looks heavier than Desk's**: wrong shadow or radius step

## Escalation

- Layout and interaction design → [`frappe-ui-patterns`](../frappe-ui-patterns/SKILL.md)
- Component implementation → [`frappe-frontend-development`](../frappe-frontend-development/SKILL.md)
- Desk-specific styling → [`frappe-desk-customization`](../frappe-desk-customization/SKILL.md)

## References

- [references/design-tokens.md](references/design-tokens.md) - Color, typography, spacing, radius, shadow scales
- [references/espresso-design-system.md](references/espresso-design-system.md) - Espresso structure and semantic layer

## Guardrails

- **Never hardcode color, spacing, radius or font**: tokens only
- **Semantic tokens over palette values**: keeps theming and dark mode working
- **Extend the frappe-ui Tailwind preset**, never replace it
- **Check the token exists in the installed version** before using it
- **Match the Desk equivalent** — compare side by side before shipping

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Hardcoded hex values | Breaks theming and dark mode | CSS variable / Tailwind token |
| Raw palette token in components | Dark mode inverts incorrectly | Semantic token |
| Replacing the Tailwind preset | Loses the whole scale | Extend it |
| Arbitrary `px` spacing | Visual drift from Desk | Spacing scale |
| Custom shadows | Screens feel foreign | Shadow scale |
