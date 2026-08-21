# CREED

CREED is a browser-based infinite-canvas workbench with a Visual Studio Code/Codespaces-inspired shell. It combines an Explorer, multi-tab source viewer, infinite canvas, resizable bottom panel, secondary sidebar, persistent layout state, and a scalable virtualized source editor.

## Architecture rules

- CSS source lives under `css/`; application JavaScript lives under `js/`.
- Shared JavaScript infrastructure belongs in `js/core/`; shared UI helpers belong in `js/ui/`.
- Component behavior belongs in `js/components/<component>/`.
- Repository-root `main.js` is only the compatibility bootstrap; `js/main.js` is application orchestration.
- Editor-panel responsibilities are split across Explorer, tabs, per-tab session state, versioned workspace persistence, metadata, loading, worker analysis/search, rendering, virtual viewport, minimap, source navigation, and workbench orchestration.
- Each open source tab keeps independent session state: vertical/horizontal scroll position, Find query/options/current match, Find/Go To widget visibility, and last committed Go To line/column.
- Editor workspace state is persisted in `creedEditorWorkspace.v1` and restores open tabs, tab order, the active tab, and each surviving tab session across browser reloads.
- Persisted file names are intersected with the generated `WORKSPACE_FILES` inventory; missing, renamed, duplicate, or deleted files are dropped safely during normalization.
- Editor workspace persistence stores metadata only. Raw source text, source-analysis buffers, and complete search result arrays are not written to localStorage.
- Editor workspace storage is schema-versioned. Early unversioned snapshots migrate to v1; unknown future versions fail closed instead of being interpreted with an incompatible schema.
- Normal editor changes are persisted with a short debounce, while `pagehide` and hidden-document transitions force a synchronous flush before reload/navigation where possible.
- Explicitly closing a source tab removes its in-memory session and the next persistence write removes it from the browser-restored workspace.
- Large source files use visible-line virtualization and a capped minimap instead of one DOM node per source line.
- Source analysis at or above 64 KiB uses a module Web Worker; small files and worker failures use the same pure synchronous fallback.
- Whole-file search is bounded to 5,000 returned matches and supports Match Case, Whole Word, and Regular Expression modes.
- `Ctrl/Cmd+F` opens the non-blocking Find widget. `Enter` / `F3` moves forward, `Shift+Enter` / `Shift+F3` moves backward, and `Alt+C` / `Alt+W` / `Alt+R` toggle Match Case / Whole Word / Regex.
- `Ctrl/Cmd+G` opens the non-blocking Go To Line/Column widget. `:line` and `:line:column` preview navigation live against the virtual viewport.
- `Escape` closes the active source-navigation widget.
- Internal ES-module imports do not use manual cache-version query strings.
- After adding, renaming, or deleting files, regenerate `js/components/editor-panel/source-files.js` with `npm run build:inventory`.

## Development commands

```bash
npm run build
npm run check
```

Focused commands:

```bash
npm run build:frame
npm run build:css
npm run build:inventory
npm run check:history
npm run check:render
npm run check:terminal
npm run check:snapping
npm run check:quick-open
npm run check:navigation
npm run check:accessibility
```

`npm run check` verifies generated frame/CSS freshness, JavaScript syntax/import integrity, DOM wiring, Explorer inventory freshness, pointer-capture recovery, JS colony boundaries, editor responsibility boundaries, virtualization bounds, worker contracts, bounded whole-file search, advanced Find modes, non-blocking source-navigation wiring, Go To parsing, command history, render scheduling, terminal commands, world-space snapping, Quick Open, canvas navigation, accessibility navigation, and editor-workspace schema/migration/localStorage behavior.

## Repository structure

The authoritative complete file inventory is generated into:

```text
js/components/editor-panel/source-files.js
```

Do not maintain a second exhaustive file list in this README. That previously allowed the documentation tree to drift behind the actual repository. Run `npm run build:inventory` after adding, renaming, or deleting files; `npm run check` rejects a stale Explorer inventory.

Current architecture:

```text
CREED/
├── .github/
│   └── workflows/
│       └── ci.yml
├── AGENTS.md
├── README.md
├── index.html
├── main.js
├── package.json
├── css/
│   ├── creed-main.css
│   ├── foundation/
│   ├── primitives/
│   ├── layout/
│   ├── components/
│   └── generated/
│       └── creed.css
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── command-engine.js
│   │   ├── config.js
│   │   ├── coordinates.js
│   │   ├── elements.js
│   │   ├── state.js
│   │   └── storage.js
│   ├── ui/
│   │   ├── accessibility.js
│   │   ├── icons.js
│   │   ├── render-scheduler.js
│   │   ├── toast.js
│   │   ├── ui.js
│   │   └── unavailable-controls.js
│   └── components/
│       ├── bottom-panel/
│       │   ├── bottom-panel-input.js
│       │   ├── bottom-panel-main.js
│       │   └── terminal-session.js
│       ├── editor-panel/
│       │   ├── editor-panel-main.js
│       │   ├── editor-session-state.js
│       │   ├── editor-tabs.js
│       │   ├── editor-workspace-storage.js
│       │   ├── explorer-controller.js
│       │   ├── file-metadata.js
│       │   ├── minimap-controller.js
│       │   ├── quick-open.js
│       │   ├── source-analysis-client.js
│       │   ├── source-analysis-worker.js
│       │   ├── source-analysis.js
│       │   ├── source-files.js
│       │   ├── source-loader.js
│       │   ├── source-navigation.js
│       │   ├── source-renderer.js
│       │   ├── source-viewport.js
│       │   └── workbench-input.js
│       ├── infinite-canvas/
│       │   ├── anchors.js
│       │   ├── canvas-navigation.js
│       │   ├── card-input.js
│       │   ├── grid-lod.js
│       │   ├── infinitecanvas-main.js
│       │   ├── json-file.js
│       │   ├── keyboard.js
│       │   ├── pan-input.js
│       │   ├── reset-input.js
│       │   ├── sidebar-input.js
│       │   ├── snapping.js
│       │   ├── viewport.js
│       │   └── wheel-input.js
│       ├── panel-resize/
│       │   └── panel-resize-input.js
│       ├── primary-sidebar/
│       └── secondary-sidebar/
├── scripts/
│   ├── build-css.mjs
│   ├── build-main-frame.mjs
│   ├── build-source-files.mjs
│   ├── check-accessibility-navigation.mjs
│   ├── check-architecture.mjs
│   ├── check-canvas-navigation.mjs
│   ├── check-command-history.mjs
│   ├── check-editor-workspace.mjs
│   ├── check-quick-open.mjs
│   ├── check-render-scheduler.mjs
│   ├── check-snapping.mjs
│   └── check-terminal-session.mjs
└── ui/
    ├── main-frame.html
    └── bars/
        ├── bar-registry.json
        ├── activity-bar/
        ├── bottom-panel/
        ├── editor-breadcrumbs/
        ├── editor-tabs/
        ├── primary-sidebar-footer/
        ├── primary-sidebar-header/
        ├── restricted-mode/
        ├── secondary-sidebar-footer/
        ├── secondary-sidebar-header/
        ├── status-bar/
        ├── title-bar/
        └── workspace/
```

## File relationship entry graph

This section intentionally records stable entry/build relationships rather than duplicating every internal import. The complete relative import graph is validated by `scripts/check-architecture.mjs`.

```text
ui/main-frame.html
├── build-time slots declared by ui/bars/bar-registry.json
└── scripts/build-main-frame.mjs
    └── index.html

css/creed-main.css
└── scripts/build-css.mjs
    └── css/generated/creed.css
        └── index.html <link>

index.html
└── main.js <script type="module">
    └── js/main.js
        ├── js/core/
        ├── js/ui/
        └── js/components/

scripts/build-source-files.mjs
└── js/components/editor-panel/source-files.js
    └── Explorer workspace inventory
```

The bar registry is the source of truth for build-time bar templates, CSS ownership, and behavior owners. CSS colonies remain owned by their component entry files, while application behavior remains under `js/components/` or `js/ui/`.
