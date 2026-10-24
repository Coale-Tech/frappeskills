#!/usr/bin/env node
// frappe-testing/scripts/qa-score.js
// Reads a findings.json, computes Frappe QA health score, diffs against a baseline.
// Usage: node qa-score.js <findings.json> [--baseline <path>] [--save-baseline] [--selftest]
// Zero deps — pure Node.js stdlib.

'use strict';
const fs = require('fs');
const path = require('path');

// ---- rubric ----------------------------------------------------------------
const CATEGORIES = {
  console:     { weight: 0.15, countBased: true,  label: 'Console/JS errors' },
  network:     { weight: 0.15, countBased: true,  label: 'Network 4xx/5xx' },
  permissions: { weight: 0.10, countBased: false, label: 'Permission surprises' },
  forms:       { weight: 0.15, countBased: false, label: 'Form/submit flow' },
  lists:       { weight: 0.10, countBased: false, label: 'List/report/dashboard' },
  print:       { weight: 0.05, countBased: false, label: 'Print format/PDF' },
  workflow:    { weight: 0.10, countBased: false, label: 'Workflow transitions' },
  a11y:        { weight: 0.05, countBased: false, label: 'Accessibility basics' },
  mobile:      { weight: 0.05, countBased: false, label: 'Mobile viewport' },
  performance: { weight: 0.10, countBased: false, label: 'Performance budget' },
};

// Accept P0-P3 aliases from design-review findings (DesignPostWorker compat)
const SEVERITY_MAP = { P0: 'critical', P1: 'high', P2: 'medium', P3: 'low' };
const DEDUCTIONS   = { critical: 25, high: 15, medium: 8, low: 3 };

function normSev(s) { return SEVERITY_MAP[s] || s; }

function countBasedScore(n) {
  if (n === 0)  return 100;
  if (n <= 3)   return 70;
  if (n <= 10)  return 40;
  return 10;
}

function deductionScore(findings) {
  let score = 100;
  for (const f of findings) score -= (DEDUCTIONS[normSev(f.severity)] || 0);
  return Math.max(0, score);
}

function grade(n) {
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 65) return 'C';
  if (n >= 50) return 'D';
  return 'F';
}

// ---- compute ---------------------------------------------------------------
function computeScores(data) {
  const untested = new Set(data.untested || []);

  // bucket findings by category
  const buckets = {};
  for (const cat of Object.keys(CATEGORIES)) {
    if (!untested.has(cat)) buckets[cat] = [];
  }
  for (const f of (data.findings || [])) {
    if (buckets[f.category] !== undefined) buckets[f.category].push(f);
  }

  // severity counts (for DesignPostWorker compat output)
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of (data.findings || [])) {
    const s = normSev(f.severity);
    if (counts[s] !== undefined) counts[s]++;
  }

  const scores = {};
  let totalW = 0, weightedSum = 0;
  for (const [cat, info] of Object.entries(CATEGORIES)) {
    if (buckets[cat] === undefined) { scores[cat] = null; continue; }
    const s = info.countBased ? countBasedScore(buckets[cat].length) : deductionScore(buckets[cat]);
    scores[cat] = s;
    totalW += info.weight;
    weightedSum += s * info.weight;
  }
  const healthScore = totalW > 0 ? Math.round(weightedSum / totalW) : 0;
  return { scores, healthScore, counts };
}

// ---- output ----------------------------------------------------------------
function pad(s, n) { return (String(s) + ' '.repeat(n)).slice(0, n); }

function printTable(data, scores, healthScore, counts, baseline) {
  const W = 26;
  console.log('\nFrappe QA Health — ' + (data.site || '<site>') + '  ' + (data.date || ''));
  console.log('─'.repeat(65));
  console.log(pad('Category', W) + pad('Score', 7) + pad('Wt', 5) + (baseline ? '  Δ' : ''));
  console.log('─'.repeat(65));
  for (const [cat, info] of Object.entries(CATEGORIES)) {
    const s = scores[cat];
    const prev = baseline && baseline.categoryScores ? baseline.categoryScores[cat] : undefined;
    const delta = (s !== null && prev != null) ? s - prev : null;
    const dStr  = delta !== null ? (delta >= 0 ? '+' + delta : String(delta)) : '';
    console.log(
      pad(info.label, W) +
      pad(s !== null ? s : '—', 7) +
      pad(Math.round(info.weight * 100) + '%', 5) +
      (baseline ? '  ' + dStr : '')
    );
  }
  console.log('─'.repeat(65));
  const g = grade(healthScore);
  if (baseline) {
    const delta = healthScore - baseline.healthScore;
    const sign  = delta >= 0 ? '+' : '';
    console.log(pad('HEALTH SCORE', W) + pad(healthScore + ' (' + g + ')', 7) + '      '
      + sign + delta + ' vs baseline (' + baseline.healthScore + ')');
  } else {
    console.log(pad('HEALTH SCORE', W) + healthScore + '  grade ' + g);
  }
  console.log('counts: critical=' + counts.critical + ' high=' + counts.high
    + ' medium=' + counts.medium + ' low=' + counts.low);
  console.log('');

  if (baseline) {
    const prevIds = new Set(baseline.findingIds || []);
    const curIds  = new Set((data.findings || []).map(f => f.id));
    const resolved = [...prevIds].filter(id => !curIds.has(id));
    const fresh    = [...curIds].filter(id => !prevIds.has(id));
    if (resolved.length) console.log('Resolved: ' + resolved.join(', '));
    if (fresh.length)    console.log('New:      ' + fresh.join(', '));
    if (!resolved.length && !fresh.length) console.log('No change in finding IDs.');
    console.log('');
  }
}

// ---- selftest --------------------------------------------------------------
function selftest() {
  const data = {
    date: '2024-01-15', site: 'test.localhost',
    findings: [
      { id: 'F-001', category: 'console',  severity: 'high',     title: 'JS error on Desk load' },
      { id: 'F-002', category: 'console',  severity: 'medium',   title: 'Deprecation warning' },
      { id: 'F-003', category: 'forms',    severity: 'critical', title: 'Submit fails' },
      { id: 'F-004', category: 'forms',    severity: 'P1',       title: 'P1 alias test' },  // design-review compat
    ],
    untested: ['print', 'a11y', 'mobile'],
  };

  const { scores, healthScore, counts } = computeScores(data);

  // console: 2 findings → countBased → score 70
  if (scores.console !== 70)   { console.error('FAIL console: got ' + scores.console); process.exit(1); }
  // forms: critical(-25) + P1/high(-15) = 100-25-15 = 60
  if (scores.forms !== 60)     { console.error('FAIL forms: got ' + scores.forms); process.exit(1); }
  // network: 0 findings → 100
  if (scores.network !== 100)  { console.error('FAIL network: got ' + scores.network); process.exit(1); }
  // untested → null
  if (scores.print !== null)   { console.error('FAIL print: should be null'); process.exit(1); }
  if (scores.a11y !== null)    { console.error('FAIL a11y: should be null');  process.exit(1); }
  // severity counts
  if (counts.critical !== 1)   { console.error('FAIL counts.critical: got ' + counts.critical); process.exit(1); }
  if (counts.high !== 2)       { console.error('FAIL counts.high: got ' + counts.high + ' (P1 must alias high)'); process.exit(1); }
  // grade on a score ≥90 should be A
  if (grade(92) !== 'A')       { console.error('FAIL grade 92: got ' + grade(92)); process.exit(1); }
  if (grade(79) !== 'C')       { console.error('FAIL grade 79: got ' + grade(79)); process.exit(1); }

  console.log('selftest PASS — console=' + scores.console + ' forms=' + scores.forms
    + ' network=' + scores.network + ' healthScore=' + healthScore);
  process.exit(0);
}

// ---- main ------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes('--selftest')) { selftest(); }
if (!args.length || args.includes('--help')) {
  console.log([
    'Usage: node qa-score.js <findings.json> [options]',
    'Options:',
    '  --baseline <path>   diff against a saved baseline',
    '  --save-baseline     write .qa/baseline.json next to findings file',
    '  --selftest          run self-check and exit 0/1',
    '',
    'findings.json schema: { date, site, findings: [{id, category, severity, title}], untested: [] }',
    'severity: critical|high|medium|low  or P0|P1|P2|P3 (design-review compat)',
    'category: console|network|permissions|forms|lists|print|workflow|a11y|mobile|performance',
  ].join('\n'));
  process.exit(0);
}

let data, baseline = null;
try { data = JSON.parse(fs.readFileSync(args[0], 'utf8')); }
catch (e) { console.error('Cannot read findings: ' + e.message); process.exit(1); }

const bi = args.indexOf('--baseline');
if (bi >= 0) {
  try { baseline = JSON.parse(fs.readFileSync(args[bi + 1], 'utf8')); }
  catch (e) { console.error('Cannot read baseline: ' + e.message); process.exit(1); }
}

const { scores, healthScore, counts } = computeScores(data);
printTable(data, scores, healthScore, counts, baseline);

if (args.includes('--save-baseline')) {
  const out = {
    date: data.date, site: data.site, healthScore,
    categoryScores: scores,
    findingIds: (data.findings || []).map(f => f.id),
  };
  const dest = path.join(path.dirname(path.resolve(args[0])), '.qa', 'baseline.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('Baseline saved → ' + dest);
}
