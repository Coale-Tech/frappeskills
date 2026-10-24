#!/usr/bin/env bash
# bench-guard.sh — PreToolUse hook: Frappe bench safety guard
# Advisory guard, NOT a security boundary. Bash commands can always bypass it.
# See docs/bench-guard.md for install instructions and rationale.
#
# Bash tier  (tool_input.command):
#   HIGH/DENY  — bench drop-site, reinstall, restore --force, rm -rf on bench dirs
#   MEDIUM/ASK — bench migrate/update/build --force/setup prod/mariadb/execute+SQL,
#                git push --force, git reset --hard, git clean -fd, direct SQL DROP/TRUNCATE/DELETE
#   ALLOW      — read-only bench commands: list-apps, version, doctor, backup, …
#
# File tier (tool_input.file_path):
#   DENY — edits to apps/frappe, apps/erpnext, apps/hrms (and FRAPPE_GUARD_PROTECTED_APPS)
#   ASK  — sites/*/site_config.json, common_site_config.json, apps.txt
#
# Env config:
#   FRAPPE_GUARD_PROD_SITES       POSIX ERE matched against --site NAME → always ASK
#   FRAPPE_GUARD_PROTECTED_APPS   colon-separated extra app names to deny edits
set -euo pipefail

INPUT=$(cat)

# Fast path: no JSON parser spawn (~1s cold python/node start) unless the payload
# mentions something a rule could match. Keep this list a superset of the rules below.
PRE='bench|rm|git|sql|mariadb|mysql|drop|truncate|delete|apps|sites|site_config|restore|reinstall'
[ -n "${FRAPPE_GUARD_PROTECTED_APPS:-}" ] && PRE="$PRE|${FRAPPE_GUARD_PROTECTED_APPS//:/|}"
[ -n "${FRAPPE_GUARD_PROD_SITES:-}" ] && PRE="$PRE|${FRAPPE_GUARD_PROD_SITES}"
if ! printf '%s' "$INPUT" | grep -qiE "$PRE"; then echo '{}'; exit 0; fi

# ── JSON helpers ──────────────────────────────────────────────────────────────
# Extract tool_input.FIELD as a plain string. Returns 1 if no parser available.
_bg_get() {
  local field="$1"
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c \
      'import sys,json; d=json.loads(sys.stdin.read()); v=(d.get("tool_input") or {}).get(sys.argv[1],""); sys.stdout.write(v if isinstance(v,str) else "")' \
      "$field" 2>/dev/null && return 0
  fi
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$INPUT" | node -e \
      'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const v=((j&&j.tool_input)||{})[process.argv[1]]||"";process.stdout.write(typeof v==="string"?v:"")}catch(e){process.exit(3)}})' \
      "$field" 2>/dev/null && return 0
  fi
  return 1
}

_bg_json_str() {
  # Encode $1 as a JSON string literal (with surrounding quotes).
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$1" | python3 -c 'import sys,json; sys.stdout.write(json.dumps(sys.stdin.read()))' 2>/dev/null && return 0
  fi
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s)))' 2>/dev/null && return 0
  fi
  # Safe fallback: strip chars that would break JSON string literal.
  printf '"%s"' "$(printf '%s' "$1" | tr -cd 'a-zA-Z0-9 ._/:@=+\[\](),-')"
}

_bg_decision() {
  # Emit PreToolUse hookSpecificOutput envelope. $1=decision $2=reason.
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":%s}}\n' \
    "$1" "$(_bg_json_str "$2")"
}

# ── File tier ─────────────────────────────────────────────────────────────────
_guard_file() {
  local fpath="$1"

  # Deny edits to core framework apps (and any extras in FRAPPE_GUARD_PROTECTED_APPS).
  local app protected="frappe erpnext hrms"
  if [ -n "${FRAPPE_GUARD_PROTECTED_APPS:-}" ]; then
    protected="$protected ${FRAPPE_GUARD_PROTECTED_APPS//:/ }"
  fi
  for app in $protected; do
    if printf '%s' "$fpath" | grep -qE "(^|/)apps/$app(/|$)" 2>/dev/null; then
      _bg_decision deny "[bench-guard] Edit blocked: apps/$app is a core framework app. Extend it via Custom Fields, hooks, or patches in your own app."
      return 0
    fi
  done

  # Ask on sensitive bench config files.
  case "$fpath" in
    */sites/*/site_config.json|sites/*/site_config.json)
      _bg_decision ask "[bench-guard] Editing site_config.json changes site credentials and connections. Verify site name and values." ;;
    */common_site_config.json|common_site_config.json)
      _bg_decision ask "[bench-guard] Editing common_site_config.json affects ALL sites on this bench." ;;
    */apps.txt|*/sites/apps.txt|apps.txt|sites/apps.txt)
      _bg_decision ask "[bench-guard] Editing apps.txt modifies the installed app list." ;;
    *)
      echo '{}' ;;
  esac
}

# ── Bash tier ─────────────────────────────────────────────────────────────────
_guard_bash() {
  local cmd="$1" cmd_lower DENY_MSG="" ASK_MSG=""
  cmd_lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')

  _deny() { DENY_MSG="${DENY_MSG:-$1}"; }
  _ask()  { [ -z "$DENY_MSG" ] && ASK_MSG="${ASK_MSG:-$1}"; }

  # ── rm -rf targeting bench directories (DENY) ─────────────────────────────
  # Both flags (recursive) and bench path must appear in the same segment.
  if printf '%s' "$cmd" | grep -qE 'rm\s+[^|;&]*(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)[^|;&]*(sites/|apps/|env/|\.\/sites/?|\.\/apps/?|\.\/env/?)' 2>/dev/null \
  || printf '%s' "$cmd" | grep -qE 'rm\s+[^|;&]*(sites/|apps/|env/|\.\/sites/?|\.\/apps/?|\.\/env/?)[^|;&]*(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)' 2>/dev/null; then
    _deny "[bench-guard] rm -rf on bench directories (sites/, apps/, env/) is blocked. These are irreversible without a backup."
  fi

  # ── bash/sh -c wrapping bench destructive commands (DENY) ─────────────────
  if printf '%s' "$cmd" | grep -qE '(bash|sh)\s+-c\b' 2>/dev/null \
  && printf '%s' "$cmd" | grep -qE 'bench\b[^|;&]*(drop-site|reinstall)\b|bench\b[^|;&]*restore\b[^|;&]*--force' 2>/dev/null; then
    _deny "[bench-guard] bench destructive command detected inside a bash/sh -c wrapper."
  fi

  # ── git destructive operations (ASK) ─────────────────────────────────────
  if printf '%s' "$cmd" | grep -qE 'git\s+push(\s[^|;&]*)?\s(-f\b|--force\b)' 2>/dev/null \
  || printf '%s' "$cmd" | grep -qE 'git\s+push\s[^|;&]*\s[+][^[:space:]]' 2>/dev/null; then
    _ask "[bench-guard] git force-push rewrites remote history; other contributors may lose commits."
  fi
  if printf '%s' "$cmd" | grep -qE 'git\s+reset\s+--hard' 2>/dev/null; then
    _ask "[bench-guard] git reset --hard discards all uncommitted changes."
  fi
  if printf '%s' "$cmd" | grep -qE 'git\s+clean\s+[^|;&]*-[a-zA-Z]*[fd]' 2>/dev/null; then
    _ask "[bench-guard] git clean removes untracked files from the working tree permanently."
  fi

  # ── Direct SQL with destructive keywords (ASK) ────────────────────────────
  if printf '%s' "$cmd_lower" | grep -qE '(mariadb|mysql)\b[^|;&]*(drop\s+(table|database)|truncate\s+\w|delete\s+from\s+\w)' 2>/dev/null; then
    _ask "[bench-guard] SQL DROP/TRUNCATE/DELETE detected in direct database client command."
  fi

  # ── Bench invocation checks ───────────────────────────────────────────────
  # Use python3 to parse bench command segments properly — this correctly handles
  # `echo bench drop-site x` (no invocation) vs `bench drop-site x` (invocation).
  if command -v python3 >/dev/null 2>&1; then
    local BENCH_RESULT
    BENCH_RESULT=$(FRAPPE_GUARD_CMD="$cmd" \
      FRAPPE_GUARD_PROD_SITES="${FRAPPE_GUARD_PROD_SITES:-}" \
      python3 << 'PYEOF'
import os, re

cmd      = os.environ.get("FRAPPE_GUARD_CMD", "")
prod_re  = os.environ.get("FRAPPE_GUARD_PROD_SITES", "")

DENY_SUBCMDS  = {"drop-site", "reinstall"}
ASK_SUBCMDS   = {"migrate", "update", "remove-app", "uninstall-app",
                 "clear-cache", "mariadb", "console"}
ALLOW_SUBCMDS = {"list-apps", "version", "doctor", "show-pending-jobs",
                 "describe-job", "backup", "status"}

deny_msg = ""; ask_msg = ""

def deny(m):
    global deny_msg
    if not deny_msg: deny_msg = m

def ask(m):
    global ask_msg
    if not deny_msg and not ask_msg: ask_msg = m

for seg in re.split(r'&&|\|\||`|\$\(|[;|\n]', cmd):
    t = seg.split(); i = 0
    # Skip sudo/env wrapper tokens
    while i < len(t) and t[i] in ("sudo","time","nice","ionice","env","command","builtin"): i += 1
    # Skip inline env-var assignments (e.g. SITE=x bench ...)
    while i < len(t) and re.match(r'^[A-Za-z_]\w*=', t[i]): i += 1
    if i >= len(t): continue
    # bench or path-prefixed bench (e.g. /usr/local/bin/bench)
    if t[i] != "bench" and not t[i].endswith("/bench"): continue

    args = t[i+1:]
    site = ""
    for j, a in enumerate(args):
        if a == "--site" and j + 1 < len(args): site = args[j+1]; break

    # strip --site <value> from remaining args to get subcommand tokens
    rest = []; skip = False
    for a in args:
        if skip: skip = False; continue
        if a == "--site": skip = True; continue
        rest.append(a)

    if not rest: continue
    subcmd = rest[0]

    # Prod site check (applies to any non-allow-listed subcommand)
    if prod_re and site and subcmd not in ALLOW_SUBCMDS:
        try:
            if re.search(prod_re, site):
                ask(f"[bench-guard] Production site ({site} matches FRAPPE_GUARD_PROD_SITES). Confirm this is safe on a live site.")
        except re.error:
            pass

    if subcmd in DENY_SUBCMDS:
        deny(f"[bench-guard] 'bench {subcmd}' permanently destroys site data. Run backup first.")
    elif subcmd == "restore":
        if "--force" in rest:
            deny("[bench-guard] 'bench restore --force' replaces the database without any confirmation prompt.")
        else:
            ask("[bench-guard] 'bench restore' replaces the site database with a backup. Ensure this is the right site.")
    elif subcmd == "setup":
        targets = {a for a in rest[1:] if not a.startswith("-")}
        if targets & {"production","nginx","supervisor"}:
            _tgt = " ".join(rest[1:])
            ask("[bench-guard] 'bench setup " + _tgt + "' modifies production system configuration.")
    elif subcmd == "build":
        if "--force" in rest:
            ask("[bench-guard] 'bench build --force' rebuilds all assets; may affect in-flight page loads.")
    elif subcmd == "execute":
        combined = " ".join(rest[1:]).lower()
        if "frappe.db.sql" in combined and re.search(r'\b(delete|truncate)\b', combined):
            ask("[bench-guard] 'bench execute' contains frappe.db.sql with DELETE/TRUNCATE.")
    elif subcmd in ASK_SUBCMDS:
        ask("[bench-guard] 'bench " + subcmd + "' — confirm it is intended on the target site.")

print(("DENY:" + deny_msg) if deny_msg else ("ASK:" + ask_msg) if ask_msg else "ALLOW")
PYEOF
2>/dev/null || echo "ALLOW")
    case "$BENCH_RESULT" in
      DENY:*) _deny "${BENCH_RESULT#DENY:}" ;;
      ASK:*)  _ask  "${BENCH_RESULT#ASK:}"  ;;
    esac

  elif command -v node >/dev/null 2>&1; then
    # Node fallback: simpler regex, no echo-filtering. May false-positive on
    # `echo bench drop-site` — acceptable for a fail-safe advisory guard.
    local _nr
    _nr=$(printf '%s' "$cmd" | node -e '
const c=require("fs").readFileSync("/dev/stdin","utf8");
const D=/\bbench\s+(drop-site|reinstall)\b|\bbench\s+restore\b[^|;&]*--force/;
const A=/\bbench\s+(migrate|update|remove-app|uninstall-app|clear-cache|mariadb|console|restore)\b|\bbench\s+build\b[^|;&]*--force|\bbench\s+setup\b[^|;&]*(production|nginx|supervisor)|\bgit\s+push\b[^|;&]*(-f\b|--force\b|\+\S)|\bgit\s+reset\s+--hard\b|\bgit\s+clean\b[^|;&]*-[a-zA-Z]*[fd]/;
console.log(D.test(c)?"DENY":A.test(c)?"ASK":"ALLOW");
' 2>/dev/null || echo "ALLOW")
    case "$_nr" in
      DENY) _deny "[bench-guard] Destructive bench command detected." ;;
      ASK)  _ask  "[bench-guard] Bench command requiring confirmation." ;;
    esac

  else
    # No parser available — fail to ASK if bench appears anywhere.
    if printf '%s' "$cmd" | grep -qwF 'bench' 2>/dev/null; then
      _ask "[bench-guard] Cannot parse bench command (no python3/node). Approve only if safe."
    fi
  fi

  # ── Output ────────────────────────────────────────────────────────────────
  if [ -n "$DENY_MSG" ]; then
    _bg_decision deny "$DENY_MSG"
  elif [ -n "$ASK_MSG" ]; then
    _bg_decision ask "$ASK_MSG"
  else
    echo '{}'
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
set +e
CMD=$(_bg_get command); CMD_RC=$?
FILE_PATH=$(_bg_get file_path)
set -e

if [ "$CMD_RC" -ne 0 ]; then
  # No JSON parser available at all.
  _bg_decision ask "[bench-guard] Cannot parse hook payload (no python3/node) — approve only if safe."
  exit 0
fi

if [ -n "$CMD" ]; then
  _guard_bash "$CMD"
elif [ -n "$FILE_PATH" ]; then
  _guard_file "$FILE_PATH"
else
  echo '{}'
fi
