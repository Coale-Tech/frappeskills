# Troubleshooting a Broken Bench

Failure modes that look like application bugs but are actually stale processes
or stale filesystem state. Each section states the cause, then the fix.

## `ModuleNotFoundError: No module named '<new_app>'` inside a queued job

Seen when `bench --site <site> migrate` fails on a job such as
`Role Profile.on_update -> queue_action`, right after installing a new app.

**Cause.** `bench get-app <app>` installs the app on disk and into the venv,
but does **not** restart already-running `bench worker` / `worker-pool`
processes. On a dev setup driven by `bench start` / honcho (rather than
supervisor), `bench get-app`'s own `supervisorctl restart frappe:` step fails
silently — exit 7, because there is no supervisor group. Confirm by looking for
`WARNING ... failed. Use 'bench restart' to retry.` in `logs/bench.log`. Every
worker alive before the `get-app` keeps its old Python module cache and crashes
on any job importing the new app's `hooks.py` — which is every job, via
`frappe.get_hooks("before_job")`.

**Fix.**

1. Confirm the app is importable in the venv:
   `./env/bin/python -c "import <app>"`.
2. Enumerate workers:
   `ps aux | grep -iE "bench worker|bench_helper frappe worker"`.
3. **Check the parent chain of each one before touching it:**
   `ps -o pid,ppid,tty,lstart,command -p <pid>`. A real `TTY` (not `?`) with a
   `STAT` ending in `+` is very likely a live foreground session someone is
   using — do not kill it.
4. Kill only workers confirmed orphaned (`ps -o ppid=` returns `1`) or in a
   process tree with no live foreground tty. Restart:
   ```bash
   nohup bench --site <site> worker --queue short,default,long \
     > /tmp/<site>_worker.log 2>&1 &
   ```
   Confirm health via the log's `*** Listening on ...` line and the absence of
   `ModuleNotFoundError` on the next job.
5. A stale worker you cannot kill (someone else's terminal) stays in the RQ
   rotation and will keep racing your fresh worker, intermittently failing jobs
   with the same stale-module error. It does not block `bench --site <site> migrate`
   itself, but it keeps producing new stale locks — expect to repeat the next fix.

## `DocumentLockedError: This document is currently locked and queued for execution`

**Cause.** `Document.queue_action()` calls `self.lock()` — a pure filesystem
lock at `sites/<site>/locks/<signature>.lock`, no DB or Redis state (see
`frappe/model/document.py`'s `is_locked` and `frappe/utils/file_lock.py`) —
**before** enqueuing the job. If the job later crashes (for example on the
`ModuleNotFoundError` above), `unlock()` never runs and the lock is permanently
stale. Every later `queue_action` on that document throws immediately, before
reaching a worker.

**Fix.** Safe to clear whenever the lock is a self-inflicted leftover from a
crashed job. On a shared or production-like site, first confirm no legitimate
long-running edit is in flight.

```bash
rm -f sites/<site>/locks/*.lock
bench --site <site> migrate
```

`queue_action` only acquires the lock and enqueues — it does not wait for the
job — so `bench --site <site> migrate` proceeds past that line regardless of whether the
async job eventually succeeds. If it fails again, clear and retry; each retry
enqueues a fresh attempt.

To see exactly which documents are affected and why their jobs died, inspect
RQ's failed registry from `bench --site <site> console`:

```python
from rq.job import Job
from frappe.utils.background_jobs import get_redis_conn, get_queue
from rq.registry import FailedJobRegistry

conn = get_redis_conn()
for qname in ("short", "default", "long"):
    reg = FailedJobRegistry(queue=get_queue(qname))
    for jid in reg.get_job_ids():
        j = Job.fetch(jid, connection=conn)
        print(jid, j.ended_at, j.kwargs)
# print(j.exc_info) for the real traceback of one
```

## The site starts 500ing after killing "just a worker"

A `bench start` / honcho session's death can cascade-kill its siblings — web
server and socketio — even though you only targeted its worker child.

**Verify before concluding you broke it.** Find the process actually listening
on the site's `webserver_port` (`lsof -iTCP -sTCP:LISTEN | grep <port>`) and
inspect it: `ps -o pid,ppid,lstart,command -p <web_pid>`. If its `PPID` is `1`
and its `lstart` predates your session, it was never a child of what you killed
and the 500 has another cause.

Reproduce the real error through the actual WSGI app. Do **not** use
`bench --site <site> console`'s `get_response` — it has no real `frappe.local.request` and
reports a misleading `AttributeError: request`.

```python
from werkzeug.test import Client
from frappe.app import application

client = Client(application)
resp = client.get("/login", headers={"Host": "<site>"})
print(resp.status_code)
```

A 200 means the DB and app layers are healthy and the fault is isolated to one
broken long-lived process — often its stdout/stderr pipe died with an unrelated
parent. Kill that single process and restart it with the exact command `ps`
shows it was running, e.g.:

```bash
nohup bench --site <site> serve --port <port> > /tmp/<site>_web.log 2>&1 &
```

## General rule

Never kill a PID you have not inspected. `ps -o pid,ppid,tty,lstart,command -p
<pid>` first, every time — the difference between an orphaned worker and
someone's live `bench start` is one column.
