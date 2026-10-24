'use strict';
/**
 * skill-lint.js — frappeskills validation rules.
 * Adapted from addyosmani/agent-skills (MIT): scripts/lib/skill-lint.js
 *
 * Differences from upstream:
 *  - Skills are repo-root dirs matching frappe-* (no skills/ subdir)
 *  - Frontmatter: only `name` and `description` allowed
 *  - Description trigger: /\bUse (when|for|as|it for|to)\b/i
 *  - 11 required sections (in order); frappe-router has a partial exemption
 *  - Line budget: warn > 200, error > 230
 *  - references/*.md must contain ## Sources (error)
 *  - Common Rationalizations table >= 6 data rows
 *  - Red Flags >= 6 bullets
 */

const fs   = require('fs');
const path = require('path');

const MAX_DESCRIPTION_LENGTH = 1024;
const WARN_SKILL_LINES  = 200;
const ERROR_SKILL_LINES = 230;

// frappeskills allows only these two frontmatter keys at the top level.
const SPEC_FRONTMATTER_KEYS = new Set(['name', 'description']);

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Description must carry a positive trigger phrase.
// Report violators; do not weaken this rule.
const DESCRIPTION_TRIGGER        = /\bUse (when|for|as|it for|to)\b/i;
const DESCRIPTION_TRIGGER_NEGATE = /\b(do not|don't|never) use (this )?(when|for|as|to)\b/i;
const DESCRIPTION_TRIGGER_NEGATE_ALL = new RegExp(DESCRIPTION_TRIGGER_NEGATE.source, 'gi');

// All 11 required body sections, in canonical order.
const REQUIRED_SECTIONS = [
  '## When to use',
  '## Inputs required',
  '## Procedure',
  '## Verification',
  '## Failure modes / debugging',
  '## Escalation',
  '## References',
  '## Guardrails',
  '## Common Rationalizations',
  '## Red Flags',
  '## Common Mistakes',
];

// frappe-router is an entry-point router; these sections don't apply.
const ROUTER_EXEMPT_SECTIONS = new Set([
  '## Inputs required',
  '## Verification',
  '## Failure modes / debugging',
  '## Escalation',
  '## References',
]);

// Exemptions are validator-owned — contributors cannot bypass by editing SKILL.md.
const SECTION_EXEMPT_SKILLS = {
  'frappe-router': {
    reason: 'Entry-point router — Inputs required, Verification, Failure modes, Escalation and References do not apply to a routing-only document.',
    exemptSections: ROUTER_EXEMPT_SECTIONS,
  },
};

// Patterns that signal an explicit frappe-* cross-skill reference.
const SKILL_REF_PATTERNS = [
  /\buse the `(frappe-[a-z0-9-]+)` skill/g,
  /\bfollow the `(frappe-[a-z0-9-]+)` skill/g,
  /`(frappe-[a-z0-9-]+)` skill\b/g,
  /→ `(frappe-[a-z0-9-]+)`/g,
  /skill:\/\/(frappe-[a-z0-9-]+)/g,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripFencedCodeBlocks(content) {
  const out = [];
  let open = null;

  for (const line of content.split(/\r?\n/)) {
    if (open) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === open.marker && close[1].length >= open.length) {
        open = null;
      }
      out.push('');
      continue;
    }

    const start = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (start && !(start[1][0] === '`' && start[2].includes('`'))) {
      open = { marker: start[1][0], length: start[1].length };
      out.push('');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function topLevelFrontmatterKeys(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return [];
  const keys = [];
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function parseFrontmatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    result[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return result;
}

function frontmatterYamlErrors(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return [];

  const errors = [];
  const lines = match[1].split(/\r?\n/);
  lines.forEach((line, i) => {
    const lineNo = i + 2;
    if (!line.trim() || /^\s*#/.test(line)) return;

    if (/^[ ]*\t/.test(line)) {
      errors.push(`Frontmatter line ${lineNo} indents with a tab — YAML forbids tabs in indentation`);
      return;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const value = line.slice(colonIdx + 1).trim();
    if (!value) return;

    const quote = value[0] === '"' || value[0] === "'" ? value[0] : null;
    if (quote) {
      if (value.length < 2 || !value.endsWith(quote)) {
        errors.push(`Frontmatter line ${lineNo} opens a ${quote === '"' ? 'double' : 'single'} quote that never closes`);
      }
      return;
    }

    if (/^[`@%*,]/.test(value)) {
      errors.push(`Frontmatter line ${lineNo} starts an unquoted value with '${value[0]}' — YAML reserves that character; wrap the value in quotes`);
      return;
    }
    if (/^[|>]\S/.test(value)) {
      errors.push(`Frontmatter line ${lineNo} starts an unquoted value with '${value[0]}' followed by text — wrap in quotes`);
      return;
    }
    if (/^[-?&](\s|$)/.test(value)) {
      errors.push(`Frontmatter line ${lineNo} starts an unquoted value with '${value[0]} ' — wrap in quotes`);
      return;
    }
    if (/:(\s|$)/.test(value)) {
      errors.push(`Frontmatter line ${lineNo} has an unquoted value containing ': ' — wrap in quotes`);
    }
  });

  return errors;
}

function extractSkillReferences(content) {
  const refs = new Set();
  for (const pattern of SKILL_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(content)) !== null) {
      refs.add(m[1]);
    }
  }
  return refs;
}

// Returns content between a heading and the next same-or-higher-level heading.
function getSectionContent(stripped, heading) {
  const lines = stripped.split('\n');
  const idx = lines.findIndex(l => l.trimEnd() === heading.trimEnd());
  if (idx === -1) return null;

  const result = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^(# |## )/.test(lines[i])) break;
    result.push(lines[i]);
  }
  return result.join('\n');
}

// ─── Linter ──────────────────────────────────────────────────────────────────

function lintSkillContent(dirName, content, knownSkills) {
  const errors   = [];
  const warnings = [];
  let   exempt   = false;

  // ── Frontmatter ──────────────────────────────────────────────────────────
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('Missing or malformed YAML frontmatter (expected --- block at top of file)');
    return { errors, warnings, exempt };
  }

  errors.push(...frontmatterYamlErrors(content));

  for (const key of topLevelFrontmatterKeys(content)) {
    if (!SPEC_FRONTMATTER_KEYS.has(key)) {
      errors.push(
        `Frontmatter key '${key}' is not allowed — frappeskills frontmatter accepts only: ` +
        `${[...SPEC_FRONTMATTER_KEYS].join(', ')}`
      );
    }
  }

  if (!fm.name) {
    errors.push("Frontmatter missing required field: 'name'");
  } else if (fm.name !== dirName) {
    errors.push(`Frontmatter name '${fm.name}' does not match directory name '${dirName}'`);
  }

  if (!KEBAB_CASE.test(dirName)) {
    errors.push(`Directory name '${dirName}' is not lowercase-hyphen-separated`);
  }

  if (!fm.description) {
    errors.push("Frontmatter missing required field: 'description'");
  } else {
    if (fm.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description is ${fm.description.length} chars — exceeds the ${MAX_DESCRIPTION_LENGTH}-char limit`);
    }
    const hasTrigger  = DESCRIPTION_TRIGGER.test(fm.description);
    const onlyNegated = hasTrigger && DESCRIPTION_TRIGGER_NEGATE.test(fm.description)
      && !fm.description.replace(DESCRIPTION_TRIGGER_NEGATE_ALL, '').match(DESCRIPTION_TRIGGER);
    if (!hasTrigger || onlyNegated) {
      errors.push(
        'Description has no trigger phrase — add "Use when …", "Use for …", "Use as …", ' +
        '"Use to …", or "Use it for …" (/\\bUse (when|for|as|it for|to)\\b/i)'
      );
    }
  }

  // ── Section checks ───────────────────────────────────────────────────────
  const exemptEntry = Object.hasOwn(SECTION_EXEMPT_SKILLS, dirName)
    ? SECTION_EXEMPT_SKILLS[dirName]
    : null;
  exempt = exemptEntry !== null;

  const proseContent = stripFencedCodeBlocks(content);

  const sectionsToCheck = REQUIRED_SECTIONS.filter(s =>
    !exemptEntry || !exemptEntry.exemptSections.has(s)
  );

  const sectionPositions = new Map();
  for (const heading of sectionsToCheck) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = proseContent.match(new RegExp(`^${escaped}\\s*$`, 'm'));
    if (!m) {
      errors.push(`Missing required section: ${heading}`);
    } else {
      sectionPositions.set(heading, m.index);
    }
  }

  // Check that found sections appear in spec order.
  const found = sectionsToCheck.filter(s => sectionPositions.has(s));
  for (let i = 1; i < found.length; i++) {
    if (sectionPositions.get(found[i]) < sectionPositions.get(found[i - 1])) {
      errors.push(
        `Section '${found[i]}' appears before '${found[i - 1]}' — ` +
        `sections must follow the canonical order`
      );
    }
  }

  // ── Rationalizations table >= 6 data rows ────────────────────────────────
  if (sectionPositions.has('## Common Rationalizations')) {
    const sec = getSectionContent(proseContent, '## Common Rationalizations');
    if (sec !== null) {
      const pipeLines = sec.split('\n').filter(l => /^\|/.test(l) && l.replace(/\|/g, '').trim());
      const seps      = pipeLines.filter(l => /^\|[-: |]+\|/.test(l));
      const nonSep    = pipeLines.filter(l => !/^\|[-: |]+\|/.test(l));
      const dataCount = Math.max(0, nonSep.length - 1); // subtract header row
      if (dataCount < 6) {
        errors.push(
          `'## Common Rationalizations' table has ${dataCount} data row(s) — ` +
          `need >= 6 Frappe-specific rationalization patterns`
        );
      }
      void seps; // used only to compute nonSep above
    }
  }

  // ── Red Flags >= 6 bullets ────────────────────────────────────────────────
  if (sectionPositions.has('## Red Flags')) {
    const sec = getSectionContent(proseContent, '## Red Flags');
    if (sec !== null) {
      const bullets = sec.split('\n').filter(l => /^[-*] ./.test(l));
      if (bullets.length < 6) {
        errors.push(
          `'## Red Flags' has ${bullets.length} bullet(s) — need >= 6 observable signs`
        );
      }
    }
  }

  // ── Context budget ───────────────────────────────────────────────────────
  const lineCount = (content.match(/\n/g) || []).length;
  if (lineCount > ERROR_SKILL_LINES) {
    errors.push(
      `SKILL.md is ${lineCount} lines — exceeds the ${ERROR_SKILL_LINES}-line hard limit; ` +
      `move detail to references/`
    );
  } else if (lineCount > WARN_SKILL_LINES) {
    warnings.push(
      `SKILL.md is ${lineCount} lines — over the ${WARN_SKILL_LINES}-line budget; consider trimming`
    );
  }

  // ── Cross-skill references ───────────────────────────────────────────────
  if (knownSkills) {
    const refs = extractSkillReferences(content);
    for (const ref of refs) {
      if (!knownSkills.has(ref)) {
        warnings.push(`Dead cross-reference: \`${ref}\` is not a known skill`);
      }
    }
  }

  return { errors, warnings, exempt };
}

function isEffectivelyEmpty(dir) {
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) return true;
    return entries.every(e => {
      const abs = path.join(dir, e);
      return fs.statSync(abs).isDirectory() && isEffectivelyEmpty(abs);
    });
  } catch {
    return false;
  }
}

/**
 * Lint a single references/*.md file: must contain ## Sources heading.
 * Returns array of error strings (empty = clean).
 */
function lintReferenceFile(filePath) {
  const errors = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    errors.push(`Unreadable: ${err.message}`);
    return errors;
  }
  if (!/^## Sources\s*$/m.test(stripFencedCodeBlocks(content))) {
    errors.push('Missing required "## Sources" heading');
  }
  return errors;
}

function lintSkillLayout(skillDir) {
  const errors = [];

  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // assets/ and scripts/ inside a skill dir are not linted
        if (rel === 'assets' || rel === 'scripts') continue;
        if (isEffectivelyEmpty(abs)) {
          errors.push(`Empty directory \`${rel}/\` — remove it`);
        } else {
          walk(abs, rel);
        }
        continue;
      }

      if (rel === 'SKILL.md') continue;
      if (!entry.name.endsWith('.md')) continue;

      if (!KEBAB_CASE.test(entry.name.slice(0, -3))) {
        errors.push(`Supporting file \`${rel}\` is not lowercase-hyphen-separated`);
      }

      // Every references/*.md must have a ## Sources section.
      if (relBase === 'references') {
        for (const e of lintReferenceFile(abs)) {
          errors.push(`${rel}: ${e}`);
        }
      }
    }
  };

  walk(skillDir, '');
  return errors;
}

function lintSkill(dirName, skillsDir, knownSkills) {
  const skillDir  = path.join(skillsDir, dirName);
  const skillPath = path.join(skillDir, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return { errors: ['Missing SKILL.md'], warnings: [], exempt: false };
  }

  let content;
  try {
    content = fs.readFileSync(skillPath, 'utf8');
  } catch (err) {
    return { errors: [`Unreadable SKILL.md: ${err.message}`], warnings: [], exempt: false };
  }

  const result = lintSkillContent(dirName, content, knownSkills);
  result.errors.push(...lintSkillLayout(skillDir));
  return result;
}

module.exports = {
  stripFencedCodeBlocks,
  parseFrontmatter,
  topLevelFrontmatterKeys,
  frontmatterYamlErrors,
  extractSkillReferences,
  lintSkillContent,
  lintSkillLayout,
  lintReferenceFile,
  lintSkill,
};
