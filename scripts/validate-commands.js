#!/usr/bin/env node
/**
 * validate-commands.js — lint command and agent persona files.
 * Adapted from addyosmani/agent-skills (MIT): scripts/validate-commands.js
 *
 * Checks:
 *   commands/*.md     — must have `description` frontmatter; every frappe-*
 *                       skill name referenced must be a known skill.
 *   omp/commands/*.md — same rules.
 *   omp/agents/*.md   — frontmatter `name` must equal file stem; must have
 *                       `description`; every `autoloadSkills` entry must be
 *                       a known skill dir at the repo root.
 *
 * Exit codes: 0 = all clear, 1 = one or more errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { parseFrontmatter, frontmatterYamlErrors } = require('./lib/skill-lint');

const ROOT = path.resolve(__dirname, '..');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function knownSkillDirs() {
  return new Set(
    fs.readdirSync(ROOT)
      .filter(d => /^frappe-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  );
}

// Parse a YAML list value from frontmatter block.
// Returns the array items for a key like `autoloadSkills`.
function parseYamlList(content, key) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return [];
  const fmLines = match[1].split(/\r?\n/);
  const keyIdx  = fmLines.findIndex(l => l.match(new RegExp(`^${key}\\s*:`)));
  if (keyIdx === -1) return [];
  const items = [];
  for (let i = keyIdx + 1; i < fmLines.length; i++) {
    const m = fmLines[i].match(/^\s+-\s+(.+)$/);
    if (m) {
      items.push(m[1].trim().replace(/^['"]|['"]$/g, ''));
    } else if (/^[A-Za-z0-9_-]+\s*:/.test(fmLines[i])) {
      break; // hit next key
    }
  }
  return items;
}

// Find all frappe-* skill names explicitly referenced in content.
// Only matches names in backticks, skill:// URIs, or list items — not globs.
function extractFrappeSkillRefs(content) {
  const names = new Set();
  const patterns = [
    /`(frappe-[a-z0-9]+(?:-[a-z0-9]+)+)`/g,
    /skill:\/\/(frappe-[a-z0-9]+(?:-[a-z0-9]+)+)/g,
    /^\s*-\s+(frappe-[a-z0-9]+(?:-[a-z0-9]+)+)\s*$/gm,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) names.add(m[1]);
  }
  return names;
}

// ─── Command file check ───────────────────────────────────────────────────────

function checkCommandFile(file, knownSkills, errors) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (err) {
    errors.push(`${rel}: cannot read — ${err.message}`);
    return;
  }

  const fm = parseFrontmatter(content);
  if (!fm || !fm.description) {
    errors.push(`${rel}: missing required 'description' frontmatter`);
  }

  const yamlErrors = frontmatterYamlErrors(content);
  for (const e of yamlErrors) errors.push(`${rel}: ${e}`);

  const refs = extractFrappeSkillRefs(content);
  for (const name of refs) {
    if (!knownSkills.has(name) && !fs.existsSync(path.join(ROOT, 'omp', 'agents', `${name}.md`))) {
      errors.push(`${rel}: references unknown skill '${name}'`);
    }
  }
}

// ─── Agent persona check ──────────────────────────────────────────────────────

function checkAgentFile(file, knownSkills, errors) {
  const rel  = path.relative(ROOT, file).split(path.sep).join('/');
  const stem = path.basename(file, '.md');
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (err) {
    errors.push(`${rel}: cannot read — ${err.message}`);
    return;
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push(`${rel}: missing or malformed YAML frontmatter`);
    return;
  }

  const yamlErrors = frontmatterYamlErrors(content);
  for (const e of yamlErrors) errors.push(`${rel}: ${e}`);

  if (!fm.name) {
    errors.push(`${rel}: missing required 'name' frontmatter`);
  } else if (fm.name !== stem) {
    errors.push(`${rel}: frontmatter name '${fm.name}' does not match file stem '${stem}'`);
  }

  if (!fm.description) {
    errors.push(`${rel}: missing required 'description' frontmatter`);
  }

  const skills = parseYamlList(content, 'autoloadSkills');
  for (const name of skills) {
    if (!knownSkills.has(name)) {
      errors.push(`${rel}: autoloadSkills entry '${name}' is not a known skill dir`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const known  = knownSkillDirs();
  const errors = [];

  // commands/*.md
  const commandsDir = path.join(ROOT, 'commands');
  if (fs.existsSync(commandsDir) && fs.statSync(commandsDir).isDirectory()) {
    const files = fs.readdirSync(commandsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => path.join(commandsDir, f));
    if (files.length > 0) {
      console.log('Checking commands/*.md...');
      for (const f of files) {
        checkCommandFile(f, known, errors);
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        const fileErrors = errors.filter(e => e.startsWith(rel + ':'));
        if (fileErrors.length === 0) {
          console.log(`  ✓  ${rel}`);
        } else {
          console.log(`  ✗  ${rel}`);
          for (const e of fileErrors) console.log(`       ERROR: ${e.slice(rel.length + 2)}`);
        }
      }
    }
  }

  // omp/commands/*.md
  const ompCommandsDir = path.join(ROOT, 'omp', 'commands');
  if (fs.existsSync(ompCommandsDir) && fs.statSync(ompCommandsDir).isDirectory()) {
    const files = fs.readdirSync(ompCommandsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => path.join(ompCommandsDir, f));
    if (files.length > 0) {
      console.log('\nChecking omp/commands/*.md...');
      const errsBefore = errors.length;
      for (const f of files) {
        const errsBefore2 = errors.length;
        checkCommandFile(f, known, errors);
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        const newErrors = errors.slice(errsBefore2);
        if (newErrors.length === 0) {
          console.log(`  ✓  ${rel}`);
        } else {
          console.log(`  ✗  ${rel}`);
          for (const e of newErrors) console.log(`       ERROR: ${e.slice(rel.length + 2)}`);
        }
      }
      void errsBefore;
    }
  }

  // omp/agents/*.md
  const agentsDir = path.join(ROOT, 'omp', 'agents');
  if (fs.existsSync(agentsDir) && fs.statSync(agentsDir).isDirectory()) {
    const files = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md') && !/^readme\.md$/i.test(f))
      .sort()
      .map(f => path.join(agentsDir, f));
    if (files.length > 0) {
      console.log('\nChecking omp/agents/*.md...');
      for (const f of files) {
        const errsBefore = errors.length;
        checkAgentFile(f, known, errors);
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        const newErrors = errors.slice(errsBefore);
        if (newErrors.length === 0) {
          console.log(`  ✓  ${rel}`);
        } else {
          console.log(`  ✗  ${rel}`);
          for (const e of newErrors) console.log(`       ERROR: ${e.slice(rel.length + 2)}`);
        }
      }
    }
  }

  const status = errors.length > 0 ? 'FAILED' : 'PASSED';
  console.log(`\n${errors.length} error(s) — ${status}`);

  if (errors.length > 0) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`\nERROR: validate-commands failed unexpectedly: ${err.message}`);
  process.exit(1);
}
