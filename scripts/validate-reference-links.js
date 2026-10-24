#!/usr/bin/env node
/**
 * validate-reference-links.js — check that every relative markdown link resolves.
 * Adapted from addyosmani/agent-skills (MIT): scripts/validate-reference-links.js
 *
 * Checks these file sets:
 *   frappe-* SKILL.md, frappe-* references/*.md
 *   commands/*.md, omp (recursive), docs/*.md, README.md
 *
 * Rules:
 *   - Every relative link [text](path) must resolve to an existing file/dir.
 *   - Ignore http(s)://, mailto:, skill://, and anchor-only (#...) links.
 *   - Check fragment anchors against GitHub-style heading slugs when cheap.
 *   - Error if any SKILL.md links to a references/ file that does not exist
 *     (covered by the general check; highlighted in output).
 *   - Warn if a references/*.md is not linked from its owning SKILL.md.
 *
 * Exit codes: 0 = all clear, 1 = one or more errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { stripFencedCodeBlocks } = require('./lib/skill-lint');

const ROOT = path.resolve(__dirname, '..');

// Matches inline markdown links: [text](url) and ![alt](url).
// Captures the raw URL part (may include a title string after a space).
const MARKDOWN_LINK_RE = /!?\[[^\[\]]*\]\(([^)]+)\)/g;

function isRelativeLink(raw) {
  if (!raw) return false;
  if (/^https?:\/\//.test(raw)) return false;
  if (/^mailto:/.test(raw))     return false;
  if (/^skill:\/\//.test(raw))  return false;
  if (/^#/.test(raw))           return false; // anchor-only
  return true;
}

function parseUrl(raw) {
  // Strip optional title: "path.md" or path.md "My Title"
  const url = raw.trim().split(/\s+/)[0];
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return { pathPart: url, anchor: null };
  return { pathPart: url.slice(0, hashIdx), anchor: url.slice(hashIdx + 1) || null };
}

// GitHub heading anchor slugging: lowercase, keep letters/numbers/spaces/-/_,
// drop the rest, replace spaces with hyphens, deduplicate with -1/-2/…
function slugify(heading) {
  const text = heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '');
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '').replace(/ /g, '-');
}

function headingAnchors(file) {
  const anchors = new Set();
  const seen    = new Map();
  let content;
  try {
    content = stripFencedCodeBlocks(fs.readFileSync(file, 'utf8'));
  } catch {
    return anchors;
  }
  for (const line of content.split('\n')) {
    const m = line.match(/^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    if (!m) continue;
    const slug  = slugify(m[1]);
    const count = seen.get(slug) || 0;
    let   anchor = count === 0 ? slug : `${slug}-${count}`;
    while (anchors.has(anchor)) anchor = `${slug}-${++seen.get(slug) || 1}`;
    anchors.add(anchor);
    seen.set(slug, count + 1);
  }
  return anchors;
}

/**
 * Find broken relative links in a single file.
 * Returns { violations: [{line, url, target, anchor?}] }
 */
function findViolations(file) {
  const violations = [];
  const baseDir = path.dirname(file);
  let content;
  try {
    content = stripFencedCodeBlocks(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    violations.push({ line: 0, url: `<unreadable: ${err.message}>`, target: file });
    return violations;
  }

  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const match of line.matchAll(MARKDOWN_LINK_RE)) {
      const raw = match[1];
      if (!isRelativeLink(raw)) continue;
      const { pathPart, anchor } = parseUrl(raw);
      if (!pathPart) continue;

      const target = path.resolve(baseDir, pathPart);
      if (!fs.existsSync(target)) {
        violations.push({ line: i + 1, url: raw.trim().split(/\s+/)[0], target });
      } else if (anchor) {
        try {
          if (fs.statSync(target).isFile() && !headingAnchors(target).has(anchor)) {
            violations.push({ line: i + 1, url: raw.trim().split(/\s+/)[0], target, anchor });
          }
        } catch { /* best-effort anchor check */ }
      }
    }
  });

  return violations;
}

function walkMd(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMd(abs, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(abs);
    }
  }
}

function getFilesToCheck() {
  const files = [];

  // frappe-*/SKILL.md and frappe-*/references/*.md
  for (const entry of fs.readdirSync(ROOT).sort()) {
    if (!/^frappe-/.test(entry)) continue;
    const skillDir = path.join(ROOT, entry);
    if (!fs.statSync(skillDir).isDirectory()) continue;

    const skillMd = path.join(skillDir, 'SKILL.md');
    if (fs.existsSync(skillMd)) files.push(skillMd);

    const refsDir = path.join(skillDir, 'references');
    if (fs.existsSync(refsDir) && fs.statSync(refsDir).isDirectory()) {
      for (const f of fs.readdirSync(refsDir).sort()) {
        if (f.endsWith('.md')) files.push(path.join(refsDir, f));
      }
    }
  }

  // commands/*.md (top-level)
  const commandsDir = path.join(ROOT, 'commands');
  if (fs.existsSync(commandsDir) && fs.statSync(commandsDir).isDirectory()) {
    for (const f of fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).sort()) {
      files.push(path.join(commandsDir, f));
    }
  }

  // omp/**/*.md (recursive)
  walkMd(path.join(ROOT, 'omp'), files);

  // docs/*.md
  const docsDir = path.join(ROOT, 'docs');
  if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()) {
    for (const f of fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort()) {
      files.push(path.join(docsDir, f));
    }
  }

  // README.md
  const readme = path.join(ROOT, 'README.md');
  if (fs.existsSync(readme)) files.push(readme);

  return files;
}

function toPosix(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function main() {
  console.log('Checking relative markdown links...\n');

  const files     = getFilesToCheck();
  let checked     = 0;
  let errCount    = 0;
  let warnCount   = 0;

  for (const file of files) {
    const violations = findViolations(file);
    checked++;

    if (violations.length === 0) {
      console.log(`  ✓  ${toPosix(file)}`);
    } else {
      console.log(`  ✗  ${toPosix(file)}`);
      for (const { line, url, target, anchor } of violations) {
        errCount++;
        if (anchor) {
          console.log(`       L${line}: ${url} — no heading produces #${anchor} in ${toPosix(target)}`);
        } else {
          console.log(`       L${line}: ${url} — resolves to ${toPosix(target)}, which does not exist`);
        }
      }
    }
  }

  // Warn on references/*.md not linked from their SKILL.md
  for (const entry of fs.readdirSync(ROOT).sort()) {
    if (!/^frappe-/.test(entry)) continue;
    const skillDir = path.join(ROOT, entry);
    if (!fs.statSync(skillDir).isDirectory()) continue;

    const refsDir = path.join(skillDir, 'references');
    if (!fs.existsSync(refsDir)) continue;

    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    let skillContent = '';
    try { skillContent = fs.readFileSync(skillMd, 'utf8'); } catch { continue; }

    for (const f of fs.readdirSync(refsDir).filter(f => f.endsWith('.md')).sort()) {
      const relLink = `references/${f}`;
      if (!skillContent.includes(relLink)) {
        console.log(`  ⚠  ${entry}/SKILL.md: ${relLink} not linked from SKILL.md`);
        warnCount++;
      }
    }
  }

  const status = errCount > 0 ? 'FAILED' : warnCount > 0 ? 'PASSED WITH WARNINGS' : 'PASSED';
  console.log(`\n${checked} files checked — ${errCount} error(s), ${warnCount} warning(s) — ${status}`);

  if (errCount > 0) process.exit(1);
}

module.exports = { findViolations };

if (require.main === module) main();
