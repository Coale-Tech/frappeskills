#!/usr/bin/env python3
"""
generate-mockup.py — Frappe-UI 1.0 mockup generator (zero Python deps beyond stdlib).

Reads frappe-ui tailwind/tokens/*.js source files and emits:
  tokens.css   — CSS custom properties for all semantic color/type/radius/shadow families
  mockup.html  — self-contained comparison board (3 variants) with .fui-* component kit

Usage:
  python3 generate-mockup.py [--frappe-ui PATH] [--out DIR] [--title TITLE]

  --frappe-ui PATH   frappe-ui root dir (default: $FRAPPE_UI, or auto-searched)
  --out DIR          output directory, created if absent (default: ./mockup-out)
  --title TITLE      page / app title shown in the mockup (default: "Frappe Mockup")

Fidelity limits (honest disclosure):
  - Colors use oklch() from real token files; requires Chrome 111+, Firefox 113+, Safari 15.4+
  - Font: Inter loaded from Google Fonts CDN; bundled apps use local @font-face
  - .fui-* classes approximate frappe-ui components visually — NOT real Vue components
  - Icons are inline SVG stubs; real apps use lucide-* (e.g. icon="lucide-plus")
  - Scroll behaviour, focus management, animations are minimal stubs
  - Tailwind utility classes (bg-surface-base etc.) are NOT generated; use .fui-* only
"""

import argparse, json, os, re, sys
from pathlib import Path

# ── token file parsing ───────────────────────────────────────────────────────

_EXPORT_RE          = re.compile(r'^\s*export\s+default\s*', re.MULTILINE)
_TRAILING_COMMA_RE  = re.compile(r',(\s*[}\]])')
_LINE_COMMENT_RE    = re.compile(r'//[^\n]*')


def load_js(path: Path) -> dict:
    """Load a `export default { ... }` JS token file as a Python dict."""
    text = path.read_text('utf-8')
    text = _LINE_COMMENT_RE.sub('', text)
    text = _EXPORT_RE.sub('', text, count=1).strip()
    text = _TRAILING_COMMA_RE.sub(r'\1', text)
    return json.loads(text)


def resolve_ref(ref: str, colors: dict) -> str:
    """'lightMode/gray/50' → actual color string; literal passthrough."""
    if '/' not in ref:
        return ref
    parts = ref.split('/')
    node = colors
    for p in parts:
        if not isinstance(node, dict):
            return ''
        node = node.get(p, '')
    return node if isinstance(node, str) else ''


def semantic_vars(colors: dict) -> tuple:
    """Return (light_vars, dark_vars) CSS-variable dicts from themedVariables."""
    themed = colors.get('themedVariables', {})
    light, dark = {}, {}
    for mode, target in (('light', light), ('dark', dark)):
        for family, keys in themed.get(mode, {}).items():
            if isinstance(keys, dict):
                for key, ref in keys.items():
                    val = resolve_ref(ref, colors)
                    if val:
                        target[f'--{family}-{key}'] = val
    return light, dark


def type_vars(typo: dict) -> dict:
    v = {}
    ff = typo.get('fontFamily', {}).get('text', 'Inter Variable')
    v['--font-family'] = f'"{ff}", system-ui, sans-serif'
    for n, w in typo.get('fontWeight', {}).items():
        v[f'--font-weight-{n}'] = str(w)
    for name, data in typo.get('fontSize', {}).items():
        if isinstance(data, list) and data:
            v[f'--font-size-{name}'] = data[0]
            props = data[1] if len(data) > 1 else {}
            if 'lineHeight'    in props: v[f'--line-height-{name}']    = str(props['lineHeight'])
            if 'letterSpacing' in props: v[f'--letter-spacing-{name}'] = props['letterSpacing']
    return v


def radius_vars(radius: dict) -> dict:
    return {f'--rounded-{k}': v for k, v in radius.items()}


def shadow_vars(effects: dict) -> dict:
    v = {}
    for mode in ('light', 'dark'):
        for name, val in effects.get('elevation', {}).get(mode, {}).items():
            v[f'--shadow-{name}-{mode}'] = val
    for mode in ('light', 'dark'):
        for name, val in effects.get('focus', {}).get(mode, {}).items():
            v[f'--focus-ring-{name}-{mode}'] = val
    return v


def as_css_block(selector: str, vars_: dict) -> str:
    lines = [f'{selector} {{']
    for k, val in vars_.items():
        lines.append(f'  {k}: {val};')
    lines.append('}')
    return '\n'.join(lines)


# ── component class kit ──────────────────────────────────────────────────────

COMPONENT_CSS = """\
/* ── Frappe-UI 1.0 component approximation kit (.fui-*) ─────────────────── */
/* These classes use real Espresso CSS vars but are CSS-only approximations.  */
/* Real apps use frappe-ui Vue components, not these classes.                 */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base, 1.35);
  color: var(--ink-gray-8);
  background: var(--surface-gray-1);
  -webkit-font-smoothing: antialiased;
}

/* Shell */
.fui-shell { display: flex; height: 100%; overflow: hidden; }
.fui-main  { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

/* Rail (icon-only left strip) */
.fui-rail {
  width: 48px; min-width: 48px;
  background: var(--surface-sidebar);
  border-right: 1px solid var(--outline-gray-2);
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 0; gap: 2px;
}
.fui-rail-item {
  width: 36px; height: 36px; border-radius: var(--rounded-4);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--ink-gray-6);
}
.fui-rail-item:hover  { background: var(--surface-gray-2); color: var(--ink-gray-8); }
.fui-rail-item.active { background: var(--surface-gray-3); color: var(--ink-gray-9); }

/* Sidebar */
.fui-sidebar {
  width: 220px; min-width: 220px;
  background: var(--surface-sidebar);
  border-right: 1px solid var(--outline-gray-2);
  padding: 8px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 1px;
}
.fui-sidebar-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--ink-gray-5);
  padding: 8px 12px 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.fui-sidebar-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: var(--rounded-4);
  font-size: var(--font-size-sm); color: var(--ink-gray-7);
  cursor: pointer; text-decoration: none;
}
.fui-sidebar-item:hover { background: var(--surface-gray-2); }
.fui-sidebar-item.active {
  background: var(--surface-gray-3);
  color: var(--ink-gray-9);
  font-weight: var(--font-weight-medium);
}

/* Page header */
.fui-page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; gap: 8px;
  border-bottom: 1px solid var(--outline-gray-2);
  background: var(--surface-base);
}
.fui-page-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--ink-gray-9);
}
.fui-page-actions { display: flex; gap: 6px; align-items: center; }

/* Filter bar */
.fui-filter-bar {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 8px 16px;
  border-bottom: 1px solid var(--outline-gray-2);
  background: var(--surface-base);
}

/* Buttons */
.fui-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: var(--rounded-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: inherit;
  cursor: pointer; border: 1px solid transparent;
  outline: none; white-space: nowrap; line-height: 1;
  transition: background 120ms ease;
  -webkit-user-select: none; user-select: none;
}
.fui-btn:focus-visible { box-shadow: var(--focus-ring-default-light); }
[data-theme="dark"] .fui-btn:focus-visible { box-shadow: var(--focus-ring-default-dark); }

.fui-btn-solid  { background: var(--ink-gray-9); color: var(--surface-base); border-color: transparent; }
.fui-btn-solid:hover { background: var(--ink-gray-8); }
.fui-btn-subtle { background: var(--surface-gray-2); color: var(--ink-gray-8); border-color: var(--outline-gray-2); }
.fui-btn-subtle:hover { background: var(--surface-gray-3); }
.fui-btn-ghost  { background: transparent; color: var(--ink-gray-7); }
.fui-btn-ghost:hover { background: var(--surface-gray-2); }
.fui-btn-danger { background: var(--surface-red-5); color: white; border-color: transparent; }
.fui-btn-danger:hover { background: var(--surface-red-6); }
.fui-btn-sm     { padding: 4px 8px; font-size: var(--font-size-xs); }
.fui-btn-icon   { padding: 6px; }

/* Badges — docstatus + status */
.fui-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border-radius: var(--rounded-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1.5; white-space: nowrap;
}
/* Desk docstatus indicator colours (indicator.js): 0=Draft(red), 1=Submitted(blue), 2=Cancelled(red) */
/* frappe-ui Badge has no built-in docstatus convention; document your mapping explicitly.            */
.fui-badge-gray   { background: var(--surface-gray-2);   color: var(--ink-gray-6); }
.fui-badge-blue   { background: var(--surface-blue-2);   color: var(--ink-blue-7); }
.fui-badge-red    { background: var(--surface-red-2);    color: var(--ink-red-7); }
.fui-badge-green  { background: var(--surface-green-2);  color: var(--ink-green-7); }
.fui-badge-amber  { background: var(--surface-amber-2);  color: var(--ink-amber-7); }
.fui-badge-violet { background: var(--surface-violet-2); color: var(--ink-violet-7); }

/* FormControl */
.fui-field { display: flex; flex-direction: column; gap: 4px; }
.fui-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--ink-gray-6);
}
.fui-input {
  width: 100%; padding: 5px 10px;
  border-radius: var(--rounded-5);
  border: 1px solid var(--outline-gray-2);
  background: var(--surface-base);
  color: var(--ink-gray-9);
  font-size: var(--font-size-sm);
  font-family: inherit; outline: none;
  transition: border-color 120ms;
}
.fui-input:focus { border-color: var(--outline-gray-4); box-shadow: var(--focus-ring-default-light); }
[data-theme="dark"] .fui-input:focus { box-shadow: var(--focus-ring-default-dark); }
.fui-input::placeholder { color: var(--ink-gray-4); }
.fui-input[readonly] { background: var(--surface-gray-1); color: var(--ink-gray-7); }
.fui-input-error { border-color: var(--outline-red-5); }
.fui-error-text  { font-size: var(--font-size-xs); color: var(--ink-red-6); }

/* List */
.fui-list-header, .fui-list-row {
  display: grid; align-items: center; gap: 12px; padding: 8px 16px;
}
.fui-list-header {
  background: var(--surface-gray-1);
  border-bottom: 1px solid var(--outline-gray-2);
  color: var(--ink-gray-5);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  text-transform: uppercase; letter-spacing: 0.04em;
  position: sticky; top: 0; z-index: 1;
}
.fui-list-row {
  background: var(--surface-base);
  border-bottom: 1px solid var(--outline-gray-2);
  cursor: pointer; color: var(--ink-gray-8);
  transition: background 80ms;
}
.fui-list-row:hover    { background: var(--surface-gray-1); }
.fui-list-row.selected { background: var(--surface-blue-1); }
.fui-list-area  { overflow-y: auto; flex: 1; }
.fui-list-count {
  font-size: var(--font-size-xs); color: var(--ink-gray-5);
  padding: 6px 16px; border-bottom: 1px solid var(--outline-gray-2);
  background: var(--surface-base);
}

/* Empty state */
.fui-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 48px 24px; text-align: center;
}
.fui-empty-icon  { font-size: 36px; opacity: 0.3; }
.fui-empty-title { font-size: var(--font-size-base); font-weight: var(--font-weight-medium); color: var(--ink-gray-7); }
.fui-empty-sub   { font-size: var(--font-size-sm); color: var(--ink-gray-5); max-width: 280px; }

/* Loading skeleton */
.fui-skeleton {
  display: block;
  background: linear-gradient(90deg,
    var(--surface-gray-2) 25%, var(--surface-gray-1) 50%, var(--surface-gray-2) 75%);
  background-size: 200% 100%;
  animation: fui-shimmer 1.4s ease-in-out infinite;
  border-radius: var(--rounded-4);
}
@keyframes fui-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Dialog */
.fui-dialog {
  background: var(--surface-base);
  border-radius: var(--rounded-6);
  box-shadow: var(--shadow-xl-light);
  width: min(480px, 92vw);
  padding: 24px; display: flex; flex-direction: column; gap: 16px;
}
[data-theme="dark"] .fui-dialog { box-shadow: var(--shadow-xl-dark); }
.fui-dialog-title  { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--ink-gray-9); }
.fui-dialog-body   { font-size: var(--font-size-sm); color: var(--ink-gray-7); }
.fui-dialog-footer { display: flex; gap: 8px; justify-content: flex-end; }

/* Detail side panel */
.fui-detail-panel {
  width: 320px; min-width: 320px;
  background: var(--surface-base);
  border-left: 1px solid var(--outline-gray-2);
  overflow-y: auto;
}
.fui-detail-header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--outline-gray-2);
  font-weight: var(--font-weight-semibold);
  color: var(--ink-gray-9); font-size: var(--font-size-sm);
}
.fui-detail-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 10px 16px; border-bottom: 1px solid var(--outline-gray-2); gap: 8px;
}
.fui-detail-label { font-size: var(--font-size-xs); color: var(--ink-gray-5); min-width: 80px; }
.fui-detail-value { font-size: var(--font-size-sm); color: var(--ink-gray-8); text-align: right; }

/* Tabs */
.fui-tabs { display: flex; border-bottom: 1px solid var(--outline-gray-2); padding: 0 16px; background: var(--surface-base); }
.fui-tab  { padding: 8px 14px; font-size: var(--font-size-sm); color: var(--ink-gray-6); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.fui-tab:hover  { color: var(--ink-gray-8); }
.fui-tab.active { color: var(--ink-gray-9); border-bottom-color: var(--ink-gray-9); font-weight: var(--font-weight-medium); }

/* Workflow banner */
.fui-workflow-banner {
  background: var(--surface-blue-1);
  border-bottom: 1px solid var(--outline-blue-3);
  padding: 8px 16px; font-size: var(--font-size-sm); color: var(--ink-blue-7);
  display: flex; align-items: center; gap: 8px;
}

/* Utilities */
.fui-spacer  { flex: 1; }
.fui-divider { height: 1px; background: var(--outline-gray-2); margin: 4px 0; }
.fui-muted   { color: var(--ink-gray-5); }

/* Responsive stubs (375px) */
@media (max-width: 768px) {
  .fui-sidebar      { display: none; }
  .fui-detail-panel { display: none; }
  .fui-rail         { display: none; }
}
"""


# ── HTML mockup template ─────────────────────────────────────────────────────

MOCKUP_HTML = """\
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="tokens.css">
<style>
{component_css}

/* Demo page chrome */
body {{ padding: 16px; }}
.variant-label {{
  padding: 6px 12px;
  background: var(--surface-gray-2);
  font-size: var(--font-size-xs);
  color: var(--ink-gray-5);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--rounded-4) var(--rounded-4) 0 0;
  border: 1px solid var(--outline-gray-2);
  border-bottom: none;
}}
.variant-frame {{
  border: 1px solid var(--outline-gray-2);
  border-radius: 0 0 var(--rounded-5) var(--rounded-5);
  overflow: hidden;
  margin-bottom: 32px;
}}
.theme-toggle {{
  position: fixed; top: 12px; right: 16px; z-index: 200;
}}
</style>
</head>
<body>

<div class="theme-toggle">
  <button class="fui-btn fui-btn-subtle fui-btn-sm" onclick="toggleTheme()" aria-label="Toggle theme">
    <span id="theme-icon">🌙</span> Toggle theme
  </button>
</div>

<!-- ══ Variant A: List View ════════════════════════════════════════════════ -->
<div class="variant-label">Variant A — List view (DesktopShell + list/detail) — Purchase Invoice</div>
<div class="variant-frame">
  <div class="fui-shell" style="height:500px;">

    <!-- Rail -->
    <div class="fui-rail">
      <div class="fui-rail-item active" title="Documents">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div class="fui-rail-item" title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="fui-sidebar">
      <div class="fui-sidebar-label">Accounting</div>
      <a class="fui-sidebar-item active" href="#">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        Purchase Invoice
      </a>
      <a class="fui-sidebar-item" href="#">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        Sales Invoice
      </a>
      <a class="fui-sidebar-item" href="#">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Payment Entry
      </a>
      <div class="fui-divider"></div>
      <div class="fui-sidebar-label">Reports</div>
      <a class="fui-sidebar-item" href="#">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>
        Accounts Payable
      </a>
    </div>

    <!-- Main -->
    <div class="fui-main">
      <div class="fui-page-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <h1 class="fui-page-title">Purchase Invoice</h1>
          <span class="fui-badge fui-badge-gray">24 records</span>
        </div>
        <div class="fui-page-actions">
          <button class="fui-btn fui-btn-ghost fui-btn-icon" aria-label="Filters">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
          </button>
          <button class="fui-btn fui-btn-solid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Invoice
          </button>
        </div>
      </div>

      <div class="fui-filter-bar">
        <div style="position:relative;flex:1;max-width:260px;">
          <svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--ink-gray-4);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="fui-input" style="padding-left:28px;" type="search" placeholder="Search invoices…" aria-label="Search invoices">
        </div>
        <button class="fui-btn fui-btn-subtle fui-btn-sm">Status ▾</button>
        <button class="fui-btn fui-btn-subtle fui-btn-sm">Supplier ▾</button>
        <button class="fui-btn fui-btn-subtle fui-btn-sm">Date ▾</button>
        <div class="fui-spacer"></div>
        <span class="fui-muted" style="font-size:var(--font-size-xs);">3 filters active</span>
      </div>

      <div style="display:flex;flex:1;overflow:hidden;">
        <!-- List -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div class="fui-list-count">Showing 1–5 of 24</div>
          <div class="fui-list-header" style="grid-template-columns:1fr 110px 100px 90px;">
            <span>Invoice / Supplier</span><span>Date</span><span style="text-align:right;">Amount</span><span>Status</span>
          </div>
          <div class="fui-list-area">
            <div class="fui-list-row selected" style="grid-template-columns:1fr 110px 100px 90px;" tabindex="0">
              <div><div style="font-weight:500;color:var(--ink-gray-9);">ACC-PINV-2024-00098</div><div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);">Acme Supplies Ltd</div></div>
              <span style="color:var(--ink-gray-6);font-size:var(--font-size-xs);">24 Oct 2024</span>
              <span style="text-align:right;font-weight:500;">₹ 1,24,800</span>
              <span><span class="fui-badge fui-badge-gray">Draft</span></span>
            </div>
            <div class="fui-list-row" style="grid-template-columns:1fr 110px 100px 90px;" tabindex="0">
              <div><div style="font-weight:500;color:var(--ink-gray-9);">ACC-PINV-2024-00097</div><div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);">Beta Industrial Co.</div></div>
              <span style="color:var(--ink-gray-6);font-size:var(--font-size-xs);">22 Oct 2024</span>
              <span style="text-align:right;font-weight:500;">₹ 56,200</span>
              <span><span class="fui-badge fui-badge-blue">Submitted</span></span>
            </div>
            <div class="fui-list-row" style="grid-template-columns:1fr 110px 100px 90px;" tabindex="0">
              <div><div style="font-weight:500;color:var(--ink-gray-9);">ACC-PINV-2024-00096</div><div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);">Gamma Trading LLC</div></div>
              <span style="color:var(--ink-gray-6);font-size:var(--font-size-xs);">21 Oct 2024</span>
              <span style="text-align:right;font-weight:500;">₹ 8,400</span>
              <span><span class="fui-badge fui-badge-red">Cancelled</span></span>
            </div>
            <div class="fui-list-row" style="grid-template-columns:1fr 110px 100px 90px;" tabindex="0">
              <div><div style="font-weight:500;color:var(--ink-gray-9);">ACC-PINV-2024-00095</div><div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);">Delta Logistics</div></div>
              <span style="color:var(--ink-gray-6);font-size:var(--font-size-xs);">19 Oct 2024</span>
              <span style="text-align:right;font-weight:500;">₹ 2,35,000</span>
              <span><span class="fui-badge fui-badge-blue">Submitted</span></span>
            </div>
            <div class="fui-list-row" style="grid-template-columns:1fr 110px 100px 90px;" tabindex="0">
              <div><div style="font-weight:500;color:var(--ink-gray-9);">ACC-PINV-2024-00094</div><div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);">Epsilon Parts</div></div>
              <span style="color:var(--ink-gray-6);font-size:var(--font-size-xs);">18 Oct 2024</span>
              <span style="text-align:right;font-weight:500;">₹ 44,100</span>
              <span><span class="fui-badge fui-badge-amber">On Hold</span></span>
            </div>
          </div>
        </div>

        <!-- Detail panel (selected row) -->
        <div class="fui-detail-panel">
          <div class="fui-detail-header">
            ACC-PINV-2024-00098
            <div style="margin-top:4px;"><span class="fui-badge fui-badge-gray">Draft</span></div>
          </div>
          <div class="fui-tabs">
            <div class="fui-tab active">Details</div>
            <div class="fui-tab">Items (3)</div>
            <div class="fui-tab">Activity</div>
          </div>
          <div class="fui-detail-row"><span class="fui-detail-label">Supplier</span><span class="fui-detail-value">Acme Supplies Ltd</span></div>
          <div class="fui-detail-row"><span class="fui-detail-label">Invoice Date</span><span class="fui-detail-value">24 Oct 2024</span></div>
          <div class="fui-detail-row"><span class="fui-detail-label">Due Date</span><span class="fui-detail-value">23 Nov 2024</span></div>
          <div class="fui-detail-row"><span class="fui-detail-label">Total</span><span class="fui-detail-value" style="font-weight:600;color:var(--ink-gray-9);">₹ 1,24,800</span></div>
          <div class="fui-detail-row"><span class="fui-detail-label">Company</span><span class="fui-detail-value">Acme Corp</span></div>
          <div style="padding:12px 16px;display:flex;gap:8px;">
            <button class="fui-btn fui-btn-solid" style="flex:1;">Submit</button>
            <button class="fui-btn fui-btn-subtle">Edit</button>
            <button class="fui-btn fui-btn-ghost fui-btn-icon" aria-label="More actions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══ Variant B: Form + Workflow ══════════════════════════════════════════ -->
<div class="variant-label">Variant B — Form / detail view with workflow banner (Submitted document)</div>
<div class="variant-frame">
  <div class="fui-workflow-banner">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
    Pending Accounts Manager approval — assigned to Priya S.
    <div class="fui-spacer"></div>
    <button class="fui-btn fui-btn-subtle fui-btn-sm">View Workflow</button>
  </div>
  <div class="fui-page-header">
    <div>
      <div style="font-size:var(--font-size-xs);color:var(--ink-gray-5);margin-bottom:2px;">Purchase Invoice</div>
      <h1 class="fui-page-title">ACC-PINV-2024-00097</h1>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="fui-badge fui-badge-blue">Submitted</span>
      <button class="fui-btn fui-btn-subtle fui-btn-sm">Print</button>
      <button class="fui-btn fui-btn-danger fui-btn-sm">Cancel</button>
    </div>
  </div>
  <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px 20px;max-width:880px;">
    <div class="fui-field"><label class="fui-label">Supplier *</label><input class="fui-input" type="text" value="Beta Industrial Co." readonly></div>
    <div class="fui-field"><label class="fui-label">Invoice Date *</label><input class="fui-input" type="text" value="22 Oct 2024" readonly></div>
    <div class="fui-field"><label class="fui-label">Due Date</label><input class="fui-input" type="text" value="21 Nov 2024" readonly></div>
    <div class="fui-field"><label class="fui-label">Company *</label><input class="fui-input" type="text" value="Acme Corp" readonly></div>
    <div class="fui-field"><label class="fui-label">Currency</label><input class="fui-input" type="text" value="INR" readonly></div>
    <div class="fui-field"><label class="fui-label">Bill No.</label><input class="fui-input" type="text" value="SUPP-INV-887" readonly></div>
  </div>
  <div style="padding:0 20px 20px;display:flex;justify-content:flex-end;max-width:880px;">
    <div style="min-width:240px;border:1px solid var(--outline-gray-2);border-radius:var(--rounded-5);overflow:hidden;">
      <div class="fui-detail-row" style="padding:8px 14px;"><span class="fui-detail-label">Net Total</span><span class="fui-detail-value">₹ 47,627</span></div>
      <div class="fui-detail-row" style="padding:8px 14px;"><span class="fui-detail-label">GST 18%</span><span class="fui-detail-value">₹ 8,573</span></div>
      <div class="fui-detail-row" style="padding:8px 14px;background:var(--surface-gray-1);"><span class="fui-detail-label" style="font-weight:600;color:var(--ink-gray-8);">Grand Total</span><span class="fui-detail-value" style="font-weight:700;color:var(--ink-gray-9);">₹ 56,200</span></div>
    </div>
  </div>
</div>

<!-- ══ Variant C: Component Kit Reference ══════════════════════════════════ -->
<div class="variant-label">Variant C — .fui-* component kit reference (all tokens from real frappe-ui source)</div>
<div class="variant-frame" style="padding:24px;display:flex;flex-direction:column;gap:24px;">

  <div>
    <div class="fui-label" style="margin-bottom:10px;">Buttons (.fui-btn)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="fui-btn fui-btn-solid">Primary</button>
      <button class="fui-btn fui-btn-subtle">Subtle</button>
      <button class="fui-btn fui-btn-ghost">Ghost</button>
      <button class="fui-btn fui-btn-danger">Danger</button>
      <button class="fui-btn fui-btn-solid fui-btn-sm">Small</button>
      <button class="fui-btn fui-btn-subtle" disabled style="opacity:.45;cursor:not-allowed;">Disabled</button>
    </div>
  </div>

  <div>
    <div class="fui-label" style="margin-bottom:10px;">
      Badges — Desk docstatus: 0=Draft(red) 1=Submitted(blue) 2=Cancelled(red) + custom states
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <span class="fui-badge fui-badge-gray">Draft</span>
      <span class="fui-badge fui-badge-blue">Submitted</span>
      <span class="fui-badge fui-badge-red">Cancelled</span>
      <span class="fui-badge fui-badge-green">Paid</span>
      <span class="fui-badge fui-badge-amber">Overdue</span>
      <span class="fui-badge fui-badge-violet">Pending Review</span>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:660px;">
    <div class="fui-field">
      <label class="fui-label" for="c-inp1">Text input</label>
      <input class="fui-input" id="c-inp1" type="text" placeholder="Enter value…">
    </div>
    <div class="fui-field">
      <label class="fui-label" for="c-inp2">With error</label>
      <input class="fui-input fui-input-error" id="c-inp2" type="text" value="bad@val">
      <span class="fui-error-text">Invalid email address</span>
    </div>
    <div class="fui-field">
      <label class="fui-label" for="c-inp3">Read-only</label>
      <input class="fui-input" id="c-inp3" type="text" value="ACC-PINV-2024-00098" readonly>
    </div>
  </div>

  <div>
    <div class="fui-label" style="margin-bottom:10px;">Empty state (.fui-empty)</div>
    <div style="border:1px solid var(--outline-gray-2);border-radius:var(--rounded-5);max-width:380px;">
      <div class="fui-empty">
        <div class="fui-empty-icon">📄</div>
        <div class="fui-empty-title">No invoices yet</div>
        <div class="fui-empty-sub">Create your first Purchase Invoice to start tracking payables.</div>
        <button class="fui-btn fui-btn-solid fui-btn-sm">New Invoice</button>
      </div>
    </div>
  </div>

  <div>
    <div class="fui-label" style="margin-bottom:10px;">Loading skeleton (.fui-skeleton)</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-width:360px;">
      <span class="fui-skeleton" style="display:block;height:14px;width:60%;"></span>
      <span class="fui-skeleton" style="display:block;height:14px;width:90%;"></span>
      <span class="fui-skeleton" style="display:block;height:14px;width:75%;"></span>
    </div>
  </div>

  <div>
    <div class="fui-label" style="margin-bottom:10px;">Dialog (.fui-dialog) — cancel confirm</div>
    <div style="border:1px solid var(--outline-gray-2);border-radius:var(--rounded-5);max-width:480px;overflow:hidden;">
      <div class="fui-dialog" style="box-shadow:none;border-radius:0;padding:20px;">
        <div class="fui-dialog-title">Cancel Invoice?</div>
        <div class="fui-dialog-body">Cancelling ACC-PINV-2024-00097 will reverse the associated journal entries. This action cannot be undone.</div>
        <div class="fui-dialog-footer">
          <button class="fui-btn fui-btn-ghost">Keep Invoice</button>
          <button class="fui-btn fui-btn-danger">Yes, Cancel</button>
        </div>
      </div>
    </div>
  </div>

</div>

<script>
function toggleTheme() {{
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent = dark ? '\U0001F319' : '\u2600\uFE0F';
}}
</script>
</body>
</html>
"""


# ── main ─────────────────────────────────────────────────────────────────────

def find_frappe_ui(hint):
    candidates = [hint] if hint else []
    candidates += [
        os.environ.get('FRAPPE_UI', ''),
        str(Path.home() / 'frappe-bench/apps/frappe-ui'),
        './frappe-ui',
    ]
    for c in candidates:
        if c and (Path(c) / 'tailwind' / 'tokens' / 'colors.js').exists():
            return Path(c)
    return None


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--frappe-ui', default='', help='frappe-ui root dir (default: $FRAPPE_UI or auto-searched)')
    p.add_argument('--out',       default='./mockup-out', help='output directory (default: ./mockup-out)')
    p.add_argument('--title',     default='Frappe Mockup', help='page title in HTML (default: Frappe Mockup)')
    args = p.parse_args()

    fui = find_frappe_ui(args.frappe_ui)
    if not fui:
        print('ERROR: frappe-ui not found. Use --frappe-ui PATH or set $FRAPPE_UI', file=sys.stderr)
        sys.exit(1)

    tokens_dir = fui / 'tailwind' / 'tokens'
    print(f'Reading tokens from: {tokens_dir}', file=sys.stderr)

    colors  = load_js(tokens_dir / 'colors.js')
    typo    = load_js(tokens_dir / 'typography.js')
    radius  = load_js(tokens_dir / 'radius.js')
    effects = load_js(tokens_dir / 'effects.js')

    light_vars, dark_vars = semantic_vars(colors)
    all_light = {**light_vars, **type_vars(typo), **radius_vars(radius), **shadow_vars(effects)}

    css_lines = [
        '/* Frappe-UI v1 tokens — generated by generate-mockup.py from tailwind/tokens/*',
        '   Source: frappe/frappe-ui (MIT). Do not edit; regenerate from token files.  */',
        '/* Fidelity: colors exact (oklch); shadows exact; font-size/weight/radius exact.',
        '   .fui-* classes approximate component look — not real Vue components.        */',
        '',
        as_css_block(':root', all_light),
        '',
        as_css_block('[data-theme="dark"]', dark_vars),
        '',
    ]
    tokens_css = '\n'.join(css_lines)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    (out / 'tokens.css').write_text(tokens_css, encoding='utf-8')
    print(f'  ✓ tokens.css ({len(tokens_css):,} bytes)', file=sys.stderr)

    html = MOCKUP_HTML.format(title=args.title, component_css=COMPONENT_CSS)
    (out / 'mockup.html').write_text(html, encoding='utf-8')
    print(f'  ✓ mockup.html ({len(html):,} bytes)', file=sys.stderr)

    print(f'\nDone → {out.resolve()}', file=sys.stderr)
    print(f'Serve: cd "{out.resolve()}" && python3 -m http.server 8765', file=sys.stderr)
    print(f'Open:  http://localhost:8765/mockup.html', file=sys.stderr)


if __name__ == '__main__':
    main()
