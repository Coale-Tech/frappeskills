# Learned Patterns

Patterns discovered during real Frappe development and debugging. Entries are
captured automatically at breakpoints (after debugging, implementation, or
exploration) and promoted to main reference files once validated.

**Format**: Each entry needs Discovered date, Confidence (low/medium/high),
Uses counter, and Evidence. See SKILL.md "Self-Enhancement Protocol" for
capture rules, promotion triggers, and pruning criteria.

---

## Debugging Patterns

### [Debugging] DocType directory must match frappe.scrub(DocType name)
- **Discovered**: 2026-05-03
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `bench install-app my_chat` failed with `No module named 'my_chat.my_chat.doctype.m_pesa_payout'` — the directory was named `mpesa_payout/` but Frappe expected `m_pesa_payout/`
- **Pattern**: Frappe derives the module path from the DocType name via `frappe.scrub()`, which converts ALL non-alphanumeric characters (including hyphens) to underscores. So DocType "M-Pesa Payout" → directory `m_pesa_payout/`, NOT `mpesa_payout/`. The JSON filename inside the directory must also match. Root cause: hyphens in DocType names silently break directory conventions.
- **Evidence**: `frappe/modules/utils.py:308` — `load_doctype_module()` raises `ImportError` when the directory doesn't match `frappe.scrub(doctype_name)`

## API & ORM Patterns

### [API] Guard singleton settings access before migration
- **Discovered**: 2026-04-03
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Auditing payroll_africa engine/hooks.py — `frappe.get_cached_doc("Settings DocType")` in a doc_event hook crashes if called before the DocType is synced via bench migrate
- **Pattern**: Always add `if not frappe.db.exists("DocType Name"): return` before `frappe.get_cached_doc()` on singleton settings in hooks that run on external DocTypes (e.g., doc_events on Salary Slip)
- **Evidence**: `engine/hooks.py:14` — `on_salary_slip_validate` would crash during app install if Salary Slip is validated before payroll_africa DocTypes are synced

### [API] Guard cached doc lookups for components that may not exist
- **Discovered**: 2026-04-03
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Auditing payroll_africa engine/hooks.py — `frappe.get_cached_doc("Salary Component", name)` crashes if component not created yet
- **Pattern**: Before `frappe.get_cached_doc(DocType, name)` for a dynamically-referenced record, check `frappe.db.exists()` first. Log error and return gracefully instead of crashing the parent document's save
- **Evidence**: `engine/hooks.py:58` — appending missing salary component to Salary Slip deductions would crash if setup hadn't run

### [API] Disabled country should return silently, not throw
- **Discovered**: 2026-04-03
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: payroll_africa doc_event hook was throwing `frappe.throw()` when a country was disabled — this blocks ALL salary slip saves for that country's employees
- **Pattern**: In doc_event hooks, use silent `return` for non-critical configuration issues (disabled country, missing calculator). Reserve `frappe.throw()` for data integrity violations. A disabled country means "skip processing", not "block the document"
- **Evidence**: `engine/hooks.py:22-25` — throwing on disabled country prevented HR from saving any salary slips for employees in that country, even if they wanted to process manually

### [API] Data fields raise on overflow — they never truncate
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `jkm_finance` built `JKM Action.title` (a `Data` field) verbatim from an agent finding message. One 264-invoice IRN message ran 168 chars and `CharacterLengthExceededError` aborted the whole `reconcile_actions` loop — no actions were created for *any* bucket that run.
- **Pattern**: `Document.db_insert`/`save` raise `frappe.exceptions.CharacterLengthExceededError` when a `Data` value exceeds its length; Frappe does **not** silently clip. A `Data` field with no explicit `length` caps at **140** (`frappe.model.meta.DEFAULT_VARCHAR_LEN` / `varchar(140)`), not 255. Any field fed machine-generated prose needs a bounded formatter at the *source* (clip on a sentence boundary, else hard-clip with an ellipsis) or the fieldtype changed to `Small Text`. Renaming the fieldname to widen it is a schema migration, not a fix.
- **Evidence**: `frappe/utils/messages.py:59` `_raise_exception` → `frappe/model/base_document.py` length validation; observed live as `JKM Action JKM-A-00043: <strong>Action</strong> (264 sales invoices…) will get truncated, as max characters allowed is 140`

### [API] `lines` is a MariaDB reserved word — never use it as a SQL alias
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A purchase-invoice scan used `SELECT COUNT(*) AS lines, ...` and died with a bare `Syntax error in query`. `safe_run` caught it, so the agent returned `status: unknown` with an empty findings list — a silent no-op that looked like clean data.
- **Pattern**: MariaDB 10.6+ reserves `LINES` (from `LOAD DATA ... LINES TERMINATED BY`). It is legal as a column name but **not** as a bare `AS` alias in a select list. Same trap: `rows`, `groups`, `rank`, `system`. Prefer an explicit prefix (`total_lines`, `po_lines`). Because agents wrap scans in a `safe_run`-style guard, a reserved-word slip degrades to an empty result rather than a crash — assert on expected non-empty metrics in verification, never just on "no exception".
- **Evidence**: `mariadb.com/kb/en/reserved-words/` lists `LINES` reserved since 10.6; observed as `Syntax error in query: SELECT COUNT(*) AS lines, COALESCE(SUM(...)) AS no_po FROM tabPurchase Invoice Item`

### [API] Select fields hard-throw on any value outside `options`
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `jkm_finance`'s fallback report writer set `health_status = "unknown"` on a Select whose `options` were only `green\namber\nred`. Every other layer already spoke `unknown` — the API defaulted reads to it, the Desk JS had a `STATUS_COLOR.unknown` and a "no data" legend segment — so the gap was invisible until the fallback path actually ran, which by construction only happens when the pipeline is *already* broken.
- **Pattern**: `_validate_selects` calls `frappe.throw` for any non-empty value not in `options`; there is no coercion and no warning. So a Select is a closed enum shared by the schema, the controller, the API and the client, and adding a state to any one of them without the JSON is a latent `ValidationError`. Grep the fieldname across all four layers when introducing a state. Empty string is always allowed (the check short-circuits on falsy), which is why a leading `\n` in `options` is the idiom for "optional". Listing the neutral state **first** makes it the form default — correct for a "not yet computed" state. Test the enum against the schema (`frappe.get_meta(dt).get_field(f).options.split("\n")`) rather than restating the literals, so the test fails when the JSON drifts.
- **Evidence**: `frappe/model/base_document.py:1101-1129` `_validate_selects()` — `frappe.throw(_('{0} {1} cannot be "{2}". It should be one of "{3}"'))`; skipped only under `frappe.flags.in_import`. Reproduced: `health_status='unknown'` → `ValidationError`, `health_status='amber'` → inserted.

### [API] A stale `required_apps` entry makes another app permanently un-uninstallable
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `bench --site <site> uninstall-app dependency_app` printed `App dependency_app is a dependency of my_app. Uninstall my_app first.` and **exited 0**. `my_app` listed `dependency_app` in `required_apps` but imported none of its code — it only mirrored its conventions (severity ladder, client shape). The declaration was aspirational and had become a hard lock on the other app.
- **Pattern**: `remove_app` walks every installed app and refuses if any declares the target in `required_apps`; the refusal is a `click.secho` + bare `return`, so it is a **silent no-op with a success exit code** — CI and scripts see nothing wrong. `force=True` does *not* help: it only guards the earlier "not installed" test, never the dependency check. `required_apps` is a real uninstall lock, so it must list only apps whose code you actually import. Grep before declaring (`grep -rn "<app>" --include=*.py --include=*.json`); a convention you copied is not a dependency.
- **Evidence**: `frappe/installer.py:421-425` (`is_required_by` → `click.secho(...); return`), with `force` checked separately at `:416-420`; `parse_required_app_name` at `:270`.

### [API] `before_uninstall` cleanup that can hit foreign references belongs in `after_uninstall`
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `app_a.before_uninstall` hard-deleted the `CFO` role it created on install. But `CFO` had become shared infrastructure — `app_b` carried CFO DocPerms on two of its own DocTypes plus a CFO grant on its `weekly-report` Desk page. The delete raised, aborting the whole uninstall *after* the backup had already been taken.
- **Pattern**: `Role` declares a `disabled` field and has **no `on_trash`**, so its `Has Role` grants survive into the link check and `delete_doc` rewrites `LinkExistsError` into the misleading `"You can disable this Role instead of deleting it."` — a message that names no app and looks like a permissions problem. Any `before_uninstall` step touching a shared entity (roles, custom fields, workflows) runs *before* the app's own doctypes/pages/reports are deleted, so its references are still present and indistinguishable from foreign ones. Defer such cleanup to `after_uninstall`, where the app's own records are already gone, and gate the delete on `check_if_doc_is_linked` (which only raises, never mutates — safe to probe with). Own the entities your permissions depend on in your *own* `after_install`/`after_migrate` rather than inheriting them from a sibling app.
- **Evidence**: `frappe/model/delete_doc.py:170-181` (the `enabled`/`disabled` field rewrite); `frappe/installer.py:445-446` runs `before_uninstall` after the backup at `:437-441`, while `after_uninstall` runs at `:462-463` after `_delete_modules`/`_delete_doctypes` at `:453-454`; `frappe/core/doctype/role/role.py` defines no `on_trash`.

### [API] `uninstall-app --dry-run` really mutates, and the real run discards its icon/sidebar cleanup
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A `--dry-run` uninstall permanently deleted two `Workflow` documents. The subsequent real uninstall then left orphan `Desktop Icon` and `Workspace Sidebar` rows (`Coale Finance`, `Agentic Analytics`) pointing at Workspaces it had just deleted — dead 404 entries in the Desk sidebar.
- **Pattern**: Two inverted guards in the same flow. (1) `before_uninstall` / `after_uninstall` hooks are invoked **unguarded by `dry_run`**, so a dry run executes every side effect an app's hooks perform — treat `--dry-run` as read-only only for doctype/table drops, never for hooks. (2) `delete_desktop_icon_and_sidebar` deletes the rows but its only `frappe.db.commit()` sits behind `if dry_run:`, so in a real uninstall the deletes are never committed and roll back at process exit. Expect to sweep `Desktop Icon` (matched on `name`/`parent_icon` == app title) and `Workspace Sidebar` (matched on `app`) by hand after any real uninstall. Rows created without stamping `app` are missed even by a fixed sweep, so always set `app` when an install hook creates a `Workspace Sidebar`.
- **Evidence**: `frappe/installer.py:445-449` and `:462-466` (no `dry_run` guard); `frappe/utils/install.py:225-232` — `sidebar_to_be_deleted = frappe.get_all("Workspace Sidebar", filters={"app": app_name})` then `if dry_run: frappe.db.commit()`. Verified live: a custom app's `Workspace Sidebar` survived a real uninstall; `bench migrate`'s own orphan sweep also deleted the surviving `Desktop Icon` before `after_migrate` recreated it.

### [API] `frappe.utils.add_seconds` does not exist in v16 — and `set_single_value` on a Datetime wants a string
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `from frappe.utils import add_seconds` sat in a token-persistence path that no test ever reached; the module imported fine at edit time and only exploded when the test runner tried to discover it (`TestRunnerError: cannot import name 'add_seconds'`). Any real token save would have raised `ImportError` on the first sign-in.
- **Pattern**: `frappe/utils/data.py` exports `add_to_date`, `add_days`, `add_months`, `add_years` — there is no `add_seconds`/`add_minutes`/`add_hours`. Use `add_to_date(base, seconds=n)`. Two follow-ons: (1) `add_to_date` returns a `datetime` object, but `frappe.db.set_single_value` is typed `str | int | None`, so pass `as_string=True, as_datetime=True` — `as_string=True` alone silently drops the time component (`if as_string: if as_datetime: DATETIME_FORMAT else DATE_FORMAT`); (2) a bad import inside a *function body* is invisible to `py_compile` and to a plain module import, so it survives every check short of actually executing that line. `bench run-tests --module` catches it because discovery imports the module graph — cheapest way to smoke a new module's imports.
- **Evidence**: `frappe/utils/data.py:282-332` (`add_to_date` signature and the `add_days`/`add_months` wrappers; no seconds helper); `:315-319` for the `as_string`/`as_datetime` branch. Verified live: `add_to_date(now_datetime(), seconds=3600, as_string=True, as_datetime=True)` -> `'2026-08-18 20:18:58.764217'` (`str`).

### [API] Microsoft and OpenAI device-code flows have opposite body encodings and undocumented error codes
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Porting an existing RFC 8628 device-login card (OpenAI/Codex) to Microsoft Entra for OneDrive. Reusing the working flow's request shape produced `HTTP 400 AADSTS900144: The request body must contain the following parameter: 'client_id'` even though `client_id` was present.
- **Pattern**: Both providers implement RFC 8628, but the wire details are inverted, so a "shared device-login helper" is a trap — keep one module per provider. Microsoft (`login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode` and `/token`) requires **form encoding** (`data=`); a JSON body yields AADSTS900144 as if the parameter were missing. OpenAI's Codex backend requires **JSON** (`json=`). Two more Microsoft deltas from the published reference: `verification_uri` returns `https://login.microsoft.com/device`, *not* the widely-quoted `microsoft.com/devicelogin`, so always send the operator to the value in the response; and a stale/unknown `device_code` answers `invalid_grant` (AADSTS7000014), *not* the `bad_verification_code` in the spec's error table — treating only the documented code as terminal leaves the card polling forever. A blank tenant must fall back to the literal `common`, or the URL degrades to `//oauth2/v2.0/devicecode` and 404s. Device codes are single-use: clear the cached code on success or the next poll re-exchanges it and gets `invalid_grant`. Refresh responses may omit `refresh_token` — persist the existing one rather than blanking it.
- **Evidence**: Swept live against `login.microsoftonline.com` on 2026-08-18: form body -> HTTP 200 with `user_code`; JSON body -> HTTP 400 `AADSTS900144`; tampered `device_code` -> HTTP 400 `invalid_grant` / `AADSTS7000014`; response `verification_uri` = `https://login.microsoft.com/device`, `verification_uri_complete` absent. Contract pinned in `jkm_finance/tests/test_onedrive_auth.py`.


### [API] `Document.get(key, filters=..., limit=1)` on a child table returns Document rows, not dicts
- **Discovered**: 2026-08-19
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: jkm_finance per-section AI-explain feature — a helper read `doc.get("sections", {"section_key": key}, limit=1)[0]` to fetch one child row, then did `section["headline"]`, which raised `TypeError: 'JKMWeeklyReportSection' object is not subscriptable`.
- **Pattern**: `BaseDocument.get(key, filters=None, limit=None, default=None)` (`frappe/model/base_document.py:327`) filters the child table and returns the matching **Document objects** (child rows loaded via `append()`/ORM hydration are full `Document` instances, not plain dicts) — unlike `frappe.get_all(...)` or a raw SQL `as_dict` row. Document objects support `.get("field")` (inherited dict-like accessor) but NOT `obj["field"]` subscripting. Any helper meant to work on both a live child-table row and a plain dict (e.g. shared between ORM code and a JSON-loaded snapshot) must use `.get(...)` exclusively.
- **Evidence**: `frappe/model/base_document.py:327-345` (`get()` returns `self._filter(self.get_all_children(), filters, limit=limit)` — no dict coercion); reproduced live on frappe 16.9, jkm site: `type(doc.get("sections", {"section_key": "sales"}, limit=1)[0]).__name__` == `'JKMWeeklyReportSection'`, a `Document` subclass.

### [API] Number Card `filters_json` cannot hold relative dates — bareword `Today`/`This Month` is invalid JSON that silently defers the crash to render time
- **Discovered**: 2026-09-05
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `my_app/setup_dashboard.py` shipped 8 Number Cards (`eTIMS Sales Today`, `...Sales This Month`, `...Purchase Today/This Month`, `...Sales Amount Today/Month`, `...Stock Entries Today`, `eTIMS Failed Today`) with `filters_json` string literals like `'[["Sales Invoice","posting_date","=",Today]]'` — `Today`/`This Month` typed as bare, unquoted words. `frappe.get_doc(doc_data).insert()` succeeded silently for all 8 every migrate (`filters_json` is untyped text, never validated on save); the break only surfaced when something actually rendered the card and called `get_result()`, which crashed with an `orjson.JSONDecodeError` inside `frappe.parse_json()` — both server-side (`bench execute`) and client-side (the Workspace widget's own `JSON.parse(doc.filters_json)` throws identically in the browser, so this is not a probe-script artifact).
- **Pattern**: `filters_json`/`dynamic_filters_json` are NOT interchangeable relative-date mechanisms. `dynamic_filters_json` values are raw JS-expression STRINGS (e.g. `"frappe.defaults.get_user_default(\"Company\")"`) `eval()`'d ONLY client-side by `frappe.dashboard_utils.get_all_filters()` (`dashboard_utils.js:204-249`) — invisible to any server-side caller (`bench execute`, a report, a scheduled job). The correct, server-AND-client-safe way to express "today"/"this month"/etc. in a STATIC `filters_json` literal is Frappe's own `"Timespan"` filter operator: a normal 4-tuple `[doctype, fieldname, "Timespan", "<value>"]` where `<value>` is one of the exact lowercase strings in `frappe.utils.data`'s `TimespanOptions` (`"today"`, `"yesterday"`, `"this week"`, `"this month"`, `"this quarter"`, `"this year"`, `"last N days"`, `"next month"`, etc. — full enum at `data.py:40-52`). `db_query.py:906-908` rewrites ANY filter whose operator lowercases to `"previous"`/`"next"`/`"timespan"` into a concrete `between` range via `get_timespan_date_range(value)` (`data.py:909-1004`) BEFORE the query runs — fully server-side, no eval, no browser required, and it re-resolves fresh on every render instead of freezing at creation time. Real ERPNext ships exactly this pattern, e.g. `erpnext/crm/number_card/new_opportunity_(last_1_month)/*.json`: `"filters_json": '[["Opportunity","creation","Timespan","last month"]]'`. Never hand-write a relative date into `filters_json` as a literal value (bareword or even a pre-computed `nowdate()` string) — always use the `Timespan` operator.
- **Evidence**: `frappe/desk/doctype/number_card/number_card.py:152` `get_result()` -> `frappe.parse_json(filters)` -> `frappe/utils/data.py:2620` `orjson.loads(val)`, reproduced live: calling `get_result()` against `eTIMS Sales Amount Today` raised `orjson.JSONDecodeError` before the fix. `frappe/public/js/frappe/widgets/number_card_widget.js:165-167` (`get_filters()` -> `frappe.dashboard_utils.get_all_filters(this.card_doc)`, which does `JSON.parse(doc.filters_json)` first) confirms the Workspace widget hits the identical parse failure in-browser. `frappe/model/db_query.py:906-908` and `frappe/utils/data.py:909-1004` (`get_timespan_date_range`, `match timespan: case "today"/"this month"`) are the resolvers. After rewriting all 8 `filters_json` strings to the `Timespan` form and re-running `create_number_cards()` live on `vigilante`: all 8 rendered real numbers (`get_result()` returned e.g. `{"eTIMS Sales Today": 3.0, "eTIMS Sales This Month": 3.0, "eTIMS Sales Amount Today": 17208.0, ...}`) with zero new Error Log entries (`eTIMS: number card create failed` count stayed at its pre-existing 8, all from before this fix).

## Frontend Patterns

### [Frontend Patterns] Desk Page `.js` edits need a localStorage purge, not just clear-cache
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After editing `page/weekly_report/weekly_report.js`, `bench clear-cache` + a hard browser reload still rendered the old string. `getpage` proved the server was already returning the new script (`statutory: True`), so the staleness was entirely client-side.
- **Pattern**: `Page.load_assets` reads the `.js` off disk on every `getpage` (it sets `_dynamic_page = True`, so the server never caches it), but the Desk boot caches the returned page script in **`localStorage`** and reuses it across reloads. Verifying a Desk Page script change in a browser requires `localStorage.clear()` (or a fresh profile) before the reload — `bench clear-cache`, `bench build`, and Cmd-Shift-R are all insufficient. Confirm server-side first via `/api/method/frappe.desk.desk_page.getpage?name=<page>` and grep the `script` field, so you know whether you are chasing a build problem or a client-cache problem.
- **Evidence**: `frappe/core/doctype/page/page.py:143-197` `load_assets()` re-reads `page_name + ".js"` per request and sets `self._dynamic_page = True`; browser only picked up the change after `localStorage.clear()`

### [Frontend Patterns] Espresso ink ramps are not monotonic — `--ink-blue-4` is grey and `--ink-gray-6`/`-7` are identical
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Fixing 8 WCAG AA text-contrast failures on the JKM weekly report. The instinct "the token is too light, step one number darker" silently produced a *grey* link and a no-op grey change, because two ramps break the pattern the names imply.
- **Pattern**: Measure every candidate token's computed value before swapping it; never reason from the token name's number. Verified live on a v16 Desk page (ratios against white):
  `--ink-gray-5` = `rgb(124,124,124)` = **4.17:1** → fails AA for all body text. `--ink-gray-6` = `--ink-gray-7` = `rgb(82,82,82)` = **7.81:1** — the *same colour*, so there is no passing tier between them; a tertiary text rank has to be carried by size/weight, not colour.
  `--ink-blue-3` = `--blue-600` = `rgb(0,123,224)` = **4.28:1** → fails. `--ink-blue-4` = `rgb(82,82,82)` — **not blue at all**; it is the grey ramp. The lightest blue that clears AA as text is `--blue-700` = `rgb(0,112,204)` = **5.01:1**.
  Status colours: `--amber-600` (3.16:1) and `--green-600` (3.09:1) both fail as text; `--amber-700` (5.05:1) and `--green-800` (5.42:1) pass. `--red-600` (5.36:1) already passes. Those darker values still clear the 3:1 WCAG 1.4.11 non-text floor, so one value can serve small text, a large score, and an 8px dot — no need for a parallel "dot colour" set.
  Resolve tokens at runtime to check: append a probe element, set `style.color = 'var(--token)'`, read `getComputedStyle(probe).color`.
- **Evidence**: live computed values on `/app/weekly-report` (frappe 16.9). Generic audit walking every visible text node under `.jkm-wr` across 5 tabs: 8 failures before, **0 / 679 after**; hover states included (`.jkm-open:hover` 4.28 → 5.01).

### [Frontend Patterns] Browser geometry checks silently pass on hidden panes, and `getClientRects()[0]` returns a border box
- **Discovered**: 2026-08-18
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A viewport sweep "confirmed" a table-overflow fix with `overflow: []` and `bleed: 0` at every width. Both numbers were meaningless: the tab pane was `display: none`, so every `getBoundingClientRect()` returned zeros and every comparison trivially passed. Separately, a correctly centred status dot measured 10.5px off on exactly the rows whose label wrapped to two lines.
- **Pattern**: Two distinct traps when verifying layout through a headless browser on a tabbed Desk page:
  1. **Hidden-pane zeros.** `display: none` yields all-zero rects, so *any* "is X inside Y" or "is offset 0" assertion passes. Click the tab, wait, then assert the pane is actually visible (`width > 0`) before trusting a single number. Also scope `querySelector` to the visible pane — with repeated markup (e.g. several `.jkm-tbl`), a bare `document.querySelector` grabs the first in DOM order, which is usually a hidden one.
  2. **Border box vs line box.** `el.getClientRects()[0]` on a *block* element is its border box, so on a 2-line element it appears to start half a line higher than line 1 and any "aligned to the first line" check reports a false failure. To measure the true first line box, range over the text node: `const r = document.createRange(); r.selectNodeContents(textNode); r.getClientRects()[0]`. That also gives an exact wrap-line count (`getClientRects().length`), which is the honest way to detect a crushed text column.
- **Evidence**: same sweep re-run with the pane visible reported real values (`+376px` page escape at 768px, 8-line wraps in a 120px column) that the hidden-pane run reported as `0`. Range-based measurement returned drift `0` for all 14 rows including both wrapped labels, where the element-rect method reported `-10.5`.

### [Frontend Patterns] frappe-ui 0.1.142 already ships AxisChart/DonutChart/FunnelChart/NumberChart/ListView — but three of them are traps
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Auditing 23k LOC of Coale-Insights dashboards found 39 `:style="{height|width}"` div-bar "charts", 14 raw SVG charts with hand-written coordinate maths, 18 hand-built ECharts option objects, and ZERO frappe-ui chart components in use. The full chart set had been available in the pinned version the whole time. Adopting it removed hundreds of lines of SVG arithmetic and gained axes, gridlines, tooltips, legends and responsive resize for free. But three components had to be REFUSED on evidence, so "use the library" is not unconditional.
- **Pattern**: Available and exported from `frappe-ui/src/index.ts` even in old 0.1.142: `AxisChart`, `DonutChart`, `FunnelChart`, `NumberChart`, `ECharts`, plus the whole `ListView` family. Each chart takes ONE `config` prop and needs an explicit height class or it collapses. `AxisChart` config: `{data, title, xAxis{key,type}, yAxis, y2Axis?, swapXY?, stacked?, series[{name,type:'bar'|'line'|'area',color?,axis?,...}]}`; `series[].name` MUST match a key in each data row; `swapXY` THROWS for non-bar series or `axis:'y2'`. Colour: `config.colors` is applied as the global ECharts palette via `eChartOptions.ts:31` and `series[].color` overrides per series.
  **REFUSE `FunnelChart`**: `funnelChartOptions.ts:33` hardcodes `blueGradient` and ignores `config.colors`, and line 57 hardcodes `sort: 'descending'`. It cannot be themed and it reorders stages by magnitude, so any non-monotonic funnel is misrepresented. Use `AxisChart` with `swapXY: true` and reversed data.
  **REFUSE `NumberChart`**: raw `bg-white` (unthemeable) and `text-green-500` / `text-red-500` for the delta; `green-500` is #46B37E = 2.62:1 on white, failing WCAG AA.
  **REFUSE `ListView` for data tables**: zero `role`, `<th>`, `scope` or `aria-*` anywhere under `components/ListView/`. It is a flexbox div grid, so swapping semantic `<table scope>` markup for it regresses WCAG 1.3.1 header association.
  Also: ECharts paints to a canvas, so a `var(--token)` colour renders as NOTHING. Resolve theme tokens at runtime with `getComputedStyle(document.documentElement).getPropertyValue(token)`; that also keeps a `[data-theme]` switch working. And a canvas is invisible to assistive tech, so pair every chart with an `.sr-only` table (with `<caption>` and `scope`) or an adjacent visible table carrying the same series.
  Finally: do NOT convert single-value progress bars into charts. A "% of target" or health-score meter is the correct lighter affordance; only genuine multi-point or multi-category series belong in a chart.
- **Evidence**: `node_modules/frappe-ui/src/index.ts:49-61,75-79` (exports); `Charts/types.ts` (configs); `funnelChartOptions.ts:33,57`; `Charts/NumberChart.vue` delta classes; `grep -rnoE 'role=|<th|scope=|aria-' components/ListView/*.vue` returns nothing. 21 charts converted and verified rendering in a live browser across 14 routes with zero console errors; `bench build --app insights` exit 0.

### [Debugging Patterns] vue-tsc does NOT catch an unbalanced Vue template; only the build does
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A chart conversion replaced a wrapper element but left its `</div>` behind in `SalesIntelligence.vue`. `yarn lint` passed, `vue-tsc --noEmit` reported its usual 180 errors with none in that file, and `vitest` passed 20/20. `bench build` then failed with `Invalid end tag` and a stack trace pointing at the LAST line of the template, ~50 lines away from the actual surplus tag.
- **Pattern**: A malformed SFC template is a compile-time failure that typecheck and unit tests both miss, and the reported line is where the parser gave up, not where the imbalance is. Two things follow. (1) After any template-structure edit, run the real build or at minimum parse every SFC: `require('@vue/compiler-sfc').parse(src, {filename}).errors`. That is a fast whole-tree gate worth running before `bench build`. (2) To locate the real imbalance, scan the template with interpolations, comments and quoted attribute values blanked out (otherwise `Record<string, number>` inside `{{ }}` parses as a tag), match tags GLOBALLY rather than per line (multi-line `<Select\n …\n/>` is invisible to a line-based scanner), and find the first point where nesting depth returns to 0 before the end. The surplus tag is immediately after it.
- **Evidence**: `SalesIntelligence.vue` line 1661 held a stray `</div>`; the compiler reported `Invalid end tag @ 1710`; depth analysis showed the root closing at 1686 instead of 1710. After removal, all 226 SFCs parsed clean and the build succeeded.

### [Frontend Patterns] apiCall unwraps the {status,data} envelope but createResource does NOT — swapping them renders zeros everywhere
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After migrating 21 Coale-Insights dashboards from a hand-rolled `apiCall()` pattern to a `createResource`-based composable, every dashboard rendered structurally correctly but with all-zero values: "Total Headcount 0", "Avg. Salary KES 0", "No composition data available". No console error, no failed request, HTTP 200 throughout. Nothing looked broken; the numbers were simply wrong. Only a live browser smoke test caught it, because unit tests mocked the resource layer and the typecheck was satisfied by the (equally wrong) payload interfaces.
- **Pattern**: `insights/api/response.py` (and the same convention in many Frappe apps) wraps endpoint output as `{"status": "success", "data": {...}}`. The local `apiCall()` helper silently unwrapped it (`return response?.data ?? response`), so components read `payload.field` directly. frappe-ui's `createResource` sets `resource.data` to the RAW `message` value, i.e. the whole envelope, so the same component code reads `envelope.field` -> `undefined` -> every `?? 0` fallback fires and the UI fills with confident zeros. FIX: decode the envelope in exactly ONE exported helper and call it from both paths, treating `status === "error"` on a 200 as a real error state. Keep the two paths sharing one decoder or they drift again. Guard when migrating any Frappe frontend between `call`/`apiCall` and `createResource`/`useDoc`: check whether the endpoint wraps, and verify a real number renders in a browser, not just that the request succeeded.
- **Evidence**: `/api/method/insights.api.ml.get_hr_overview` returned `{message: {status, data}}` (probed from an authenticated browser session); `frappe-ui/src/resources/resources.js` assigns the response to `out.data` with no unwrapping; HR dashboard showed 0 for every metric before the fix and 17 headcount with a 52.9/47.1 gender split after a single change in the shared composable.

### [Frontend Patterns] A whitelisted endpoint that does not exist returns HTTP 417 ValidationError, not 404
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: The Marketing & CRM dashboard rendered a header and nothing else. Its data call pointed at `insights.api.ml.marketing_intelligence.get_marketing_overview`, but the module on disk is `marketing.py`; no `marketing_intelligence.py` has ever existed. The browser console showed only `Failed to load resource: 417 (EXPECTATION FAILED)`, which reads like a server-side validation failure rather than a missing method, so the dashboard looked like a data problem instead of a wrong dotted path.
- **Pattern**: `frappe.handler.execute_cmd` raises `ValidationError` (HTTP 417) when it cannot resolve the dotted path, so a typo'd or renamed module is indistinguishable from a genuine validation error at the network layer. When a Frappe frontend panel is empty and the console shows 417, FIRST confirm the module and function actually exist on disk (`ls apps/<app>/<app>/api/...`) before debugging the query. Also note `bench execute <dotted.path>` falls back to `eval()` and reports a bare `NameError: name '<app>' is not defined` for an unimportable path, which is another disguised "does not exist" signal.
- **Evidence**: `MarketingCRMIntelligence.vue` called `...marketing_intelligence.get_marketing_overview`; `ls apps/insights/insights/api/ml/` shows `marketing.py` and no `marketing_intelligence.py`; the endpoint returned `{exception, exc_type: "ValidationError", exc, _server_messages}` with status 417 while sibling endpoints on the real module returned 200.

### [Frontend Patterns] frappe-ui tailwind preset REPLACES theme.colors — indigo/emerald/slate/zinc/neutral emit ZERO css
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Reviewing 23k LOC of custom intelligence dashboards in the Coale-Insights fork (`jkm/apps/insights/frontend`, frappe-ui 0.1.142). 42 utility classes across 12 files were rendering completely unstyled — an ML training panel showed black-on-white where a tinted card was intended. Two independent review passes classified the hits as merely "AI palette" taste violations; only a real Tailwind build revealed they compile to nothing.
- **Pattern**: `frappe-ui/src/tailwind/plugin.js` sets `theme.colors = colorPalette` (a full REPLACE, not `extend`). `colorPalette` is built from `colors.json.lightMode`, whose families are exactly: `gray blue green red amber orange yellow teal cyan purple pink violet`. **Tailwind's default `indigo`, `emerald`, `slate`, `zinc`, `neutral`, `sky`, `rose`, `lime`, `fuchsia`, `stone` DO NOT EXIST** and silently emit no CSS — no build warning, no console error. `indigo` is the dangerous one because it is the most natural substitute for `violet`/`blue`. Verify with a probe build, never by eye: `npx tailwindcss -i src/index.css -c tailwind.config.js --content probe.html -o out.css` then grep the output for the class. Add a CI guard: `! grep -rE '\b(text|bg|border|from|to|ring|divide)-(indigo|emerald|slate|zinc|neutral)-[0-9]{2,3}\b' src`.
- **Evidence**: `node_modules/frappe-ui/src/tailwind/plugin.js:59` (`colors: colorPalette`), `colorPalette.js:4-38` (`generateColorPalette`), `colors.json.lightMode` keys. Probe build confirmed `grep -c indigo out.css` = 0 while `bg-purple-500` emitted `rgb(156 69 227)`.

### [Frontend Patterns] frappe-ui semantic token families are ROLE-SCOPED: text→ink, bg→surface, border/ring/divide→outline
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After migrating the same dashboards onto Espresso semantic tokens, 6 of 32 distinct semantic utilities in use emitted zero CSS. Agents had written `bg-ink-gray-7`, `bg-outline-gray-3`, `text-outline-gray-1`, and `ring-surface-white` by analogy, assuming any semantic family works with any utility prefix.
- **Pattern**: The preset registers each semantic family against SPECIFIC Tailwind utility keys, so crossing them is the same silent-zero-CSS failure as a missing colour family. Valid combinations only: `textColor`/`stroke`/`placeholderColor` take **ink**; `backgroundColor` takes **surface**; `fill` takes **ink** OR **surface**; `borderColor`/`ringColor`/`divideColor` take **outline**. So `bg-ink-*`, `bg-outline-*`, `text-surface-*`, `text-outline-*`, `border-ink-*`, `ring-surface-*` are all dead. Bare `border` (no colour) is safe and already resolves to `var(--outline-gray-1)`. Guard: `! grep -rE '\b(bg-(ink|outline)-|text-(surface|outline)-|(border|ring|divide)-(ink|surface)-)' src`.
- **Evidence**: `node_modules/frappe-ui/src/tailwind/plugin.js:220-250` — `textColor: { ink }`, `backgroundColor: { surface }`, `fill: { ink, surface }`, `stroke: { ink }`, `placeholderColor: { ink }`, `borderColor: () => ({ DEFAULT: 'var(--outline-gray-1)', outline })`, `ringColor: { outline }`, `divideColor: { outline }`. Probe build confirmed all 6 crossings emit nothing.

### [Frontend Patterns] Espresso gray-500 is #999999 (2.85:1) — text-gray-400/500/600 all FAIL WCAG AA body text
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A WCAG 2.1 AA audit of the intelligence dashboards found 578 instances of `text-gray-500`/`text-gray-400` used as secondary body text in a financial-reporting product. Anyone reasoning from stock Tailwind gets this wrong: Tailwind's `gray-500` is `#6b7280` (4.83:1, PASSES), so the failure is invisible unless you read the installed palette.
- **Pattern**: Espresso overrides the whole gray ramp. Computed on white: `gray-400` #C7C7C7 **1.69:1**, `gray-500` #999999 **2.85:1**, `gray-600` #7C7C7C **4.17:1** — all three FAIL the 4.5:1 body-text threshold. `gray-700` #525252 is 7.81:1 and is the first passing step. Mapped to semantic ink: `ink-gray-3/4/5` fail, **`ink-gray-6` (7.81:1) is the minimum for body text**, `ink-gray-8` 11.73:1, `ink-gray-9` 17.93:1. Also fails as text: `ink-green-3` 4.06:1, `ink-blue-2` 3.34:1, `ink-amber-3` 3.16:1 — so green/amber/blue can NEVER carry status as text at body size. They are only valid as non-text graphics (3:1 threshold): `surface-green-3` 4.06, `surface-blue-3` 4.28, `surface-amber-3` 3.16, `surface-red-5` 5.36. Consequence: an AA-compliant Espresso status vocabulary is neutral-by-default with `ink-red-4` (5.36:1) for exceptions, and every colour fill needs an adjacent text label.
- **Evidence**: `frappe/public/scss/espresso/_colors.scss` gray-500 `#999999` (corroborates the 2026-07-15 source-verification entry); `node_modules/frappe-ui/src/tailwind/colors.json` `lightMode.gray` + `themedVariables.light.ink`; contrast computed per WCAG relative-luminance formula and cross-checked against the compiled CSS (`.text-gray-500 { color: rgb(153 153 153) }`).

### [Debugging Patterns] frappe-ui 0.1.142 Badge variant="solid" is unusable for blue/orange/red (1.03:1–1.46:1)
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Building an AA-compliant status vocabulary on frappe-ui `<Badge>`. The `solid` variant looked like the obvious choice for a Critical badge, but computing its actual token pairs showed it is effectively invisible.
- **Pattern**: `Badge.vue`'s `solid` map pairs `ink-<color>-1` (a near-WHITE tint) with `surface-<color>-2/3/4` (also a light tint) — the intent was clearly white-on-saturated, but the tokens resolve light-on-light. Measured: `solid/blue` #F2F9FF on #E6F4FF = **1.05:1**, `solid/orange` #FDFAED on #FFF7D3 = **1.03:1**, `solid/red` #FFF7F7 on #FDC2C2 = **1.46:1**. Only `solid/gray` (white on #171717, 17.93:1) is usable. The `subtle` variant is fine for gray (7.04:1) and red (5.08:1); green/amber/blue subtle land at 3.0–3.7 (large-text only). So: use `variant="subtle"` or `"outline"`, restrict badge TEXT to gray and red, and carry escalation with variant rather than extra hues. Re-check if frappe-ui is upgraded.
- **Evidence**: `node_modules/frappe-ui/src/components/Badge.vue` solidClasses/subtleClasses maps, resolved through `colors.json.themedVariables.light` and scored with the WCAG formula.

### [Frontend Patterns] Swapping `any` → `Record<string, unknown>` without narrowing turns 0 type errors into hundreds
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Enforcing a no-`any` rule across 23k LOC of dashboards. Replacing `data: any` and `useIntelligenceDashboard<Record<string, any>>` with `Record<string, unknown>` satisfied the lint rule but drove `vue-tsc` from 262 pre-existing `src2` errors to 571, because every `formatCurrency(row.amount)` and `row.balance.toFixed(2)` became an `unknown` violation. Measured cost of the naive swap on 4 files: +264 errors.
- **Pattern**: `Record<string, unknown>` is NOT a drop-in for `Record<string, any>`; it is a promise to narrow that the codebase has not kept. Do the two together: declare a real payload interface plus one row interface per array, with accessed fields typed `number`/`string`/`boolean` and optionality mirroring the code's existing `?.`/`|| 0` guards, then pass it as the resource generic or `defineProps` type ONCE and let it flow. Also: **verify row shapes against the Python endpoint, not the error messages** — a well-meaning agent flattened a nested `{"current": {...}}` payload into `current_revenue` and silently broke every rendered value; the backend at `insights/ml/strategic_finance/scenarios.py:277-282` returns nested objects. Only-`unknown`-is-acceptable case: genuinely arbitrary rows, e.g. a drill-down table over arbitrary DocType columns, where `String(val)`/`Number(val)` coercion at the read site is correct (that swap cost 1 error, not 264).
- **Evidence**: measured `npx vue-tsc --noEmit` deltas per file across the migration (262 → 571 → 180); `plugin.js`-independent. Final state 180 errors, 82 BELOW baseline, with zero per-file regressions.

## Version Compatibility

### [Version Compatibility] workspace_sidebar/ JSON files required to survive bench migrate
- **Discovered**: 2026-04-21
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After migrate, all nvumabaranda_group Workspace Sidebar entries were deleted from DB because there was no `workspace_sidebar/` directory
- **Pattern**: Frappe v15 `sync.py` deletes "orphaned" Workspace Sidebar DB records (those without a matching JSON file in `app/workspace_sidebar/`) on every `bench migrate`. Without `workspace_sidebar/*.json` files, module sidebars are destroyed on each migrate. Solution: create `workspace_sidebar/` directory with one JSON per module. File naming MUST match `frappe.scrub(name)` exactly — e.g., `"Chemical & Waste Recycling"` → `chemical_&_waste_recycling.json` (the `&` is preserved by `frappe.scrub()`, NOT converted to `_`).
- **Evidence**: `frappe/model/sync.py:120` — `workspace_sidebar` in `app_level_folders`; confirmed via `bench execute "print(frappe.scrub('Chemical & Waste Recycling'))"` → `chemical_&_waste_recycling`

### [Version Compatibility] Desktop Icon JSON must use icon_type "App" for /desk tile visibility
- **Discovered**: 2026-04-21
- **Confidence**: high
- **Uses**: 2
- **Flagged**:
- **Context**: After `bench migrate`, an app tile disappeared from `/desk`. The app had `add_to_apps_screen` configured but no `desktop_icon/*.json`, so its tile never appeared on `/desk` (an app with the JSON did appear). Creating `desktop_icon/<app>.json` with `icon_type=App`, `link_type=External`, `link=/app/route`, and `logo_url=/assets/<app>/images/<app>-logo.png` resolved it.
- **Pattern**: `frappe/model/sync.py` imports all JSON files in `desktop_icon/` during every `bench migrate`. If the main app JSON has `icon_type: "Link"` instead of `icon_type: "App"`, it overwrites the DB record and the app tile vanishes from `/desk`. The correct JSON for the parent app tile MUST have `icon_type: "App"`, `link_type: "External"`, and `link: "/app/route"`. Additionally, `sync.py` calls `delete_duplicate_icons()` which deletes DB App icons without a matching JSON file. Fix: update the JSON + update DB via `frappe.db.set_value()` (not `doc.save()` — the Dynamic Link validation on `link_to` crashes for External link type) + `bench clear-cache`.
- **Evidence**: `frappe/model/sync.py:120` — `desktop_icon` in `app_level_folders`; `sync.py:308-321` — `delete_duplicate_icons()` removes App icons without JSON backing

### [Version Compatibility] Workspace Sidebar title must match workspace name to block auto-gen
- **Discovered**: 2026-05-20
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After renaming a Workspace Sidebar from "JKM Production" to "Production", subsequent `bench migrate` runs kept recreating a duplicate "JKM Production" sidebar with only the workspace shortcuts (9 items vs the renamed sidebar's 45). The duplicate then won selection at `get_workspace_for_module`.
- **Pattern**: `frappe/desk/doctype/workspace_sidebar/workspace_sidebar.py:154` `create_workspace_sidebar_for_workspaces()` runs on app install / certain migrates and creates a Workspace Sidebar for any public Workspace whose `name` is NOT present in `frappe.get_all("Workspace Sidebar", pluck="title")` (note: pluck=`title`, not `name`). To block auto-creation while keeping a different sidebar `name`, set the sidebar's `title` field to exactly the workspace name. Combined with `name` matching the Desktop Icon label and the fixture filename matching `frappe.scrub(name)`, you get a stable three-way invariant that survives migrate.
- **Evidence**: Reproduced on Frappe v16.16.0; condition at workspace_sidebar.py:165-168 — `if workspace not in existing_sidebars` where `existing_sidebars = frappe.get_all("Workspace Sidebar", pluck="title")`

### [Version Compatibility] Desktop Icon label must match Workspace Sidebar name (case-insensitive)
- **Discovered**: 2026-05-20
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Added a `Production` child desktop_icon under `JKM Production` parent launcher. Icon was correctly in DB but never appeared in the /desk modal.
- **Pattern**: `DesktopIcon.is_permitted()` for `icon_type == "Link"` looks up `bootinfo.workspace_sidebar_item[self.label.lower()]["items"]` and returns False on KeyError. The Desktop Icon `label` (lowercased) MUST be a key in `workspace_sidebar_item`. That dict is keyed by lowercased `Workspace Sidebar.name` (see `boot.py:get_sidebar_items` → `sidebar_items[sidebar_title.lower()]`). So the Workspace Sidebar `name` must match the icon `label` exactly (case-insensitive). The Workspace itself can be named anything else; only `Workspace Sidebar.name` is the linkage point. Items inside the sidebar still reference the actual Workspace by name via `link_to`.
- **Evidence**: `frappe/desk/doctype/desktop_icon/desktop_icon.py:107` — `items = bootinfo.workspace_sidebar_item[self.label.lower()]["items"]` raises KeyError caught at line 114-115 returning False

### [Version Compatibility] Desk icon full chain: label==Sidebar.name==Workspace.name==scrub(label).svg for clickable+imaged tiles
- **Discovered**: 2026-07-21
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After renaming nvumabaranda_group module labels "X Management" -> "X Mngt", the 5 /desk tiles were visible but clicking gave "Page x-mngt not found" and showed no icon image. The prior entry (label==Sidebar.name) only fixes VISIBILITY, not click-through or image.
- **Pattern**: A standard `icon_type=Link` desk tile has THREE independent couplings, all keyed off the same string: (1) VISIBILITY — `Desktop Icon.label.lower()` must be a key in `bootinfo.workspace_sidebar_item` (== lowercased `Workspace Sidebar.name`). (2) ROUTE — the /desk home tile href is `/desk/<slug(Workspace Sidebar.name)>?sidebar=...` (built client-side, NOT via `get_route_for_icon`); slug = lowercase + spaces->dashes. For it to resolve, a **Workspace** must exist at `frappe.workspaces[slug(name)]`, i.e. `Workspace.name` (NOT title) must slug-match the sidebar name. (3) IMAGE — `get_desktop_icon()` builds `assets/<app>/icons/desktop_icons/<variant>/<frappe.scrub(Desktop Icon.label)>.svg`; the SVG file must be named `scrub(label).svg`. So a working "Crop Mngt" tile needs Desktop Icon.label = Workspace Sidebar.name = Workspace.name = "Crop Mngt", plus `crop_mngt.svg` in solid/ + subtle/. Corrects the earlier entry: the Workspace CANNOT be named differently if the tile must be clickable — only visibility tolerates a mismatch. Rename via `frappe.rename_doc("Workspace", old, new, force=True, rebuild_search=False)` (~12s first call; cascades the sidebar Home-item `link_to`), then re-export the workspace fixture to its new scrubbed folder and delete the old one.
- **Evidence**: frappe 16, live browser — tile href `/desk/crop-mngt?sidebar=Crop%20Mngt` 404'd until Workspace renamed to "Crop Mngt"; `desktop_icon.html` img src = `frappe.utils.get_desktop_icon(icon.label,...)` -> `utils.js:1447` `frappe.scrub(icon_name)`; route slug `router.js:580-582`; `frappe.workspaces` keyed by `slug(page.name)` at `desk.js:300`; tile href confirmed via DOM `a.desktop-icon[href]`.

### [Debugging Patterns] app_level_folders fixtures (desktop_icon/workspace_sidebar) without a `modified` key get reverted on every migrate
- **Discovered**: 2026-07-21
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: After a correct DB rename, `bench migrate` reverted Pest/Waste Desktop Icon labels from "Pest Mngt" back to the record name while Crop/Gym/Livestock (identical edits, but their fixtures HAD timestamps) held.
- **Pattern**: `app_level_folders` docs (`desktop_icon/*.json`, `workspace_sidebar/*.json`) are gated by the same modified-timestamp check as standard docs (`frappe/modules/import_file.py`): a fixture re-imports only when its `modified` is newer than the DB record's. A fixture with NO `modified` key is re-imported on EVERY migrate, and that re-import path can reset fields (e.g. label back to the record name) — silently un-doing direct `db.set_value` fixes. FIX: always ship `creation` + `modified` (+ `modified_by`) in these fixtures; set `modified` OLDER than the live DB record so migrate skips it. `import_file_by_path(path, force=True)` does NOT reliably update `label` on an existing record — use `frappe.db.set_value` for the live DB and rely on the fixture only for fresh installs.
- **Evidence**: frappe 16 — pest/waste desktop_icon fixtures lacked `modified`; adding "2026-04-16 14:54:00.000000" (older than the set_value'd DB modified) made migrate skip them and labels held across a second full migrate. Extends the existing "Workspace standard-sync skips re-import unless modified is bumped" entry to app_level_folders label reverts.

### [Version Compatibility] Workspace v16 has no is_standard field
- **Discovered**: 2026-05-20
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Reviewing a custom app for v16 alignment — `setup_workspace.py` set `ws.is_standard = 0` which is a v15-only Workspace field.
- **Pattern**: Frappe v16 removed `is_standard` from the Workspace DocType. v16 uses `public` (1/0) for shared-vs-private and the JSON fixture path `app/<module>/workspace/<name>/<name>.json` for app-shipped workspaces. Programmatic workspace creation via `frappe.new_doc("Workspace")` should set `public=1`, `module=<module>`, and not reference `is_standard`. Prefer the JSON fixture over a one-time setup script — the JSON survives migrate and is the canonical source.
- **Evidence**: `bench --site <site> execute "[f.fieldname for f in frappe.get_meta('Workspace').fields]"` on Frappe v16.16 — `is_standard` not in returned fields list

### [Version Compatibility] Frappe ships only Draft/Approved/Rejected as built-in Workflow States
- **Discovered**: 2026-05-20
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A custom app's migrate failed with "Workflow State Closed not found" because the workflow fixture referenced states the install.py author assumed were Frappe defaults.
- **Pattern**: When a Workflow fixture references a state, that Workflow State document must already exist or the fixture import crashes. Frappe ships ONLY `Draft`, `Approved`, `Rejected` as built-in Workflow States — NOT `Open`, `Completed`, `Closed`, `In Progress`, etc. Apps must create all non-default states via a `before_migrate` hook (or after_install) using `frappe.get_doc({"doctype": "Workflow State", "workflow_state_name": ..., "style": ...}).insert()`. Confirm built-ins with `bench execute "[w.name for w in frappe.get_all('Workflow State')]"` on a fresh site.
- **Evidence**: `bench --site <site> execute "[w.name for w in frappe.get_all('Workflow State', filters={'name': ['in', ['Closed','Open','Completed']]})]"` returned `[]` on a fresh site — confirming Open/Completed/Closed are NOT bundled

### [API] frappe.cache() parentheses are v16-only — use frappe.cache.set_value/get_value
- **Discovered**: 2026-06-08
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: payroll_africa boot.py used `frappe.cache()` (callable form) — semgrep `frappe-cache-breaks-multitenancy` rule flags this
- **Pattern**: `frappe.cache()` (called as a function) is the v16 pattern for getting the Redis wrapper. In v15 the API differs. The multitenancy-safe and version-compatible form is `frappe.cache.set_value(key, val, expires_in_sec=N)` and `frappe.cache.get_value(key)` — these use the property accessor (no parentheses) which works on both v15 and v16 and handles site isolation internally.
- **Evidence**: semgrep rule `frappe-cache-breaks-multitenancy` in `frappe_correctness.yml`; fix confirmed working in boot.py cache for enabled countries list

### [API] frappe.publish_realtime without room/user scope is a semgrep ERROR
- **Discovered**: 2026-06-08
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: payroll_africa `PayrollAfricaSettings.on_update()` called `frappe.publish_realtime("event")` with no audience scope — broadcasts to all connected users on the entire site
- **Pattern**: Every `frappe.publish_realtime()` call must specify at least one of: `user=`, `room=`, `doctype=`/`docname=`. Without scope, the event leaks to all sessions. For settings-updated events that only affect the saving user's session, use `user=frappe.session.user, after_commit=True`. The `after_commit=True` ensures the event fires only after the DB transaction commits, preventing stale reads in the handler.
- **Evidence**: semgrep rule `frappe-realtime-pick-room` (ERROR severity) in `frappe_correctness.yml` — confirmed as the single blocking ERROR in payroll_africa scan

### [API & ORM Patterns] override_whitelisted_methods can widen a core signature and add an arbitrary-file-write primitive
- **Discovered**: 2026-06-12
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Reviewing my_app — `override_whitelisted_methods["frappe.utils.print_format.print_by_server"]` points to a custom `print_by_server(doctype, name, printer_setting, ..., file_path=None)` that does `open(file_path, "wb"); output.write(f)` then `finally: os.remove(file_path)`. The `frappe.has_permission(doctype, "read", name)` gate only covers the printed doc — NOT `file_path`.
- **Pattern**: When you override a Frappe core whitelisted method via `override_whitelisted_methods`, your replacement is exposed at the SAME `/api/method/<core.dotted.path>` and inherits no extra protection. Adding a new caller-controlled param like `file_path` to the signature turns it into an arbitrary-file **truncate-then-delete** primitive for any authenticated user (the `open(path,"wb")` truncates the target before the `finally: os.remove` deletes it). Never accept a filesystem path from a whitelisted caller; always generate the temp path server-side (`os.path.join("/tmp", f"...{frappe.generate_hash()}...")`) as the same file already does for the raw-printing branch.
- **Evidence**: `my_app/my_app/customizations/print_format.py:39-80`; semgrep `frappe-security-file-traversal` flagged lines 63 & 75; the raw branch (line 62) correctly uses generate_hash while the PDF branch (72-73) trusts the param.

### [Frontend Patterns] doctype_js resolves source-side via get_js(), so a non-served public/ dir still works
- **Discovered**: 2026-06-12
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: my_app nests three levels (`apps/my_app/my_app/my_app/`) and has TWO `public/js` dirs. `doctype_js` paths like `"public/js/sales_invoice.js"` and `"my_app/public/js/weighbridge_log.js"` both load fine despite only one being under a served `/assets/` path.
- **Pattern**: `doctype_js` (and `app_include_js` cousins) are read server-side relative to the app PACKAGE root (`get_app_path("app")` = `get_pymodule_path("app")` = `apps/<app>/<app>/`) and INLINED into the form bundle via `get_js()` — they are NOT fetched as browser `/assets/` URLs. So the file only needs to exist at `<package_root>/<hook_path>`, even if that dir isn't the build-served `public/`. To verify a `doctype_js` hook actually loads, resolve `<package_root>/<value>` on disk; a path that doesn't exist there means the client script silently never loads (no console error).
- **Evidence**: confirmed all three my_app `doctype_js` hooks resolve under `apps/my_app/my_app/` on frappe 16.10.4; `frappe/public/js/frappe/form/form.js` loads via the server-inlined `__messages`/`get_js` path, not an asset request.

## Build & Deployment

### [Build] Semgrep frappe-sql-format-injection flags both .format() AND f-strings
- **Discovered**: 2026-04-03
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Fixing semgrep violations in payroll_africa report files — converting `.format(conditions=conditions)` to f-string still triggered the rule
- **Pattern**: The `frappe-sql-format-injection` semgrep rule matches BOTH `frappe.db.sql("...".format(...))` AND `frappe.db.sql(f"...")`. The only way to pass is string concatenation: `frappe.db.sql("..." + conditions + "...", params)`
- **Evidence**: `<bench>/apps/semgrep-rules/rules/security/sql.yml` lines 10-13 — rule explicitly lists both patterns

### [Build] `bench build --hard-link` (no `--site`) recopies every installed app's assets; the site-scoped form symlinks and is ~100x faster
- **Discovered**: 2026-08-19
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: jkm_finance AI-explain feature — rebuilding just `jkm_finance`'s bundle via `bench build --app jkm_finance --hard-link` on the `jkm` bench (24+ installed apps) blew past a 300s timeout still mid-way through `Copying assets from .../erpnext/node_modules`; the proven-fast form from the same session's earlier history was `bench --site jkm build --app jkm_finance`, which finished (link phase + esbuild + clear-cache) in ~3s.
- **Pattern**: Two different code paths. Bare `bench build [--app X] [--hard-link]` (no `--site`) walks the **global** `sites/assets` linker and, with `--hard-link`, physically **copies** every installed app's `public/` + `node_modules/` (not just the target app's) before running esbuild — on a bench with many apps this is minutes of pure I/O for an unrelated one-line CSS change. `bench --site <site> build --app X` runs the same linker but **symlinks** (`Linking ... to ./assets/...`, not `Copying`) and still only esbuild-compiles the requested app; total wall time is dominated by esbuild (~1-2s), not the link pass. For a targeted single-app rebuild during dev, always scope with `--site` and never add `--hard-link` (that flag is for production asset staging, not iterative dev builds).
- **Evidence**: `bench build --app jkm_finance --hard-link` timed out at 300s still copying `erpnext/node_modules`, `hrms/node_modules`, etc. (alphabetical, ~24 apps deep). `bench --site jkm build --app jkm_finance`: `Linking ... to ./assets/frappe` ... `DONE Total Build Time: 1.398s` / `Done in 7.69s` wall-clock, producing a freshly-hashed `jkm_finance.bundle.<hash>.css` confirmed newer than the source file's mtime.

### [Build] Shell `&` background jobs inside the persistent bash tool die when the spawning tool call returns; use the tool's own `async: true` instead
- **Discovered**: 2026-08-19
- **Confidence**: medium
- **Uses**: 1
- **Flagged**:
- **Context**: Launched a long `bench --site jkm migrate` and a smoke-test script via `(cmd > /tmp/log 2>&1 &); echo "started pid $!"` to dodge the bash tool's per-call timeout. `ps aux` later showed no matching process and the log file was truncated mid-run (or, for one attempt, contained nothing past the first import warning) even though the same command run through the tool's own `async: true` parameter and `hub wait` completed normally end-to-end.
- **Pattern**: The bash tool's persistent shell state (env vars, cwd) survives across calls, but a raw `(...) &`-detached child process is not guaranteed to survive past the end of the tool call that spawned it — it can be reaped along with that call's process group. The tool's `async: true` flag is a real backgrounded job the tool tracks and that `hub wait`/`hub jobs` can block on until actual completion; plain shell `&` is not a substitute for it. For anything that must outlive one tool call (migrate, full pipeline runs, multi-minute test suites), use `async: true` (optionally with output redirected to a file if the command's own stdout buffering would otherwise starve a piped `grep`), not manual `&` backgrounding.
- **Evidence**: Three separate `(cmd > logfile 2>&1 &)` attempts this session either left `ps aux` showing no live process with a stale/incomplete log (smoke-test script: log stopped after the first UserWarning line, no traceback, no completion marker) or could not be distinguished from a hung process; the identical smoke-test command re-run via `async: true` + `hub wait` produced a complete, correctly-ordered log (import warning, `===RESULT===`, full JSON, `SMOKE_EXIT=0`) after 494.83s.

### [Version Compatibility] fixtures hook with v16-only DocType breaks export-fixtures on v15
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Aligning my_app to a dedicated version-15 branch. App listed a v16-only core DocType ("Workspace Sidebar") in the `fixtures` hook.
- **Pattern**: Frappe's fixture IMPORT path (`frappe/utils/fixtures.py::import_fixtures`) wraps `import_doc` in `except (ImportError, frappe.DoesNotExistError)` and skips missing DocTypes — so install/migrate on v15 is safe even with a v16-only fixture file present. But the EXPORT path (`export_fixtures` → `export_json` → `frappe.get_all(doctype)`) has NO such guard: `frappe.get_all("Workspace Sidebar")` on v15 raises (no table), so `bench export-fixtures` fails. Fix: build the `fixtures` list conditionally and only append v16-only DocType entries when `int(frappe.__version__.split('.')[0]) >= 16` (wrap in try/except). Reading `frappe.__version__` at module level in hooks.py is safe and does NOT trip the `frappe-breaks-multitenancy` rule (it is attribute access, not a DB call).
- **Evidence**: apps/frappe/frappe/utils/fixtures.py lines 38-46 (import skip) vs 298-323 (export get_all, unguarded); confirmed on bench running frappe 15.110.0.

### [Version Compatibility] Workspace standard-sync skips re-import unless JSON `modified` is bumped
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 2
- **Flagged**:
- **Context**: Shipped a content change (chart block refs) in an app's standard workspace JSON; `bench migrate` did not update the DB workspace. This was reconfirmed when editing `<app>/workspace/<name>/<name>.json` (links/shortcuts/content) without bumping `modified` left the DB record untouched after `bench migrate` — `reload-doc <module> workspace <name>` ALSO no-ops for the same reason (same modified-timestamp gate). Same gate hit `workspace_sidebar/<name>.json` too — it's an `app_level_folders` doc (like `desktop_icon/`), synced by a different importer than module-folder standard docs, but gated by the identical modified-timestamp comparison.
- **Pattern**: Frappe imports a module-folder standard doc (e.g. Workspace) only when the JSON's internal `modified` timestamp is NEWER than the DB record's. Editing `content`/blocks without bumping `modified` means migrate silently skips the re-import and the DB keeps the old version — and `reload-doc` doesn't bypass this either, it hits the same check. The same gate applies to `app_level_folders` docs (`workspace_sidebar/*.json`, `desktop_icon/*.json`) via a separate importer in `frappe/model/sync.py`, so a Workspace + its Workspace Sidebar edited together both need their `modified` bumped or only one half updates. Fix: bump the `"modified"` field in the JSON to a newer timestamp when hand-editing standard workspace/doc JSON (and the paired sidebar JSON, if also edited), then `bench migrate`. To force a one-off re-import in console: `from frappe.modules.import_file import import_file_by_path; import_file_by_path(frappe.get_app_path(app, ...path..., 'name.json'))`. Verify by checking `frappe.get_doc(dt, name).modified` in `bench console` before/after — don't assume success from a quiet migrate log.
- **Evidence**: module JSON modified == DB modified == "2026-03-28 12:23:10" after migrate; DB still had old chart refs until `modified` bumped + re-imported. Confirmed on frappe 15.110.0. Reconfirmed on frappe 16.23.0 (a custom app's Workspace + Workspace Sidebar): both files' `modified` were older than their DB records (prior manual UI edits), so shortcuts/links additions silently didn't apply until both timestamps were bumped past the DB values and `bench migrate` re-run.

### [API & ORM Patterns] Number Card name derives from `label`, not the explicit `name`
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Programmatically creating Number Cards referenced by a Workspace; cards created with a name prefix did not match the workspace's `number_card_name` refs.
- **Pattern**: A `Number Card`'s document `name` is set from its `label` (an explicit `"name"` in the insert dict is ignored; a colliding label gets a `-1` suffix). So a Workspace number_card block's `number_card_name` must equal the card's `label`, not any separately-chosen name. When wiring workspace number cards, set `label` == the workspace `number_card_name` reference. (Dashboard Chart, by contrast, autonames `field:chart_name`, so its name == `chart_name`.)
- **Evidence**: insert with name="Errors This Month", label="Errors (This Month)" produced doc name "Errors (This Month)-1" on frappe 15.110.0.

### [Debugging Patterns] Number Card / Dashboard Chart filters_json must be a LIST, not a dict
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A workspace Count chart crashed in the browser with `TypeError: 'NoneType' object is not callable` at dashboard_chart.py `filters.append(...)`.
- **Pattern**: For Document-type Number Cards and Count/Heatmap Dashboard Charts, `filters_json` MUST be a list of `[doctype, fieldname, operator, value]` conditions (e.g. `[["Sales Invoice","docstatus","=",1]]`), NOT a dict like `{"docstatus":1}`. `dashboard_chart.get()` does `filters = frappe.parse_json(filters) or ...; filters.append(...)`. A dict JSON parses to a `frappe._dict`, which is truthy (so the `or []` fallback is skipped) and whose missing-attribute `.append` returns None → `None(...)` raises "'NoneType' object is not callable". An empty `{}` is falsy so it slips through as `[]` and masks the bug — only NON-empty dict filters crash. Dict-format filters_json is only valid for Report-type charts. After fixing, clear the dashboard chart cache / hard-refresh (results are cached).
- **Evidence**: live traceback on frappe 15.110.0; shipped Count charts (erpnext material_request_analysis) and Number Cards (total_active_items) all use list format; fix verified to render 13 points via the browser get() path.

### [Debugging Patterns] istable flipped after table creation -> "Unknown column 'parent'" on form load
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Opening a parent DocType form crashed with `OperationalError (1054, "Unknown column 'parent'")` in `document.load_from_db` while loading child rows.
- **Pattern**: Frappe adds the child-table columns (parent, parentfield, parenttype + parent index) ONLY in the CREATE TABLE path (`frappe/database/mariadb/schema.py` create()). The sync/alter path (`get_columns_from_docfields`) never adds them. So if a doctype is created with istable=0 and later flipped to istable=1, its existing table permanently lacks those columns and `bench migrate` cannot repair it. Any parent that loads it via a Table field then crashes on `WHERE parent=...`. CAUTION: `frappe.db.has_column()` / `get_table_columns()` are cached and can report the standard child columns as present for an istable doctype even when the physical table lacks them — guard with direct `SHOW COLUMNS`, not has_column. Fix: a post_model_sync patch that scans `istable=1` doctypes in the module and `ALTER TABLE ... ADD COLUMN parent/parentfield/parenttype varchar(VARCHAR_LEN)` + add parent index, idempotently.
- **Evidence**: 6 of 8 module child tables missing the columns on frappe 15.110.0; patch repaired all, idempotent on re-run, failing form then loaded.

### [API & ORM Patterns] Module-level @frappe.whitelist() functions get NO doctype permission gate
- **Discovered**: 2026-06-09
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Security review found many whitelisted eTIMS endpoints that mutate data / call external APIs with no explicit permission check.
- **Pattern**: A module-level `@frappe.whitelist()` function (called via `/api/method/<dotted.path>` → `frappe.handler.execute_cmd`) is gated ONLY by `is_whitelisted` + HTTP-method check — there is NO doctype permission enforcement. Any authenticated (non-Guest) user can call it; `frappe.get_doc()` inside does not re-check. Document-bound whitelisted METHODS (called via `run_doc_method`) get only a `has_permission("read")` gate — insufficient for methods that write or call external services (privilege escalation: a read-only user triggers writes). Always add an explicit `frappe.has_permission(doctype, "write"|"create", doc=..., throw=True)` (or a project helper) at the top of any state-changing whitelisted function/method, and validate all caller-supplied args before using them in external API calls or queries. `allow_guest=True` makes it unauthenticated entirely — audit those first.
- **Evidence**: confirmed against frappe/handler.py execute_cmd (whitelist+method check only) and run_doc_method (read-only gate) on frappe 15.110.0.

### [Debugging Patterns] Field `read_only` is UI-only — guard protected fields in validate()
- **Discovered**: 2026-06-14
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: maabara lab app — a claim/document lifecycle (status, settled_amount, approver) was protected only by `"read_only": 1` in the DocType JSON. Security review found a privilege-escalation: a write-holding role self-approved a claim out-of-band.
- **Pattern**: A field's `read_only` flag is enforced ONLY in the Desk UI. Server writes — `frappe.client.set_value`, `doc.save()`, `db.set_value` — can still set it, gated only by doctype-level write permission, NOT by the field flag and NOT by any role-gated lifecycle method. So a status/amount/approver field that should only change via `approve()`/`submit()` methods can be jumped out-of-band by anyone with write perm, bypassing `frappe.only_for(...)` and the transition guards. FIX: guard protected fields in `validate()` — compare `self.field` to the committed DB value (`frappe.db.get_value(dt, self.name, field)`) and `frappe.throw` if it changed; lifecycle methods use `db_set()` which skips `validate()`, so any change reaching `validate()` is an illegitimate direct edit. (Alternative: higher `permlevel` + permlevel perms.) Note: a child controller's custom `validate()` does NOT run on parent save — put cross-field/normalization guards on the PARENT doctype.
- **Evidence**: confirmed against frappe `client.set_value`/`save` path (no field-read_only enforcement) on frappe 16; reproduced + fixed TDD in maabara (lab_insurance_claim, controlled_document) — direct `save()` with a changed `status` now throws.

### [Version Compatibility] v16 source-verification pass — reference corrections + review cadence
- **Discovered**: 2026-07-15
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Full source review of the installed apps (frappe 16.27.1, erpnext 16.6.1, hrms 16.4.1 in a <bench>/apps) to enhance every `references/*.md`. Several long-standing reference claims were fabricated or stale and are now corrected + source-cited (each file has a `## Sources`).
- **Pattern**: Corrections that MUST NOT regress: (1) [design-tokens.md](../../frappe-design-tokens/references/design-tokens.md) previously invented a Tailwind "Black/Minimal" palette — the real design system is **Espresso** (`apps/frappe/frappe/public/scss/espresso/*.scss`): gray 50–900 (primary `#171717`, no gray-950), `--text-base: 14px`, `--weight-regular: 420`, dark mode via `data-theme="dark"`, icons via `frappe.utils.icon()` + `/assets/frappe/icons/espresso/icons.svg`. (2) Controller lifecycle order (per `model/document.py`) is `before_insert → autoname → before_validate → validate → before_save → INSERT → after_insert → on_update → on_change` — the old doc wrongly put `after_insert` before `validate`. (3) `frappe.call` AND `frappe.xcall` both exist (v13+); desk route is `/app/<workspace>` (not `/desk`); the Desk chart global is `frappe.Chart`, not `frappe.ui.Chart`. (4) frappe-ui (0.1.261, in `apps/{crm,hrms}/frontend`) exports: no `LinkField`, `FormControl` has no `link`/`doctype` type, socket is `initSocket`, `useRouter` is from vue-router. (5) CSRF token is `frappe.csrf_token` + `X-Frappe-CSRF-Token` header (no `frappe.get_cookie('csrf_token')`). (6) `enqueue(job_name=...)` is deprecated in v16 → use `job_id` + `deduplicate`.
- **Review cadence**: Re-run this source-verification pass after any bench upgrade (`bench update` / version bump). Treat installed `apps/{frappe,erpnext,hrms}` as ground truth; when a reference and the source disagree, fix the reference and cite the file in its `## Sources`. New per-task discoveries go here first (append with the template), then promote high-confidence/repeatedly-used entries into the matching `references/*.md`.
- **Evidence**: verified against `apps/frappe/frappe/public/scss/espresso/_colors.scss` (gray-500 `#999999`), `frappe/model/document.py`, `frappe/public/js/frappe/request.js` + `chart.js`, `frappe-ui@0.1.261` `src/index.ts`, `frappe/auth.py`/`sessions.py`, `frappe/utils/background_jobs.py`; all 17 target reference files updated 2026-07-15 with `## Sources`.

### [Frontend Patterns] `<component :is="'button'">` renders a registered `Button` component, not a native button
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Adapting the Coale-Insights intelligence dashboards (`jkm/apps/insights/frontend/src2`) for phone use. `KpiCard` used `<component :is="clickable ? 'button' : 'div'">` for its root.
- **Pattern**: Vue's `resolveDynamicComponent` checks the component registry BEFORE falling back to a native tag, and its lookup capitalizes, so the string `'button'` matches a registered `Button`. The card rendered frappe-ui's Button with both class sets merged: 44px tall instead of 101, `bg-surface-gray-2` instead of `bg-card`, and its three rows collapsed into Button's single slot wrapper. Never use a dynamic tag string that could collide with a component name. Use a static root plus `role="button"`, `tabindex="0"` and `@keydown.enter/.space` handlers; that also keeps a `Badge` out of a native `<button>`, which would be invalid HTML the moment a card holds a link.
- **Review cadence**: Grep for `:is="` with a lowercase tag literal whenever a component renders unexpectedly styled.
- **Evidence**: measured in a live browser at 375px on `strategic-finance-intelligence`; the rendered `outerHTML` carried `h-7 px-2 bg-surface-gray-2 inline-flex items-center justify-center` on top of the card's own classes. Fixed and locked by `KpiCard.spec.ts`.

### [Frontend Patterns] A comment before the root element inside `<template>` makes a component multi-root and silently drops inherited class/attrs
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Explaining a non-obvious root element in `KpiCard.vue`, the comment was placed inside `<template>` above the root `<div>`.
- **Pattern**: A comment node counts as a root node, so the component becomes a fragment and Vue has no single root to inherit `class`/attrs onto. `wrapper.classes()` returned `[]` and every passed class was dropped. Production builds strip comments so it can pass unnoticed there while breaking dev and unit tests. Keep component-level comments ABOVE `<template>`.
- **Review cadence**: If a component's passed classes vanish, check for a leading comment inside `<template>`.
- **Evidence**: `KpiCard.spec.ts` failed with `expected [] to include 'min-w-0'`; a repo-wide scan found two other SFCs with the same shape.

### [Frontend Patterns] frappe-ui's ECharts hardcodes `min-w-[400px] min-h-[300px]`, and a caller's height class collides with its `h-full`
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Making 21 intelligence dashboards work on phones and tablets.
- **Pattern**: `frappe-ui/src/components/Charts/ECharts.vue` sizes its container `h-full w-full min-w-[400px] min-h-[300px]`. (1) The width floor is unsatisfiable well into desktop: measured 400px inside a 364px grid cell at 1024px (37px bleed) and 74px past a 375px viewport. Because a typical app shell is `overflow-hidden`, the excess is CUT OFF with nothing to scroll and no overflow reported, so it never shows up in a page-level overflow check. (2) Passing `class="lg:h-64"` puts a second height utility on the SAME element as frappe-ui's `h-full`; the winner is stylesheet order, and when `h-full` won a chart asked for 256px rendered at 892px by taking its stretched grid cell. Fixes: release `min-width` globally on `[_echarts_instance_]`, LOWER the height floor rather than zeroing it (zeroing collapsed charts to 16px wherever a parent height was auto), and wrap ECharts in a plain div inside your own chart component so caller height and `h-full` resolve against different elements.
- **Review cadence**: Re-measure after any frappe-ui bump; these are internal classes with no public API.
- **Evidence**: measured in a live browser across 375/812/1024/1440 on `procurement-intelligence` and `strategic-finance-intelligence`; before/after 400→314px wide and 892→300px tall at 1024x768.

### [Frontend Patterns] headlessui Dialog focus restore needs two animation frames past `after-leave`
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Mobile navigation drawer built on `@headlessui/vue` Dialog (frappe-ui 0.1.142 ships no drawer/sheet primitive, only a centred Dialog).
- **Pattern**: headlessui is documented to restore focus to the opener, but measured it did not: after Escape `document.activeElement` was `<body>`, dropping a keyboard user at the top of the document (WCAG 2.4.3). Restoring on `nextTick` fixed a backdrop click but lost the race on Escape; `after-leave` still lost, because the focus-trap cleanup runs when the panel unmounts, which is after that hook. Two `requestAnimationFrame` calls past `after-leave` land after the unmount and hold for both paths. Separately: the drawer MUST be closed when crossing to desktop, or the focus trap keeps the keyboard inside a `lg:hidden` panel; and do NOT restore focus when the drawer closes due to navigation, since the user chose a destination.
- **Review cadence**: Re-verify all three dismissal paths (Escape, backdrop, navigation) after any `@headlessui/vue` bump.
- **Evidence**: driven in a live browser at 375px; escape/backdrop/navigation each asserted for `closed`, `focusOnTrigger`, and focus-not-yanked.

### [API & ORM Patterns] india_compliance does NOT add cgst_amount/sgst_amount/igst_amount to tax tables — use `gst_tax_type`, but only with an account_head fallback
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Insights Tax Intelligence dashboard rendered ₹0 across every KPI on a site with ₹88.85M of output GST. india_compliance 16.4.0 on ERPNext v16, site `jkm`.
- **Pattern**: A very common wrong assumption is that india_compliance adds per-component amount columns to `tabSales Taxes and Charges` / `tabPurchase Taxes and Charges`. It does NOT. Those columns do not exist in any installed version; every query using them raises `OperationalError (1054) Unknown column 'stc.cgst_amount'`. What it actually adds is **`gst_tax_type`** with values `cgst` / `sgst` / `igst` / `cess` / `cgst_rcm` / `sgst_rcm` / `igst_rcm`. CRITICAL CAVEAT: `gst_tax_type` is only backfilled on recent rows — measured 668 of 843 sales CGST rows on this site, so trusting it alone reported ₹3.98M of output CGST against an actual ₹24.99M (a 72% understatement). The robust classifier is `COALESCE`-style: prefer `NULLIF(gst_tax_type,'')`, else infer from `account_head` (test the RCM patterns FIRST, because 'Input Tax CGST RCM' matches both the RCM and plain CGST patterns). Rows matching neither (freight, carriage, rounding) must classify NULL and be excluded. Validated to the rupee against account_head ground truth.
- **Review cadence**: Re-validate the classifier totals after any india_compliance upgrade or a GST account rename.
- **Evidence**: `Unknown column 'stc.cgst_amount' in 'SELECT'` from `frappe.db.sql`; classifier output reconciled exactly with `SUM(base_tax_amount) GROUP BY account_head` (sales 24,989,965 / 24,989,965 / 38,868,746, purchase 15,071,908 / 11,378,183).

### [API & ORM Patterns] india_compliance return-log schema: `GSTR-3B Entry` does not exist, `GSTR-1` is a Single, and `return_period` is an MMYYYY string
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: `get_filing_compliance` in the Insights tax module returned `{}` for both GSTR-1 and GSTR-3B.
- **Pattern**: Three independent traps in one function. (1) **`tabGSTR-3B Entry` does not exist** in india_compliance at all — the real per-period log for every return type is **`GST Return Log`**, discriminated by `return_type` ('GSTR1', 'GSTR3B'), and its status column is **`filing_status`**, not `status`. (2) **`GSTR-1` is a Single DocType** (`issingle=1`), so `tabGSTR-1` legitimately does not exist; a leftover `tabGSTR-1 Log` table from an older rename may still sit in the DB with 0 rows and silently satisfy queries. (3) **`return_period` is an `MMYYYY` string** ('042025'), so `return_period BETWEEN '2026-04-01' AND '2027-03-31'` can never match — normalise with `CONCAT(SUBSTRING(return_period,3,4),'-',SUBSTRING(return_period,1,2))` and compare to `DATE_FORMAT(date,'%Y-%m')`. Also: `GST Inward Supply` has no `posting_date` (use `bill_date`), and its `match_status` values are 'Exact Match' / 'Suggested Match' / 'Mismatch' / blank — never 'Matched' or 'Unmatched'.
- **Review cadence**: Verify DocType names and `issingle` flags against `tabDocType` before querying india_compliance tables; a registered DocType with no table is usually a Single, not a failed migration.
- **Evidence**: `SELECT name, istable, is_virtual, issingle FROM tabDocType WHERE name='GSTR-1'` returned `issingle=1`; `tabGSTR-3B Entry` absent from information_schema; `GST Return Log` rows carried `return_period` '042025'/'032025' with `filing_status` NULL.

### [Debugging Patterns] GROUP BY an alias that shares a name with a real column binds the COLUMN — Sales Invoice has its own `status`
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: An e-Waybill status breakdown returned duplicate 'Pending' groups and a total of 4 where the real answer was 65.
- **Pattern**: `SELECT IFNULL(si.e_waybill_status,'x') AS status ... GROUP BY status` does NOT group by the alias. MariaDB resolves `status` to the real `tabSales Invoice.status` column (Paid / Overdue / Unpaid / Draft), so one e-Waybill state was split into three rows keyed by PAYMENT status while labelled with an arbitrary row's waybill status. Building a dict from those rows then collapsed duplicate keys, keeping only the last and reporting 4 instead of 65. Always `GROUP BY` the full expression, or pick an alias that cannot collide (`ewb_status`). Watch for this with any alias named `status`, `name`, `title`, `owner`, `company`, or `docstatus` on a Frappe table.
- **Review cadence**: Grep for `AS status` followed by `GROUP BY status` in any Frappe SQL.
- **Evidence**: `GROUP BY si.status, si.e_waybill_status` produced `Paid|Pending 42`, `Overdue|Pending 19`, `Unpaid|Pending 4`, proving the grouping key was payment status.

### [Debugging Patterns] A literal `%` anywhere in a frappe.db.sql string — including an SQL comment — raises "unsupported format character"
- **Discovered**: 2026-07-31
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Adding the explanatory SQL comment `-- ... drove utilisation to -100%.` to a working query broke it instantly.
- **Pattern**: `frappe.db.sql` runs the string through Python %-formatting to bind `%(name)s` params, so EVERY literal percent must be `%%` — including inside `--` comments, which are not exempt because the escaping happens before the SQL ever reaches the database. Symptom is `ValueError: unsupported format character '.'` (or whatever follows the `%`), which looks unrelated to the comment you just typed. Either write `%%` or avoid the character in prose.
- **Review cadence**: When a previously working `frappe.db.sql` call starts raising ValueError after a comment or docstring edit, look for a bare `%`.
- **Evidence**: `ValueError: unsupported format character` from `insights.ml.india_tax_intelligence.data.get_itc_health` immediately after adding a comment containing `-100%.`; resolved by rewording.

#### `pd.DataFrame(rows)` on `frappe.db.sql(..., as_dict=True)` breaks under numpy >= 2.4
  - **Context**: `get_purchase_patterns` returned `{"status": "error", "message": "invalid __array_struct__"}` and the Patterns tab rendered an unpopulated template. Same latent fault at a second call site.
  - **Pattern**: `as_dict=True` yields `frappe._dict`, whose `__getattr__` answers ANY attribute name. numpy probes candidate array interfaces by attribute, so `__array_struct__` resolves to a truthy value instead of raising `AttributeError`; numpy then tries to consume it as a real array struct and fails. Under numpy <= 2.3 the probe was never reached. Convert first: `pd.DataFrame([dict(r) for r in rows])`. `BaseMLModel.get_training_data` already does this with a comment naming the reason, so inheriting models are safe and only direct `frappe.db.sql` -> `pd.DataFrame` paths break.
  - **Review cadence**: grep `pd.DataFrame(` for any argument fed directly by a `frappe.db.sql(..., as_dict=True)` result.
  - **Evidence**: numpy 2.4.4 / pandas 2.2.3; `pd.DataFrame(list_of_frappe_dicts)` raises while `pd.DataFrame(list_of_plain_dicts)` and `from_records` both succeed.

#### An error payload is truthy, so `v-else-if="data"` disguises a failed endpoint as empty data
  - **Context**: A broken endpoint went unnoticed because the tab rendered its full template with every value `undefined`: "Top % of customers by CLV ( customers, transactions)" and `Total Orders 0`. It read as "no data yet", not "the call failed".
  - **Pattern**: Frappe API wrappers return `{"status": "error", "message": ...}` with HTTP 200, so a presence check passes. Branch on `status === 'error'` before the success branch and surface `message`. A zero-value render is indistinguishable from genuinely empty data, which is what lets the bug survive review.
  - **Review cadence**: For every `v-if`/`v-else-if` guarding on an API ref, confirm an explicit error branch exists ahead of it.
  - **Evidence**: `purchase_patterns` returned `status: error` while the Patterns tab showed a populated-looking layout with blank interpolations and no console error.


### [API & ORM Patterns] An unset Datetime/Date on a Single reads back as `datetime(1, 1, 1)`, not `None` — every `if not value` blank-check is wrong
- **Discovered**: 2026-08-07
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Adding an optional "start from" Datetime to `My App Settings` to scope the morning-brief queues. `if not start: return` was supposed to mean "no cutoff configured", and it silently did not.
- **Pattern**: `frappe.db.get_single_value` runs the raw `tabSingles` value through `frappe.utils.cast` (imported as `cast_fieldtype` in `database.py`), and `cast` is documented to return "the first/lowest value of the fieldtype" for a falsy input — `datetime.datetime(1, 1, 1)` for Datetime, `date(1, 1, 1)` for Date, `0.0`/`0`/`""` for the others. So a never-configured Datetime comes back **truthy** and outside MariaDB's DATETIME range. It leaks into WHERE clauses, comparisons, and `>` guards as a real value. Normalise at the read boundary — `get_datetime(str(raw)) if raw else None` works because `is_invalid_date_string` rejects anything starting `0001-01-01`/`0000-00-00`. Note this differs from a `tabSingles` row explicitly set to NULL, which `cast` also maps to the same sentinel — there is no "unset" signal to recover, only the sentinel.
- **Review cadence**: Any `frappe.db.get_single_value(...)` on a Date/Datetime/Time field guarded by a bare truthiness test.
- **Evidence**: frappe 16 `frappe/utils/data.py::cast` — `elif fieldtype == "Datetime": ... else: value = datetime.datetime(1, 1, 1)`; `frappe/database/database.py:36` aliases it, `:854` applies it. Live check on <site> with the `tabSingles` row deleted: `get_single_value('My App Settings','morning_brief_start')` -> `datetime.datetime(1, 1, 1, 0, 0)`.


### [API & ORM Patterns] Conditional aggregation on `tax_amount > 0` silently drops zero-rated/exempt bands from a KRA eTIMS `totTaxblAmt` header total
- **Discovered**: 2026-08-11
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Auditing why Sales Invoice ACC-SINV-2026-00020 (`my_app` app, `<bench>` bench) failed `saveTrnsSalesOsdc` with KRA error 910: `totTaxblAmt (0) must match the sum of itemList taxblAmt (50300.0)`.
- **Pattern**: `custom_methods/sales_invoice.py::fetch_total_vat()` sums a tax row's `custom_total_taxable_amount` only `if item.get("base_tax_amount_after_discount_amount") > 0`. `insert_invoice_number` then assigns `doc.custom_total_taxable_amount = fetch_total_vat(doc)`, and `build_sales_payload` sends that straight through as the KRA header field `totTaxblAmt`. A wholly VAT-Exempt (band A) or Zero-rated (band C) invoice has `tax_amount == 0` on every row by definition, so `fetch_total_vat` returns 0 while `apply_tax_bands()` (etims_utils.py) and `etims_sale_item_list_sales()` correctly aggregate the SAME rows into `taxblAmtA`/`itemList[].taxblAmt` (they gate on `custom_code in KRA_TAX_BANDS`, not on tax amount being nonzero) — guaranteeing `totTaxblAmt` != sum(itemList.taxblAmt) and a deterministic, non-transient KRA rejection that retries can never fix. The existing `_normalize_payload_non_vat` safety net does NOT cover this: it only fires when `eTIMS Settings.vat_obligation == "Not Registered"` (company-wide), not for an ordinary VAT-registered company selling an individually exempt/zero-rated line. General lesson: when a KRA/tax-authority payload requires a header total to equal the sum of per-band or per-line amounts, NEVER derive that header total via a conditional that excludes zero-value-but-legitimate rows (0% rate is a valid band, not "no tax data") — derive it the same way the per-band/per-line breakdown is derived (same predicate, or literally sum the per-band output), or use the document's own net/taxable total (`base_net_total`) as the header value.
- **Evidence**: DB: tax row `custom_code='A'`, `rate=0`, `tax_amount=0`, `custom_total_taxable_amount=50300`; `Sales Invoice.custom_total_taxable_amount=0`, `custom_total_nontaxable_amount=50300`; items sum `base_net_amount` 35600+14700=50300. `eTIMS Invoice Queue` entry (name `28`) and `Error Log` (3 entries, 16:04/16:08/16:12) all show the identical KRA 910 message. `eTIMS Settings.vat_obligation` singleton value is `"Registered"` (default in `etims_settings.py:62`), confirming the non-VAT normalizer path was correctly not applicable.

### [Debugging Patterns] A `frappe.db.set_value()` direct write inside a `before_submit` hook is silently clobbered by the core submit's own `db_update()` unless the in-memory doc is re-synced
- **Discovered**: 2026-08-11
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Same eTIMS audit — `Sales Invoice.custom_etims_queue_entry` was NULL on every one of 15 sampled submitted invoices (Sent and Failed alike), even though `queue_processor.enqueue_invoice()` (called from the `before_submit` hook `trnsSalesSaveWrReq`) does `frappe.db.set_value("Sales Invoice", doc.name, {"custom_etims_queue_status": "Queued", "custom_etims_queue_entry": queue_entry.name}, ...)`.
- **Pattern**: Frappe's `Document.submit()` runs `before_submit` hooks and THEN persists the whole in-memory document (docstatus=1 write includes every field from the in-memory object, i.e. a full `db_update()`), in the same transaction. A hook that writes columns via a direct `frappe.db.set_value()` SQL call but never mirrors those values onto the in-memory `doc` object gets overwritten back to the doc's stale in-memory value (here, unset/None) the moment that final submit-time save runs — even though the direct SQL write executed without error and would look correct if inspected mid-transaction. Symptom is a field that is written by a hook yet is reliably empty/stale right after submit, while a SIBLING field updated the same way but later rewritten by an independent, post-commit codepath (here `_update_source_status`, invoked from an `enqueue_after_commit=True` background job) looks correct — the discrepancy between the two is itself the tell. Fix: after any `frappe.db.set_value(dt, name, {...})` performed inside a hook that fires before the document's own save completes (`before_insert`/`before_validate`/`before_save`/`before_submit`), also set the matching attributes on `doc` in memory (`doc.field = value` for every key just written) — see `insert_invoice_number` in the same file, which does this correctly and even comments why ("Sync in-memory doc fields to match what was written to DB").
- **Evidence**: `queue_processor.py:50-58` (`enqueue_invoice`, no in-memory sync) vs. `sales_invoice.py:178-191` (`insert_invoice_number`, syncs `doc.<field>` after every `frappe.db.set_value`). DB: `SELECT ... custom_etims_queue_entry FROM tabSales Invoice JOIN tabeTIMS Invoice Queue ON reference_name=name` returned NULL for all 15 rows checked (mixed Sent/Failed), while `custom_etims_queue_status` was correct for all of them. Downstream break: `sales_invoice.js:45` gates the "Retry eTIMS" button on `frm.doc.custom_etims_queue_entry` being truthy, so the button never renders for ANY failed invoice.


### [API & ORM Patterns] `no_copy: 0` on a "last transmitted transaction" identity field lets Duplicate/Amend/Return silently reuse an already-consumed external ID
- **Discovered**: 2026-08-11
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: Cross-referencing the <bench> `my_app` eTIMS audit against a second client's (unrelated bench, KRA error export only, no source access) live "eTIMS Invoice Queue" report. That report independently listed `KRA 924 - Duplicate Invoice Number` as already root-caused and fixed by adding `no_copy` flags "so credit notes get fresh invoice numbers". Checked whether <bench> was exposed to the same class: `SELECT custom_invoice_number, COUNT(*) FROM tabSales Invoice ... GROUP BY custom_invoice_number HAVING COUNT(*)>1` found ACC-SINV-2026-00015/16/17/18 (same customer, same single item code, different amounts — classic Duplicate-and-edit-amount workflow) all sharing `custom_invoice_number=16`.
- **Pattern**: `custom_invoice_number` (the field holding the number actually transmitted to the external system) had `no_copy: 0` in the custom-field fixture. Frappe's Duplicate/Amend/`get_mapped_doc` (returns/credit-notes) copy every `no_copy: 0` field's value onto the new document by default. The submit-hook allocator here had a (deliberately added, commented as an anti-drift fix) short-circuit — `doc.custom_invoice_number or get_last_inv_number(...)` — that treats ANY truthy in-memory value as "already correctly assigned, do not re-derive". That optimization is exactly right for its target case (a doc's own re-save after successful transmission) and exactly wrong for a document that inherited the field via copy: the new doc's value is truthy but was never actually allocated to *it*, so the allocator is skipped and the copied ID gets re-submitted to the external system, which correctly rejects it as a duplicate. General lesson: any field that records the result/ID of an external, non-idempotent side effect (payment reference, tax-authority invoice number, webhook idempotency key, signed-document hash) needs `no_copy: 1`, AND any "skip re-derivation if already set" optimization guarding that field's allocator must be paired with `no_copy: 1` — the copy-forward hazard and the memoization optimization are two halves of the same bug when combined. Applies to every field in this pattern, not just the number: a full audit of the same app's Sales Invoice custom fields found 11 KRA-identity fields (`custom_invoice_number`, `custom_original_invoice_number`, `custom_current_receipt_number`, `custom_total_receipt_number`, `custom_receipt_signature`, `custom_receipt_type_code`, `custom_sales_control_unit`, `custom_receipt_qr_code`, `custom_receipt_qr_url`, `custom_tax_branch_office`, `custom_update_sales_to_etims`) all still `no_copy: 0` — only the *queue-tracking* fields (`custom_etims_queue_status`/`_entry`/`_retry_count`/`_last_error`), created separately via an `after_migrate` hook rather than the fixture, were correctly `no_copy: 1` from the start.
- **Review cadence**: Any custom field storing an ID/receipt/signature returned by a non-idempotent external call — grep the doctype's custom-field fixture for `no_copy.{0,20}0` near fieldnames containing `number`, `receipt`, `signature`, `reference`, `_id`.
- **Evidence**: `tabSales Invoice` query showed 4 real rows sharing `custom_invoice_number=16` (ACC-SINV-2026-00015 creation 2026-06-23, successfully Sent; 00016/17/18 created 2026-07-21 minutes apart, all Failed with KRA 924). `sales_invoice.py:121` allocator short-circuit. `TIS Device Initialization.last_sales_invoice_number` confirmed permanently 0/dead (read at :447, never written anywhere in the app) — ruled out as the mechanism, isolating the cause to the no_copy gap. Field fixture scan via `python3 -c "json.load(...)['custom_fields']"` listing `no_copy` per field confirmed the 11-field gap.

### [API & ORM Patterns] Deduping a KRA `itemList` by item code must also recompute `totItemCnt` — the two are read from different sources and silently diverge
- **Discovered**: 2026-08-11
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Same <bench> `my_app` eTIMS audit/recovery. Fixed `etims_sale_item_list_sales()` to merge Sales Invoice Item rows sharing an `item_code` into one KRA `itemList` line (previously emitted as two separate lines, which KRA also rejects). Live retry of ACC-SINV-2026-00020 (2 rows, same item code) then failed with a NEW error: `saveTrnsSalesOsdc error (910) ... [KRA: Request parameter error[<itemList> : Item Count error]]`.
- **Pattern**: `build_sales_payload()`'s `totItemCnt` field was sourced from `doc.custom_item_count` (stamped once at original submit time by `insert_invoice_number` as `len(doc.items)`, the RAW ERPNext row count) while `itemList` is built separately via `etims_sale_item_list_sales(doc)`. Any fix that changes how many lines `itemList` emits (merge/dedupe, split-by-tax-code, drop zero-qty rows, etc.) makes `totItemCnt` stale unless it is re-derived from the SAME output. KRA validates `totItemCnt == len(itemList)` independently of `totTaxblAmt == sum(itemList[].taxblAmt)` — fixing one does not fix the other; each header aggregate must be traced to its own KRA-side invariant. Fix: build `item_list` once, pass `len(item_list)` as `totItemCnt`, and reuse the same `item_list` object for the `itemList` field (avoids a second call + guarantees identical counts by construction, not by coincidence). Generalizes: whenever a payload has both a per-line array AND a header field that is some aggregate/count of that array (count, sum, first, last), grep for OTHER header fields with the same relationship before declaring an array-shape fix complete.
- **Review cadence**: Any change to a KRA (or similar aggregator-API) line-item builder function — grep the sibling payload-builder for `Cnt`/`Count`/`Sum`/`Amt` header keys and confirm each is derived from the post-transform array, not a pre-transform stored/cached count.
- **Evidence**: `custom_methods/sales_invoice.py:812` (`count = doc.custom_item_count or len(doc.items) or 0`) vs `:844` (separate `etims_sale_item_list_sales(doc)` call) before the fix. Error Log entries `ftkje7v7vd`/`ftk0kqgpjm` (2026-08-11 20:32:42) show the Item Count error on the SAME invoice that had already been fixed for the taxblAmt/dedup issues, on the SAME retry attempt — proving the two bugs were independent and the second was only surfaced once the first two were cleared. Fixed by building `item_list` before the payload dict and setting `"totItemCnt": len(item_list)`; live retry then succeeded (KRA receipt 19 issued). Regression test added: `test_build_sales_payload_tot_item_cnt_matches_item_list_length` (mocks a 2-row-invoice/1-line-itemList divergence and asserts `totItemCnt == len(itemList) != doc.custom_item_count`).

### [Debugging Patterns] `bench console` streams heredoc input line-by-line — a multi-statement `for` loop with side effects (`.save()`, `.commit()`) silently executes only its LAST iteration; `%run -i` also fails with `KeyError: '__name__'`
- **Discovered**: 2026-08-11
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Recovering 4 eTIMS Invoice Queue payloads (<bench> bench) by piping a Python `for name, qname in targets.items(): doc = frappe.get_doc(...); qe.save(); frappe.db.commit()` loop into `bench --site mbaguya console` via `cat <<'PYEOF' | bench console`. The script printed success-looking output for all 4 iterations (no traceback), but a follow-up SQL readback showed only the LAST target's queue row actually got the rebuilt payload — the other 3 silently kept their original broken payload.
- **Pattern**: `bench console` is IPython fed over stdin. IPython's `TerminalInteractiveShell` executes heredoc'd stdin as a stream of individual `In [n]:` cells split on blank-line/indentation boundaries, not as one atomically-compiled script — a `for` block piped this way can have its body cells re-parsed/re-run independently per visual line, so side effects inside the loop (a `.save()` call issued once per line rather than once per true iteration) land only for whichever iteration happened to be the one still bound to the loop variables when the stream ended. This is silent: no error, plausible partial output, exactly the shape of a "worked" run. Two tempting fixes both fail: `%run script.py` executes the file as one unit but in a FRESH namespace, so `frappe` (and every console-preloaded global) is undefined (`NameError: name 'frappe' is not defined`); `%run -i script.py` is supposed to reuse the console's namespace but `bench console`'s custom shell never sets `user_ns['__name__']`, so IPython's own `%run -i` implementation crashes with `KeyError: '__name__'` before your script even starts. The reliable pattern: write the loop to a real `.py` file, then from the console pipe run `exec(compile(open(path).read(), path, 'exec'), globals())` — `exec`+`compile` treats the file as ONE parsed/compiled code object (immune to line-by-line streaming, same as `%run`) while executing it against the console's OWN live `globals()` dict (has `frappe` already bound, no `__name__` key required, unlike `%run -i`). Always add an in-script DB readback + `assert` after each `.save()`/`.commit()` inside the file so a partial-execution failure mode raises loudly instead of printing a false "done".
- **Review cadence**: Any `bench console` invocation piping more than one statement with side effects (loops, multi-step transactions) via heredoc — prefer `exec(compile(open(path).read(), path, 'exec'), globals())` over both a raw heredoc loop and `%run`/`%run -i`.
- **Evidence**: First heredoc attempt: SQL readback after all 4 "successful" prints showed queue 25/26/27 still at `invcNo:16, totTaxblAmt:0` (the ORIGINAL broken payload) while only queue 28 (the last dict-iteration target) held the rebuilt `invcNo:17, totTaxblAmt:50300`. `%run /tmp/etims_fix.py` -> `NameError: name 'frappe' is not defined` at the first `frappe.get_doc(...)` call. `%run -i /tmp/etims_fix.py` -> `KeyError: '__name__'` inside IPython's own `execution.py:767` before any user code ran. `exec(compile(open('/tmp/etims_fix.py').read(), '/tmp/etims_fix.py', 'exec'), globals())` then ran the identical file successfully with all 4 in-script readback assertions passing, independently reconfirmed via a fresh `mysql` connection immediately after.

## Permissions Patterns

### [Permissions] Adding any Custom DocPerm row for a doctype silently drops ALL of that doctype's core DocPerm rows, for every other role
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Building primetyre app's Stock Reconciliation approval workflow. Added a Custom DocPerm fixture row granting "Stock User" read/write/create (but submit=0/cancel=0/amend=0, forcing them through the workflow) on Stock Reconciliation, and a separate row granting "Purchase User" full rights on Landed Cost Voucher. A workflow smoke test then had the Director (Stock Manager role) hit `PermissionError` inside `apply_workflow` -> `get_transitions` -> `doc.check_permission("read")` — even though core `stock_reconciliation.json` grants "Stock Manager" full permissions (read/write/submit/cancel/amend/etc.) and nothing about that role was touched.
- **Pattern**: `frappe/permissions.py` `get_valid_perms()` (:505-520) computes `doctypes_with_custom_perms` as the set of ALL doctypes that have ANY Custom DocPerm row system-wide (across every role), then for each core `DocPerm` row `p`, keeps it only `if p.parent not in doctypes_with_custom_perms`. So a doctype with even one Custom DocPerm row loses its ENTIRE core permission list for EVERY role — not just the role the Custom DocPerm row targets. `get_all_perms()` (:523-532) has the identical pattern. Administrator is unaffected only because `get_roles()` special-cases it to return every Role in the system, so it always holds whatever role core granted anyway — this masks the bug for Administrator-driven testing/consoles and only surfaces for real named users.
- **Fix**: Before adding a Custom DocPerm fixture row to restrict/extend one role on a core doctype, read that doctype's own JSON `permissions` array in full and add a matching Custom DocPerm row replicating EVERY other role listed there — otherwise those roles lose all access to the doctype. Verify with `select name, parent, role from tabCustom DocPerm` cross-referenced against `json.load(open(doctype.json))['permissions']`: any core role on that doctype with no equivalent Custom DocPerm row is now locked out. Re-run this check any time a Custom DocPerm fixture is added or edited for a core (non-custom) doctype.
- **Review cadence**: Any fixture PR touching `custom_docperm.json` for a core (erpnext/frappe/hrms) doctype — diff the doctype's core `permissions` array against the fixture's role coverage before merging.
- **Evidence**: `apps/frappe/frappe/permissions.py:505-520` (`get_valid_perms`). Repro: `apps/erpnext/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.json` `permissions` = `[{"role": "Stock Manager", "read": 1, "write": 1, "submit": 1, ...}]` only. After adding `Stock Reconciliation-Stock User-0-primetyre` Custom DocPerm, `bench console` as `director@primetyre.co.ke` (roles include "Stock Manager") hit `PermissionError` at `frappe/model/workflow.py:58` (`doc.check_permission("read")`) with full traceback through `frappe/permissions.py:916` `check_doctype_permission`. Fixed by adding `Stock Reconciliation-Stock Manager-0-primetyre` and `Landed Cost Voucher-Stock Manager-0-primetyre` Custom DocPerm rows mirroring core's grant; `bench migrate` synced them (verified via `select name, parent, role, read, submit, cancel from tabCustom DocPerm` showing all 4 rows), then the full workflow smoke test (Stock User Draft -> blocked direct submit -> Submit for Approval -> blocked self-Approve -> Director Approve succeeds, docstatus 0->1, Bin qty posts) passed end-to-end.

## Caching & Asset Patterns

### [Debugging Patterns] An app's switcher icon is frozen into a `Desktop Icon` doc at first install and never re-synced from hooks.py; updating it doesn't bust its own Redis cache either
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Building primetyre app branding. Changed `hooks.py`'s `add_to_apps_screen[0]["logo"]` from a placeholder `logo.svg` (removed from disk) to the real processed logo at `/assets/primetyre/images/app-icon.png`, ran `bench migrate` + `bench --site <site> clear-cache`, then re-verified in a real browser (not just server-side). The app switcher tile still rendered a black "PT" letter-avatar fallback with `<img src="/assets/primetyre/logo.svg">` (404) in the DOM — hooks.py, the asset on disk, and `frappe.apps.get_apps()` (the whitelisted method backing the *other* `/apps` screen) were all already correct at this point, which is what made it look fixed when it wasn't.
- **Pattern**: The desktop/home-page app tile (`frappe/public/js/frappe/ui/desktop_icon.html`, `<a class="desktop-icon">`) does NOT read `hooks.py` `add_to_apps_screen` live — it reads `icon.logo_url` off a **`Desktop Icon` doc** (`icon_type="App"`, `label=app_title`) that `create_desktop_icons_from_installed_apps()` (`frappe/desk/doctype/desktop_icon/desktop_icon.py:275-298`) creates ONCE, the first time the app is installed, copying whatever `add_to_apps_screen[0]["logo"]` was AT THAT MOMENT. `get_app_desktop_icon()` short-circuits creation if a row already exists (:279-280), so later hooks.py edits never reach it. Worse, `get_desktop_icons()` (:122-213) serves from `frappe.cache.hget("desktop_icons", user)` (a per-user Redis hash), and `DesktopIcon.after_insert()` is the ONLY code path that calls `clear_desktop_icons_cache()` (:216-218, which also deletes the cached `bootinfo` hash) — a plain `.save()` on an *existing* Desktop Icon doc does not trigger it. A generic `bench clear-cache` did not fix this in testing either (it did not visibly touch this specific per-user hash).
- **Fix**: After changing an installed app's `logo`, fix the drift directly: `icon_name = frappe.db.exists("Desktop Icon", {"label": app_title, "icon_type": "App"})`; if its `logo_url` differs from the current `frappe.get_hooks("add_to_apps_screen", app_name=app)[0]["logo"]`, `frappe.db.set_value(...)` it, then explicitly call `frappe.desk.doctype.desktop_icon.desktop_icon.clear_desktop_icons_cache(user)` for every enabled user (not just Administrator — Administrator's browser session may hold a differently-keyed cache entry than a named user's). Made idempotent inside `configure_branding()` in `primetyre/setup/provision.py` so every `provision.run()` self-heals this drift.
- **Review cadence**: Any time an installed app's `add_to_apps_screen` logo path changes post-install — verify the actual rendered `/desk` home tile in a real browser (screenshot or DOM query for `a.desktop-icon[data-id="<App Title>"] img.app-icon`'s `src`), not just `frappe.apps.get_apps()` output or the asset's HTTP 200 — both of those looked correct while the visible tile was still broken.
- **Evidence**: `apps/frappe/frappe/desk/doctype/desktop_icon/desktop_icon.py:279-298` (`create_desktop_icons_from_installed_apps`, `get_app_desktop_icon`), `:122-127` (`get_desktop_icons` reading `frappe.cache.hget("desktop_icons", user)`), `:216-218` (`clear_desktop_icons_cache`), `:89-90` (`after_insert` as the only caller). Repro: `select logo_url from tabDesktop Icon where label='Prime Tyre'` showed the stale `/assets/primetyre/logo.svg` (confirmed 404 via `curl`) even after `bench migrate` + `bench clear-cache` + a full browser page reload; `frappe.apps.get_apps()` and `curl .../app-icon.png` (200 OK, correct image) were both already correct at the same moment. Fixed live via `frappe.db.set_value` + `clear_desktop_icons_cache(user)` for all 5 enabled users, re-screenshotted `/desk` in the browser — tile switched from a black "PT" fallback square to the real EldoPrime Tyres logo with no further cache clear needed.

### [Build & Deployment] A hardcoded `modified` timestamp in workspace/DocType JSON makes `bench migrate` silently skip re-importing your edits on any existing site
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Cutting primetyre's custom `bank-reconciliation` Desk page over to core ERPNext's `Bank Reconciliation Tool`. Edited the workspace fixture `primetyre/prime_tyre/workspace/prime_tyre/prime_tyre.json` to change one shortcut from `{"type": "Page", "link_to": "bank-reconciliation"}` to `{"type": "DocType", "link_to": "Bank Reconciliation Tool"}`, then ran a **full, clean** `bench migrate` (363s, reached `Executing after_migrate hooks` + `=== MIGRATE EXIT OK ===`) followed by `bench clear-cache`. The Custom DocPerm fixture rows from the same commit landed fine, but the workspace shortcut in the DB was still `Page -> bank-reconciliation`. Nothing errored — migrate reported success.
- **Pattern**: `frappe.modules.import_file.import_file_by_path()` compares the `modified` value **inside the JSON file** against the `modified` column of the existing DB row and returns early when the file is not strictly newer (`:124-128`, `if not force and db_modified_timestamp:` → skip when file timestamp <= DB timestamp). Workspace JSON exported by Frappe ships a frozen `"modified": "<export time>"`, and re-importing writes that same value back into the DB row (`update_modified()`, `:187-198`). So file and DB converge to the identical timestamp and **every subsequent edit to that file is a permanent no-op on already-migrated sites**. Fresh installs are unaffected (no DB row to compare against), which is exactly why this survives CI and only bites existing sites — including the production site you are upgrading.
- **Fix**: Bump the `modified` field in the JSON whenever you hand-edit a workspace/DocType/fixture file that already exists on a live site — treat it as part of the edit, not metadata. Then `bench migrate` picks it up normally. **Do NOT reach for `import_file_by_path(..., force=True)` on a Workspace to force the sync** — it destroys the source file (see the companion entry below). If a site is already diverged and you need it fixed without a full migrate, edit the DB row directly (`frappe.db.set_value` / child-table update) and then export back to disk with `export_to_files(record_list=[["Workspace", "<name>"]], record_module="<Module>", create_init=True)`.
- **Review cadence**: Any PR that hand-edits a `workspace/*.json`, `doctype/*.json`, or module fixture already deployed somewhere — confirm the `modified` field moved. After migrating, verify the change in the DB (`select type, link_to from tabWorkspace Shortcut where parent='<Workspace>'`), never from migrate's exit status.
- **Evidence**: `apps/frappe/frappe/modules/import_file.py:87-92` (documented skip conditions), `:122-128` (`db_modified_timestamp` comparison and early return), `:160-167` + `:187-198` (`update_modified` writing the file's timestamp into the DB row). Repro: DB `tabWorkspace.modified` and the file's `"modified"` were both exactly `2026-08-31 00:00:00.000000`; a complete `bench migrate` + `clear-cache` left the shortcut as `Page -> bank-reconciliation`. Bumping the file to `21:20:00` and calling `import_file_by_path(frappe.get_app_path(...), force=True)` returned `True` and the shortcut flipped to `DocType -> Bank Reconciliation Tool`, then verified in a real browser as `director@primetyre.co.ke` (tile click → `/desk/bank-reconciliation-tool/Bank%20Reconciliation%20Tool`, title `Bank Reconciliation Tool`, zero msgprint errors).

### [Build & Deployment] `import_file_by_path(force=True)` on a public Workspace DELETES its own source folder from the app — outside `bench migrate` only
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Immediately after the `modified`-timestamp gotcha above. To force the skipped workspace re-import I ran, in `bench console`: `import_file_by_path(frappe.get_app_path("primetyre","prime_tyre","workspace","prime_tyre","prime_tyre.json"), force=True)`. It returned `True` and the DB shortcut correctly flipped to `DocType -> Bank Reconciliation Tool` — the intended outcome, with no error or warning. Minutes later `git status` in the app repo reported `D primetyre/prime_tyre/workspace/prime_tyre/prime_tyre.json` and `D .../__init__.py`: the entire workspace source directory had been deleted from disk. Nothing in the console output hinted at it.
- **Pattern**: `import_doc` → `delete_old_doc()` (`frappe/modules/import_file.py:273`) deletes the existing doc first: `frappe.delete_doc(doctype, name, force=1, ignore_doctypes=ignore, for_reload=True)`. In `frappe/model/delete_doc.py`, `for_reload` suppresses permission checks (`:160`) and link checks, and its docstring claims it skips `on_trash` — but `on_trash` is actually gated only by `ignore_on_trash` (`:164-165`), which `import_file.py` never passes, and **`doc.run_method("after_delete")` at `:185` has no `for_reload` guard at all**. `Workspace.after_delete()` (`frappe/desk/doctype/workspace/workspace.py:164-169`) is `if self.module and frappe.conf.developer_mode: delete_folder(self.module, "Workspace", self.title)` — a real filesystem delete of `<app>/<module>/workspace/<scrubbed title>/`. The guard that normally saves you is `disable_saving_as_public()` (`:268-276`), which returns True during `in_migrate`/`in_install`/`in_fixtures`/`in_patch`/`in_test` — so `bench migrate` is safe, and **only hand-invoked imports from `bench console` (no flags set) are destructive**. The subsequent re-insert's `on_update` → `export_to_files` did *not* recreate the folder in practice, so the loss is silent and permanent until you notice it in `git status`.
- **Fix**: Never call `import_file_by_path(..., force=True)` on a Workspace from `bench console`. To re-sync one: bump `modified` in the JSON and run `bench migrate` (safe — `in_migrate` disables the folder delete). To recover an already-deleted source folder, do **not** hand-restore from git — the DB is authoritative at that point, so re-export it: `bench --site <site> console` → `from frappe.modules.export_file import export_to_files; export_to_files(record_list=[["Workspace","<name>"]], record_module="<Module>", create_init=True)`. That rewrites the canonical JSON (preserving `modified`, `public`, and `url`-type shortcuts whose `link_to` is legitimately `None`) and recreates `__init__.py`.
- **Review cadence**: After ANY hand-invoked `import_file_by_path`/`import_doc` in `bench console` against a module-owned doc in developer_mode, run `git status` in the app repo before doing anything else. Treat unexpected ` D ` entries as this bug, not as your own earlier `rm`.
- **Evidence**: `apps/frappe/frappe/modules/import_file.py:273` (`delete_old_doc` → `frappe.delete_doc(..., for_reload=True)`); `apps/frappe/frappe/model/delete_doc.py:164-165` (`on_trash` gated by `ignore_on_trash`, not `for_reload`), `:185` (`run_method("after_delete")`, unguarded), `:50-52` (docstring that misleadingly claims `for_reload` skips `on_trash`); `apps/frappe/frappe/desk/doctype/workspace/workspace.py:164-169` (`after_delete` → `delete_folder`), `:119-125` (`on_update` → `export_to_files`), `:268-276` (`disable_saving_as_public`). Repro: force-import returned `True` and fixed the DB; `ls primetyre/prime_tyre/workspace/prime_tyre/` then returned `No such file or directory` and `git status` showed both files as deleted. Recovered with `export_to_files(..., create_init=True)`, which logged `Wrote document file for Workspace Prime Tyre at .../prime_tyre.json`; verified the restored file kept `modified: 2026-08-31 21:20:00`, `public: 1`, all 12 shortcuts, and the `URL` shortcut's `url: /coale-pos`.

### [Frontend] `Workflow.override_status` is inverse-named — setting it to 1 hides the workflow state and shows `Draft` instead
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Built a `Credit Limit Approval` workflow (Draft → Pending Approval → Approved/Rejected) with correct `Workflow State` styles (`Warning`/`Success`/`Danger`). In the browser the form indicator read **`Draft` in red** while `cur_frm.doc.workflow_state` was genuinely `"Pending Approval"` and the Actions menu correctly offered Approve/Reject. `frappe.get_indicator(cur_frm.doc)` returned `["Draft","red","docstatus,=,0"]`.
- **Pattern**: The field is stored as `override_status` but its **label is "Don't Override Status"** ("If Checked workflow status will not override status in list view", default `0`). The name reads like an enable-flag; it is a suppress-flag. `frappe/public/js/frappe/model/indicator.js:35` does `var without_workflow = workflow ? workflow["override_status"] : true;` and only reaches the workflow-state branch (`:46-50`) when that is falsy — otherwise it falls through to the submittable-draft branch (`:72-73`) and renders `Draft`/red. So `override_status: 1` silently disables the entire visual half of an approval workflow, on both form and list view, while transitions keep working.
- **Fix**: Leave `override_status` at `0` in every `Workflow` fixture unless you deliberately want docstatus to win. Most custom apps ship `0` on their workflows — that is the convention. Colour comes from `Workflow State.style` (`Success`→green, `Warning`→orange, `Danger`→red, `Primary`→blue, `Info`→light-blue, `Inverse`→black; anything else → gray), so the states need styles set regardless.
- **Review cadence**: Any PR adding a `Workflow` fixture — grep it for `"override_status": 1` and challenge it. Verify in a browser that the form pill shows the workflow state, not `Draft`; a passing server-side transition test will not catch this.
- **Evidence**: `apps/frappe/frappe/public/js/frappe/model/indicator.js:26-73` (`get_indicator`: `:35` reads `override_status`, `:46-50` workflow branch, `:55-67` style→colour map, `:72-73` draft fallback); `apps/frappe/frappe/workflow/doctype/workflow/workflow.json` field `override_status` label `"Don't Override Status"`, default `0`. Repro: with `override_status: 1`, browser reported `indicator: ["Draft","red","docstatus,=,0"]` for a doc in `Pending Approval`; after flipping both fixtures to `0` and re-syncing, the same doc rendered pill `"Pending Approval"` with class `indicator-pill … orange`, and clicking Approve in the Actions menu moved it to `Approved`/`docstatus 1` and wrote the real `Customer Credit Limit` row.

### [Frontend] v16 `Workspace Sidebar` auto-generation is a one-shot seeder that drops URL shortcuts and never re-syncs — ship `<app>/<app>/workspace_sidebar/<name>.json` instead
- **Discovered**: 2026-08-31
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A custom workspace's sidebar rendered only 11 of its 13 items. Missing: a `Point of Sale` entry (a `URL` shortcut to `/coale-pos`) and `Bank Reconciliation`. Everything was correct in `tabWorkspace Shortcut`, and every workspace tile rendered — so it looked like a render bug, not data.
- **Pattern**: `Workspace Sidebar` is a **core frappe v16 DocType**, separate from `Workspace`. `frappe/utils/install.py:194 create_workspace_sidebar_for_workspaces()` seeds one per workspace — but only `if workspace not in existing_sidebars`, so it **never re-syncs** after the first run, and its shortcut loop (`workspace_sidebar.py:148-155`) copies `s.type` into `link_type` while **never copying `s.url`**. Net effect: `URL`-type shortcuts land with `link_type: "URL"` and `url: NULL` and are silently skipped by the renderer, and any target deleted later (my case: a `Page` removed during an earlier cutover) leaves a permanently dead item. Nothing logs. Meanwhile `frappe/model/sync.py:120` lists `app_level_folders = ["desktop_icon", "workspace_sidebar", "sidebar_item_group"]`, so an app-shipped `<app>/<app>/workspace_sidebar/<name>.json` **is** imported on every `bench migrate` — the supported, version-controlled path. Path resolution is `frappe.get_app_path("<app>") + "/workspace_sidebar"` (`frappe/modules/utils.py:429`), i.e. `apps/<app>/<app>/workspace_sidebar/`, *not* under the module folder.
- **Fix**: Author the sidebar as a real file — `apps/<app>/<app>/workspace_sidebar/<scrubbed_title>.json` with `"standard": 1`, `"app": "<app>"`, `"module": "<Module>"`, and an `items` array of `{child, collapsible, icon, indent, keep_closed, label, link_to, link_type, type}`. Use `type: "Section Break"` rows for grouping and `child: 1` on the rows under them. For a URL item set `link_type: "URL"` **and** `url`. Bump `modified` when editing (see the timestamp gotcha above), then `bench migrate`. Audit dead links with a SQL join from `tabWorkspace Sidebar Item` to the target table rather than trusting the render.
- **Icons**: names must exist in `apps/frappe/frappe/public/icons/timeless/icons.svg`. Some custom sidebars use feather-style names (`shopping-cart`, `file-text`, `dollar-sign`, `settings`, `external-link`) that are **not** in that sprite — they render blank. Enumerate the real inventory with `grep -o 'id="icon-[a-zA-Z0-9-]*"' …/timeless/icons.svg` before choosing (`retail`, `accounting`, `sell`, `buying`, `stock`, `crm`, `customer`, `wallet`, `chart`, `permission`, `tool`, `home`, `dashboard` all exist).
- **Review cadence**: Any app shipping a custom workspace — confirm `apps/<app>/<app>/workspace_sidebar/*.json` exists and `select standard, app from tabWorkspace Sidebar where name='<Title>'` shows `1` + your app after migrate. If `standard` is `0`/`app` is NULL you are looking at the stale auto-generated record and your file never landed.
- **Evidence**: `apps/frappe/frappe/utils/install.py:194-199` (`create_workspace_sidebar_for_workspaces`, `if workspace not in existing_sidebars` one-shot guard); `apps/frappe/frappe/desk/doctype/workspace_sidebar/workspace_sidebar.py:143-155` (shortcut loop copying `s.type` → `link_type`, no `url`), `:48-63` (`export_sidebar` → `create_directory_on_app_path("workspace_sidebar", self.app)`); `apps/frappe/frappe/model/sync.py:107,120,204,210` (`app_level_folders` / `app_level_entities` including `Workspace Sidebar`, `"standard": True`); `apps/frappe/frappe/modules/utils.py:429-432` (`get_app_level_directory_path`). Repro: DB sidebar held 13 items, only 11 rendered; the two absentees were exactly the `URL`-with-NULL-`url` row and a `Page` row whose target had been deleted. After shipping the file and migrating: `standard=1, app=primetyre`, 19 items, zero broken links by SQL audit, and all 19 confirmed in a real browser as `director@primetyre.co.ke`.

### [Frontend] frappe-charts indexes `colors` by **dataset**, not by bar — a single-series bar chart paints every category the first colour
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A query-report chart bucketing cheques into Overdue / Within 7 days / Later passed `"colors": ["#e03636", "#e79913", "#2f9bff"]` with `"type": "bar"` and one dataset of three values. Every bar rendered **red** — so the benign "Later" bucket looked like an alarm. Nothing errored; the colours were simply applied to the wrong axis of the data.
- **Pattern**: In `frappe-charts`, bar colour resolves as `color: t.colors[i]` where `i` is the **dataset index** (`AxisChart` barGraph mapping). One dataset ⇒ `colors[0]` for every bar. Pie/donut is the opposite: `this.colors[e]` indexes the **slice/label**, so per-category colour works. If categories need distinct colours, use `"type": "donut"` (or `"pie"`) — supported values are Line, Bar, Percentage, Pie, Donut, Heatmap per `dashboard_chart.json`. Restructuring into N single-value datasets "works" but yields N×N grouped bars mostly full of zeros.
- **Evidence**: `apps/frappe/node_modules/frappe-charts/dist/frappe-charts.cjs.js` — bar: `…["barGraph-"+e.index,{index:i,color:t.colors[i],…}]`; donut/pie: `hoverSlice`/`makeLegend` use `this.colors[e]` over slice index. Chart type list: `apps/frappe/frappe/desk/doctype/dashboard_chart/dashboard_chart.json` `type.options`. Verified in a real browser: bar → three red bars; donut → red/amber/blue slices matching the summary cards.

### [Frontend] `chart.fieldtype` on a query report leaks raw HTML into pie/donut legends
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Adding `"fieldtype": "Currency"` to a report's chart dict to format donut legend values printed the literal string `<div style='text-align: right'>Sh 18,000.00</div>` under each slice.
- **Pattern**: `query_report.js:1187-1200` converts `options.fieldtype` into `tooltipOptions.formatTooltipY = (d) => frappe.format(d, {fieldtype…})`. `frappe.format` for `Currency` returns **HTML**. That is fine for the axis-chart tooltip (an HTML node) but pie/donut `makeLegend` writes the same `formatTooltipY` output into an **SVG `<text>` node**, which has no markup parsing — so the tags render as text. Do not set `fieldtype` on a pie/donut report chart; carry formatted money in the `report_summary` cards instead.
- **Evidence**: `apps/frappe/frappe/public/js/frappe/views/reports/query_report.js:1187-1200` (`if (options.fieldtype) { options.tooltipOptions = { formatTooltipY: … frappe.format(…) } }`); `frappe-charts.cjs.js` `makeLegend` → `this.config.formatTooltipY?this.config.formatTooltipY(t):t` passed to the SVG text builder. Browser-verified both states.

### [Frontend] A submittable DocType's form indicator shows Draft/Submitted until you define `frappe.listview_settings[dt].get_indicator`
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A `Post Dated Cheque` whose `status` field read `On Hand` showed a blue **"Submitted"** pill on the form — identical to one already `Cleared` or `Bounced`. The lifecycle status is the whole point of the register, and the toolbar hid it.
- **Pattern**: `form/toolbar.js:307 set_indicator()` calls `frappe.get_indicator(this.frm.doc)` — the *same* function the list view uses. With no `frappe.listview_settings[doctype].get_indicator`, a submittable doctype falls through to the docstatus ladder (Draft/Submitted/Cancelled). Ship `<doctype>_list.js` next to the doctype defining `get_indicator: (doc) => [__(doc.status), colour, "status,=," + doc.status]` and it fixes **both** surfaces at once. Include every state the field can hold — a `Draft` default is easy to forget. Colours must come from `$indicator-colors` (`green, cyan, blue, orange, yellow, gray, grey, red, darkgrey, purple, light-blue, pink`) in `apps/frappe/frappe/public/scss/common/indicator.scss`; an unknown name yields an unstyled pill.
- **Evidence**: `apps/frappe/frappe/public/js/frappe/form/toolbar.js:307`; `apps/frappe/frappe/public/js/frappe/model/indicator.js:35,46-50,73` (submittable fallback, `settings.get_indicator` branch); pattern example `apps/erpnext/erpnext/stock/doctype/stock_entry/stock_entry_list.js:1-30`. Browser-verified: pill went from `indicator-pill … blue` "Submitted" to `indicator-pill … orange` "On Hand" on both form and list.

### [Frontend] Imported third-party Jinja templates can hide JavaScript that only fails at render time
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Branded `Process Statement Of Accounts` templates merged in from the `customer_statements` app crashed every AR statement with `'list object' has no attribute 'slice'`. The app installed cleanly, migrated cleanly, and the templates were never exercised until a statement was actually rendered.
- **Pattern**: Vendored statement/print templates are frequently authored against the client-side preview and carry JS idioms Jinja cannot execute: `data.slice(-1).pop()` → `data[-1]`; `data[data.length-1]` → `data[-1]`; `report.columns.findIndex(x)` → a `{% set ns = namespace(idx=None) %}` loop over `loop.index0`; `format_number(x, null, 2)` → `frappe.utils.flt(x, 2)`. Also `flt(...)` as a **function** fails — `frappe/utils/jinja.py:212-220` registers `flt`/`int`/`str`/`len`/`json` as **filters** (`{{ x|flt }}`), so call `frappe.utils.flt(...)` instead. And `fmt_money`'s second positional parameter is `precision`, not `currency` (`utils/data.py:1398-1403`) — `fmt_money(x, row["currency"])` silently passes a currency string as precision; always use `currency=`. Grep any imported template for `.slice(|.length|.pop(|.findIndex|format_number(|[^.]flt(|null` before trusting it, and render one document end-to-end.
- **Evidence**: `apps/frappe/frappe/utils/jinja.py:208-220` (`set_filters`); `apps/frappe/frappe/utils/data.py:1398-1403` (`fmt_money(amount, precision, currency, format)`); correct reference implementation `apps/erpnext/erpnext/accounts/doctype/process_statement_of_accounts/process_statement_of_accounts_accounts_receivable.html:56-142`. Verified by rendering a real statement: crash → 13,128 chars of HTML containing the cheque number.
### [ERPNext Domain] `Process Statement Of Accounts` snapshots its recipient list and never refreshes it — new customers are never billed and changed emails keep going to the old address
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Building a recurring monthly customer-statement run for the primetyre app. The doc looks fully automatic — `enable_auto_email` + `frequency` + a scheduler hook — so the assumption was that ERPNext mails "whoever owes money" each period. It does not: it mails exactly the child rows someone last materialised by pressing **Fetch Customers**.
- **Pattern**: The recipient list is a **static child table** (`Process Statement Of Accounts Customer`), populated only by the whitelisted `fetch_customers` (`process_statement_of_accounts.py:423`) — i.e. a UI button — and `send_emails` (`:522`) iterates `doc.customers` verbatim. Three silent failures follow: (1) a customer onboarded after the run was built is never on it, so never billed; (2) `get_recipients_and_cc` (`:391`) reads `row.billing_email` / `row.primary_email` **off the snapshot row**, not off the live Customer, so a corrected email keeps mailing the stale address; (3) a row that resolves to zero recipients is skipped by a bare `continue` (`:534`) with no log and no error. Also load-bearing: `primary_mandatory` ("Send To Primary Contact") defaults to 1, and with it **off** any customer whose only address is `Customer.email_id` (no Contact row) resolves to nobody. And the doc **cannot be saved with an empty customer table** (`validate` throws "Customers not selected", `:105`), so it cannot be provisioned on a fresh site before the first debtor exists — provision it lazily from the same nightly job instead of at install time.
- **Fix**: Own the list. Add a boolean (`custom_keep_customers_current`) marking a run as managed, and a `scheduler_events["daily"]` task that rebuilds `doc.customers` from live receivable balances (`sum(debit)-sum(credit) > 0` on `account_type = 'Receivable'`, grouped by `gle.party`) while re-reading each address, comparing against the existing rows first so an unchanged day does not churn `modified`. Create the run from that same task when it does not yet exist, so a bench provisioned before its first invoice self-heals. Surface reachability (`covered` vs `unreachable`, mirroring `get_recipients_and_cc`'s exact condition) somewhere a human looks, because all three failure modes above are indistinguishable from success.
- **Evidence**: `apps/erpnext/erpnext/accounts/doctype/process_statement_of_accounts/process_statement_of_accounts.py:423` (`fetch_customers` is whitelisted-only), `:391-401` (`get_recipients_and_cc` reads snapshot rows), `:522-534` (`send_emails` loop with silent `continue`), `:105` (empty-table `validate` throw), `apps/erpnext/erpnext/hooks.py:481` (scheduler → `send_auto_email`). Verified with a 35-check smoke test on `primetyre.localhost`: run auto-created on first debt, second debtor picked up by the nightly task without pressing Fetch Customers, unchanged day left `modified` alone, settled customer dropped, and a rendered statement carrying the invoice and letter head.

### [Debugging Patterns] `awaiting_password=1` is the only way to insert an `Email Account` without dialling SMTP — and such an account still satisfies `{enable_outgoing:1, default_outgoing:1}` while being unable to send
- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Needed a default outgoing `Email Account` on a dev site to exercise a "can we actually email statements?" dashboard branch. Inserting one normally attempts a real SMTP connection and fails; the naive readiness check `frappe.db.exists("Email Account", {"enable_outgoing": 1, "default_outgoing": 1})` then also reported "ready" for an account that could never send.
- **Pattern**: `EmailAccount.validate` only dials SMTP when `not self.awaiting_password` (`email_account.py:186-210`, guarded further by `frappe.local.flags.in_patch or frappe.in_test` returning early at `:174`). So `awaiting_password=1` inserts cleanly with no server — useful for tests and fixtures. The flip side is a production trap: an account left in that half-installed state matches every "is outgoing mail configured?" filter while every send fails, so any readiness check MUST include `"awaiting_password": 0`. To reach a genuinely-sendable state in a test without a mail server, insert with `awaiting_password=1` then `frappe.db.set_value(..., "awaiting_password", 0)` — `db_set` bypasses `validate`.
- **Evidence**: `apps/frappe/frappe/email/doctype/email_account/email_account.py:174` (early return under `in_patch`/`in_test`), `:186-190` (`not self.awaiting_password` guard), `:191-210` (`validate_smtp_conn` branch). Verified on `primetyre.localhost`: `can_send` returned `False` with `awaiting_password=1` and `True` immediately after `db_set` cleared it, asserted in both directions by smoke test.

### [ERPNext Domain] `Transaction Deletion Record` deletes its own record mid-run and rolls the whole wipe back — the pre-go-live "delete all transactions" tool silently achieves nothing

- **Discovered**: 2026-09-01
- **Confidence**: high
- **Uses**: 1
- **Flagged**:
- **Context**: A dev bench needed its smoke-test transactions cleared before handover (2 submitted Sales Invoices, 84 cancelled GL Entries, 38 Payment Ledger Entries). `frappe.delete_doc("Sales Invoice", ...)` is refused — `LinkExistsError: ... is linked with GL Entry` — because ERPNext keeps `is_cancelled=1` GL rows as audit trail. ERPNext ships `Transaction Deletion Record` for exactly this job, so it was submitted with `process_in_single_transaction = 1` (which runs the chain inline via `execute_task` instead of `frappe.enqueue`, `transaction_deletion_record.py:589`). It reported `DoesNotExistError: Transaction Deletion Record TDL0001 not found` on the `reload()` after `submit()`, and a follow-up audit showed **every document still present** — invoice count, GL count, series counters all unchanged.
- **Pattern**: `get_doctypes_with_company_field()` (`transaction_deletion_record.py:878`) selects every DocType carrying a `Link`-to-`Company` DocField that is not in the ignore list. `Transaction Deletion Record` itself has a mandatory `company` Link and is **absent** from `get_doctypes_to_be_ignored()` (`:1023`, which protects Account, Cost Center, Warehouse, Budget, Party Account, Employee, tax templates, POS Profile, BOM, Company, Bank Account, Item Tax Template, Mode of Payment). So the wipe deletes the very record driving it; the next `self.db_set(...)` status write hits a missing row, `execute_task`'s `except Exception: frappe.db.rollback()` (`:609-610`) unwinds the entire single transaction, and the caller sees only a `DoesNotExistError` from `reload()`. **The failure looks like a reporting glitch after a successful wipe — it is a total no-op.** Add `Transaction Deletion Record` to `doctypes_to_be_ignored` before submitting, or skip the tool: for a pre-go-live bench, **cancel** the documents instead. Cancellation is sufficient and supported — a cancelled invoice is excluded from the Accounts Receivable report (`docstatus < 2`), so AR, statements and any dashboard reading `GL Entry`/`Bin` all go to zero. Masters that cancelled documents still link to cannot be deleted either; `frappe.db.set_value(dt, name, "disabled", 1)` keeps them out of every selection list without touching the ledger.
- **Evidence**: `apps/erpnext/erpnext/setup/doctype/transaction_deletion_record/transaction_deletion_record.py:878-885` (`get_doctypes_with_company_field`), `:1023-1039` (`get_doctypes_to_be_ignored`, no self-entry), `:589-601` (`process_in_single_transaction` inline path), `:603-611` (`execute_task` rollback-on-exception). Verified on `primetyre.localhost`: post-submit audit returned `gl entries: 88 cancelled: 84`, `payment ledger: 38`, both invoices still `docstatus: 1`, series `ACC-SINV-2026- current: 2` — byte-identical to the pre-run audit. Cancelling the two invoices instead moved the director dashboard to `total_receivable: 0.0` and the AR report to `0 rows`.

### [Debugging Patterns] `ibis.union` demands byte-identical schemas — two `string(N)` GSTIN columns of different widths raise `RelationError`, and a `_safe` section wrapper turns that crash into a panel of silent zeros

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: The Tax Intelligence "Counterparty GSTIN registry" panel rendered `0 tracked / 0 active / 0 cancelled` on a ledger that demonstrably transacts with 2,705 registered parties. Nothing in the UI or the response envelope indicated failure — `status` was `success` and the section key was present, holding `{}`.
- **Pattern**: `get_counterparty_risk` unions sales-side and purchase-side GSTINs to build one registry. `Sales Invoice.billing_address_gstin` is `Data(140)` while `Purchase Invoice.supplier_gstin` is `Data(64)`, so Ibis materialises them as `string(140)` and `string(64)` and `ibis.union` raises `RelationError: Table schemas must be equal for set operations. Conflicting types for keys: gstin: string(140) != string(64)`. Every per-section aggregator is called through `model.py`'s `_safe(fn, default=None)`, which logs to the error log and returns the default — so a hard crash presents as an empty dict and the frontend's `?? 0` fallbacks paint a confident zero. Two rules follow: (1) **cast both sides of any Ibis `union` to a width-free type** — `si["billing_address_gstin"].cast("string")` — never assume two DocTypes agree on a `Data` field's length; (2) an aggregator whose failure mode is an empty dict MUST be proven non-empty against real data at least once, because `_safe` makes "broken" and "no rows" indistinguishable. A second, independent bug hid behind the same wrapper: after `gstin.join(unioned, ...)`, an `.aggregate()` referencing `unioned["value"]` raises `IntegrityError: Cannot add <CountDistinct> to projection, they belong to another relation` — post-join aggregates may only touch one relation, so the at-risk subset must be selected with a semijoin (`unioned.filter(unioned["gstin"].isin(at_risk["gstin"]))`) rather than by projecting across the join.
- **Evidence**: `apps/insights/insights/ml/india_tax_intelligence/data.py:1199-1299` (`get_counterparty_risk`), `:1246` and `:1256` (both group-by keys now `.cast("string")`), `:1273` (`isin` semijoin replacing the cross-relation aggregate), `apps/insights/insights/ml/india_tax_intelligence/model.py:147-157` (`_safe` swallowing to `default`). Verified on site `jkm`: the panel moved from all-zeros to `2,705 tracked / 2,484 active / 162 cancelled / 26 suspended / 17 blocked`, with 1 at-risk counterparty transacted worth ₹202,410 in the window.

### [ERPNext Domain] A compliance/coverage percentage must exclude rows the obligation never applied to — counting `Not Applicable` e-Waybills and not-yet-due return periods understated a real GST score by 35 points

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: The Tax Intelligence compliance score read 51.18/100 on a site whose GST filings and e-invoicing were, on inspection of the ledger, essentially current: 690 of 690 invoices requiring an IRN had one, and every return period whose due date had passed was filed. A headline that says "half compliant" when the books are clean is worse than no headline — it trains the reader to ignore it.
- **Pattern**: Two denominators were built from "all rows" rather than "all rows the rule reaches". (1) **e-Waybill**: `get_ewaybill_status` buckets invoices as `Active` / `Cancelled` / `Pending` / `Not Applicable`, the last being movements below the ₹50,000 statutory threshold — 455 of 751 invoices here. Coverage computed as `active / total` gave 39%; the honest figure is `active / (total - not_applicable)` = 99.3%. Note the sibling `get_einvoice_status` already had this right, measuring IRN coverage only over `needs_irn` invoices, which is what made the inconsistency visible. (2) **Filing**: `get_filing_compliance` returns `total` / `filed` / `pending` / `unknown` per return type, where `unknown` is a period with a NULL filing status — a period whose return is not yet due. Counting those as unfiled scored 6/24 = 25%; excluding them scored 3/3 = 100%. General rule for any Frappe compliance tile: the denominator is *applicable* obligations, and each aggregator must expose the out-of-scope count (`not_applicable`, `unknown`) so the scorer can subtract it — plus a UI sublabel naming the exclusion, or the reader cannot reconcile the tile against a raw row count.
- **Evidence**: `apps/insights/insights/ml/india_tax_intelligence/model.py:354-409` (`_compute_compliance_score`), `:370-381` (e-Waybill branch, `applicable = total - not_applicable`), `:383-399` (filing branch, `gstr1_due = total - unknown`), `apps/insights/insights/ml/india_tax_intelligence/data.py:829-896` (`get_ewaybill_status` buckets), `:898-1011` (`get_filing_compliance` `unknown` key). Verified on site `jkm`: compliance score 51.18 → 86.46, with e-Waybill coverage 39% → 99.3% and filing 25% → 100%, and the UI sublabels now read "455 below-threshold invoices excluded" and "61 exempt invoices excluded from the denominator".

### [Frontend] A metric table mixing percentages, counts and money needs a per-cell `unit` from the server — a `typeof value === 'number'` formatter fallback rendered 1,838 unreconciled rows as "1,838.0%"

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A new compliance coverage matrix (one row per tax area; columns for reconciliation, filing, evidence, escalation, open actions, exposure) rendered `1,838.0%` for a row count and `2,111,865.5%` for a rupee amount. The cells were correct numbers wearing the wrong unit, which is the most expensive kind of dashboard bug: it is not obviously broken, it is quietly wrong, and a reviewer who trusts it acts on it.
- **Pattern**: The matrix builder returned `{value, note}` cells and the Vue side inferred formatting from the runtime type — `typeof v === 'number' ? formatPercent(v) : String(v)`. That works only while every numeric cell happens to be a percentage. The moment one column carries a count and another carries currency, type-based inference is unrecoverable: the information needed (what this number measures) never left the server. Fix is to make the unit part of the cell contract — `_cell(value, note, unit)` on the Python side emitting `'percent' | 'count' | 'currency' | 'text'`, and a `switch (cell.unit)` on the client. Two deployment details matter: (1) the fallback for a missing `unit` must be the *plain number*, not a percentage — a cached payload written before the field existed still has to render, and a bare figure is merely less informative whereas a `%` on a rupee amount is a lie; (2) the payload is served from `cached_run`, so a stale cache keeps exercising that fallback until the cache is cleared — verify with a fresh compute, not a page reload.
- **Evidence**: `apps/insights/insights/ml/india_tax_intelligence/control.py:914-926` (`_cell` emitting `unit`), `:927-1126` (`get_compliance_matrix` rows, heterogeneous by column), `apps/insights/frontend/src2/intelligence/TaxIntelligence.vue:63-68` (`MatrixCell.unit`), `:420-431` (`matrixCellText` switching on unit, plain-number fallback). Verified live in the browser on site `jkm` after a forced recompute: the reconciliation column reads `46.2%`, ITC open-actions `1,838`, exposure `₹2.4M`, and areas with no data read `Not available` rather than `0`.

### [Frontend] A Tailwind class assembled at runtime is never emitted — `severityFill(s).replace('bg-', 'stroke-')` painted a black arc on a black card, and only in the built bundle

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: A composite score ring rendered its track and arc in near-black on a `#0F0F0F` dark-mode card: invisible. The class looked right in the source and in DevTools' class list, `yarn build` was green, and the two existing token guards (`lint:palette`, `lint:tokens`) both passed, because every string involved is individually legal.
- **Pattern**: Tailwind's scanner reads **source text**. A class produced by string surgery (`.replace('bg-', 'stroke-')`) or interpolation (`` `bg-${tone}-fill` ``) never appears literally in any file, so the utility is never generated. The element then keeps the property's *initial* value, and the initial value of `stroke` is `none` — nothing paints, silently. This is a third, distinct failure mode from the two documented token traps (wrong family, crossed role scope): here the family and the role are both correct and the rule simply does not exist. Two consequences for verification: a Tailwind probe build cannot detect it (a probe proves a class *can* be emitted, not that the scanner ever saw it — grep the built `assets/index-*.css` instead), and a `.replace()`-derived class also defeats grep-based review. Fix at the vocabulary, not the call site: return whole literal class strings from one module (`severityStroke()` beside `severityFill()`), and add a guard that greps for the construction pattern itself.
- **Evidence**: `apps/insights/frontend/src2/utils/status.ts:129-150` (`severityStroke`, literal returns), `apps/insights/frontend/src2/intelligence/components/HealthRing.vue:161` (call site), `apps/insights/frontend/package.json` (`lint:classgen` guard), `DESIGN.md` trap 9. Verified in the browser on site `jkm`: arc computed stroke went from `rgb(0,0,0)` to `rgb(70,179,126)`, and `grep stroke-pos-fill insights/public/frontend/assets/index-*.css` went from ABSENT to IN_BUILD. Guard proven by reintroducing the exact defect: `lint:classgen` fails on both the `.replace()` and the interpolated form.

### [Debugging Patterns] jsdom 29 ships no Web Storage, so a composable that *correctly* guards `localStorage` turns its own persistence specs into no-ops

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: `npx vitest run` — a guard the design doc tells you to run before shipping — was red with 8 failures in `useTheme.spec.ts`, all dying in `beforeEach` on `localStorage.clear()` with "Cannot read properties of undefined". The obvious readings are both wrong: it is not the spec's `vi.unstubAllGlobals()` stripping a stub (the spec only ever stubs `matchMedia`), and it is not a missing jsdom URL (`location.href` is `http://localhost:3000/`). jsdom 29 simply does not expose `window.localStorage`.
- **Pattern**: The trap is what happens if you "fix" it the cheap way. Production code that reads storage defensively — `if (typeof localStorage === 'undefined') return null` — is correct for Safari private mode, but in a Storage-less test environment it means the code under test takes its degraded branch. So guarding the spec's `clear()` call turns eight loud failures into specs that pass while asserting nothing about persistence. Install a real in-memory `Storage` in a `setupFiles` module instead, and define it as a plain own property via `Object.defineProperty` rather than `vi.stubGlobal`, or the spec's own `unstubAllGlobals()` removes it again before the first assertion. Then prove the restored specs have teeth by sabotaging the write and watching exactly the persistence test fail.
- **Evidence**: `apps/insights/frontend/vitest.setup.ts` (in-memory Storage), `vitest.config.ts:15-18` (`setupFiles`), `src2/composables/useTheme.ts:32,68` (the correct production guards that cause the vacuity). Suite went 175 passed / 8 failed → 183 passed / 0 failed; sabotaging `localStorage.setItem` then failed exactly one spec ("an explicit choice overrides the OS preference and persists"), confirming the coverage is real.

### [ERPNext Domain] Netting a two-directional GL account reports the unused remainder as the amount used

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: Tax Intelligence showed "Credit utilisation 22.39%" on a gauge whose colour bands make low readings red — telling a tax manager that ₹9.4M of input credit sat unclaimed. The true figure was 77.83%. The `available` denominator was right and the numerator was a real number off the real ledger, so nothing looked broken.
- **Pattern**: Input tax accounts (`Input Tax CGST/SGST/IGST`) are assets carrying two different facts in opposite directions: a **debit** when a purchase accrues credit, a **credit** when the monthly GSTR-3B set-off journal consumes it (that journal debits `Output Tax *` and credits these, leaving `GST Payble` as the residual cash). `debit - credit` is therefore neither fact — it is the *balance carried forward*, and dividing it by available credit reports the complement of utilisation. The tell is a code comment rationalising a sign flip: the original read "Summing credit - debit returned it negative, inverting utilisation, so use debit - credit here". The author saw `-2,111,865`, flipped the operands to get a positive number, and shipped it; the figure actually wanted was the credit total `7,414,022`, not the net at all. A negative net tells you which column you are in, it is not licence to invert. Aggregate `debit` and `credit` separately, name all three (`accrued` / `utilised` / `balance`), and keep numerator and denominator on one ledger — a GL numerator over a Purchase-Invoice denominator puts two figures that never agree exactly (₹9,525,888 vs ₹9,430,263) on the same ratio. The same file already argued this for reverse charge: "A single net figure hides an ineligible self-assessment entirely."
- **Evidence**: `apps/insights/insights/ml/india_tax_intelligence/data.py:486-523` (split aggregate), `:636-648` (ratio and keys), `control.py:1021-1025`, `agents/tax_agent.py:69-71`, `frontend/src2/intelligence/TaxIntelligence.vue:1305-1335` (four unnetted tiles), `:1676-1686`, `:1936`. Verified against raw SQL on site `jkm`: gross debit ₹9,525,887.83, gross credit ₹7,414,022.36 of which ₹7,342,896.15 is 5 GSTR-3B set-off journals; payload `utilization_pct` 22.39 → 77.83, gauge red → green in the browser.

### [Debugging Patterns] An LLM context extractor is a silent-zero factory: `dict.get(key, 0)` on a key the payload never had

- **Discovered**: 2026-09-10
- **Confidence**: high
- **Uses**: 0
- **Flagged**:
- **Context**: The Tax dashboard's chat agent was handed `estimated_tax: 0.0` for every HSN row against millions in real revenue — the payload key is `actual_gst` and `estimated_tax` has never existed. Nothing raised, nothing logged, and the tax figure never reached a screen where a human could notice; only the model saw it, and it was asked to reason about a zero-rated book. Sibling `_extract_filing_compliance` in the same file was correct, so the file did not look suspect.
- **Pattern**: Extractor layers that flatten a payload for an LLM are uniquely dangerous because `.get(key, default)` is the house style, the consumer cannot complain, and the output is prose rather than a number a reviewer reconciles. Two failure modes travel together: (1) **key drift** — the producer renames `estimated_tax` → `actual_gst` and the extractor keeps compiling; (2) **denominator loss** — passing `filed: 3` without `due: 4` hands the model a count it cannot judge, and it will confidently call the same 3 either compliant or delinquent. Audit the whole layer at once rather than the one you found: load a live payload, walk each `_extract_*` for its `context.get("<section>")` and the `.get("<key>")` calls under it, and diff against the real keys. Nested reads (`filing.get("gstr1", {}).get("status")`) are false positives — check the sub-dict before believing the report. Ship counts as pairs (`filed_of_due` + `due` + `overdue`), never bare.
- **Evidence**: `apps/insights/insights/agents/tax_agent.py:145-163` (HSN, `estimated_tax` → `actual_gst` + `effective_gst_rate`), `:111-131` (filing, bare `filed` → `filed_of_due`/`due`/`overdue`/`due_through`). Live on site `jkm`: HSN row 1 went `estimated_tax 0.0` → `actual_gst ₹915,502.29` at 18.03%; filing went `gstr1_filed: 3` → `3 of 4 due, 1 overdue through 2026-07`. The audit script found 5 hits, 4 of which were nested-read false positives — the diff is a lead, not a verdict.
