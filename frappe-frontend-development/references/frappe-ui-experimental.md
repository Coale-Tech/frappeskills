# Experimental Components (`frappe-ui/experimental`)

**Stability: NONE.** Every export here can change shape or be removed without a
deprecation cycle. P14 in `PHILOSOPHY.md` states this explicitly. Never import
from `frappe-ui/experimental` in production app code unless you are willing to
own the migration when the API changes or the component is deleted.

```ts
import { SomeComponent } from 'frappe-ui/experimental'
```

Components move here from the root export when their API isn't final yet, or
while a replacement is being built. Each section below names the replacement
and the tracking issue.

---

## Accordion

```ts
import { Accordion, type AccordionItem, type AccordionProps } from 'frappe-ui/experimental'
```

A disclosure widget for collapsible content panels. Built on reka-ui
`AccordionRoot`. **Incubating** — API under review before a stable release.

`AccordionProps`: `items: AccordionItem[]`, `type?: 'single' | 'multiple'`
(default `'single'`), `collapsible?: boolean`. `AccordionItem`: `{ value,
label, icon?, disabled?, default slot content }`.

(`experimental/Accordion/`)

---

## Calendar

```ts
import {
  Calendar,
  CalendarColorMap, CalendarActiveEvent, calendarDaySpan,
  type CalendarConfig, type CalendarEvent, type CalendarMode,
  type CalendarPublicProps, type CalendarRowSlotProps,
} from 'frappe-ui/experimental'
```

Month/week calendar for rendering scheduled events. Moved out of root (`#1020`,
redirect of `#989`) — parked here, API unchanged, until a redesigned calendar
family replaces it. Migration is an import-path change only.

`CalendarPublicProps`: `config` (`CalendarConfig`), `events` (`CalendarEvent[]`).
`CalendarMode`: `'month' | 'week' | 'day'`. Slots: `#event-row` (slot props
`CalendarRowSlotProps`: `{ event, row, day }`), `#header`, `#cell`.

(`experimental/Calendar/`)

---

## Charts (v1 experimental family)

```ts
import {
  AxisChart, DonutChart, FunnelChart, NumberChart, ECharts,
} from 'frappe-ui/experimental'
```

Moved out of root (`#942`) — `frappe-ui/charts` is the replacement and covers
everything these drew. Parked here, unstable, as an interim import path while
apps migrate. Migration is an import-path change only.

For new code use `frappe-ui/charts`. These components stay in
`frappe-ui/experimental` only for apps mid-migration.

(`experimental/Charts/`)

---

## CommandPalette

```ts
import {
  CommandPalette,
  CommandPaletteInput,
  CommandPaletteList,
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteEmpty,
  CommandPaletteFooter,
  type CommandPaletteProps,
  type CommandPaletteValue,
  type CommandPaletteSelectEvent,
  // … other type exports
} from 'frappe-ui/experimental'
```

The root `CommandPalette` was removed in `1.0.0` and rebuilt here as seven
composable parts. Unstable: the parts stay here until the docs site,
Gameplan, and Helpdesk all run on them.

**Parts**: `CommandPalette` (root wrapper + keyboard wiring),
`CommandPaletteInput` (search field), `CommandPaletteList` (scroll container),
`CommandPaletteGroup` (labelled section), `CommandPaletteItem` (row, takes
`value`/`label`/`icon`, emits `select`), `CommandPaletteEmpty` (empty state),
`CommandPaletteFooter` (action row for keyboard hints).

```vue
<CommandPalette v-model:open="open" @select="onSelect">
  <CommandPaletteInput placeholder="Search…" />
  <CommandPaletteList>
    <CommandPaletteGroup label="Recent">
      <CommandPaletteItem v-for="item in results" :key="item.id"
        :value="item.id" :label="item.label" icon="lucide-file" />
    </CommandPaletteGroup>
    <CommandPaletteEmpty>No results.</CommandPaletteEmpty>
  </CommandPaletteList>
</CommandPalette>
```

(`experimental/CommandPalette/`)

---

## DateCalendar / DateRangeCalendar

```ts
import {
  DateCalendar, DateRangeCalendar,
  type DateCalendarProps, type DateCalendarEmits, type DateCalendarExposed,
  type DateRangeCalendarProps, type DateRangeCalendarEmits, type DateRangeCalendarExposed,
} from 'frappe-ui/experimental'
```

The calendar panels inside `DatePicker` / `DateRangePicker`, exposed as
standalone components. **Incubating** — props and events are still settling.
Use the full `DatePicker`/`DateRangePicker` components for production; reach
for these only when you need the calendar panel without the input.

(`src/components/DatePicker/DateCalendar.vue`, `DateRangeCalendar.vue`)

---

## FloatingWindow

```ts
import { FloatingWindow } from 'frappe-ui/experimental'
// useFloatingWindow is internal — not exported
```

A draggable/resizable floating panel with dock/float/minimize modes. Mode is
a `v-model:mode` (`'docked' | 'floating' | 'minimized'`). **Incubating.**

Props: `title?: string`, `storageKey?: string | null` (persists `{ mode,
rect }` to localStorage; `null` disables), `minimizable?: boolean` (default
`true`).

Slots:
- `#default({ mode })` — scrollable body
- `#footer({ mode })` — pinned below the body (composer / action bar)
- `#header({ mode, dock, float, minimize, expandFromTray })` — replaces
  the built-in title bar entirely; becomes the drag handle
- `#actions({ mode, dock, float, minimize })` — extra controls before the
  built-in window buttons

```vue
<FloatingWindow v-model:mode="mode" title="AI Chat" storage-key="ai-chat-window">
  <template #default>…body…</template>
  <template #footer>…composer…</template>
</FloatingWindow>
```

(`experimental/FloatingWindow/`)

---

## ListView (legacy family)

```ts
import {
  ListView, List,          // ListView and List are the same component
  ListEmptyState, ListFooter,
  ListGroupHeader, ListGroupRows, ListGroups,
  ListHeader, ListHeaderItem,
  ListRow, ListRowItem, ListRows,
  ListSelectBanner,
} from 'frappe-ui/experimental'
```

The config-driven list family. Moved from the root export to
`frappe-ui/experimental` `(1.0.2)` — **not deprecated**: the source
explicitly preserves it until `frappe-ui/list` reaches parity (grouping,
footer/pagination, resizable columns, select-banner). Migration is an
import-path change only.

Prefer `frappe-ui/list` for new code. Reach for this family when you need
grouped rows, built-in pagination footer, resizable columns, or a bulk-
selection banner today.

Full prop/slot/emit tables: [frappe-ui-list-and-editor.md](frappe-ui-list-and-editor.md).

(`experimental/ListView/`)

---

## MultiEmailInput

```ts
import { MultiEmailInput } from 'frappe-ui/experimental'
```

Email-address chip input: validates RFC-compliant addresses, renders each
as a removable chip, supports paste of comma-separated addresses.
**Incubating** — API under review.

`v-model` is `string[]` (email addresses). Props: `label`, `description`,
`error`, `required` (P5); `placeholder`.

(`experimental/MultiEmailInput/`)

---

## PickerShell

```ts
import {
  PickerShell,
  type PickerShellProps, type PickerShellSlots,
  type PickerShellTriggerSlotProps, type PickerShellExposed,
} from 'frappe-ui/experimental'
```

The input half of the date pickers as a standalone: a `TextInput`, a
`Popover`, and the focus wiring between them. **Incubating** — props and
slots are still settling.

(`src/components/shared/picker/PickerShell.vue`)

---

## Stepper

```ts
import {
  Stepper,
  type StepItem, type StepState, type StepValue,
  type StepperEdge, type StepperProps, type StepperSize,
  type StepSlotProps,
} from 'frappe-ui/experimental'
```

Horizontal or vertical step indicator for multi-step workflows (wizard,
progress, pipeline). **Incubating** — API under review before freeze.

`StepperProps`: `steps: StepItem[]`, `v-model` (active step value),
`size?: StepperSize` (`'sm' | 'md' | 'lg'`, default `'md'`), `orientation?`
(`'horizontal' | 'vertical'`). `StepItem`: `{ value, label, description?,
state: StepState }`. `StepState`: `'pending' | 'current' | 'completed' | 'error'`.

Slot `#step({ step, isActive, isCompleted, isError })` overrides the step indicator.

(`experimental/Stepper/`)

---

## SpriteIcons

```ts
import { Icon, IconPicker } from 'frappe-ui/experimental'
// spritePlugin is a Vite plugin, import from 'frappe-ui/experimental'
```

Legacy SVG sprite icon trio. Moved from `frappe-ui/icons` (`#904`) —
`lucide-*` CSS classes and the root `Icon` component are the canonical
replacement. Will be removed.

(`experimental/SpriteIcons/`)

---

## TextEditor (deprecated)

```ts
import {
  TextEditor,
  TextEditorBubbleMenu, TextEditorFixedMenu,
  TextEditorFloatingMenu, TextEditorContent,
  createEditorButton,
  ImageExtension, type SetImageOptions,
  createSuggestionExtension, type BaseSuggestionItem,
  type CreateSuggestionExtensionOptions,
} from 'frappe-ui/experimental'
```

The 0.1.x rich-text editor. Moved from root (`#974`) and deprecated —
`frappe-ui/editor` (`<Editor>` + kits) is the replacement. Parked here
`(1.0.2)` while apps migrate. Deletion is human-gated (`spec/editor.md §12`).

Migration guide: [frappe-ui-list-and-editor.md](frappe-ui-list-and-editor.md#migration).

(`experimental/TextEditor/`)

---

## ThemeSwitcher (deprecated)

```ts
import { ThemeSwitcher } from 'frappe-ui/experimental'
```

Moved from root (`#1094`). Deprecated — `<Select>` bound to
`useColorScheme()` is the replacement. Renders a reka-ui `RadioGroupRoot` of
color-scheme preview cards; use the composable approach instead.

(`experimental/ThemeSwitcher/`)

---

## `inputFontSizeClasses` / `InputLabel` / `InputDescription` / `InputError` / `useInputLabeling`

```ts
import {
  inputFontSizeClasses,
  InputLabel, InputDescription, InputError,
  useInputLabeling,
} from 'frappe-ui/experimental'
```

Internal input-labeling primitives (`InputLabel`, `InputDescription`,
`InputError`) and the shared Combobox font-size helper. Incubating. Only
needed when building a custom input that must match frappe-ui's own labeling
layout exactly.

---

## Sources

Verified against frappe-ui `1.0.2` (`apps/frappe-ui/package.json`):

- `apps/frappe-ui/experimental.ts` — all re-exports with inline comments naming the tracking issue and replacement
- `apps/frappe-ui/experimental/Accordion/index.ts`, `Accordion.vue`, `types.ts`
- `apps/frappe-ui/experimental/Calendar/index.ts`, `types.ts`
- `apps/frappe-ui/experimental/Charts/index.ts`
- `apps/frappe-ui/experimental/CommandPalette/index.ts`, `CommandPalette.vue`, `types.ts`
- `apps/frappe-ui/experimental/FloatingWindow/FloatingWindow.vue` — props, slots, `WindowMode` type
- `apps/frappe-ui/experimental/ListView/index.ts` — `ListView` family; `List` and `ListView` are the same export
- `apps/frappe-ui/experimental/MultiEmailInput/MultiEmailInput.vue`, `types.ts`
- `apps/frappe-ui/experimental/Stepper/index.ts`, `types.ts`
- `apps/frappe-ui/experimental/SpriteIcons/index.ts`
- `apps/frappe-ui/experimental/TextEditor/index.ts`, `extensions/image/index.ts`, `extensions/suggestion/createSuggestionExtension.ts`
- `apps/frappe-ui/experimental/ThemeSwitcher/index.ts`
- `apps/frappe-ui/src/components/DatePicker/DateCalendar.vue`, `DateRangeCalendar.vue`, `calendarTypes.ts`
- `apps/frappe-ui/src/components/shared/picker/PickerShell.vue`, `types.ts`
- `apps/frappe-ui/src/components/Combobox/utils.ts` — `inputFontSizeClasses`
- `apps/frappe-ui/src/components/InputLabeling/` — `InputLabel`, `InputDescription`, `InputError`
- `apps/frappe-ui/src/composables/useInputLabeling.ts`
- `apps/frappe-ui/PHILOSOPHY.md` P14 — experimental stability promise
