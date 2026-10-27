#!/usr/bin/env node
// frappe-spec-driven-development/scripts/spec-drift.js
// Compares a spec written from assets/spec-template.md with the DocType JSON in an app.
// Reports ONLY differences: fields (name, type), is_submittable, permission roles.
// Usage: node spec-drift.js <spec.md> <app-dir> [--selftest]
// Exit: 0 no drift, 1 drift found, 2 usage error or selftest failure.
// Zero deps. Reads files only. Rules paraphrased from the drift-report idea in
// google/elephant-goldfish-model (Apache-2.0); see NOTICE.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const scrub = (s) => s.replace(/[ -]/g, '_').toLowerCase(); // frappe.scrub
const LAYOUT = new Set(['Section Break', 'Column Break', 'Tab Break', 'Heading', 'Fold']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'public', '__pycache__']);

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/`/g, ''));
const isRow = (line) => /^\s*\|/.test(line);
const isSep = (line) => /^\s*\|[\s:|-]+\|?\s*$/.test(line);

// Rows of the table starting at lines[i] (header row): [{col: value}]. Returns [rows, nextIndex].
function table(lines, i) {
  const head = cells(lines[i]).map((c) => c.toLowerCase());
  const rows = [];
  let j = i + 1;
  if (j < lines.length && isSep(lines[j])) j++;
  for (; j < lines.length && isRow(lines[j]); j++) {
    const c = cells(lines[j]);
    rows.push(Object.fromEntries(head.map((h, k) => [h, c[k] || ''])));
  }
  return [rows, j];
}

function parseSpec(text) {
  const lines = text.split('\n');
  const docs = [];
  const perms = {}; // doctype -> Set(role)
  let cur = null;
  let inPerm = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h2 = /^##\s+(.*)/.exec(l);
    const h3 = /^###\s+DocType:\s*(.+?)\s*$/.exec(l);
    if (h3) {
      inPerm = false;
      cur = h3[1].startsWith('[') ? null : { name: h3[1], fields: null, submittable: null };
      if (cur) docs.push(cur);
      continue;
    }
    if (h2 && !/^###/.test(l)) {
      cur = null;
      inPerm = /^permission matrix/i.test(h2[1]);
    }
    if (!isRow(l) || isSep(l)) continue;
    const head = cells(l).map((c) => c.toLowerCase());
    if (cur && head.includes('fieldname') && head.includes('fieldtype')) {
      const [rows, next] = table(lines, i);
      cur.fields = cur.fields || {};
      for (const r of rows) {
        if (/^[a-z_][a-z0-9_]*$/.test(r.fieldname)) cur.fields[r.fieldname] = r.fieldtype;
      }
      i = next - 1;
    } else if (cur && head[0] === 'property') {
      const [rows, next] = table(lines, i);
      for (const r of rows) {
        const v = r.value.toLowerCase();
        if (r.property === 'is_submittable' && (v === 'yes' || v === 'no')) cur.submittable = v === 'yes';
      }
      i = next - 1;
    } else if (inPerm && head.includes('role')) {
      const [rows, next] = table(lines, i);
      let last = '';
      for (const r of rows) {
        const dt = r.doctype || last;
        last = dt;
        if (dt && r.role) (perms[dt] = perms[dt] || new Set()).add(r.role);
      }
      i = next - 1;
    }
  }
  // A matrix that never names a DocType applies to the only DocType in the spec.
  if (perms[''] && docs.length === 1) perms[docs[0].name] = perms[''];
  return { docs, perms };
}

function findJson(appDir, name) {
  const s = scrub(name);
  const suffix = path.join('doctype', s, s + '.json');
  const stack = [appDir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(p);
      } else if (p.endsWith(suffix)) {
        return p;
      }
    }
  }
  return null;
}

function drift(specText, appDir) {
  const { docs, perms } = parseSpec(specText);
  const out = [];
  for (const d of docs) {
    const diffs = [];
    const file = findJson(appDir, d.name);
    if (!file) {
      diffs.push('DocType JSON not found in the app (spec is ahead of the code, or the name differs)');
    } else {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const code = Object.fromEntries((j.fields || []).filter((f) => !LAYOUT.has(f.fieldtype)).map((f) => [f.fieldname, f.fieldtype]));
      for (const [n, t] of Object.entries(d.fields || {})) {
        if (!(n in code)) diffs.push(`field \`${n}\` is in the spec but not in the code`);
        else if (t && t.toLowerCase() !== code[n].toLowerCase()) diffs.push(`field \`${n}\` is ${t} in the spec but ${code[n]} in the code`);
      }
      if (d.fields) {
        for (const [n, t] of Object.entries(code)) if (!(n in d.fields)) diffs.push(`field \`${n}\` (${t}) is in the code but not in the spec`);
      }
      const sub = !!j.is_submittable;
      if (d.submittable !== null && d.submittable !== sub) diffs.push(`is_submittable is ${d.submittable ? 'Yes' : 'No'} in the spec but ${sub ? 'Yes' : 'No'} in the code`);
      const want = perms[d.name];
      if (want) {
        const have = new Set((j.permissions || []).map((p) => p.role));
        for (const r of want) if (!have.has(r)) diffs.push(`role \`${r}\` is in the permission matrix but has no permission row in the code`);
        for (const r of have) if (!want.has(r)) diffs.push(`role \`${r}\` has a permission row in the code but is not in the permission matrix`);
      }
    }
    out.push({ name: d.name, diffs });
  }
  return out;
}

function report(results) {
  let n = 0;
  const text = results
    .map((r) => {
      n += r.diffs.length;
      return `## ${r.name}\n\n` + (r.diffs.length ? r.diffs.map((x) => `- ${x}`).join('\n') : 'No drift detected');
    })
    .join('\n\n');
  return { text: text || 'No `### DocType:` sections found in the spec.', n };
}

function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-drift-'));
  const dir = path.join(tmp, 'app', 'mod', 'doctype', 'salary_advance');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'salary_advance.json'), JSON.stringify({
    name: 'Salary Advance',
    is_submittable: 1,
    fields: [
      { fieldname: 'sec', fieldtype: 'Section Break' },
      { fieldname: 'employee', fieldtype: 'Link' },
      { fieldname: 'amount', fieldtype: 'Data' },
      { fieldname: 'remarks', fieldtype: 'Text' },
    ],
    permissions: [{ role: 'Employee' }, { role: 'Auditor' }],
  }));
  const spec = [
    '### DocType: Salary Advance', '',
    '| Property | Value |', '|---|---|', '| `is_submittable` | No |', '',
    '| fieldname | fieldtype | options | mandatory | notes |', '|---|---|---|---|---|',
    '| employee | Link | Employee | ✓ | |', '| amount | Currency | | ✓ | |', '| reason | Text | | | |', '| ... | | | | |', '',
    '## Permission matrix', '',
    '| DocType | Role | Read |', '|---|---|---|', '| Salary Advance | Employee | own |', '| | HR Manager | all |', '',
    '### DocType: Ghost', '',
    '| fieldname | fieldtype |', '|---|---|', '| x | Data |', '',
  ].join('\n');
  const r = Object.fromEntries(drift(spec, path.join(tmp, 'app')).map((x) => [x.name, x.diffs.join('\n')]));
  const sa = r['Salary Advance'];
  const want = [
    'field `reason` is in the spec but not in the code',
    'field `amount` is Currency in the spec but Data in the code',
    'field `remarks` (Text) is in the code but not in the spec',
    'is_submittable is No in the spec but Yes in the code',
    'role `HR Manager` is in the permission matrix but has no permission row in the code',
    'role `Auditor` has a permission row in the code but is not in the permission matrix',
  ];
  const bad = [];
  for (const w of want) if (!sa.includes(w)) bad.push(`missing: ${w}`);
  if (sa.includes('employee')) bad.push('matching field `employee` was reported');
  if (sa.includes('Section Break') || sa.includes('`sec`')) bad.push('layout field was reported');
  if (!r.Ghost.includes('DocType JSON not found')) bad.push('missing JSON not reported');
  const clean = report(drift(spec.split('### DocType: Ghost')[0].replace('| No |', '| Yes |')
    .replace('| amount | Currency', '| amount | Data').replace('| reason | Text | | | |', '| remarks | Text | | | |')
    .replace('| | HR Manager | all |', '| | Auditor | all |'), path.join(tmp, 'app')));
  if (clean.n !== 0 || !clean.text.includes('No drift detected')) bad.push(`clean spec reported drift: ${clean.text}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (bad.length) {
    process.stderr.write('selftest FAILED\n' + bad.join('\n') + '\n');
    process.exit(2);
  }
  console.log('selftest PASSED');
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  selftest();
} else if (args.length !== 2) {
  process.stderr.write('Usage: node spec-drift.js <spec.md> <app-dir> [--selftest]\n');
  process.exit(2);
} else {
  const results = drift(fs.readFileSync(args[0], 'utf8'), args[1]);
  const { text, n } = report(results);
  console.log(text);
  process.exit(results.length === 0 ? 2 : n ? 1 : 0);
}
