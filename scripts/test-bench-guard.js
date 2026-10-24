#!/usr/bin/env node
// test-bench-guard.js — zero-dependency smoke tests for bench-guard.sh
// Run: node scripts/test-bench-guard.js
// Requires: bash, python3 (or node for partial coverage)

'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, 'bench-guard.sh');
let passed = 0; let failed = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(input, extraEnv = {}) {
  const result = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    timeout: 8000,
  });
  const stdout = (result.stdout || '').trim();
  if (!stdout || stdout === '{}') return 'allow';
  try {
    const d = JSON.parse(stdout);
    return (d.hookSpecificOutput && d.hookSpecificOutput.permissionDecision) || 'allow';
  } catch (_) {
    return 'error:' + stdout.slice(0, 120);
  }
}

function bash(label, cmd, expected, extraEnv = {}) {
  const got = run({ tool_name: 'Bash', tool_input: { command: cmd } }, extraEnv);
  if (got === expected) {
    console.log(`  ok  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}: expected=${expected} got=${got}  cmd=${cmd}`);
    failed++;
  }
}

function file(label, fpath, expected, extraEnv = {}) {
  const got = run({ tool_name: 'Edit', tool_input: { file_path: fpath } }, extraEnv);
  if (got === expected) {
    console.log(`  ok  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}: expected=${expected} got=${got}  path=${fpath}`);
    failed++;
  }
}

// ── DENY: bench destructive subcommands ───────────────────────────────────────
console.log('\n── DENY: bench drop-site / reinstall / restore --force ──');

bash('bare bench drop-site',
  'bench drop-site', 'deny');

bash('bench drop-site with site arg',
  'bench drop-site mysite', 'deny');

bash('bench --site X drop-site',
  'bench --site mysite drop-site', 'deny');

bash('bench drop-site --force',
  'bench drop-site mysite --force', 'deny');

bash('bench reinstall',
  'bench reinstall', 'deny');

bash('bench --site X reinstall',
  'bench --site mysite reinstall', 'deny');

bash('bench restore --force',
  'bench --site mysite restore /backups/mysite-2024.sql.gz --force', 'deny');

// ── DENY: sudo / path prefix / env-var prefix ──────────────────────────────
console.log('\n── DENY: sudo / path-prefix / env-var prefix ──');

bash('sudo bench drop-site',
  'sudo bench drop-site mysite', 'deny');

bash('bench via absolute path',
  '/usr/local/bin/bench drop-site mysite', 'deny');

bash('bench via relative path',
  './bin/bench drop-site mysite', 'deny');

bash('env-var prefix',
  'BENCH_VERBOSE=1 bench drop-site mysite', 'deny');

// ── DENY: chained / subshell ──────────────────────────────────────────────
console.log('\n── DENY: chained & subshell ──');

bash('chained: allow && deny',
  'bench list-apps && bench drop-site mysite', 'deny');

bash('chained: deny; allow',
  'bench drop-site mysite; bench version', 'deny');

bash('subshell $(bench drop-site)',
  '$(bench drop-site mysite)', 'deny');

// ── DENY: rm -rf on bench dirs ────────────────────────────────────────────
console.log('\n── DENY: rm -rf on bench directories ──');

bash('rm -rf sites/',
  'rm -rf sites/', 'deny');

bash('rm -rf apps/',
  'rm -rf apps/', 'deny');

bash('rm -rf env/',
  'rm -rf env/', 'deny');

bash('rm -rf sites/*/private',
  'rm -rf sites/mysite/private', 'deny');

bash('rm -Rf apps/ (BSD uppercase R)',
  'rm -Rf apps/', 'deny');

bash('rm --recursive sites/',
  'rm --recursive sites/', 'deny');

bash('sudo rm -rf apps/',
  'sudo rm -rf apps/', 'deny');

// ── ASK: bench MEDIUM operations ──────────────────────────────────────────
console.log('\n── ASK: bench migrate / update / setup / etc. ──');

bash('bench migrate',
  'bench migrate', 'ask');

bash('bench --site X migrate',
  'bench --site mysite migrate', 'ask');

bash('bench update',
  'bench update', 'ask');

bash('bench --site X update',
  'bench --site mysite update', 'ask');

bash('bench setup production',
  'bench setup production', 'ask');

bash('bench setup nginx',
  'bench setup nginx', 'ask');

bash('bench setup supervisor',
  'bench setup supervisor', 'ask');

bash('bench remove-app',
  'bench remove-app myapp', 'ask');

bash('bench uninstall-app',
  'bench uninstall-app myapp', 'ask');

bash('bench --site X clear-cache',
  'bench --site mysite clear-cache', 'ask');

bash('bench --site X mariadb',
  'bench --site mysite mariadb', 'ask');

bash('bench --site X console',
  'bench --site mysite console', 'ask');

bash('bench restore without --force',
  'bench --site mysite restore /backups/mysite-2024.sql.gz', 'ask');

bash('bench build --force',
  'bench build --force', 'ask');

bash('bench execute with frappe.db.sql DELETE',
  "bench --site mysite execute 'frappe.db.sql(\"DELETE FROM tabLead WHERE 1=1\")'", 'ask');

bash('bench execute with frappe.db.sql TRUNCATE',
  "bench --site mysite execute 'frappe.db.sql(\"TRUNCATE tabError\")'", 'ask');

// ── ASK: git destructive ──────────────────────────────────────────────────
console.log('\n── ASK: git force-push / reset --hard ──');

bash('git push --force',
  'git push --force', 'ask');

bash('git push -f origin main',
  'git push -f origin main', 'ask');

bash('git push with plus-refspec',
  'git push origin +main', 'ask');

bash('git reset --hard',
  'git reset --hard HEAD~3', 'ask');

// ── ASK: direct SQL ───────────────────────────────────────────────────────
console.log('\n── ASK: direct SQL DROP/TRUNCATE/DELETE ──');

bash('mariadb with DELETE FROM',
  'mariadb -u root mydb -e "DELETE FROM tabFoo WHERE 1=1"', 'ask');

bash('mysql with DROP TABLE',
  'mysql -u root -p mydb -e "DROP TABLE tabOld"', 'ask');

// ── ASK: FRAPPE_GUARD_PROD_SITES env ─────────────────────────────────────
console.log('\n── ASK: production site env regex ──');

bash('bench migrate on prod site (env match)',
  'bench --site production migrate', 'ask',
  { FRAPPE_GUARD_PROD_SITES: '^(prod|production|live)' });

bash('bench remove-app on prod site',
  'bench --site live remove-app myapp', 'ask',
  { FRAPPE_GUARD_PROD_SITES: '^(prod|production|live)' });

// ── ALLOW: read-only bench commands ───────────────────────────────────────
console.log('\n── ALLOW: read-only bench commands ──');

bash('bench list-apps',
  'bench list-apps', 'allow');

bash('bench version',
  'bench version', 'allow');

bash('bench doctor',
  'bench doctor', 'allow');

bash('bench --site X list-apps',
  'bench --site mysite list-apps', 'allow');

bash('bench --site X backup --with-files',
  'bench --site mysite backup --with-files', 'allow');

bash('bench --site X show-pending-jobs',
  'bench --site mysite show-pending-jobs', 'allow');

bash('bench get-app (unknown subcommand)',
  'bench get-app https://github.com/frappe/erpnext', 'allow');

// ── ALLOW: echo / no-op strings containing bench keywords ─────────────────
console.log('\n── ALLOW: bench as argument, not command ──');

bash('echo bench drop-site (no invocation)',
  'echo bench drop-site mysite', 'allow');

bash('echo quoted bench drop-site',
  'echo "bench drop-site is dangerous — run backup first"', 'allow');

bash('bench setup redis (safe setup target)',
  'bench setup redis', 'allow');

// ── ALLOW: safe rm / git ──────────────────────────────────────────────────
console.log('\n── ALLOW: safe rm / git ──');

bash('rm -rf node_modules (not a bench dir)',
  'rm -rf node_modules', 'allow');

bash('git push origin main (no force)',
  'git push origin main', 'allow');

bash('git status',
  'git status', 'allow');

// ── File tier: DENY (core apps) ───────────────────────────────────────────
console.log('\n── File DENY: core app edits ──');

file('apps/frappe/hooks.py',
  'apps/frappe/hooks.py', 'deny');

file('apps/erpnext/controllers/taxes_and_totals.py',
  'apps/erpnext/controllers/taxes_and_totals.py', 'deny');

file('apps/hrms/payroll/doctype/salary_slip/salary_slip.py',
  'apps/hrms/payroll/doctype/salary_slip/salary_slip.py', 'deny');

file('absolute path to frappe app',
  '/home/user/bench1/apps/frappe/config/desktop.py', 'deny');

file('FRAPPE_GUARD_PROTECTED_APPS: custom protected app',
  'apps/myprotected/hooks.py', 'deny',
  { FRAPPE_GUARD_PROTECTED_APPS: 'myprotected' });

// ── File tier: ASK (config) ───────────────────────────────────────────────
console.log('\n── File ASK: sensitive config ──');

file('sites/*/site_config.json',
  'sites/mysite/site_config.json', 'ask');

file('absolute sites/*/site_config.json',
  '/home/user/bench1/sites/production/site_config.json', 'ask');

file('common_site_config.json',
  'common_site_config.json', 'ask');

file('apps.txt',
  'apps.txt', 'ask');

// ── File tier: ALLOW (custom app / other files) ───────────────────────────
console.log('\n── File ALLOW: custom app edits ──');

file('custom app controller',
  'apps/myapp/controllers/order.py', 'allow');

file('custom app SKILL.md (not under apps/)',
  'frappe-code-review/SKILL.md', 'allow');

file('site private backup file (not in deny/ask list)',
  'sites/mysite/private/backups/mysite-123.sql.gz', 'allow');


// ══════════════════════════════════════════════════════════════════════════
// Adversarial tests (added after bench-guard improvements)
// ══════════════════════════════════════════════════════════════════════════

// ── DENY: flag ordering / spacing variants ────────────────────────────────
console.log('\n── DENY: bench command flag / spacing variants ──');

bash('bench --site x drop-site (site flag before subcommand)',
  'bench --site x drop-site', 'deny');

bash('bench drop-site --force mysite (force after site)',
  'bench drop-site mysite --force', 'deny');

bash('bench  drop-site (double space)',
  'bench  drop-site', 'deny');

bash('bench\\tdrop-site (tab separated)',
  'bench\tdrop-site', 'deny');

// ── DENY: env-var prefix ─────────────────────────────────────────────────
console.log('\n── DENY: env-var prefix before bench ──');

bash('FOO=1 bench drop-site',
  'FOO=1 bench drop-site mysite', 'deny');

bash('BENCH_VERBOSE=1 bench drop-site',
  'BENCH_VERBOSE=1 bench drop-site mysite', 'deny');

// ── DENY: command / builtin wrapper (now caught via skip-list) ────────────
console.log('\n── DENY: command/builtin wrapper ──');

bash('command bench drop-site',
  'command bench drop-site mysite', 'deny');

bash('builtin bench drop-site',
  'builtin bench drop-site mysite', 'deny');

// ── DENY: bash/sh -c wrapper ─────────────────────────────────────────────
console.log('\n── DENY: bash/sh -c wrapper ──');

bash('bash -c "bench drop-site mysite"',
  'bash -c "bench drop-site mysite"', 'deny');

bash('sh -c "bench reinstall"',
  'sh -c "bench reinstall"', 'deny');

bash('sh -c bench restore --force (force inside wrapper)',
  'sh -c "bench --site x restore /backup.sql.gz --force"', 'deny');

// ── DENY: rm -rf with ./ prefix (now caught) ─────────────────────────────
console.log('\n── DENY: rm variants (dot-slash prefix) ──');

bash('rm -rf ./sites (dot-slash prefix)',
  'rm -rf ./sites', 'deny');

bash('rm -rf ./apps/ (dot-slash with trailing slash)',
  'rm -rf ./apps/', 'deny');

bash('rm -rf ./env/ (dot-slash, trailing slash)',
  'rm -rf ./env/', 'deny');

// ── ALLOW: rm without slash/prefix (known limit — documented) ─────────────
console.log('\n── ALLOW: rm known limits (no trailing slash, no dot-slash) ──');

bash('rm -fr apps (no trailing slash — known limit)',
  'rm -fr apps', 'allow');

bash('rm -rf env (no trailing slash — known limit)',
  'rm -rf env', 'allow');

bash("echo 'rm -rf sites' > note.txt (echo, not command — no false positive)",
  "echo 'rm -rf sites' > note.txt", 'allow');

// ── ASK: git clean ────────────────────────────────────────────────────────
console.log('\n── ASK: git clean ──');

bash('git clean -fdx',
  'git clean -fdx', 'ask');

bash('git clean -f (force only)',
  'git clean -f', 'ask');

bash('git clean -fd (force+directories)',
  'git clean -fd', 'ask');

// ── ASK: git push --force-with-lease (caught by --force\b match) ─────────
console.log('\n── ASK: git push --force-with-lease ──');

bash('git push origin main --force-with-lease',
  'git push origin main --force-with-lease', 'ask');

bash('git push -f origin main (short flag before remote)',
  'git push -f origin main', 'ask');

bash('git push origin main -f (short flag at end)',
  'git push origin main -f', 'ask');

// ── ALLOW: false-positive checks ──────────────────────────────────────────
console.log('\n── ALLOW: false-positive checks ──');

bash('grep drop-site README (no bench invocation)',
  'grep drop-site README', 'allow');

bash('git commit -m "bench drop-site notes" (keyword in message)',
  'git commit -m "bench drop-site notes"', 'allow');

bash('rm -rf node_modules (not a bench dir)',
  'rm -rf node_modules', 'allow');

bash('rm -rf /tmp/foo (not a bench dir)',
  'rm -rf /tmp/foo', 'allow');

bash('bench setup redis (safe setup target)',
  'bench setup redis', 'allow');

bash('bench setup socketio (safe setup target)',
  'bench setup socketio', 'allow');

bash('bench start (not in deny/ask lists)',
  'bench start', 'allow');

bash('bench restart (not in deny/ask lists)',
  'bench restart', 'allow');

bash('bench get-app (install, not destructive)',
  'bench get-app https://github.com/frappe/erpnext', 'allow');

bash('bench execute frappe.db.count (no sql mutation)',
  "bench --site mysite execute 'frappe.db.count(\"Error Log\")'", 'allow');

bash('mariadb SELECT only (no destructive SQL)',
  'mariadb -u root mydb -e "SELECT count(*) FROM tabUser"', 'allow');

bash('git push origin main (no force flag)',
  'git push origin main', 'allow');

bash('git status (read-only git)',
  'git status', 'allow');

bash('git log --oneline (read-only git)',
  'git log --oneline -20', 'allow');

bash('git clean (no -f/-d flags, just listing)',
  'git clean -n', 'allow');

// ── ALLOW: xargs/find wrappers (known limits, not caught) ─────────────────
console.log('\n── ALLOW: known bypass patterns (documented limits) ──');

bash('xargs bench drop-site (known limit: not caught)',
  'xargs -I{} bench drop-site {}', 'allow');

bash('find sites -delete (known limit: find -delete not caught)',
  'find sites -delete', 'allow');

bash('bench cmd in variable (known limit: not caught)',
  'CMD="bench drop-site mysite"; $CMD', 'allow');

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
if (failed === 0) {
  console.log(`bench-guard tests PASSED  (${passed} ok, 0 failed)`);
} else {
  console.error(`bench-guard tests FAILED  (${passed} ok, ${failed} FAILED)`);
  process.exitCode = 1;
}
