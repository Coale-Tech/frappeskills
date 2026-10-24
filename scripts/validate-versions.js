#!/usr/bin/env node
/**
 * validate-versions.js — verify plugin manifest version consistency.
 * Adapted from addyosmani/agent-skills (MIT): scripts/validate-versions.js
 *
 * Checks that every present manifest agrees on version.
 * No-op (exit 0) when none of the manifest files exist yet.
 *
 * Exit codes: 0 = consistent or no manifests present, 1 = mismatch.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MANIFEST_PATHS = [
  'plugin.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
];

function readManifest(rel) {
  const abs = path.join(ROOT, rel);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return {
    version: raw.version ?? raw.plugins?.[0]?.version,
    name:    raw.plugins?.[0]?.name ?? raw.name,
  };
}

function main() {
  const present = MANIFEST_PATHS.filter(p => fs.existsSync(path.join(ROOT, p)));

  if (present.length === 0) {
    console.log('No plugin manifests found — skipping version check.');
    return;
  }

  let errors = 0;
  let ref;

  for (const rel of present) {
    let m;
    try {
      m = readManifest(rel);
    } catch (err) {
      console.log(`  ✗  ${rel}: cannot read — ${err.message}`);
      errors++;
      continue;
    }

    if (!ref) {
      ref = m;
      console.log(`  ✓  ${rel} — version ${m.version}, name ${m.name} (reference)`);
      continue;
    }

    if (m.version !== ref.version) {
      console.log(`  ✗  ${rel}: version ${m.version ?? '<missing>'} does not match reference ${ref.version}`);
      errors++;
    } else {
      console.log(`  ✓  ${rel} — version ${m.version}`);
    }
  }

  const status = errors > 0 ? 'FAILED' : 'PASSED';
  console.log(`\n${present.length} manifest(s) checked — ${errors} error(s) — ${status}`);

  if (errors > 0) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`\nERROR: validate-versions failed unexpectedly: ${err.message}`);
  process.exit(1);
}
