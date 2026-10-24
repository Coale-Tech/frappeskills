#!/usr/bin/env node
/**
 * validate-skills.js — lint every frappe-* skill at the repo root.
 * Adapted from addyosmani/agent-skills (MIT): scripts/validate-skills.js
 *
 * Skills live at the repo root as frappe-* dirs (no skills/ subdir).
 * Exit codes: 0 = all clear, 1 = one or more errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { lintSkill } = require('./lib/skill-lint');

const ROOT = path.resolve(__dirname, '..');

function main() {
  const skillDirs = fs.readdirSync(ROOT)
    .filter(d => /^frappe-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
    .sort();

  if (skillDirs.length === 0) {
    console.log('No frappe-* skill directories found at repo root.');
    return;
  }

  const knownSkills = new Set(skillDirs);
  let totalErrors   = 0;
  let totalWarnings = 0;

  for (const dirName of skillDirs) {
    const { errors, warnings, exempt } = lintSkill(dirName, ROOT, knownSkills);
    totalErrors   += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0 && warnings.length === 0) {
      const tag = exempt ? ' (partial section exemption)' : '';
      console.log(`  ✓  ${dirName}${tag}`);
    } else {
      const icon = errors.length > 0 ? '  ✗ ' : '  ⚠ ';
      console.log(`${icon} ${dirName}`);
      for (const msg of errors)   console.log(`       ERROR: ${msg}`);
      for (const msg of warnings) console.log(`       WARN:  ${msg}`);
    }
  }

  const status = totalErrors > 0 ? 'FAILED' : totalWarnings > 0 ? 'PASSED WITH WARNINGS' : 'PASSED';
  console.log(`\n${skillDirs.length} skills checked — ${totalErrors} error(s), ${totalWarnings} warning(s) — ${status}`);

  if (totalErrors > 0) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`\nERROR: validate-skills failed unexpectedly: ${err.message}`);
  process.exit(1);
}
