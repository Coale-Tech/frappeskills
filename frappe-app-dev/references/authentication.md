# Authentication Guide

This guide covers authentication patterns in Frappe/ERPNext applications.

## Overview

Frappe uses session-based authentication by default. The `frappe-ui` library provides components and utilities for handling authentication in Vue.js applications.

## Server-Side Authentication

### Checking User Session

```python
import frappe

@frappe.whitelist()
def get_current_user():
    """Get current logged-in user"""
    return frappe.session.user

@frappe.whitelist()
def check_login():
    """Check if user is logged in"""
    if frappe.session.user == "Guest":
        return {"logged_in": False}
    return {
        "logged_in": True,
        "user": frappe.session.user,
        "user_email": frappe.session.data.user_email
    }
```

### Permission Checks

```python
@frappe.whitelist()
def get_sensitive_data():
    """Require specific permission"""
    if not frappe.has_permission("MyDocType", "read"):
        frappe.throw("Not permitted", frappe.PermissionError)

    # Return data
    return frappe.get_all("MyDocType")

@frappe.whitelist()
def update_document(docname, data):
    """Write permission check"""
    doc = frappe.get_doc("MyDocType", docname)

    if not doc.has_permission("write"):
        frappe.throw("Not permitted", frappe.PermissionError)

    doc.update(data)
    doc.save()
    return doc.as_dict()
```

### Role-Based Access

```python
@frappe.whitelist()
def admin_only_method():
    """Only accessible to System Manager"""
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Access denied", frappe.PermissionError)

    # Admin logic here
    return {"message": "Admin access granted"}

@frappe.whitelist()
def get_user_data():
    """Get data based on user role"""
    user = frappe.session.user
    roles = frappe.get_roles(user)

    if "System Manager" in roles:
        # Return all data
        return frappe.get_all("MyDocType", fields=["*"])
    elif "Manager" in roles:
        # Return filtered data
        return frappe.get_all("MyDocType", filters={"owner": user})
    else:
        # Return limited data
        return frappe.get_all("MyDocType", fields=["name", "status"])
```

### API Key Authentication (for external integrations)

```python
@frappe.whitelist()
def api_method():
    """Method that supports both session and API key auth"""
    # Frappe handles API key auth automatically
    # Just check permissions

    if not frappe.has_permission("MyDocType", "read"):
        frappe.throw("Not permitted", frappe.PermissionError)

    return frappe.get_all("MyDocType")
```

## Permission Model (Server-Side, source-verified — v16)

Frappe's permission system is layered (role permissions → User Permissions →
shares → controller hooks). A check passes only if the relevant layer grants it.
Critically, **controller `has_permission` hooks can only DENY, never grant**
access that role permissions didn't already allow
(`apps/frappe/frappe/permissions.py:468` `has_controller_permissions`).
`Administrator` short-circuits to `True` in `has_permission`
(`permissions.py:107-109`).

### Core permission functions & signatures

```python
# Public wrapper — USE THIS in whitelisted methods. Supports throw=True.
frappe.has_permission(
    doctype=None, ptype="read", doc=None, user=None, throw=False,
    *, parent_doctype=None, debug=False, ignore_share_permissions=False,
) -> bool
# frappe/__init__.py:577 — if throw=True and denied, raises frappe.PermissionError

# Low-level engine (called by the wrapper above)
frappe.permissions.has_permission(
    doctype, ptype="read", doc=None, user=None,
    *, parent_doctype=None, print_logs=True, debug=False,
    ignore_share_permissions=False,
) -> bool
# frappe/permissions.py:80

# Per-doc evaluated permission dict, e.g. {"read": 1, "write": 1}
frappe.permissions.get_doc_permissions(doc, user=None, ptype=None, debug=False) -> dict
# frappe/permissions.py:214

# Role-permission dict for a DocType meta (does NOT include User Permissions)
frappe.permissions.get_role_permissions(doctype_meta, user=None, is_owner=None, debug=False) -> dict
# frappe/permissions.py:269

# User Permission (document-level scoping) check
frappe.permissions.has_user_permission(doc, user=None, debug=False, *, ptype=None) -> bool
# frappe/permissions.py:338

# Controllers can only DENY, never grant
frappe.permissions.has_controller_permissions(doc, ptype, user=None, debug=False) -> bool
# frappe/permissions.py:468

# Roles of a user (includes automatic roles: All, Guest, Desk User)
frappe.get_roles(username=None) -> list[str]                                # frappe/__init__.py:384
frappe.permissions.get_roles(user=None, with_standard=True) -> list[str]    # permissions.py:522

# Raise frappe.PermissionError unless the user has ANY of the given roles.
frappe.only_for(roles, message=False)                                       # frappe/__init__.py:525
```

Document methods (`apps/frappe/frappe/model/document.py`):
`doc.has_permission(permtype="read", *, debug=False, user=None) -> bool` (line 368)
and `doc.check_permission(permtype="read", permlevel=None)` (line 363), which
raises `frappe.PermissionError` on failure.

### Recommended patterns in whitelisted methods

```python
@frappe.whitelist()
def get_sensitive_data():
    # Preferred: let the framework raise PermissionError with throw=True
    frappe.has_permission("MyDocType", "read", throw=True)
    return frappe.get_all("MyDocType")

@frappe.whitelist()
def update_document(docname, data):
    doc = frappe.get_doc("MyDocType", docname)
    doc.check_permission("write")            # raises frappe.PermissionError if denied
    doc.update(frappe.parse_json(data))
    doc.save()
    return doc.as_dict()

@frappe.whitelist()
def admin_only():
    frappe.only_for("System Manager")        # raises PermissionError otherwise
    return {"ok": True}
```

Note: the `unchecked-frappe-permission-call` semgrep rule flags a bare
`frappe.has_permission(...)` whose return value is ignored — always either check
the return value or pass `throw=True`.

### Row-level filtering: `permission_query_conditions` hook

List queries (`frappe.get_list`/`get_all` when `ignore_permissions` is falsy)
append extra `WHERE` conditions from the `permission_query_conditions` hook
(`apps/frappe/frappe/model/db_query.py:1149` `get_permission_query_conditions`).
Hooks are resolved as `hooks.get(doctype, []) + hooks.get("*", [])`; each method
is invoked as `method(user, doctype=doctype)` and must return a SQL condition
string (Server Scripts of type "Permission Query" are also supported).

```python
# hooks.py
permission_query_conditions = {
    "ToDo": "my_app.permissions.todo_query_conditions",
}

# my_app/permissions.py
def todo_query_conditions(user, doctype=None):
    user = user or frappe.session.user
    # Escape any interpolated value with frappe.db.escape to stay injection-safe.
    return f"`tabToDo`.owner = {frappe.db.escape(user)}"
```

Document-level (not list) access can be denied via the `has_permission` hook,
resolved in `has_controller_permissions` (`permissions.py:468`):

```python
# hooks.py
has_permission = {"ToDo": "my_app.permissions.todo_has_permission"}

def todo_has_permission(doc, ptype=None, user=None, debug=False):
    # Return falsy to DENY. Controllers cannot grant extra access.
    return doc.owner == (user or frappe.session.user)
```

### User Permissions

User Permissions restrict *which specific documents* a user may access for a
linked DocType, layered on top of role permissions
(`frappe/permissions.py:has_user_permission`, backed by
`frappe/core/doctype/user_permission/`). They are enforced automatically inside
`get_doc_permissions` and in list queries — you do not call them directly.

### `ignore_permissions` semantics

`ignore_permissions` **bypasses all permission checks**. On a document,
`doc.flags.ignore_permissions = True` makes `doc.has_permission()` return `True`
unconditionally (`apps/frappe/frappe/model/document.py:375-376`). DB-op kwargs
set that flag:

```python
doc.insert(ignore_permissions=True)            # document.py:400, 424
doc.save(ignore_permissions=True)              # document.py:520, 534
doc.delete(ignore_permissions=True)            # document.py:1301
frappe.get_list("X", ignore_permissions=True)  # skips permission_query_conditions
```

Only use `ignore_permissions=True` in trusted server-side code (background jobs,
migrations, system-authored writes). NEVER derive it from user input, and NEVER
use it as a shortcut inside a `@frappe.whitelist()` endpoint reachable by
untrusted users — that is a privilege-escalation bug.

### `@frappe.whitelist` and endpoint exposure

```python
frappe.whitelist(allow_guest=False, xss_safe=False, methods=None)  # frappe/__init__.py:417
```
- Only whitelisted functions are callable via `/api/method/<dotted.path>`
  (`is_whitelisted`, `frappe/__init__.py:457`).
- `methods` defaults to `["GET", "POST", "PUT", "DELETE"]`; restrict it
  (e.g. `methods=["POST"]`) for state-changing endpoints.
- `allow_guest=True` exposes the method to unauthenticated users — audit every
  such method (semgrep `guest-whitelisted-method`). For Guest calls, `form_dict`
  string values are HTML-sanitized unless `xss_safe=True`.
- Type hints on parameters are validated at call time via
  `validate_argument_types` (semgrep `missing-argument-type-hint`).

### Rate limiting

```python
from frappe import rate_limit   # frappe.rate_limiter.rate_limit
rate_limit(key=None, limit=5, seconds=86400, methods="ALL", ip_based=True)
# frappe/rate_limiter.py:104

@frappe.whitelist(allow_guest=True)
@rate_limit(key="email", limit=5, seconds=60 * 60)
def request_otp(email):
    ...
```
Exceeding the limit raises `frappe.RateLimitExceededError`
(`rate_limiter.py:164-168`). A site-wide limit can also be set via
`frappe.conf.rate_limit = {"limit": ..., "window": ...}` (`rate_limiter.py:16-19`).

## Client-Side Authentication

### Using frappe-ui User Resource

```javascript
import { user } from 'frappe-ui'

// Access current user
console.log(user.value) // Ref with user object

// Check if logged in
const isLoggedIn = computed(() => user.value && user.value.name !== 'Guest')

// Get user properties
const userName = computed(() => user.value?.full_name)
const userEmail = computed(() => user.value?.email)
const userRoles = computed(() => user.value?.roles)

// Check if user has role
const hasRole = (role) => {
  return user.value?.roles?.includes(role) ?? false
}

// Check if System Manager
const isSystemManager = computed(() => hasRole('System Manager'))
```

### Login Component

```vue
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Sign In</h1>
        <p class="text-sm text-gray-500 mt-2">Enter your credentials to access</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <FormControl
          v-model="form.username"
          label="Username"
          type="text"
          placeholder="Enter username"
          :disabled="loading"
          required
        />

        <FormControl
          v-model="form.password"
          label="Password"
          type="password"
          placeholder="Enter password"
          :disabled="loading"
          required
        />

        <ErrorMessage v-if="error" :message="error" />

        <Button
          type="submit"
          variant="solid"
          theme="blue"
          class="w-full"
          :loading="loading"
        >
          Sign In
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { FormControl, Button, ErrorMessage } from 'frappe-ui'
import { call } from 'frappe-ui'

const router = useRouter()

const form = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref(null)

async function handleLogin() {
  loading.value = true
  error.value = null

  try {
    await call('login', {
      usr: form.value.username,
      pwd: form.value.password
    })

    // Redirect to home or intended page
    router.push('/')
  } catch (err) {
    error.value = err.message || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>
```

### Logout Function

```javascript
import { call } from 'frappe-ui'

async function logout() {
  try {
    await call('logout')
    // Redirect to login
    window.location.href = '/login'
  } catch (error) {
    console.error('Logout failed:', error)
    // Force redirect even on error
    window.location.href = '/login'
  }
}
```

### Route Guards (Vue Router)

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { user } from 'frappe-ui'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/Admin.vue'),
    meta: { requiresAuth: true, roles: ['System Manager'] }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const isPublic = to.meta.public
  const requiresAuth = to.meta.requiresAuth
  const requiredRoles = to.meta.roles

  const isLoggedIn = user.value && user.value.name !== 'Guest'
  const userRoles = user.value?.roles || []

  if (isPublic) {
    // Redirect to home if already logged in
    if (isLoggedIn && to.name === 'Login') {
      next('/')
    } else {
      next()
    }
  } else if (requiresAuth && !isLoggedIn) {
    // Redirect to login if not authenticated
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
  } else if (requiredRoles && !requiredRoles.some(role => userRoles.includes(role))) {
    // Redirect if user doesn't have required role
    next({ name: 'Home' })
  } else {
    next()
  }
})

export default router
```

### Permission Composable

```javascript
// composables/usePermissions.js
import { computed } from 'vue'
import { user } from 'frappe-ui'

export function usePermissions() {
  const isLoggedIn = computed(() => {
    return user.value && user.value.name !== 'Guest'
  })

  const hasRole = (role) => {
    return user.value?.roles?.includes(role) ?? false
  }

  const hasAnyRole = (roles) => {
    if (!user.value?.roles) return false
    return roles.some(role => user.value.roles.includes(role))
  }

  const hasAllRoles = (roles) => {
    if (!user.value?.roles) return false
    return roles.every(role => user.value.roles.includes(role))
  }

  const hasPermission = (doctype, permtype) => {
    // Check from user's permissions
    const perms = user.value?.permissions?.[doctype]
    return perms?.[permtype] ?? false
  }

  const isSystemManager = computed(() => hasRole('System Manager'))
  const isAdmin = computed(() => hasAnyRole(['System Manager', 'Administrator']))

  return {
    isLoggedIn,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    hasPermission,
    isSystemManager,
    isAdmin,
    user: computed(() => user.value)
  }
}
```

### Usage in Components

```vue
<template>
  <div>
    <!-- Show based on authentication -->
    <div v-if="isLoggedIn">
      Welcome, {{ user?.full_name }}!
    </div>

    <!-- Show based on role -->
    <Button
      v-if="isSystemManager"
      @click="adminAction"
    >
      Admin Action
    </Button>

    <!-- Show based on permission -->
    <div v-if="hasPermission('Customer', 'write')">
      <Button @click="createCustomer">Create Customer</Button>
    </div>
  </div>
</template>

<script setup>
import { usePermissions } from '@/composables/usePermissions'

const {
  isLoggedIn,
  isSystemManager,
  hasPermission,
  user
} = usePermissions()

function adminAction() {
  // Admin-only action
}
</script>
```

## Session Management

### Auto-Logout on Inactivity

```javascript
// composables/useSessionTimeout.js
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { call } from 'frappe-ui'

const TIMEOUT_MINUTES = 30
let timeoutId = null

export function useSessionTimeout() {
  const router = useRouter()
  const warningVisible = ref(false)

  function resetTimeout() {
    if (timeoutId) clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      // Show warning before logout
      warningVisible.value = true

      // Logout after 30 more seconds
      setTimeout(() => {
      logout()
      }, 30000)
    }, TIMEOUT_MINUTES * 60 * 1000)
  }

  function logout() {
    call('logout').then(() => {
      window.location.href = '/login'
    })
  }

  function extendSession() {
    warningVisible.value = false
    resetTimeout()
  }

  onMounted(() => {
    // Setup activity listeners
    window.addEventListener('mousemove', resetTimeout)
    window.addEventListener('keypress', resetTimeout)
    window.addEventListener('click', resetTimeout)
    resetTimeout()
  })

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
    window.removeEventListener('mousemove', resetTimeout)
    window.removeEventListener('keypress', resetTimeout)
    window.removeEventListener('click', resetTimeout)
  })

  return {
    warningVisible,
    extendSession,
    logout
  }
}
```

### Session Refresh

```javascript
// Keep session alive with periodic refresh
setInterval(() => {
  call('frappe.ping').catch(() => {
    // Session expired
    window.location.href = '/login'
  })
}, 5 * 60 * 1000) // Every 5 minutes
```

## CSRF Protection

Frappe validates a CSRF token on every unsafe HTTP request — `POST`, `PUT`,
`DELETE`, `PATCH` (`apps/frappe/frappe/auth.py:29` `UNSAFE_HTTP_METHODS`). The
submitted token is compared to `frappe.session.data.csrf_token`; a mismatch
raises `frappe.CSRFTokenError` ("Invalid Request") in
`HTTPRequest.validate_csrf_token` (`auth.py:81-97`). The token is accepted from
either the `X-Frappe-CSRF-Token` request header or a `csrf_token` form field
(`auth.py:89`). Validation is skipped for safe methods, when
`frappe.conf.ignore_csrf` is set, for a Guest session with no token, or for an
allowed referrer.

The token is generated server-side by `frappe.generate_hash()`
(`frappe/sessions.py:194-204` `get_csrf_token`/`generate_csrf_token`) and
injected into the page as the global `frappe.csrf_token`
(`frappe/website/page_renderers/base_template_page.py:22`, and on Desk boot via
`frappe/public/js/frappe/desk.js`). It is **not** a readable cookie.

When using `frappe-ui`'s `call` / `createResource`, the CSRF header is attached
automatically:

```javascript
import { call, createResource } from 'frappe-ui'

// These include the X-Frappe-CSRF-Token header automatically
await call('my_method')
await resource.submit()
```

For manual `fetch` requests, read the boot-injected `frappe.csrf_token` and send
it in the header (Frappe's own `request.js` uses the same header —
`frappe/public/js/frappe/request.js:267`):

```javascript
async function manualRequest() {
  const csrfToken = frappe.csrf_token   // injected into the desk/web boot

  await fetch('/api/method/my_method', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ data: 'value' }),
  })
}
```

## Best Practices

1. **Always check permissions** on server-side methods
2. **Use frappe-ui's `user` resource** for client-side auth state
3. **Implement route guards** to protect authenticated pages
4. **Use role-based access** for granular permissions
5. **Never expose sensitive data** without permission checks
6. **Use CSRF tokens** for all state-changing requests
7. **Handle session expiry** gracefully
8. **Redirect to login** on authentication failure
9. **Use `@frappe.whitelist()`** for all public API methods
10. **Validate user input** even with authenticated users

## Sources

Verified against Frappe framework v16 (`frappe.__version__ == "16.9.0"`,
`apps/frappe/frappe/__init__.py:57`):

- `apps/frappe/frappe/permissions.py` — `has_permission` (l.80), `get_doc_permissions` (l.214), `get_role_permissions` (l.269), `has_user_permission` (l.338), `has_controller_permissions` (l.468), `get_valid_perms` (l.492), `get_roles` (l.522)
- `apps/frappe/frappe/__init__.py` — `whitelist` (l.417), `is_whitelisted` (l.457), `only_for` (l.525), `has_permission` wrapper (l.577), `get_roles` (l.384), `get_installed_apps` (l.900), `generate_hash` (l.684), `_`/`_lt` import (l.44)
- `apps/frappe/frappe/rate_limiter.py` — `rate_limit` decorator (l.104), site-wide `apply` (l.16)
- `apps/frappe/frappe/utils/messages.py` — `throw` (l.129), `msgprint` (l.14)
- `apps/frappe/frappe/utils/translations.py` — `_` (l.4), `_lt` (l.40)
- `apps/frappe/frappe/auth.py` — `UNSAFE_HTTP_METHODS` (l.29), `validate_csrf_token` (l.81), `is_allowed_referrer` (l.102)
- `apps/frappe/frappe/sessions.py` — `get_csrf_token`/`generate_csrf_token` (l.194-204)
- `apps/frappe/frappe/model/db_query.py` — `get_permission_query_conditions` (l.1149)
- `apps/frappe/frappe/model/document.py` — `check_permission` (l.363), `has_permission` (l.368), `insert`/`save`/`delete` `ignore_permissions` (l.400, 520, 1301)
- `apps/frappe/frappe/website/page_renderers/base_template_page.py` (l.20-22), `apps/frappe/frappe/public/js/frappe/request.js` (l.267), `apps/frappe/frappe/public/js/frappe/desk.js` — client CSRF token exposure (`frappe.csrf_token`)
