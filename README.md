# CREED

CREED is a browser-based infinite-canvas workbench with a Visual Studio Code/Codespaces-inspired shell. It combines an Explorer, multi-tab source viewer, infinite canvas, resizable bottom panel, secondary sidebar, persistent layout state, and a scalable virtualized source editor.

## Architecture rules

- CSS source lives under `css/`; application JavaScript lives under `js/`.
- Shared JavaScript infrastructure belongs in `js/core/`; shared UI helpers belong in `js/ui/`.
- Component behavior belongs in `js/components/<component>/`.
- Repository-root `main.js` is only the compatibility bootstrap; `js/main.js` is application orchestration.
- Editor-panel responsibilities are split across Explorer, tabs, metadata, loading, worker analysis/search, rendering, virtual viewport, minimap, source navigation, and workbench orchestration.
- Large source files use visible-line virtualization and a capped minimap instead of one DOM node per source line.
- Source analysis at or above 64 KiB uses a module Web Worker; small files and worker failures use the same pure synchronous fallback.
- Whole-file literal search is worker-backed for large files and bounded to 5,000 returned matches.
- `Ctrl/Cmd+F` starts whole-file search, `F3` / `Shift+F3` moves between matches, `Ctrl/Cmd+G` navigates to `line[:column]`, and `Escape` clears the active search.
- Internal ES-module imports do not use manual cache-version query strings.
- After adding, renaming, or deleting files, regenerate `js/components/editor-panel/source-files.js` with `npm run build:inventory`.

## Development commands

```bash
npm run build
npm run check
```

Focused commands:

```bash
node scripts/build-css.mjs
node scripts/build-css.mjs --check
node scripts/build-source-files.mjs
node scripts/check-architecture.mjs
```

`npm run check` verifies generated CSS freshness, JavaScript syntax/import integrity, DOM wiring, Explorer inventory freshness, pointer-capture recovery, JS colony boundaries, editor responsibility boundaries, virtualization bounds, worker contracts, whole-file search bounds, and source navigation parsing/wiring.

## Current directory tree

```text
CREED/
├── AGENTS.md
├── README.md
├── css/
│   ├── creed-main.css
│   ├── foundation/
│   ├── primitives/
│   ├── layout/
│   ├── generated/
│   │   └── creed.css
│   └── components/
│       ├── activity-bar/
│       ├── bottom-panel/
│       ├── chat/
│       ├── editor-panel/
│       ├── explorer/
│       ├── feedback/
│       ├── infinite-canvas/
│       ├── primary-sidebar/
│       ├── restricted-mode/
│       ├── secondary-sidebar/
│       ├── source-editor/
│       ├── status-bar/
│       └── titlebar/
├── index.html
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── config.js
│   │   ├── coordinates.js
│   │   ├── elements.js
│   │   ├── state.js
│   │   └── storage.js
│   ├── ui/
│   │   ├── icons.js
│   │   ├── toast.js
│   │   ├── ui.js
│   │   └── unavailable-controls.js
│   └── components/
│       ├── bottom-panel/
│       │   ├── bottom-panel-input.js
│       │   └── bottom-panel-main.js
│       ├── editor-panel/
│       │   ├── editor-panel-main.js
│       │   ├── editor-tabs.js
│       │   ├── explorer-controller.js
│       │   ├── file-metadata.js
│       │   ├── minimap-controller.js
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
│       │   ├── card-input.js
│       │   ├── grid-lod.js
│       │   ├── infinitecanvas-main.js
│       │   ├── json-file.js
│       │   ├── keyboard.js
│       │   ├── pan-input.js
│       │   ├── reset-input.js
│       │   ├── sidebar-input.js
│       │   ├── viewport.js
│       │   └── wheel-input.js
│       ├── panel-resize/
│       │   └── panel-resize-input.js
│       ├── primary-sidebar/
│       │   ├── primary-sidebar-input.js
│       │   └── primary-sidebar-main.js
│       └── secondary-sidebar/
│           ├── secondary-sidebar-input.js
│           └── secondary-sidebar-main.js
├── main.js
├── package.json
└── scripts/
    ├── build-css.mjs
    ├── build-source-files.mjs
    └── check-architecture.mjs
```

## Current file relationship tree

```text
index.html
├── CSS
│   └── css/generated/creed.css
└── JavaScript
    └── main.js
        └── js/main.js
            ├── js/core/elements.js
            ├── js/ui/icons.js
            ├── js/ui/toast.js
            ├── js/ui/unavailable-controls.js
            ├── js/components/primary-sidebar/primary-sidebar-main.js
            │   └── js/components/primary-sidebar/primary-sidebar-input.js
            ├── js/components/secondary-sidebar/secondary-sidebar-main.js
            │   └── js/components/secondary-sidebar/secondary-sidebar-input.js
            ├── js/components/bottom-panel/bottom-panel-main.js
            │   └── js/components/bottom-panel/bottom-panel-input.js
            ├── js/components/panel-resize/panel-resize-input.js
            │   ├── js/core/state.js
            │   └── js/core/storage.js
            ├── js/components/editor-panel/editor-panel-main.js
            │   └── js/components/editor-panel/workbench-input.js
            │       ├── js/components/editor-panel/editor-tabs.js
            │       │   └── js/ui/icons.js
            │       ├── js/components/editor-panel/explorer-controller.js
            │       │   ├── js/components/editor-panel/source-files.js
            │       │   └── js/components/editor-panel/file-metadata.js
            │       ├── js/components/editor-panel/file-metadata.js
            │       ├── js/components/editor-panel/minimap-controller.js
            │       ├── js/components/editor-panel/source-loader.js
            │       ├── js/components/editor-panel/source-navigation.js
            │       └── js/components/editor-panel/source-viewport.js
            │           ├── js/components/editor-panel/file-metadata.js
            │           ├── js/components/editor-panel/source-analysis-client.js
            │           │   └── js/components/editor-panel/source-analysis.js
            │           └── js/components/editor-panel/source-renderer.js
            └── js/components/infinite-canvas/infinitecanvas-main.js
                ├── js/core/state.js
                ├── js/core/storage.js
                ├── js/ui/ui.js
                ├── js/ui/toast.js
                ├── js/components/infinite-canvas/viewport.js
                ├── js/components/infinite-canvas/anchors.js
                ├── js/components/infinite-canvas/pan-input.js
                ├── js/components/infinite-canvas/wheel-input.js
                ├── js/components/infinite-canvas/keyboard.js
                ├── js/components/infinite-canvas/sidebar-input.js
                ├── js/components/infinite-canvas/reset-input.js
                ├── js/components/infinite-canvas/card-input.js
                └── js/components/infinite-canvas/json-file.js

js/components/editor-panel/source-analysis-worker.js
└── js/components/editor-panel/source-analysis.js

css/creed-main.css
├── css/foundation/reset.css
├── css/foundation/design-tokens.css
├── css/foundation/themes.css
├── css/foundation/typography.css
├── css/foundation/accessibility.css
├── css/foundation/states.css
├── css/foundation/utilities.css
├── css/primitives/buttons.css
├── css/primitives/icon-buttons.css
├── css/primitives/inputs.css
├── css/primitives/menus.css
├── css/primitives/tabs.css
├── css/primitives/toolbars.css
├── css/primitives/scrollbars.css
├── css/primitives/icons.css
├── css/layout/app-shell-main.css
├── css/layout/workbench-main.css
├── css/layout/panel-layout.css
├── css/layout/panel-resize-main.css
├── css/components/restricted-mode/restricted-mode-main.css
├── css/components/titlebar/titlebar-main.css
├── css/components/activity-bar/activity-bar-main.css
├── css/components/primary-sidebar/primary-sidebar-main.css
├── css/components/explorer/explorer-main.css
├── css/components/editor-panel/editor-panel-main.css
├── css/components/infinite-canvas/infinitecanvas-main.css
├── css/components/source-editor/source-editor-main.css
├── css/components/bottom-panel/bottom-panel-main.css
├── css/components/secondary-sidebar/secondary-sidebar-main.css
├── css/components/chat/chat-view-main.css
├── css/components/feedback/feedback-main.css
├── css/components/status-bar/status-bar-main.css
└── css/layout/responsive.css
```

`css/generated/creed.css` is generated from the concrete CSS import graph above and should not be edited directly.
