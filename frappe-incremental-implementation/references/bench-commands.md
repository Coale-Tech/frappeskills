# Bench Command Routing for Incremental Slices

Which bench command to run after each type of change, with verified flags.

## Decision table

| What changed | Command | Notes |
|---|---|---|
| DocType JSON added or modified (any field, setting, permission row) | `bench --site <site> migrate` | Syncs schema to MariaDB; runs `patches.txt`; required before new fields are accessible |
| Python only — controller, hooks.py, utils, API methods | `bench --site <site> clear-cache` | Reloads Python bytecode cache and DocType metadata; does NOT apply schema changes |
| JS, Vue, or CSS files modified | `bench build --app <app>` | Recompiles esbuild bundle; `--site` not accepted; omit `--app` to rebuild all apps |
| Fixtures exported or modified (`fixtures/<doctype>.json`) | `bench --site <site> clear-cache` | Reloads fixture-backed metadata |
| Schema change + data backfill patch in same slice | `bench --site <site> migrate` | Backfill patch must be in `patches.txt [post_model_sync]`; runs after schema sync |
| New app installed on site | `bench --site <site> migrate` | Runs app's initial patches and schema |

## Command notes

- `bench migrate` performs `clear-cache` internally at the end (v16). An explicit `clear-cache` after migrate is harmless but redundant.
- `bench build` does **not** accept `--site`; it is bench-scoped, not site-scoped.
- `bench build --app <app>` restricts the build to one app's assets. Multiple apps: `--apps app1,app2`.
- `bench run-tests` requires `allow_tests = true` in `site_config.json`:
  ```bash
  bench --site <site> set-config allow_tests true
  ```
- `bench set-config <key> <value>` writes to `site_config.json` for the named `--site`.
  Pass `-g` / `--global` to write to `common_site_config.json` instead.

## patches.txt sections

```
[pre_model_sync]
<app>.patches.v1_0.rename_column    # runs BEFORE schema sync — use for destructive column ops

[post_model_sync]
<app>.patches.v1_0.backfill_data    # runs AFTER schema sync — use for data backfills on new columns
```

Re-run a single patch (bypasses already-ran guard):
```bash
bench --site <site> run-patch <app>.<module>.<patch> --force
```

## Sources

Verified against Frappe v16.35.0 (`apps/frappe/frappe/__init__.py` `__version__ = "16.35.0"`);
updated for v16.51.1 where noted:

- `apps/frappe/frappe/commands/site.py` lines 707-726 — `migrate` command: `skip_failing`, `skip_search_index`, `skip_fixtures` flags
- `apps/frappe/frappe/commands/utils.py` lines 135-151 — `clear-cache` command; site-scoped (`@pass_context`)
- `apps/frappe/frappe/commands/utils.py` (build command) — `--app`/`--apps`; no `--site`; `--force`/`--production`/`--verbose`.
  (16.51+) import moved: `from frappe.bundler import bundle, download_frappe_assets`; old `from frappe.build import bundle` still works via `frappe/build/__init__.py` compat shim.
- `apps/frappe/frappe/commands/utils.py` — `set-config` command: positional `key value`; `-g`/`--global`; `-p`/`--parse`
- `apps/frappe/frappe/commands/testing.py` — `run-tests` command: `--app`, `--module`, `--doctype`, `--test-category {unit,integration,all}`, `--failfast`; checks `frappe.conf.allow_tests`
- `apps/frappe/frappe/commands/site.py` — `run-patch` command: module positional arg; `--force` flag
- `apps/frappe/frappe/modules/patch_handler.py` — `patches.txt` format: `[pre_model_sync]` / `[post_model_sync]` INI sections; `execute:` inline commands; execution order
