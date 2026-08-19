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
- Whole-file search is bounded to 5,000 returned matches and supports Match Case, Whole Word, and Regular Expression modes.
- `Ctrl/Cmd+F` opens the non-blocking Find widget. `Enter` / `F3` moves forward, `Shift+Enter` / `Shift+F3` moves backward, and `Alt+C` / `Alt+W` / `Alt+R` toggle Match Case / Whole Word / Regex.
- `Ctrl/Cmd+G` opens the non-blocking Go To Line/Column widget. `:line` and `:line:column` preview navigation live against the virtual viewport.
- `Escape` closes the active source-navigation widget; file/canvas switches reset source-navigation state.
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

`npm run check` verifies generated CSS freshness, JavaScript syntax/import integrity, DOM wiring, Explorer inventory freshness, pointer-capture recovery, JS colony boundaries, editor responsibility boundaries, virtualization bounds, worker contracts, bounded whole-file search, advanced Find modes, non-blocking source-navigation wiring, and Go To parsing.

## Current directory tree

```text
CREED/
├── AGENTS.md
├── README.md
├── index.html
├── main.js
├── package.json
├── css/
│   ├── creed-main.css
│   ├── foundation/
│   │   ├── accessibility.css
│   │   ├── design-tokens.css
│   │   ├── reset.css
│   │   ├── states.css
│   │   ├── themes.css
│   │   ├── typography.css
│   │   └── utilities.css
│   ├── primitives/
│   │   ├── buttons.css
│   │   ├── icon-buttons.css
│   │   ├── icons.css
│   │   ├── inputs.css
│   │   ├── menus.css
│   │   ├── scrollbars.css
│   │   ├── tabs.css
│   │   └── toolbars.css
│   ├── layout/
│   │   ├── app-shell-main.css
│   │   ├── panel-layout.css
│   │   ├── panel-resize-main.css
│   │   ├── responsive.css
│   │   └── workbench-main.css
│   ├── generated/
│   │   └── creed.css
│   └── components/
│       ├── activity-bar/
│       │   ├── activity-bar-groups.css
│       │   ├── activity-bar-main.css
│       │   ├── activity-bar-shell.css
│       │   └── activity-buttons.css
│       ├── bottom-panel/
│       │   ├── bottom-panel-main.css
│       │   ├── bottom-panel-shell.css
│       │   ├── bottom-panel-tabs.css
│       │   ├── bottom-panel-toolbar.css
│       │   ├── bottom-panel-views.css
│       │   ├── terminal-prompt.css
│       │   └── terminal-view.css
│       ├── chat/
│       │   ├── chat-composer.css
│       │   ├── chat-context.css
│       │   ├── chat-empty-state.css
│       │   ├── chat-messages.css
│       │   ├── chat-tools.css
│       │   └── chat-view-main.css
│       ├── editor-panel/
│       │   ├── editor-actions.css
│       │   ├── editor-breadcrumbs.css
│       │   ├── editor-panel-main.css
│       │   ├── editor-panel-shell.css
│       │   ├── editor-tabs.css
│       │   └── editor-viewport.css
│       ├── explorer/
│       │   ├── explorer-actions.css
│       │   ├── explorer-header.css
│       │   ├── explorer-main.css
│       │   ├── explorer-sections.css
│       │   ├── file-row.css
│       │   ├── workspace-header.css
│       │   └── workspace-tree.css
│       ├── feedback/
│       │   ├── feedback-main.css
│       │   ├── notification-layer.css
│       │   └── toast.css
│       ├── infinite-canvas/
│       │   ├── canvas-anchors.css
│       │   ├── canvas-cards.css
│       │   ├── canvas-grid.css
│       │   ├── canvas-hints.css
│       │   ├── canvas-lod.css
│       │   ├── canvas-viewport.css
│       │   ├── canvas-world.css
│       │   ├── canvas-zoom.css
│       │   └── infinitecanvas-main.css
│       ├── primary-sidebar/
│       │   ├── primary-sidebar-content.css
│       │   ├── primary-sidebar-footer.css
│       │   ├── primary-sidebar-header.css
│       │   ├── primary-sidebar-main.css
│       │   └── primary-sidebar-shell.css
│       ├── restricted-mode/
│       │   ├── restricted-mode-actions.css
│       │   ├── restricted-mode-main.css
│       │   └── restricted-mode-shell.css
│       ├── secondary-sidebar/
│       │   ├── secondary-sidebar-content.css
│       │   ├── secondary-sidebar-footer.css
│       │   ├── secondary-sidebar-header.css
│       │   ├── secondary-sidebar-main.css
│       │   └── secondary-sidebar-shell.css
│       ├── source-editor/
│       │   ├── source-editor-main.css
│       │   ├── source-editor-shell.css
│       │   ├── source-editor-states.css
│       │   ├── source-lines.css
│       │   ├── source-minimap.css
│       │   ├── source-navigation.css
│       │   ├── source-scroller.css
│       │   └── source-syntax.css
│       ├── status-bar/
│       │   ├── status-bar-items.css
│       │   ├── status-bar-layout.css
│       │   └── status-bar-main.css
│       └── titlebar/
│           ├── command-center.css
│           ├── layout-controls.css
│           ├── navigation-controls.css
│           ├── titlebar-actions.css
│           ├── titlebar-brand.css
│           ├── titlebar-main.css
│           └── titlebar-shell.css
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
            │       │   └── js/ui/icons.js
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
│   ├── css/components/source-editor/source-editor-shell.css
│   ├── css/components/source-editor/source-scroller.css
│   ├── css/components/source-editor/source-lines.css
│   ├── css/components/source-editor/source-syntax.css
│   ├── css/components/source-editor/source-navigation.css
│   ├── css/components/source-editor/source-minimap.css
│   └── css/components/source-editor/source-editor-states.css
├── css/components/bottom-panel/bottom-panel-main.css
├── css/components/secondary-sidebar/secondary-sidebar-main.css
├── css/components/chat/chat-view-main.css
├── css/components/feedback/feedback-main.css
├── css/components/status-bar/status-bar-main.css
└── css/layout/responsive.css
```

`source-navigation.js` creates the Find and Go To controls inside the source-editor shell at runtime. Those DOM ownership relationships are not shown in the file relationship tree because the tree records only HTML references, CSS `@import`, and JavaScript import/export dependencies.

`css/generated/creed.css` is generated from the concrete CSS import graph above and should not be edited directly.
