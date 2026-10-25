# bench-guard — Frappe Bench Safety Hook

An advisory PreToolUse hook that intercepts destructive bench commands and
edits to core framework apps. It is **not a security boundary**: a sufficiently
determined agent (or a human in a terminal) can bypass it. Its job is to
surface dangerous operations for review before they run, not to stop a
determined adversary.

---

## What it guards

### Bash tier (Bash tool)

| Tier | Pattern | Decision |
|------|---------|----------|
| DENY | `bench drop-site`, `bench drop-site --force` | hard block |
| DENY | `bench reinstall` | hard block |
| DENY | `bench --site X restore ... --force` | hard block |
| DENY | `rm -rf sites/`, `rm -rf apps/`, `rm -rf env/`, `rm -rf ./sites`, `rm -rf ./apps/` | hard block |
| DENY | `command bench drop-site`, `builtin bench drop-site` (shell builtins stripped) | hard block |
| DENY | `bash -c "bench drop-site ..."`, `sh -c "bench reinstall"` (obvious -c wrappers) | hard block |
| ASK  | `bench migrate`, `bench update` | confirm |
| ASK  | `bench restore` (without `--force`) | confirm |
| ASK  | `bench build --force` | confirm |
| ASK  | `bench setup production\|nginx\|supervisor` | confirm |
| ASK  | `bench remove-app`, `bench uninstall-app` | confirm |
| ASK  | `bench --site X clear-cache` | confirm |
| ASK  | `bench --site X mariadb` (interactive DB shell) | confirm |
| ASK  | `bench --site X console` (Python REPL) | confirm |
| ASK  | `bench execute` containing `frappe.db.sql` + DELETE/TRUNCATE | confirm |
| ASK  | `git push --force`, `git push --force-with-lease`, `git push origin +refspec` | confirm |
| ASK  | `git reset --hard` | confirm |
| ASK  | `git clean -fd`, `git clean -fdx` | confirm |
| ASK  | `mariadb`/`mysql` with DROP/TRUNCATE/DELETE in command | confirm |
| ASK  | Any `--site NAME` where NAME matches `FRAPPE_GUARD_PROD_SITES` regex | confirm |
| ALLOW| `bench list-apps`, `bench version`, `bench doctor`, `bench backup` | pass |

### File tier (Edit / Write tools)

| Tier | Path pattern | Decision |
|------|-------------|----------|
| DENY | `apps/frappe/**`, `apps/erpnext/**`, `apps/hrms/**` | hard block |
| DENY | Any app in `FRAPPE_GUARD_PROTECTED_APPS` | hard block |
| ASK  | `sites/*/site_config.json` | confirm |
| ASK  | `common_site_config.json` | confirm |
| ASK  | `apps.txt`, `sites/apps.txt` | confirm |
| ALLOW| Everything else | pass |

---

## ASK justifications

| Command | Justification |
|---------|--------------|
| `bench migrate` | Schema changes are irreversible without a backup; may run for minutes |
| `bench update` | Updates all apps, runs migrations, high blast radius |
| `bench restore` (no force) | Replaces the entire site database with a backup |
| `bench build --force` | Rebuilds all assets; serves stale JS/CSS to in-flight requests |
| `bench setup production/nginx/supervisor` | Modifies OS-level config outside the bench |
| `bench remove-app` / `bench uninstall-app` | Removes app and related custom modules (16.51+: custom modules may remain) |
| `bench clear-cache` | Flushes all app cache (permissions, metadata, DocType schema); busy production sites see a 10–60 s warm-up hit |
| `bench mariadb` | Opens an unrestricted SQL shell |
| `bench console` | Opens a Python REPL with full DB access |
| `bench execute` + `frappe.db.sql DELETE/TRUNCATE` | Bypasses ORM-level access control; raw SQL delete |
| `git push --force` / `+refspec` / `--force-with-lease` | Rewrites remote history (or may after lease failure); other contributors lose commits |
| `git reset --hard` | Discards all uncommitted changes permanently |
| `git clean -fd/-fdx` | Removes untracked files from the working tree; often includes generated assets |

---

## Configuration

```bash
# ERE matched against every --site NAME in bench commands.
# Commands on a matching site that are not in the allow-list get ASK.
# Default: empty (disabled).
export FRAPPE_GUARD_PROD_SITES='^(prod|production|live)'

# Colon-separated extra app names whose files are denied for Edit/Write.
# In addition to the built-in frappe/erpnext/hrms block.
export FRAPPE_GUARD_PROTECTED_APPS='payments:lending'
```

Set these in your shell profile or in the `env` block of `settings.json`.

---

## Install — Claude Code

Add the hook to `~/.claude/settings.json` under `hooks.PreToolUse`.
The hook handles Bash, Edit, and Write through a single script:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/frappeskills/scripts/bench-guard.sh",
            "statusMessage": "Checking bench command safety…"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/frappeskills/scripts/bench-guard.sh",
            "statusMessage": "Checking file protection…"
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/frappeskills` with the actual path (e.g.
`~/.claude/skills-src/frappeskills`). Claude Code resolves `~` in hook
commands.

The JSON format matches the Claude Code hook protocol: the hook receives a
`PreToolUse` event on stdin with `tool_name` and `tool_input.command`
(Bash) or `tool_input.file_path` (Edit/Write). It emits
`hookSpecificOutput.permissionDecision` of `"deny"`, `"ask"`, or nothing
(`{}`). The decision **must** be nested under `hookSpecificOutput` — Claude
Code ignores a top-level `permissionDecision`.

### omp

omp has native `tool_call` hooks that can block a call (see `omp://hooks.md` and
`omp://extensions.md`; hook factories under `~/.omp/agent/hooks/pre/*.ts` are loaded).
`scripts/bench-guard.omp.ts` is an adapter around the same `bench-guard.sh` rules: it maps
omp's `bash` / `write` / `edit` calls to the guard payload, turns `deny` into
`{ block: true, reason }`, and turns `ask` into a `ctx.ui.confirm` dialog (blocked when
there is no UI). The `tool_call` return type is `{ block: true; reason: string } | undefined`
(per omp extension docs).

**omp edit tool input:** the default `edit` tool passes a hashline `input` string with `[path#TAG]`
headers; the adapter extracts every header path (and a plain `path` if present) and runs the
file-tier rules on each. The `tool_call` event input shape is not specified in the omp docs;
this was taken from the live tool schema and covered by the adapter smoke test, so re-check it
after an omp upgrade.

```sh
ln -s "$PWD/scripts/bench-guard.omp.ts" ~/.omp/agent/hooks/pre/bench-guard.omp.ts
ln -s "$PWD/scripts/bench-guard.sh"     ~/.omp/agent/hooks/pre/bench-guard.sh
```

The adapter resolves `bench-guard.sh` next to itself, so keep both links in the
same directory. Subagent tool calls pass through the same handler. Handlers fail
closed on error or timeout (20 s in the adapter, 30 s omp default). omp discovers hook factories only from `hooks/pre|post/*.{ts,js}` under its own config roots (`omp://hooks.md`). Its docs do not mention Claude Code `settings.json` `hooks.PreToolUse` entries, so the shell-hook config above does not protect omp sessions; use the adapter.

---

## Fail behaviour

| Condition | Bash tier | File tier |
|-----------|-----------|-----------|
| No python3 or node on PATH | ASK ("cannot parse") | ASK |
| Unparseable JSON | ASK | ASK |
| Valid JSON, no command/file | allow | allow |

The guard fails to **ASK** rather than DENY on parser failure — it is
advisory, not a hard gate. If you need a stricter fail-closed posture, switch
the `_bg_decision ask` calls in the main block to `deny`.

---

## Honest limitations

The following patterns are **not caught** by this guard:

| Pattern | Why it bypasses |
|---------|----------------|
| `xargs -I{} bench drop-site {}` | `xargs` is not in the sudo/builtin skip list; the tool token is `xargs`, not `bench` |
| `bench\ndrop-site` (literal newline splits) | Newline in the command string causes the Python parser to see two separate segments, neither of which has a complete bench invocation |
| `CMD="bench drop-site x"; $CMD` (variable indirection) | Variable expansion is not performed before inspection |
| `eval "$(base64 -d ...)"` (obfuscated) | Base64 payload is not decoded |
| `find sites -delete` | `find -delete` is not in the rm-pattern list |
| `rm -rf apps` (no trailing slash, no `./` prefix) | Bare directory name without path prefix is not caught to avoid false-positives on similar names; use `rm -rf apps/` or `rm -rf ./apps` to trigger it |
| `bench console <<< 'frappe.db.sql("DROP TABLE x")'` | Only the command line is inspected; stdin piped to console is not decoded |
| `bench` behind an alias | Aliases expand in a live shell but not in the literal command string the hook sees |
| `bash -c` with non-obvious destructive payload | Only `drop-site`, `reinstall`, and `restore --force` inside the wrapper are detected; other destructive subcommands (e.g. `migrate`) are not checked inside `-c` strings |

`DENY` is best-effort advisory, not a policy enforcement point. The guard cannot stop a
determined adversary who knows these bypasses. Its purpose is to catch accidental or
default-path commands, not to enforce a security policy.

---

## Running tests

```bash
node scripts/test-bench-guard.js   # 111 cases, zero deps
```

Expected output: `bench-guard tests PASSED  (111 ok, 0 failed)`

Requires python3 (for the bench invocation parser) and bash 3.2+.

---

## Integration requests

The following skills should add a pointer to this guard but are owned by the
main integrator, not this slice:

- `frappe-bench-operations/SKILL.md` → add a **Guardrails** entry:
  *"Wire `scripts/bench-guard.sh` as a PreToolUse hook when running bench
  commands on a live site — see `docs/bench-guard.md`."*
- `frappe-manager/SKILL.md` → add a note that `bench-guard.sh` applies to
  classic bench environments; Frappe Manager (Docker) uses different CLI
  surface and the guard's patterns do not apply to `fm` commands.
