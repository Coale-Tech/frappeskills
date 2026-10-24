#!/usr/bin/env node
// design-lint.js — zero-dependency static design violation scanner for Frappe apps.
//
// Usage:
//   node design-lint.js <app-dir>          # scan and print JSON
//   node design-lint.js <app-dir> --fix    # print JSON only (fixes done by the skill loop)
//   node design-lint.js --selftest         # scan a temp fixture, assert known violations are found
//
// Output (stdout): JSON { dir, violations, counts, total, score, grade }
// Exit codes: 0 = OK (may have violations), 1 = argument error, 2 = selftest failed
//
// Scoring weights match frappe-testing/scripts/qa-score.js (P0=25, P1=15, P2=8, P3=3).

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Check definitions
// ---------------------------------------------------------------------------
const CHECKS = [
  {
    id:      'hex-color',
    desc:    'Hardcoded hex color — use a CSS variable or Tailwind token',
    severity:'P2',
    exts:    ['.css', '.scss', '.vue'],
    // Match #rrggbb or #rrggbbaa.
    // False-positive suppression (handled in scan loop):
    //   - CSS var definitions: --name: #value  → skip
    //   - CSS id selectors: #id { ... }        → skip (hex at start of trimmed line)
    //   - url(#...) paint-server refs          → skip
    //   - Comment lines                         → skip (handled globally)
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    inStyleBlock: true,  // only inside Vue <style> blocks
    lineFilter: (lineText, match) => {
      // Skip CSS variable definitions: lines with `--something: #value`
      if (/--[\w-]+\s*:/.test(lineText)) return false;
      // Skip CSS id selectors: hex at start of trimmed line (selector position)
      const trimmed = lineText.trimStart();
      if (trimmed.startsWith('#')) return false;
      // Skip url(#...) SVG paint-server references
      const matchIdx = lineText.indexOf(match);
      if (matchIdx > 0 && lineText[matchIdx - 1] === '(') return false;
      return true;
    },
  },
  {
    id:      'rgb-color',
    desc:    'Hardcoded rgb()/rgba() color — use a CSS variable or Tailwind token',
    severity:'P2',
    exts:    ['.css', '.scss', '.vue'],
    pattern: /\brgba?\s*\(/g,
    inStyleBlock: true,
  },
  {
    id:      'feather-icon',
    desc:    'FeatherIcon component — removed in frappe-ui 1.0.0 (ADR-0008); migrate to lucide-* icon strings',
    severity:'P1',
    exts:    ['.vue', '.js', '.ts'],
    pattern: /\bFeatherIcon\b/g,
    inStyleBlock: false,
  },
  {
    id:      'removed-css-var',
    desc:    'CSS variable deprecated in Frappe 16.51 (moved to legacy.css shim, removed from css_variables.scss) — replace with a direct Espresso palette token',
    severity:'P1',
    exts:    ['.css', '.scss', '.vue', '.js', '.ts'],
    // 15 vars deprecated in 16.51 per frappe-design-tokens SKILL.md
    pattern: /--(appreciation-color|appreciation-bg|criticism-color|criticism-bg|error-bg|error-border|date-active-text|date-active-bg|date-range-bg|timeline-badge-color|timeline-badge-bg|user-mention-bg-color|group-mention-bg-color|skeleton-bg|progress-bar-bg)\b/g,
    inStyleBlock: false,
  },
  {
    id:      'important-abuse',
    desc:    '!important in stylesheet — fix specificity instead (allowed in @media print)',
    severity:'P2',
    exts:    ['.css', '.scss', '.vue'],
    pattern: /!important\b/g,
    inStyleBlock: true,
    // Handled by printMediaRanges check in scan loop
    skipInPrintMedia: true,
  },
  {
    id:      'fixed-px-width',
    desc:    'Fixed pixel container width (≥100px) — use max-width or a token instead',
    severity:'P2',
    exts:    ['.css', '.scss', '.vue'],
    // Only flag widths that look like intentional container sizing (100px+)
    pattern: /(?<![a-z-])width\s*:\s*([1-9]\d{2,}px)/g,
    inStyleBlock: true,
  },
  {
    id:      'icon-aria-label',
    desc:    'Icon-only button without aria-label (approximate — verify visually)',
    severity:'P2',
    exts:    ['.vue'],
    // Restrict to SINGLE-LINE self-closing tags only (original intent — [^\n>] prevents
    // multi-tag spanning and matches the "single-line tags" comment).
    pattern: /<Button\s[^\n>]*\bicon(?:-left|-right)?\s*=[^\n>]*\/>/g,
    filter: (match) => !/aria-label/.test(match),  // only flag when no aria-label
    inStyleBlock: false,
  },
  {
    id:      'btn-primary-selector',
    desc:    '.btn-primary dialog selector — use .btn-modal-primary in Frappe 16.51+ or dialog.get_primary_btn()',
    severity:'P2',
    exts:    ['.js', '.ts', '.py'],
    pattern: /['".]btn-primary\b/g,
    // Only flag in test/script files, not in templates
    inStyleBlock: false,
  },
];

// ---------------------------------------------------------------------------
// File walker (sync, shallow-ish — ignores node_modules/dist/__pycache__)
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '__pycache__', '.cache', 'coverage']);

function* walkFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walkFiles(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Vue style-block extractor
// ---------------------------------------------------------------------------
function extractStyleBlocks(src) {
  // Returns array of { startLine (0-based), text }
  const blocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(src)) !== null) {
    const before = src.slice(0, m.index);
    const startLine = before.split('\n').length - 1;
    blocks.push({ startLine, text: m[1] });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// @media print range finder — returns array of [startIdx, endIdx] char ranges
// ---------------------------------------------------------------------------
function findPrintMediaRanges(text) {
  const ranges = [];
  const printRe = /@media\s+print\s*\{/g;
  let m;
  while ((m = printRe.exec(text)) !== null) {
    // find the matching closing brace (accounting for nesting)
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
  }
  return ranges;
}

function isInsidePrintMedia(idx, ranges) {
  for (const [s, e] of ranges) {
    if (idx >= s && idx < e) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------
function scan(dir) {
  const violations = [];

  for (const filePath of walkFiles(dir)) {
    const ext = path.extname(filePath);
    const rel = path.relative(dir, filePath);

    for (const check of CHECKS) {
      if (!check.exts.includes(ext)) continue;

      let src;
      try { src = fs.readFileSync(filePath, 'utf8'); }
      catch { continue; }

      // For style-block-only checks on .vue files, scan only the <style> content
      // but adjust line numbers back to the original file.
      const isVue = ext === '.vue';
      const sources = [];  // { text, lineOffset }

      if (check.inStyleBlock && isVue) {
        for (const b of extractStyleBlocks(src)) {
          sources.push({ text: b.text, lineOffset: b.startLine });
        }
      } else if (check.inStyleBlock && !isVue) {
        sources.push({ text: src, lineOffset: 0 });
      } else {
        sources.push({ text: src, lineOffset: 0 });
      }

      for (const { text, lineOffset } of sources) {
        const lines = text.split('\n');
        // Precompute print-media ranges for this source block (used by skipInPrintMedia)
        const printRanges = check.skipInPrintMedia ? findPrintMediaRanges(text) : [];

        check.pattern.lastIndex = 0;
        let m;
        while ((m = check.pattern.exec(text)) !== null) {
          // Skip commented-out lines (// /* * at line start)
          const before = text.slice(0, m.index);
          const lineIdx = before.split('\n').length - 1;
          const lineText = lines[lineIdx] || '';
          if (/^\s*(\/\/|\/\*|\*)/.test(lineText)) continue;

          // Skip !important inside @media print { } blocks
          if (check.skipInPrintMedia && isInsidePrintMedia(m.index, printRanges)) continue;

          // Apply per-check line filter (e.g. hex in CSS var definitions)
          if (check.lineFilter && !check.lineFilter(lineText, m[0])) continue;

          // Apply optional match filter (e.g. icon button with aria-label present)
          if (check.filter && !check.filter(m[0])) continue;

          const absLine = lineOffset + lineIdx + 1;
          violations.push({
            id:       check.id,
            severity: check.severity,
            desc:     check.desc,
            file:     rel,
            line:     absLine,
            match:    m[0].slice(0, 80),
          });
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Scoring — weights match frappe-testing/scripts/qa-score.js
// (P0=critical=25, P1=high=15, P2=medium=8, P3=low=3)
// ---------------------------------------------------------------------------
function score(violations) {
  const weights = { P0: 25, P1: 15, P2: 8, P3: 3 };
  const total = violations.reduce((n, v) => n + (weights[v.severity] || 0), 0);
  const raw = Math.max(0, 100 - total);
  const grade =
    raw >= 90 ? 'A' :
    raw >= 80 ? 'B' :
    raw >= 65 ? 'C' :
    raw >= 50 ? 'D' : 'F';
  return { score: raw, grade };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const selftest = args.includes('--selftest');
let targetDir = args.find(a => !a.startsWith('-')) || null;
if (selftest) {
  targetDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'design-lint-'));
  fs.writeFileSync(path.join(targetDir, 'Bad.vue'), '<template><div>x</div></template>\n<style>\n.a {\n  color: #ff0000;\n}\n</style>\n');
  fs.writeFileSync(path.join(targetDir, 'Ok.css'), '.a { color: var(--ink-gray-9); }\n');
}

if (!targetDir) {
  process.stderr.write('Usage: node design-lint.js <app-dir> [--selftest]\n');
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  process.stderr.write(`Directory not found: ${targetDir}\n`);
  process.exit(selftest ? 2 : 1);
}

const violations = scan(targetDir);
const counts = {};
for (const c of CHECKS) counts[c.id] = 0;
for (const v of violations) counts[v.id] = (counts[v.id] || 0) + 1;

const { score: s, grade } = score(violations);

const output = {
  dir:        targetDir,
  violations,
  counts,
  total:      violations.length,
  score:      s,
  grade,
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');

if (selftest) {
  const ids = violations.map(v => v.id);
  const ok = ids.includes('hex-color') && violations.every(v => !v.file.endsWith('Ok.css'));
  fs.rmSync(targetDir, { recursive: true, force: true });
  process.stderr.write(`selftest: scanned ${targetDir}\n`);
  process.stderr.write(`selftest: ${violations.length} violations found across ${Object.keys(counts).length} checks\n`);
  process.stderr.write(`selftest: score=${s} grade=${grade}\n`);
  process.stderr.write(ok ? 'selftest: PASS\n' : 'selftest: FAIL\n');
  process.exit(ok ? 0 : 2);
}
