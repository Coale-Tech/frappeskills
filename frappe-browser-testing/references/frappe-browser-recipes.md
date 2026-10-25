# Frappe Browser Recipes

Verified selectors, JS globals, login flow, and network inspection patterns for
Frappe v16 Desk and portal pages.

## Login flow

```
POST /api/method/login
  Body: usr=<email>&pwd=<password>
  Response 200 → session cookie set (sid)

Navigate to /app → Desk SPA loads
```

With Playwright:
```js
await page.goto('http://localhost:8000/login');
await page.fill('#login_email', 'browser-tester@example.com');
await page.fill('#login_password', 'password');
await page.click('.btn-login');
await page.waitForURL('**/app**');  // Desk SPA loaded
```

## Frappe JS globals (verified in source)

| Global | Source file | Notes |
|--------|------------|-------|
| `frappe.boot` | `frappe/public/js/frappe/desk.js` | Loaded at login; contains `user`, `roles`, `modules`, `csrf_token`, `workspace_sidebar_item`, `setup_complete`, `navbar_settings` |
| `frappe.csrf_token` | `frappe/public/js/frappe/desk.js` (line ~84, ~575) | Set from `frappe.boot.csrf_token`; refreshed via `broadcast` channel on token rotation |
| `frappe.call(opts)` | `frappe/public/js/frappe/request.js` | Sends `X-Frappe-CSRF-Token` header automatically (line 267) |
| `cur_frm` | `frappe/public/js/frappe/ui/dropdown_console.js`, `form/script_helpers.js` | The active Form controller; `undefined` outside a form route |
| `frappe.ui` | `frappe/public/js/frappe/ui/sidebar/sidebar_item.js` et al. | Namespace for Dialog, FilterGroup, toolbar, sidebar |
| `frappe.ready(fn)` | `frappe/templates/base.html` (line 49) | **Portal/web pages only** — queues callbacks run after DOM+JS init; not available in Desk SPA |

## Desk routes

```
/app                              → Home workspace
/app/<doctype-kebab>              → List view  (e.g. /app/sales-order)
/app/<doctype-kebab>/<name>       → Form view  (e.g. /app/sales-order/SO-0001)
/app/query-report/<Report Name>   → Query/Script report
/app/form/<DocType>/<name>        → Alternate form route (older style)
```

## frappe.call network shape

Every Desk API call posts to:
```
POST /api/method/<dotted.python.path>
Headers:
  X-Frappe-CSRF-Token: <frappe.csrf_token>
  X-Requested-With: XMLHttpRequest
Body (form-encoded):
  cmd=<method>&arg1=value1&...

Response (always HTTP 200 unless hard crash):
{
  "message": <return value>,
  "exc": "<traceback string or null>",
  "_server_messages": "[{\"message\": \"...\"}]"
}
```

A non-null `exc` means the call raised a Python exception even though HTTP status is 200.
Check `_server_messages` for user-visible validation messages.

## Whitelisted method requirements

For a method to respond to `frappe.call`:
```python
@frappe.whitelist()           # authenticated users only
def my_method(arg):
    ...

@frappe.whitelist(allow_guest=True)  # unauthenticated access
def public_method():
    ...
```

Missing `@frappe.whitelist()` → HTTP 404.  
`allow_guest=True` missing for an unauthenticated call → HTTP 403.

Source: `apps/frappe/frappe/client.py` (decorator usage, lines 26–259).

## Console error patterns

```
Uncaught (in promise) Error: Not permitted
  → frappe.call returned 403; check whitelist and roles

Uncaught TypeError: cur_frm is undefined
  → Script ran before the form controller initialised; use frm.refresh_field()
    inside the form's JS refresh hook, not at page load

frappe.call failed: 409 Conflict
  → TimestampMismatchError; user edited a stale doc; instruct reload
```

## Playwright wait patterns for Frappe

```js
// Wait for List view to load
await page.waitForSelector('.list-row');

// Wait for Form view to load
await page.waitForSelector('.page-title');

// Wait for a frappe.call to complete (network idle)
await page.waitForLoadState('networkidle');

// Read console errors
page.on('console', msg => {
  if (msg.type() === 'error') console.log('Console error:', msg.text());
});
```

## Selector changes (16.51+)

| Element | ≤16.35 selector | 16.51+ selector |
|---------|-----------------|-----------------|
| Dialog primary button | `.btn-primary` (inside dialog) | `.btn-modal-primary` |
| Toast/alert container | `#alert-container` inside `#dialog-container` | `.es-toast-container` |
| Toast element type | `.desk-alert.green` | `.es-toast[data-type="success"]` |

**Dialog rule**: always use `dialog.get_primary_btn()` rather than jQuery selectors — the method is API-stable across versions.

**Toast**: `frappe.show_alert({ message, indicator })` still works (it is now an alias for `frappe.ui.toast()`), but DOM assertions must target `.es-toast-container` in 16.51+. (16.51)

## iOS / WebKit emulation

### What Playwright Chromium device emulation covers

Using `devices['iPhone 13']` (or any iPhone preset) in Playwright runs
**Chromium** with an iPhone-sized context — not Safari or WebKit. It provides:

- Viewport size (e.g. 390 × 844 px) and device pixel ratio
- iPhone user-agent string (so UA-sniffing code sees iOS)
- `isMobile: true` (viewport meta tag respected, touch events enabled)
- `hasTouch: true`
- Locale, timezone, geolocation, color-scheme (via `page.emulateMedia`)

These are sufficient for layout regression tests, breakpoint checks, and
Frappe-specific responsive behavior (e.g. `MobileShell` rendering at 390 px).

### What Chromium device emulation cannot reproduce

The following behaviors are Safari/WebKit-only or hardware-only and **cannot be
reproduced by Playwright Chromium device emulation**:

- **WebKit rendering engine**: Chromium runs underneath; CSS quirks unique to
  WebKit (e.g. `-webkit-overflow-scrolling`, WebKit-only prefixes) are absent.
- **`env(safe-area-inset-*)`**: Chromium returns `0` for all safe-area insets;
  only the iOS OS + real Safari hardware geometry supplies non-zero values.
- **`display-mode: standalone`**: there is no way to install a PWA in Playwright
  Chromium; `@media (display-mode: standalone)` always evaluates `false`.
- **Dynamic viewport (toolbar show/hide)**: Chromium has no collapsing address
  bar; `100svh` / `100dvh` / `100lvh` all equal the fixed viewport height.
- **iOS Safari toolbar chrome**: the translucent address bar, swipe-back
  gesture, and home indicator are OS-level UI, not reproduced by emulation.
- **Momentum / rubber-band scrolling**: `-webkit-overflow-scrolling:touch` and
  iOS overscroll physics are WebKit-native and absent in Chromium.

### Playwright WebKit project

Adding `project: { name: 'webkit', use: { browserName: 'webkit' } }` runs
Playwright's own WebKit build. This **does** exercise the WebKit rendering
engine and catches many WebKit-only CSS bugs. It still **does not**:
- Provide non-zero `env(safe-area-inset-*)` values (no hardware insets)
- Emulate `display-mode: standalone` (no PWA installation)
- Reproduce iOS Safari's navigation chrome or toolbar behavior
- Run on iOS/iPadOS hardware (desktop WebKit only)

Source: Playwright emulation docs — <https://playwright.dev/docs/emulation>

### Verifying safe-area and standalone behavior

Safe-area insets, PWA standalone mode, and iOS-specific viewport sizing
(including the iOS 26 `MobileShell` fix) **require a real iPhone or Xcode
Simulator** running actual Safari:

1. Open the app in Safari on iOS and tap **Share → Add to Home Screen**.
2. Launch from the home screen icon to enter standalone mode.
3. Check `env(safe-area-inset-top/bottom)` values via Safari Web Inspector.
4. Verify `MobileShell` header clears the notch and `MobileNav` clears the
   home indicator — these cannot be verified in Playwright.

See also: [`frappe-ui-patterns/references/mobile-patterns.md`](../../frappe-ui-patterns/references/mobile-patterns.md) — iOS PWA checklist and safe-area requirements.


## Sources

Verified against Frappe v16.35.0 and v16.51.1:

- `apps/frappe/frappe/public/js/frappe/desk.js` — `frappe.boot`, `frappe.csrf_token` initialisation
- `apps/frappe/frappe/public/js/frappe/request.js` — `X-Frappe-CSRF-Token` header
- `apps/frappe/frappe/public/js/frappe/ui/dropdown_console.js` — `cur_frm` usage
- `apps/frappe/frappe/public/js/frappe/form/script_helpers.js` — `cur_frm` in form helpers
- `apps/frappe/frappe/public/js/frappe/ui/sidebar/sidebar_item.js` — `frappe.ui` namespace
- `apps/frappe/frappe/templates/base.html` — `frappe.ready` definition
- `apps/frappe/frappe/client.py` — `@frappe.whitelist()` decorator examples
- `apps/frappe/frappe/public/js/frappe/ui/dialog.js` line 196 (16.51.1) — `get_primary_btn()` returns `.btn-modal-primary`; was `.btn-primary` in ≤16.35
- `apps/frappe/frappe/public/js/frappe/ui/components/toast.js` (16.51.1) — `frappe.ui.toast()`; container `.es-toast-container`
- `apps/frappe/frappe/public/js/frappe/ui/messages.js` (16.51.1) — `frappe.show_alert` aliased to `frappe.ui.toast`
- Playwright emulation docs — device emulation capabilities and limitations — <https://playwright.dev/docs/emulation>
- web.dev Learn PWA — standalone-mode detection — <https://web.dev/learn/pwa/detection>

## Design review integration

For post-build visual QA — viewport matrix screenshots, dark-mode checks,
and scored findings — see [`frappe-design-review`](../../frappe-design-review/SKILL.md).
The selectors in the **Selector changes (16.51+)** table above (`.btn-modal-primary`,
`.es-toast-container`) are the primary Frappe-specific targets that skill checks.
