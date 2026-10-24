# frappe-ui API Contracts (1.0.2)

Adapted from frappe/frappe-ui (MIT): `skills/frappe-ui/CORE.md`, `DATA.md`,
`evals/findings-2026-08.md`, `evals/observed-failures-2026-08.md`.

Concrete contracts derived from audited model failures. Read before writing
any component or composable call — every table row below maps to a class of
code an agent has shipped incorrectly in production evals.

## v-model contracts

| Component | Primary `v-model` | Named `v-model` |
|---|---|---|
| TextInput / Textarea / Password | `string \| number` | — |
| Select / Combobox | `string \| number \| null` | `v-model:query` on Combobox |
| MultiSelect | `Array<string \| number>` | `v-model:query` |
| Checkbox / Switch | `boolean` | — |
| RadioGroup | `string \| number \| boolean` | — |
| DatePicker / DateTimePicker / TimePicker | `string` | — |
| DateRangePicker | `[from, to]` YYYY-MM-DD or `[]` | — |
| Slider | `number[]` (`[25]` single thumb, `[20, 80]` range) | — |
| Rating | `number` | — |
| Duration | `number` (seconds) or `null` | — |
| Dialog | — | `v-model:open` (canonical); bare `v-model` also works |
| Popover / HoverCard / Dropdown | — | `v-model:open` |
| **Tabs** | `TabValue` (`string \| number`) via bare **`v-model`** | — |
| List (`frappe-ui/list`) | — | `v-model:selection`, `v-model:active` |

> **`Tabs` uses bare `v-model`** for the active tab. `v-model:tab` belongs to
> `SettingsDialog` — the two are unrelated. This is failure mode A3/C3 in the
> 2026-08 audit.

## variant + theme per component

| Component | `variant` | `theme` |
|---|---|---|
| Button | `solid \| subtle \| outline \| ghost` | `gray \| blue \| green \| red` |
| Badge | `solid \| subtle \| outline \| ghost` | `gray \| blue \| green \| amber \| red \| violet` |
| Alert | — | `gray \| blue \| green \| amber \| red` |
| Dialog icon color | — | `amber \| blue \| red \| green` (`DialogTheme`) |
| Avatar | — | `gray \| blue \| green \| amber \| red \| violet` |
| FormControl | `subtle \| outline` | — |

No component accepts `intent`, `kind`, `severity`, `appearance`, or **`orange`**
(`Badge`'s warm tone is `amber`, not `orange` — `Badge theme="orange"` renders nothing).

## Icons

Icons are CSS mask classes, not SVGs. A bare value like `"home"` (no `lucide-`
prefix) renders nothing.

```vue
<!-- Inline span (most common) -->
<span class="lucide-edit size-4" aria-hidden="true" />

<!-- Via Icon component -->
<Icon icon="lucide-edit" />   <!-- icon prop is canonical -->
<Icon name="lucide-edit" />   <!-- name remains supported -->

<!-- Via icon prop on Button/Alert/Dialog/Dropdown options -->
<Button icon="lucide-edit" label="Edit" />
```

`Badge` has **no `icon` prop** — place the span in the `#prefix` or `#suffix` slot.

## Slot contracts

| Component | Trigger slot | Content slot | Notes |
|---|---|---|---|
| Popover | `#trigger` | default | (NOT `#target` / `#body` — those were v0) |
| Tooltip | **default** (the wrapped element) | `#content` | Unique inversion: trigger is default |
| HoverCard | `#trigger` | default | — |
| Dropdown / ContextMenu | default or `#trigger` | `options` prop | `#item-prefix`, `#item-suffix`, `#group-label`, `#empty` |
| Dialog | — (v-model:open) | default | `#title`, `#actions` |
| **PageHeader** | — | **default only** | `#prefix`/`#suffix` templates **silently discard content** |
| PageHeaderMobile | — | default (centered title) | `#prefix`, `#suffix` work here |

> **`<PageHeader><template #suffix>…</template></PageHeader>`** renders nothing.
> All header content — including action buttons — must go in the default slot.
> This is failure mode A3 in the 2026-08 audit.

## Dialog and Toast imperative APIs

```ts
import { dialog, toast } from 'frappe-ui'

// ✓ valid
dialog.confirm({ title, message, confirmLabel, onConfirm: async (ctx) => {} })
dialog.danger({ title, message, onConfirm: async (ctx) => {} })   // red, "Delete" default
dialog.prompt({ title, fields: [...], onConfirm: ({ values, close }) => {} })

// ✗ dialog.alert(...)  — does NOT exist; throws TypeError at runtime
// src/utils/dialog.ts exports only { confirm, prompt, danger }
```

All three return `{ close }` **synchronously** — they do NOT return a Promise
and never resolve one. `onConfirm` receives `ctx = { close, setError }`. Call
`setError('message')` to show an inline error. Resolving `onConfirm` closes the
dialog; throwing renders the error inline and re-enables the buttons.

```ts
toast.success('Saved', { id: 'contact-saved' })   // same id replaces in place
toast.error('Failed')
toast.dismiss('contact-saved')
// duration is in milliseconds (default ~4000)
```

Toasts report what already happened. Decisions go to `dialog.confirm` / `dialog.danger`.
One action, one toast — pass a stable `id` when the same record can be saved
multiple times so the toast replaces itself rather than stacking.

## Data-fetching composable contracts

| Composable | Key field | `refetch` default | Notes |
|---|---|---|---|
| `useCall` | `data` | `false` | `immediate: true` fires on mount |
| `useList` | `data` | **`true`** | auto-refetches when `filters` / `orderBy` change |
| `useDoc` | **`doc`** (NOT `data`) | n/a | shared reactive store |
| `useNewDoc` | `doc` (draft) + `data` (insert result) | n/a | `submit()` inserts |
| `useDoctype` | none | n/a | write helpers only: `insert`, `delete`, `setValue`, `runDocMethod`, `runMethod` |

**`cacheKey` is NOT reactive.** It is stringified once at setup; a `Ref` inside
it is not unwrapped. For calls with a reactive `url` keyed by route id, either
omit `cacheKey` or key the component with `:key="id"` so the composable
re-creates when the id changes.

**`useDoc` accepts no `cacheKey`, `refetch`, `params`, `initialData`, `onSuccess`, or `onError` option.**
Documents share state through the reactive store; subscribe with the returned
`onSuccess(callback)` instead.

**`useList.start` and `.limit` are readonly.** Page with `next()` / `previous()`;
do not assign them directly.

## Dropdown options — group shape

```ts
// ✓ correct
{ group: 'Manage', options: [{ label: 'Edit', onClick }] }

// ✗ WRONG — `items` is typed `never`; renders nothing, no console error
{ group: 'Manage', items: [{ label: 'Edit', onClick }] }
```

This is failure mode A5 in the 2026-08 audit.

## LoadingText vs Skeleton

`LoadingText` renders a spinner beside one line of text. It has **no `:lines` prop**.

| Need | Component |
|---|---|
| Spinner + label | `<LoadingText text="Syncing…" />` |
| Animated placeholder block | `<Skeleton class="h-4 w-40" />` |
| Inline spinner only | `<Spinner />` or `<LoadingIndicator />` |

`<LoadingText :lines="3">` silently ignores the `:lines` prop. This is failure
mode A1 / DESIGN.md:244 in the 2026-08 audit.

## app.use(FrappeUI) vs FrappeUIProvider

`app.use(FrappeUI)` is **optional** for new apps. It installs no injections by
default — only the v1 resources Options API when called as
`app.use(FrappeUI, { resources: true })`.

`<FrappeUIProvider>` is the piece you actually need — mount it once at the app
root. It mounts the `dialog.*` and `toast.*` portals.

```vue
<!-- App.vue -->
<script setup>
import { FrappeUIProvider } from 'frappe-ui'
</script>
<template>
  <FrappeUIProvider>
    <router-view />
  </FrappeUIProvider>
</template>
```

Mount **exactly one**. A second `FrappeUIProvider` (or bare `ToastProvider`)
renders every toast twice.

## Sources

- `apps/frappe-ui/src/components/Button/types.ts` — Size/Theme values (xs|sm|md|lg, gray|blue|green|red)
- `apps/frappe-ui/src/components/Badge/types.ts` — amber|violet theme; no icon prop
- `apps/frappe-ui/src/components/Dialog/types.ts` — v-model:open canonical; bare v-model also works
- `apps/frappe-ui/src/utils/dialog.ts` — confirm/danger/prompt; no alert
- `apps/frappe-ui/src/components/Tabs/types.ts` — modelValue (bare v-model, not v-model:tab)
- `apps/frappe-ui/src/components/Popover/Popover.vue` — #trigger/#default slots
- `apps/frappe-ui/src/components/PageHeader/PageHeader.vue` — default slot only
- `apps/frappe-ui/src/data-fetching/useDoc/useDoc.ts` — returns doc; no cacheKey option
- `apps/frappe-ui/src/data-fetching/useCall/useCall.ts` — cacheKey stringified once at setup
- `apps/frappe-ui/src/data-fetching/useList/useList.ts` — refetch defaults true
- `apps/frappe-ui/src/components/Menu/types.ts` — MenuGroupOption {group, options}; items is never
- `apps/frappe-ui/src/components/LoadingText/types.ts` — text prop only; no lines
- `apps/frappe-ui/src/utils/plugin.ts` — app.use(FrappeUI) optional; no injections
- `apps/frappe-ui/src/components/FrappeUIProvider/FrappeUIProvider.vue` — mounts toast/dialog portals
- `apps/frappe-ui/skills/frappe-ui/{CORE,DATA,SETUP}.md`, `evals/findings-2026-08.md` — verified contracts
- frappe-ui version 1.0.2
