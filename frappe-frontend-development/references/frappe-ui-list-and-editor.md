# List and Rich-Text Editor

frappe-ui ships two overlapping list families and two overlapping rich-text
families. This page picks the canonical one for new v1 code and documents the
still-supported alternative so existing code isn't misdiagnosed as wrong.

## List: which family to use

| | `frappe-ui/list` `(v1)` | `ListView` (experimental `(1.0.2)`) |
|---|---|---|
| Import | `import { List, ListRows, ... } from 'frappe-ui/list'` | `import { ListView } from 'frappe-ui/experimental'` |
| Shape | Composition primitives (`List` + `ListRows` + `ListRow` + `ListCell`) | One config-driven component (`:columns`, `:rows`, `:options`) |
| Status | New in v1; the forward direction | **Not deprecated.** Source explicitly keeps it until `frappe-ui/list` reaches feature parity (grouping, footer/pagination, resize-column, select-banner). Moved from the root export to `frappe-ui/experimental` `(1.0.2)`. |
| Grouping, footer/pagination, resizable columns, select-banner | Not yet (roll your own) | Built in (`ListGroup(s)`, `ListFooter`, `resizeColumn`, `ListSelectBanner`) |
| Virtualization | `virtual` prop on `ListRows` (boolean) | Not built in |

Pick `frappe-ui/list` for new feed/table UI without heavy chrome (settings
lists, simple record tables, master-detail panes). Reach for `ListView` when
you need grouped rows, built-in pagination footer, resizable columns, or a
bulk-selection banner today — its API is stable, not a deprecated fallback.
Both are present in 1.0.2 (ListView via `frappe-ui/experimental`); only `ListView` is present in the 0.1.261
baseline.

## `frappe-ui/list` `(v1)`

One column grid: a feed row is the default column template
(`['auto', 'minmax(0,1fr)', 'auto']`); a table passes explicit `columns`. The
family owns geometry (columns, dividers, hover, selection, sort chrome); cell
contents (typography, avatars, badges) are entirely app-authored.

```ts
import {
  List, ListRow, ListCell, ListHeader, ListHeaderCell,
  ListHeaderCellSort, ListRows, ListGroup,
} from 'frappe-ui/list'
```

### Feed mode

```vue
<script setup>
import { List, ListRow, ListCell, ListRows } from 'frappe-ui/list'
import { useList } from 'frappe-ui'

const leads = useList({ doctype: 'CRM Lead', fields: ['name', 'lead_name', 'status'] })
const selection = ref([])
</script>

<template>
  <List v-model:selection="selection" selectable>
    <ListRows :items="leads.data ?? []" v-slot="{ item, value }">
      <ListRow :value="value" :to="`/leads/${value}`">
        <ListCell>
          <Avatar :label="item.lead_name" size="sm" />
          <span>{{ item.lead_name }}</span>
        </ListCell>
        <ListCell class="justify-end">
          <Badge :label="item.status" theme="gray" />
        </ListCell>
      </ListRow>
    </ListRows>
  </List>
</template>
```

`List` props: `columns` (`string[]` track sizes), `divider` (`'inset' |
'full'`, default `inset` for the feed template / `full` once `columns` is
set), `selectable` (reveals the animated checkbox column, switches row click
to toggle, drives `v-model:selection`), `rowHeight` (px; required for
virtualization), `selection` (`string[]`), `active` (single-select row key,
`v-model:active`). Emits `update:selection`, `update:active`.

`ListRow` props: `to` (renders a RouterLink), `value` (the row key used by
selection/active state — required whenever the list uses either), `onClick`.
Without `to`, a row with a click listener renders as a button, otherwise a
plain `div`.

`ListRows` props: `items` (required), `rowKey` (string field name or
`(item, index) => key`; defaults to `name`, then `id`, then index),
`virtual` (`boolean`; activates row windowing via the internal `useVirtualRows` — not a public export). Scoped slot: `{ item, index, value }`.

### Active row (master-detail)

```vue
<List v-model:active="openId">
  <ListRows :items="threads" v-slot="{ value }">
    <ListRow :value="value">…</ListRow>
  </ListRows>
</List>
```

Activation is additive (unlike `selectable`): the row's own `@click`/`to`
navigation still fires. Single-select, independent of `selection`.

### Column mode with sortable header

```vue
<script setup>
const sortField = ref('modified')
const sortDir = ref('desc')
function toggleSort(field) {
  if (sortField.value !== field) { sortField.value = field; sortDir.value = 'desc'; return }
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
}
</script>

<template>
  <List :columns="['minmax(8rem,1fr)', '7rem', '9rem']">
    <ListHeader>
      <ListHeaderCell>Name</ListHeaderCell>
      <ListHeaderCellSort
        align="end"
        :direction="sortField === 'amount' ? sortDir : null"
        @click="toggleSort('amount')"
      >
        Amount
      </ListHeaderCellSort>
      <ListHeaderCellSort
        :direction="sortField === 'modified' ? sortDir : null"
        @click="toggleSort('modified')"
      >
        Modified
      </ListHeaderCellSort>
    </ListHeader>
    <ListRows :items="deals" v-slot="{ item, value }">
      <ListRow :value="value">
        <ListCell>{{ item.name }}</ListCell>
        <ListCell class="justify-end">{{ item.amount }}</ListCell>
        <ListCell>{{ item.modified }}</ListCell>
      </ListRow>
    </ListRows>
  </List>
</template>
```

`ListHeaderCellSort` is a **controlled** sort button — you own sort state,
toggle rules, and (for server ordering) feeding `sortField`/`sortDir` into
`useList`'s `orderBy`. Props: `direction` (`'asc' | 'desc' | null`), `align`
(`'start' | 'end'`, `'end'` also flips the glyph to the leading side). Emits
`click`.

### Virtual rows

```vue
<List :row-height="48">
  <ListRows :items="bigList" virtual v-slot="{ item, value }">
    <ListRow :value="value">{{ item.name }}</ListRow>
  </ListRows>
</List>
```

Only rows near the viewport mount (windowed via the internal `useVirtualRows`).
The scroll container is resolved as the nearest scrollable ancestor; the list
windows against an app-owned scroll area, not its own.

### Styling hooks

CSS vars: `--list-columns`, `--list-gap` (default `0.5rem`),
`--list-row-padding-x` (default `0.75rem`, shared by rows and header). The
Tailwind preset ships `list-gap-*` / `list-row-px-*` utilities. `data-slot`
values for targeting: `list`, `list-header`, `list-header-cell`, `list-row`,
`list-cell`, `list-row-checkbox`, `list-divider`. State attributes:
`data-state="selected"`, `data-active` (+ `aria-current`), `data-interactive`,
`data-sort`.

(`src/molecules/list/`)

## `ListView` (experimental — `frappe-ui/experimental` `(1.0.2)`)

```vue
<script setup>
import { ListView } from 'frappe-ui/experimental'

const columns = [
  { label: 'Name', key: 'lead_name', width: 3 },
  { label: 'Status', key: 'status', width: 1 },
]
</script>

<template>
  <ListView
    :columns="columns"
    :rows="leads.data ?? []"
    row-key="name"
    :options="{ selectable: true, getRowRoute: (row) => `/leads/${row.name}` }"
  >
    <template #cell="{ item, row, column }">
      <Badge v-if="column.key === 'status'" :label="item" theme="gray" />
      <span v-else>{{ item }}</span>
    </template>
  </ListView>
</template>
```

Props: `columns` (`unknown[]`, default `[]`), `rows` (`unknown[]`, default
`[]`), `rowKey` (**required** `string`), `options` — an object merged over
these defaults: `{ getRowRoute: null, onRowClick: null, showTooltip: true,
selectable: true, resizeColumn: false, rowHeight: 40, emptyState: { title:
'No Data', description: 'No data available' } }`. Emits `update:selections`,
`update:active-row`. Default slot receives `{ showGroupedRows, selectable }`.

**Per-cell rendering is one scoped `#cell` slot receiving `{ item, row,
column }`** — switch on `column.key` inside it, as above. `ListView` has
**no dynamic per-column named slots** (there is no `#status` or `#name`
slot); every cell customization goes through `#cell`. `ListRowItem`'s
`default` slot similarly receives `{ label }`, not a per-column name.

Sub-components (all under `src/components/ListView/`, importable individually
for hand-built layouts): `ListEmptyState`, `ListFooter` (`modelValue` page
length, `options.{rowCount,totalCount,pageLengthOptions}`, slots
`#left`/`#right`, emits `update:modelValue`/`loadMore`), `ListGroupHeader`
(`group` prop), `ListGroupRows`, `ListGroups` (slot `#group-header`),
`ListHeader`, `ListHeaderItem` (`item` prop, slots `#prefix`/`#suffix`/
`#resizer`, emits `columnWidthUpdated`), `ListRow` (`row` prop, default slot
`{ idx, column, item, isActive }`), `ListRowItem`, `ListRows`,
`ListSelectBanner` (slots `#default`/`#actions` receiving `{ selections,
allRowsSelected, selectAll, unselectAll }`).

(`src/components/ListView/`)

## Rich text: which family to use

| | `frappe-ui/editor` `(v1)` | `TextEditor` (deprecated) |
|---|---|---|
| Import | `import { Editor, useEditor, RichTextKit } from 'frappe-ui/editor'` | `import { TextEditor } from 'frappe-ui/experimental'` `(1.0.2)` |
| Shape | Renderless `<Editor>` + `useEditor` composable + composable kits | One opinionated SFC with a fixed/bubble menu |
| Status | v1 canonical | **`@deprecated`** — use `frappe-ui/editor` instead. Parked in `frappe-ui/experimental` `(1.0.2)`; will be removed. |
| Present in 0.1.261 | No | Yes (this is the 0.1.x API) |

## `frappe-ui/editor` `(v1)`

`Editor` is renderless: it wraps `useEditor` (the TipTap engine) and exposes
`{ editor, isEmpty }` through its default scoped slot and via
`defineExpose`, so the app owns 100% of the chrome.

```vue
<script setup>
import { Editor, EditorContent, EditorFixedMenu, RichTextKit } from 'frappe-ui/editor'
import { minimalToolbar } from 'frappe-ui/editor'

const extensions = [RichTextKit.configure({ placeholder: 'Write something…' })]
</script>

<template>
  <Editor
    v-model="content"
    :extensions="extensions"
    format="html"
    :editable="true"
    @change="onChange"
  >
    <template #default="{ editor }">
      <EditorFixedMenu :editor="editor" :items="minimalToolbar" />
      <EditorContent :editor="editor" />
    </template>
  </Editor>
</template>
```

`Editor` props: `extensions` (required, TipTap extension array — normally one
or more configured kits), `format` (`'html' | 'json' | 'markdown'`, default
`'html'`, reactive), `placeholder` (reactive), `editable` (reactive),
`autofocus` (one-shot on mount), `uploadFunction`. `v-model` binds content in
the shape `format` names. Emits `change`, `focus`, `blur`, `transaction`.

Building blocks composed inside the default slot: `EditorContent` (renders
the document), `EditorFixedMenu`, `EditorBubbleMenu`, `EditorFloatingMenu`
(toolbars — each takes `:editor` and an `:items` array of `MenuItem`s),
`EditorTableMenu` (the table-context toolbar), `EditorDropZone` (drag-and-drop
file target for image/video/attachment).

### Kits

Kits are TipTap extension bundles with a typed `.configure()`:

- `StarterKit` — baseline nodes/marks (paragraph, headings, lists, etc.).
- `InlineKit` — `{ starterKit, placeholder, link }`. For single-line/comment
  contexts that must stay inline.
- `CommentKit` — `{ starterKit, heading, placeholder, link, image,
  imageGroup, imageViewer, video, attachment, table (off by default),
  contentPaste, emoji, mention, tag }`. Comment-thread-shaped rich text.
- `RichTextKit extends CommentKit`, adding `{ taskList, iframe, toc,
  slashCommands, color, highlight, typography, textAlign, styleClipboard }`.
  Full document editing (articles, wiki pages).

```ts
const usersRef = ref<MentionSuggestionItem[]>([])
// populate usersRef from useList / createResource / etc.

const extensions = [
  RichTextKit.configure({
    mention: { items: usersRef },  // MaybeRefOrGetter<MentionSuggestionItem[]>
    table: true,
  }),
]
```

`MentionSuggestionItem`: `{ label: string; value: string; [extra: string]: any }`.
Results are ranked by query `(1.0.2)`: exact label match → label starts-with → any word starts-with, limited to 10.
`mention: false` disables the extension; passing `null` (or omitting `items`)
renders existing mentions but shows no suggestion menu.

Toolbar presets (arrays of `MenuItem` for the menu components):
`minimalToolbar`, `commentToolbar`, `articleToolbar`, `tableToolbar`. Command
building blocks (`Bold`, `Italic`, `Strike`, `InlineCode`, `BulletList`,
`OrderedList`, `Blockquote`, `Paragraph`, `H1`–`H6`, `HeadingGroup`,
`AlignLeft`/`Center`/`Right`, `FontColor`, `FontHighlight`, `InsertImage`,
`InsertVideo`, `InsertAttachment`, `InsertLink`, `InsertIframe`,
`InsertTable` + table controls, `HorizontalRule`, `Undo`, `Redo`,
`Separator`) compose custom toolbars when a preset doesn't fit.

### `useEditor` (L4 — headless)

`useEditor(options)` → `ShallowRef<TiptapEditor | null>` — builds the editor
without `<Editor>`. Use when the component's lifecycle doesn't fit (a global
editor, a non-SFC context). Options mirror `Editor` props plus lifecycle
callbacks (`onUpdate`, `onFocus`, `onBlur`, `onTransaction`). The caller owns
disposal; `onBeforeUnmount` is NOT called automatically.

```ts
import { useEditor, RichTextKit, type TiptapEditor } from 'frappe-ui/editor'

const editor = useEditor({
  content: myContentRef,
  format: 'html',
  extensions: [RichTextKit.configure({ mention: { items: usersRef } })],
  onUpdate(e) { /* sync */ },
})
```

(`src/molecules/editor/`)

## `frappe-ui/code-editor`

A CodeMirror 6 code editor, same compositional shape as `frappe-ui/editor`.

```ts
import {
  CodeEditor, CodeEditorContent,
  CodeKit, useCodeEditor,
  loadLanguage, codeChrome, codeHighlight, codeKeymap,
  type LanguageKey, type CodeEditorOptions, type CodeEditorExposed,
} from 'frappe-ui/code-editor'
```

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CodeEditor, CodeEditorContent, CodeKit, loadLanguage } from 'frappe-ui/code-editor'

const code = ref('')
const extensions = ref([CodeKit])

onMounted(async () => {
  const lang = await loadLanguage('python')  // dynamic import
  if (lang) extensions.value = [CodeKit, lang]
})
</script>

<template>
  <CodeEditor v-model="code" :extensions="extensions" @change="onCommit">
    <template #default="{ editor }">
      <CodeEditorContent :editor="editor" />
    </template>
  </CodeEditor>
</template>
```

`CodeEditor` props: `extensions` (required, `Extension[]`, reactive — a new
array is re-applied without recreating the view, so document/selection/history
survive a language change), `editable` (default `true`), `autofocus` (default
`false`). `v-model` is a `string`. Emits `change` (on blur), `focus`, `blur`.
Scoped slot: `{ editor: EditorView | null }`. `defineExpose`: `{ editor }`.

`LanguageKey`: `'json' | 'html' | 'javascript' | 'python' | 'sql' | 'markdown' | 'css' | 'scss' | 'yaml' | 'xml'`. `loadLanguage(key?)` dynamically imports the matching `@codemirror/lang-*` package and returns a `Promise<Extension | null>` (null = plain text / unknown key).

`CodeKit` is the one default extension bundle (chrome + highlight + keymap). Individual members: `codeChrome` (frappe-design-system gutter/border shell), `codeHighlight` (lowlight tree-sitter themes), `codeKeymap` (indent/dedent/comment keybindings). Use `CodeKit.configure({ member: false })` to remove members.

`useCodeEditor(options)` → `ShallowRef<EditorView | null>` — the L4 API; builds the view without `<CodeEditor>`. Options: `content` (Ref<string>), `extensions` (MaybeRefOrGetter<Extension[]>), `editable`, `autofocus`, `onChange`, `onFocus`, `onBlur`.

(`src/molecules/code-editor/`)

## `TextEditor` (deprecated — `frappe-ui/experimental` `(1.0.2)`)

`import { TextEditor } from 'frappe-ui/experimental'`

Still present and functional for migration, but new code should use
`frappe-ui/editor` above. This is the 0.1.261 API:

```vue
<template>
  <TextEditor
    v-model:content="content"
    editor-class="prose"
    :bubble-menu="true"
    :fixed-menu="['Bold', 'Italic', 'Link']"
    :mentions="fetchMentions"
    placeholder="Write something…"
  >
    <template #editor="{ editor }">
      <EditorContent :editor="editor" />
    </template>
  </TextEditor>
</template>
```

Props: `content` (`v-model`), `placeholder`, `editorClass`, `editable`,
`autofocus`, `bubbleMenu` (`boolean`), `bubbleMenuOptions`, `fixedMenu`
(array of button names), `floatingMenu`, `extensions` (appended to the
built-in set), `starterkitOptions`, `mentions`, `tags`. Slots: `#top`,
`#editor`, `#bottom`.

### Migration

| 0.1.x `TextEditor` | v1 `frappe-ui/editor` |
|---|---|
| `<TextEditor :content v-model:content extensions>` | `<Editor v-model :extensions>` + compose `EditorContent`/menus yourself |
| `fixedMenu: ['Bold', 'Italic', ...]` | `<EditorFixedMenu :items="minimalToolbar">` or a custom `MenuItem[]` |
| `bubbleMenu` / `bubbleMenuOptions` | `<EditorBubbleMenu :items="...">` |
| `starterkitOptions` | `RichTextKit.configure({ starterKit: {...} })` |
| `mentions` | `RichTextKit.configure({ mention: {...} })` |
| Built-in image/video/attachment extensions imported top-level | Bundled into `CommentKit`/`RichTextKit`; configure via `.configure({ image, video, attachment })` |

(`src/components/TextEditor/`)

## Sources

Verified against frappe-ui `1.0.2` (`apps/frappe-ui/package.json`):

- `apps/frappe-ui/src/molecules/list/List.vue`, `ListRows.vue`, `ListRow.vue`, `ListRowBase.vue`, `ListCell.vue`, `ListHeader.vue`, `ListHeaderCell.vue`, `ListHeaderCellSort.vue`, `ListGroup.vue`, `useVirtualRows.ts` (internal), `list-context.ts`, `types.ts`, `index.ts`, `list.api.md`
- `apps/frappe-ui/experimental/ListView/index.ts` — `ListView` and full legacy family exported from `frappe-ui/experimental`
- `apps/frappe-ui/src/molecules/editor/Editor.vue`, `EditorContent.vue`, `EditorFixedMenu.vue`, `EditorBubbleMenu.vue`, `EditorFloatingMenu.vue`, `EditorTableMenu.vue`, `EditorDropZone.vue` (components/), `kits.ts`, `menu.ts`, `extensions.ts`, `index.ts`, `useEditor.ts`, `SuggestionExtension.ts`
- `apps/frappe-ui/src/molecules/editor/extensions/mention/mention-extension.ts` — `items: MaybeRefOrGetter<MentionSuggestionItem[]>` (not `fetchSuggestions`), `rankByQuery` scorer (exact → starts-with → word-starts-with, 1.0.2)
- `apps/frappe-ui/src/molecules/editor/extensions/slash-commands/slash-commands-extension.ts` — `SlashCommandsOptions.items?: MaybeRefOrGetter<CommandItem[]>`
- `apps/frappe-ui/src/molecules/code-editor/CodeEditor.vue`, `CodeEditorContent.vue`, `index.ts`, `kit.ts`, `extensions.ts`, `languages.ts`, `useCodeEditor.ts`
- `apps/frappe-ui/experimental/TextEditor/index.ts` — deprecated family re-parked in `frappe-ui/experimental`
- `apps/frappe-ui/experimental.ts` — all experimental re-exports with comments naming the tracking issue
