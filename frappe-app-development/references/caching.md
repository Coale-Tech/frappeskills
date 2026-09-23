# Caching

`frappe.cache` is a Redis wrapper that auto-prefixes keys with the current site name.

## Basic operations

```python
# Set with TTL (preferred for ephemeral state)
frappe.cache.set_value("presence:user1", {"status": "online"}, expires_in_sec=300)

# Set without TTL (persistent until cleared)
frappe.cache.set_value("config:feature_flags", {"beta": True})

# Get
value = frappe.cache.get_value("presence:user1")

# Delete
frappe.cache.delete_value("presence:user1")

# Delete multiple
frappe.cache.delete_value(["key1", "key2"])
```

## Key patterns

Pass logical keys (e.g. `presence:user1`). The wrapper handles site-prefixing automatically. Do NOT manually prefix with database name.

## Listing keys

```python
# Get keys matching a prefix
keys = frappe.cache.get_keys("presence:")

# Count active keys
count = len(frappe.cache.get_keys("presence:"))
```

`get_keys` returns raw Redis keys (with site prefix). Safe for counting. Do NOT compare directly to unprefixed logical keys.

## When to use cache

- **Session/presence data** — TTL-backed, short-lived
- **Expensive computed values** — cache with TTL to avoid recomputation
- **Cross-request coordination** — flags, locks, counters

Do not cache large objects. Redis is not a blob store.

---

## Caching

### Redis cache (`frappe.cache`)

`frappe.cache` is a `RedisWrapper` (`frappe/utils/redis_wrapper.py`). Values are
pickled and namespaced per site.

```python
# Key/value (val is pickled; expires_in_sec optional)
frappe.cache.set_value("my_key", {"a": 1}, expires_in_sec=300)
val = frappe.cache.get_value("my_key")

# Lazy compute-on-miss with a generator
val = frappe.cache.get_value("expensive", generator=compute_expensive)

frappe.cache.delete_value("my_key")

# Hash maps
frappe.cache.hset("group", "field", value)
frappe.cache.hget("group", "field")
frappe.cache.hgetall("group")
frappe.cache.hdel("group", "field")
```

### Client cache (`frappe.client_cache`, v16)

`frappe.client_cache` is a `ClientCache`: an in-process LRU backed by Redis with
pub/sub invalidation — faster than `frappe.cache` for hot keys read many times per
request across workers.

```python
frappe.client_cache.get_value("key", generator=compute)
frappe.client_cache.set_value("key", value)
frappe.client_cache.delete_value("key")
frappe.client_cache.get_doc("Website Settings")   # cached single/doc
```

### Caching decorators (`frappe.utils.caching`)

```python
from frappe.utils.caching import request_cache, site_cache, redis_cache

@request_cache                       # memoize for the duration of ONE request
def get_config(name): ...

@site_cache(ttl=600, maxsize=1024)   # in-process, per-site, across requests
def get_settings(): ...

@redis_cache(ttl=3600, shared=False) # persisted in Redis, survives process restart
def get_report_data(company): ...
```

> Rule of thumb: `request_cache` for within-request memoization, `site_cache` for
> process-local hot data, `redis_cache` / `frappe.cache` for cross-process data.
> Always invalidate on write (e.g. in `on_update`) for cached DB-derived values.
