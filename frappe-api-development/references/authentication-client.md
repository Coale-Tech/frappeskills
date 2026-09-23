# Client-Side Authentication (frappe-ui)

Vue/frappe-ui patterns: user resource, login/logout, route guards, and
session timeout. Server-side session/permission checks:
[authentication-server.md](authentication-server.md).

## Using frappe-ui User Resource

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

## Login Component

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

## Logout Function

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

## Route Guards (Vue Router)

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

## Permission Composable

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

## Usage in Components

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

## Sources

See [authentication.md](authentication.md) `## Sources`.
