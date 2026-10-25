---
name: frappe-design-consultation
description: "Brand-design consultation for Frappe surfaces where the design system is not given — website/portal themes, print format branding, frappe-ui SPA CSS-variable overrides, login page, and email templates. Use for establishing a visual identity on custom-branded Frappe surfaces before any frontend code is written."
---

# Frappe Design Consultation

## When to use

- Establishing a brand identity on a **website/portal** (Website Theme doctype, web templates, portal CSS)
- Designing **print-format** branding (invoice/PO PDF header, logo placement, colour accents)
- Overriding **frappe-ui SPA** colours and fonts via CSS variables or Tailwind preset extension
- Branding the **login page** or splash screen
- Defining **email template** typography and colour
- Pre-code brief when a client brings brand assets (logo, colours, font) to apply to Frappe surfaces

Not for plain Desk or stock frappe-ui screens — Espresso tokens are fixed there; use `frappe-design-tokens`.  
Not for mockup generation or scoring → `frappe-design-mockup-review`.  
Not for post-build visual QA on a live site → `frappe-design-review`.

## Inputs required

- Target surface(s): website/portal, print, frappe-ui SPA, login, email — one or many
- Audience: who sees this surface (customers, operators, public web)
- Existing brand assets: hex colours, font names, logo file (if any)
- Constraints: what Frappe controls must remain untouched (Desk, workflow, doctype behaviour)
- Live site URL or screenshots (optional) to research the existing brand

## Procedure

### 1. Brief

Collect: surface(s), audience, product positioning, must-stay-Frappe constraints.  
Ask once: *"What's the one thing someone should feel after seeing this for the first time?"*  
Record brand assets (hex values, font names, logo).

### 2. Research existing brand / site

If a live URL exists: screenshot the homepage and key pages (read-only); note colours, fonts, spacing density.  
Identify: primary hue, secondary accent, font family (display vs body), overall tone.  
If no brand assets: derive from the product's industry positioning and audience.

### 3. Propose ONE design direction

Produce a complete proposal — do not offer multiple directions for the client to pick.

| Element | Decision | Rationale |
|---------|----------|-----------|
| Display font | `<name>` | brand tone |
| Body font | `<name>` (or same) | readability |
| Primary colour | `#RRGGBB` | brand anchor |
| Background | `#RRGGBB` | surface base |
| Text | `#RRGGBB` | legibility |
| Accent | `#RRGGBB` | call-to-action |
| Radius | rounded / sharp | brand personality |
| Tone | one sentence | personality target |

Map to implementation targets (see [references/surface-map.md](references/surface-map.md)):

- **Website Theme**: `google_font`, `primary_color`, `background_color`, `text_color`, `button_rounded_corners`, `custom_scss`
- **frappe-ui SPA**: CSS variable overrides on `:root` (`--surface-*`, `--ink-*`, `--outline-*`) or `tailwind.config` `theme.extend`
- **Print format**: `@page` colour + logo CSS; `@media print` only — no runtime CSS variables
- **Login page**: Website Theme CSS covers it; custom splash via `apps/<app>/templates/includes/login_page.html` extension
- **Email**: inline `style=""` only; no external stylesheets

### 4. Contrast / accessibility gate

Compute (do not claim) WCAG contrast ratios before accepting the palette:

```
Linearise: C_lin = C/255; then: C_lin ≤ 0.04045 → C_lin/12.92 ; else → ((C_lin+0.055)/1.055)^2.4
L = 0.2126 R_lin + 0.7152 G_lin + 0.0722 B_lin
Contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Required minimums: normal text ≥ 4.5:1 (AA), large text / UI components ≥ 3:1 (AA).  
Check: primary on background, text on background, accent on background.  
Adjust any failing pair before proceeding.

### 5. Preview

Hand off to `frappe-design-mockup-review` for a rendered mockup:

```bash
node frappe-design-mockup-review/scripts/generate-mockup.js \
  --frappe-ui <bench>/apps/frappe-ui \
  --out /tmp/<feature>-mockup --title "<Feature>"
cd /tmp/<feature>-mockup && python3 -m http.server 8765
# open http://localhost:8765/mockup.html
```

Apply the brand palette as CSS variable overrides in `mockup.html` before reviewing.  
Score the result on readability, contrast, and brand consistency.

### 6. Write DESIGN.md

Write `DESIGN.md` into the app repo root:

```
SURFACE:        <website-theme | print | frappe-ui-spa | login | email>
AUDIENCE:       <who sees this>
FONT-DISPLAY:   <name>  (→ google_font field)
FONT-BODY:      <name or "same">
PRIMARY:        <#hex>  (→ primary_color Color doc / --surface-menublue for SPA)
BACKGROUND:     <#hex>  (→ background_color Color doc / --surface-white for SPA)
TEXT:           <#hex>  (→ text_color Color doc / --ink-gray-9 for SPA)
ACCENT:         <#hex>  (→ custom_scss var or CSS variable override)
RADIUS:         <rounded|sharp>  (→ button_rounded_corners)
TONE:           <one sentence>
WCAG AA:        primary on bg: N.N:1 ✓   text on bg: N.N:1 ✓
MOCKUP:         <path/to/mockup.html>
IMPLEMENTATION: see references/surface-map.md
```

## Verification

- [ ] All surfaces in scope have a mapped implementation target
- [ ] WCAG contrast ratios computed (not claimed) for primary/bg and text/bg pairs
- [ ] Ratios pass: normal text ≥ 4.5:1, UI components ≥ 3:1
- [ ] ONE design direction proposed with rationale; not a menu of options
- [ ] Google Font name verified loadable (match the Google Fonts URL slug format)
- [ ] `DESIGN.md` written to app repo root with all fields populated
- [ ] Mockup preview generated and spot-checked for palette fidelity

## Failure modes / debugging

| Symptom | Cause | Fix |
|---------|-------|-----|
| Website Theme CSS not applied to portal | `Website Settings` still points to old theme | Set `website_theme` in Website Settings via Desk or `bench --site <site> execute` |
| Font not loading | `google_font` uses display name; URL needs `+` for spaces | Match Google Fonts URL slug: `Roboto+Slab`, not `Roboto Slab` |
| frappe-ui SPA colours unchanged after CSS var override | Override placed before plugin.js token block | Place `:root` override after all CSS imports in the SPA's entry stylesheet |
| Print PDF ignores CSS variables | wkhtmltopdf / WeasyPrint don't resolve `var()` | Use literal hex / rgb values in all `@media print` and Jinja-rendered `<style>` blocks |
| Email colours broken in Gmail | External stylesheets and `<link>` stripped | Inline all CSS; use web-safe font stacks |

## Escalation

- Token values and CSS var names for Desk / Espresso screens → `frappe-design-tokens`
- Mockup generation, variant scoring, hand-off spec → `frappe-design-mockup-review`
- Post-build visual QA of the live portal or SPA → `frappe-design-review`
- Print format layout and Jinja rendering detail → `frappe-printing-templates`
- Web form UI and portal page structure → `frappe-web-forms`

## References

- [references/surface-map.md](references/surface-map.md) — Website Theme field-by-field SCSS map, frappe-ui CSS variable override patterns, print/email rules

## Guardrails

- **One direction, not a menu**: propose the right answer with rationale; don't present three palettes for the client to choose
- **WCAG gate is mandatory**: never skip contrast computation; a claimed "accessible" colour that fails is a P0 finding
- **Desk is off-limits for branding**: Website Theme SCSS is not scoped; overriding `--primary` at `:root` breaks Desk's own primary buttons
- **Print CSS must use literal values**: CSS variables don't resolve in PDF renderers (wkhtmltopdf, WeasyPrint)
- **Email must use inline styles**: `<link>` and `<style>` blocks are stripped by Gmail and Outlook
- **Google Font only**: third-party font hosting needs privacy review; only `google_font` is built into the Website Theme SCSS compilation pipeline

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We can eyeball contrast — our brand colours look accessible" | WCAG ratios are arithmetic; mid-tone palettes fail 4.5:1 regularly. Compute it. |
| "The Desk sidebar should use our brand colour too" | Website Theme SCSS is unscoped; it breaks Desk primary buttons site-wide. |
| "We'll finalize the font after we see how the site looks" | `google_font` drives the `@import` in the compiled CSS; a late change means full recompile + cache clear for every visitor. |
| "Just put the hex in `custom_scss` — simpler than creating a Color doc" | A hardcoded hex bypasses the `primary_color` → Bootstrap var pipeline and can't be changed without a recompile. |
| "The client approved the colours, so the contrast check is just a formality" | Client approval doesn't satisfy WCAG AA; a contrast failure is a legal risk in many jurisdictions. |
| "The mockup step is optional for small colour-only changes" | A five-minute preview catches palette clashes before they land on a live site with cached CSS. |
| "Email can load the font via `<link rel=stylesheet>`" | Gmail strips `<link>` and `@import` in `<head>`; fonts in email must fall back to web-safe stacks. |

## Red Flags

- Contrast ratios cited without showing the numerical computation
- Multiple parallel design directions proposed ("Option A, B, C — pick one")
- `custom_scss` in Website Theme contains raw hex values instead of SCSS/CSS variables
- Brand colours applied to Desk Sidebar or Navbar via Website Theme SCSS
- `DESIGN.md` missing the `WCAG AA` row
- Print format using CSS `var()` references (won't resolve in PDF renderers)
- Email template referencing an external stylesheet URL

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| `google_font: "Inter"` when Inter is the Frappe default | Template generates a redundant `@import` + `--font-stack` override with no visible change | Use a distinct typeface or leave `google_font` blank |
| Overriding `--surface-gray-*` in Website Theme `custom_scss` | Website Theme SCSS compiles to portal CSS; frappe-ui SPAs load their own token layer separately | Override frappe-ui vars in the SPA's own entry stylesheet, not in Website Theme |
| Editing `primary_color` on a standard (non-custom) theme | `validate_if_customizable()` throws `PermissionError` outside developer mode | Duplicate the theme first (`custom: 1`), then edit |
| Using `oklch()` in Website Theme `custom_scss` | Bootstrap 4 (the portal CSS stack) and older portal browsers may not support `oklch()` | Use hex or `rgb()` for Website Theme; `oklch()` is safe only in frappe-ui 1.0 SPAs |
