# Frappe Design Surface Map

Implementation targets for each branded Frappe surface.

## Website / Portal Theme (Website Theme doctype)

### Fields that drive the compiled CSS

| Field | Type | CSS effect |
|-------|------|------------|
| `google_font` | Data | Generates `@import url(googleapis.com/css2?family=<name>:<font_properties>)` and sets `--font-stack` on `:root` |
| `font_properties` | Data | Appended to Google Fonts URL (default: `wght@300;400;500;600;700;800`) |
| `font_size` | Data | Sets `body { font-size: <value> }` after Bootstrap import |
| `primary_color` | Link → Color | Resolves `$primary` Bootstrap SCSS var → `:root { --primary; --primary-color }` |
| `text_color` | Link → Color | Resolves `$body-text-color` → `:root { --text-color; --text-light }` |
| `background_color` | Link → Color | Resolves `$body-bg` → `:root { --bg-color }` |
| `dark_color` | Link → Color | Resolves `$dark` Bootstrap var (navbar, badges) |
| `light_color` | Link → Color | Resolves `$light` Bootstrap var |
| `button_rounded_corners` | Check | `$enable-rounded`; when 0 → all `--border-radius-*: 0px` on `:root` |
| `button_shadows` | Check | `$enable-shadows` |
| `button_gradients` | Check | `$enable-gradients` |
| `custom_overrides` | SCSS | Injected **before** Bootstrap `@import` — Bootstrap variable overrides go here |
| `custom_scss` | SCSS | Injected **after** Bootstrap `@import` — free selectors and rules |

Color field values are resolved via `frappe.db.get_value('Color', <link>, 'color')` at compile time, not runtime.

### SCSS compilation pipeline

1. `WebsiteTheme.generate_bootstrap_theme()` renders `website_theme_template.scss` (Jinja) to produce a complete SCSS string
2. Calls `node generate_bootstrap_theme.js <output.css> <scss_content>` from the frappe app source path — compiles Bootstrap 4 SCSS to CSS
3. Output CSS lands at `<site>/public/files/website_theme/<scrubbed_name>_<hash>.css`
4. `theme_url` field stores the path; `Website Settings.website_theme` references the active theme
5. After saving, `clear_cache()` is called — but browser-cached CSS may still serve the old file until TTL expires

### Standard vs custom themes

`custom: 1` is required to save edits. Standard themes raise a `PermissionError` on save outside developer mode. Duplicate the standard theme first; `frappe.copy_doc` or the Desk **Duplicate** action sets `custom: 1` automatically.

### Activation

Set the active theme via Desk (Website Settings → Website Theme) or:

```python
# bench --site <site> execute
doc = frappe.get_doc("Website Settings", "Website Settings")
doc.website_theme = "<Theme Name>"
doc.ignore_validate = True
doc.save()
frappe.db.commit()
```

## frappe-ui SPA Theme Override (1.0.x)

The frappe-ui Tailwind preset (`frappe-ui/tailwind` → `preset.js`) sets:

- **Dark mode selector**: `[data-theme="dark"]` on `<html>` (verified in `preset.js`)
- **Semantic CSS variables**: emitted on `:root` by `plugin.js` for every entry in `tokens.js#cssVariables`; names follow `--<category>-<name>` (e.g., `--surface-white`, `--surface-gray-1`, `--ink-gray-9`, `--outline-gray-2`)

### Option A — CSS variable override (preferred for brand theming)

Patches the semantic layer that all frappe-ui components already read; no component code changes needed.

```css
/* In the SPA's entry stylesheet, AFTER importing frappe-ui styles */
:root {
  --surface-white:  #f8f4ef;   /* page background */
  --surface-gray-1: #f2ede7;   /* subtle card / sidebar bg */
  --ink-gray-9:     #1a1208;   /* primary text */
}
[data-theme="dark"] {
  --surface-white:  #1c1813;
  --ink-gray-9:     #f0ebe3;
}
```

Place the override block **after** all CSS imports so the specificity wins over `plugin.js`'s `:root` block.

### Option B — Tailwind config extension (build-time; utility classes only)

```js
// tailwind.config.js
import frappePreset from 'frappe-ui/tailwind'
export default {
  presets: [frappePreset],
  theme: {
    extend: {
      colors: {
        brand: '#4f46e5',  // adds bg-brand, text-brand utilities
      },
    },
  },
}
```

Note: Tailwind v3 does **not** merge `content` from presets; consuming apps must spread the `content` export from `frappe-ui/tailwind` in their own config (see `preset.js` comment).

### Semantic token categories (from plugin.js / colorPalette.js)

| Category prefix | Examples | Use |
|-----------------|----------|-----|
| `--surface-*` | `--surface-white`, `--surface-gray-1` … `--surface-gray-4` | Page / card backgrounds |
| `--ink-*` | `--ink-gray-9`, `--ink-gray-7`, `--ink-gray-5` | Text colours |
| `--outline-*` | `--outline-gray-2`, `--outline-gray-3` | Borders and dividers |

The `[data-theme="dark"]` block on `<html>` flips all semantic vars to their dark-mode values automatically.

## Login Page / Splash

The Frappe login page is a portal route rendered with the active Website Theme. The same CSS applies.

For a custom splash (logo, background image, tagline):

- Extend `apps/<app>/templates/includes/login_page.html` using `{% extends %}` — do not replace the base file
- Add CSS via the Website Theme `custom_scss` field to avoid a separate template compile step

## Print Format Branding

PDF renderers (wkhtmltopdf, WeasyPrint) do **not** resolve `var()` CSS references.

Rules:

- Use literal hex or `rgb()` values in all `@media print` and Jinja-rendered `<style>` blocks
- Logo: `<img src="{{ frappe.utils.get_url() }}/files/logo.svg" style="height:40px;">` — serve from the site's public files
- Fonts: use a system-safe stack, or embed via `@font-face` with `src: url(data:...)` for offline-safe output
- Avoid `oklch()` in print CSS

Full print format layout workflow: `frappe-printing-templates`.

## Email Template Branding

Most email clients (Gmail, Outlook) strip `<link>`, `@import`, and `<style>` blocks from `<head>`.

Rules:

- All CSS must be **inline**: `style="..."` on every element
- Font: declare a web-safe fallback stack (e.g., `font-family: 'Helvetica Neue', Arial, sans-serif`)
- Colours: literal hex only
- Max width 600 px; single-column layout is the most compatible

Full email template workflow: `frappe-printing-templates`.

## Sources

- `apps/frappe/frappe/website/doctype/website_theme/website_theme.json` — field definitions verified
- `apps/frappe/frappe/website/doctype/website_theme/website_theme_template.scss` — SCSS template and Jinja vars verified
- `apps/frappe/frappe/website/doctype/website_theme/website_theme.py` — `generate_bootstrap_theme()` Node command verified; `clear_cache_if_current_theme()` on save verified
- `apps/frappe-ui/tailwind/preset.js` — dark mode selector `[data-theme="dark"]`; `presets` merge behaviour documented in source comment
- `apps/frappe-ui/tailwind/plugin.js` — CSS variable emission from `cssVariables`; semantic token naming pattern
- `apps/frappe-ui/tailwind/colorPalette.js` — semantic colour generation and `--<category>-<name>` CSS variable pattern
