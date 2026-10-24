#!/usr/bin/env node
/**
 * selftest.js — zero-dep self-check for the frappeskills validator toolchain.
 *
 * Builds a temp directory with one good and several bad skills, runs the
 * linter functions, and asserts each produces exactly the expected outcome.
 * Exits non-zero on any assertion failure.
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const { lintSkillContent, lintSkill, lintReferenceFile } = require('./lib/skill-lint');
const { findViolations } = require('./validate-reference-links');

let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`  pass: ${msg}`);
  }
}

function assertIncludes(arr, substr, msg) {
  const found = arr.some(s => s.includes(substr));
  assert(found, `${msg} — expected entry containing: "${substr}"\n         got: [${arr.map(s => `"${s}"`).join(', ')}]`);
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

// A valid SKILL.md satisfying all 11 sections, 6+ Rationalizations, 6+ Red Flags, < 200 lines.
const GOOD_CONTENT = `---
name: test-good
description: "Self-test fixture. Use when running the frappeskills validator selftest."
---

# Test Good

Self-test fixture skill.

## When to use

- When the selftest runs

## Inputs required

- Nothing

## Procedure

### 0) Do nothing

No-op step.

## Verification

- [ ] Nothing to verify

## Failure modes / debugging

No failures expected.

## Escalation

No escalation needed.

## References

No references.

## Guardrails

None.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| Skip it | Don't |
| Too slow | Still required |
| Works locally | Not proof |
| One-time only | Never is |
| It is fine | Check first |
| Already done | Verify it |

## Red Flags

- Nothing is checked
- Tests are disabled
- Empty function bodies
- No assertions
- Hardcoded test data
- Always passing

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---|---|---|
| Skip steps | Misses bugs | Follow the procedure |
`;

// Enough filler to push a skill over 230 lines.
const FILLER = Array.from({ length: 180 }, (_, i) => `<!-- filler line ${i + 1} -->`).join('\n');

const OVERSIZE_CONTENT = GOOD_CONTENT.replace(
  '## Common Mistakes\n\n| Mistake | Why It Fails | Fix |\n|---|---|---|\n| Skip steps | Misses bugs | Follow the procedure |',
  `## Common Mistakes\n\n| Mistake | Why It Fails | Fix |\n|---|---|---|\n| Skip steps | Misses bugs | Follow the procedure |\n\n${FILLER}`
);

const MISSING_RED_FLAGS = GOOD_CONTENT
  .replace('\n## Red Flags\n\n- Nothing is checked\n- Tests are disabled\n- Empty function bodies\n- No assertions\n- Hardcoded test data\n- Always passing\n', '\n');

const WRONG_NAME_CONTENT = GOOD_CONTENT.replace('name: test-good', 'name: bad-name');

const DEAD_REF_CONTENT = GOOD_CONTENT.replace(
  '## Escalation\n\nNo escalation needed.',
  '## Escalation\n\nUse the `frappe-nonexistent` skill.'
);

const BROKEN_LINK_CONTENT = GOOD_CONTENT.replace(
  '## References\n\nNo references.',
  '## References\n\n[See data](references/nonexistent.md)'
);

// ─── In-memory lintSkillContent tests ─────────────────────────────────────────

console.log('\n=== lintSkillContent ===');

{
  const knownSkills = new Set(['test-good', 'frappe-testing']);
  const { errors, warnings } = lintSkillContent('test-good', GOOD_CONTENT, knownSkills);
  assert(errors.length === 0,   'good skill: no errors');
  assert(warnings.length === 0, 'good skill: no warnings');
}

{
  const { errors } = lintSkillContent('test-missing-section', MISSING_RED_FLAGS, new Set(['test-missing-section']));
  assert(errors.length > 0, 'missing Red Flags: produces errors');
  assertIncludes(errors, '## Red Flags', 'missing Red Flags: correct section named');
}

{
  // wrong name: frontmatter says bad-name but dir is test-wrong-name
  const { errors } = lintSkillContent('test-wrong-name', WRONG_NAME_CONTENT, new Set(['test-wrong-name']));
  assert(errors.length > 0, 'wrong name: produces errors');
  assertIncludes(errors, "bad-name", 'wrong name: error mentions mismatched name');
}

{
  // oversize: > 230 lines → error
  const lineCount = (OVERSIZE_CONTENT.match(/\n/g) || []).length;
  assert(lineCount > 230, `oversize content actually has ${lineCount} lines (need > 230)`);
  const { errors } = lintSkillContent('test-oversize', OVERSIZE_CONTENT.replace('name: test-good', 'name: test-oversize'), new Set(['test-oversize']));
  assert(errors.length > 0, 'oversize: produces errors');
  assertIncludes(errors, 'lines', 'oversize: error mentions line count');
}

{
  // dead cross-reference → warning
  const { warnings } = lintSkillContent('test-dead-ref', DEAD_REF_CONTENT.replace('name: test-good', 'name: test-dead-ref'), new Set(['test-dead-ref', 'frappe-testing']));
  assert(warnings.length > 0, 'dead cross-ref: produces warnings');
  assertIncludes(warnings, 'frappe-nonexistent', 'dead cross-ref: warning names the unknown skill');
}

// ─── Filesystem-based tests ────────────────────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappeskills-selftest-'));

try {
  console.log('\n=== lintReferenceFile ===');

  // Test: references file without ## Sources → error
  const noSrcPath = path.join(tmpDir, 'data.md');
  fs.writeFileSync(noSrcPath, '# Data\n\nSome content.\n');
  {
    const errs = lintReferenceFile(noSrcPath);
    assert(errs.length > 0, 'no Sources: lintReferenceFile returns errors');
    assertIncludes(errs, 'Sources', 'no Sources: error mentions Sources');
  }

  // Test: references file WITH ## Sources → clean
  const withSrcPath = path.join(tmpDir, 'good.md');
  fs.writeFileSync(withSrcPath, '# Good\n\nContent.\n\n## Sources\n\n- apps/frappe/something.py\n');
  {
    const errs = lintReferenceFile(withSrcPath);
    assert(errs.length === 0, 'with Sources: lintReferenceFile clean');
  }

  console.log('\n=== lintSkill (filesystem) ===');

  // Create test-good skill dir
  const goodDir = path.join(tmpDir, 'test-good');
  fs.mkdirSync(goodDir);
  fs.writeFileSync(path.join(goodDir, 'SKILL.md'), GOOD_CONTENT);
  {
    const { errors, warnings } = lintSkill('test-good', tmpDir, new Set(['test-good']));
    assert(errors.length === 0,   'lintSkill good: no errors');
    assert(warnings.length === 0, 'lintSkill good: no warnings');
  }

  // Create test-no-sources skill dir (references file lacks ## Sources)
  const noSrcDir = path.join(tmpDir, 'test-no-sources');
  fs.mkdirSync(noSrcDir);
  fs.writeFileSync(path.join(noSrcDir, 'SKILL.md'), GOOD_CONTENT.replace('name: test-good', 'name: test-no-sources'));
  fs.mkdirSync(path.join(noSrcDir, 'references'));
  fs.writeFileSync(path.join(noSrcDir, 'references', 'data.md'), '# Data\n\nNo Sources here.\n');
  {
    const { errors } = lintSkill('test-no-sources', tmpDir, new Set(['test-no-sources']));
    assert(errors.length > 0, 'no Sources in layout: lintSkill returns errors');
    assertIncludes(errors, 'Sources', 'no Sources in layout: error mentions Sources');
  }

  console.log('\n=== findViolations (broken link) ===');

  // Create test-broken-link skill dir
  const brokenDir = path.join(tmpDir, 'test-broken-link');
  fs.mkdirSync(brokenDir);
  fs.writeFileSync(
    path.join(brokenDir, 'SKILL.md'),
    BROKEN_LINK_CONTENT.replace('name: test-good', 'name: test-broken-link')
  );
  {
    const viols = findViolations(path.join(brokenDir, 'SKILL.md'));
    assert(viols.length > 0, 'broken link: findViolations returns violations');
    assertIncludes(viols.map(v => v.url), 'nonexistent', 'broken link: violation names the missing file');
  }

} finally {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`selftest FAILED — ${failures} assertion(s) failed`);
  process.exit(1);
} else {
  console.log('selftest PASSED');
}
