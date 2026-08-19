# CREED

CREED is a browser-based infinite-canvas workbench with a Visual Studio Code/Codespaces-inspired shell. It combines an Explorer, multi-tab source viewer, infinite canvas, resizable bottom panel, secondary sidebar with chat view, and persistent layout state.

## Architecture rules

- IDs are stable JavaScript and ARIA hooks.
- Classes own presentation and use component-oriented names.
- Repeated elements use classes plus `data-*` attributes instead of sequential IDs.
- CSS source lives under `css/`; application JavaScript lives under `js/`.
- Each visual component has one `*-main.css` entry and focused CSS colony files.
- Component JavaScript is grouped under `js/components/<component>/` where practical.
- Shared JS infrastructure lives in `js/core/`; shared UI helpers live in `js/ui/`.
- Repository-root `main.js` is only a compatibility bootstrap; `js/main.js` is the application orchestration entry.
- `index.html` loads only `css/generated/creed.css` for styles.
- Edit CSS source colonies, then run `node scripts/build-css.mjs`.
- Internal ES-module imports do not use manual cache-version query strings.
- Run `node scripts/build-source-files.mjs` after adding, renaming, or deleting repository files.

## Main visual regions

```text
#app.app-shell
├── #restrictedModeBanner.restricted-mode-banner
├── #titleBar.app-titlebar
├── #activityBar.activity-bar
├── #primarySidebar.primary-sidebar
├── #workbench.workbench
│   ├── #editorPanel.editor-panel
│   │   ├── #canvasView.editor-view--canvas
│   │   └── #sourceEditorView.editor-view--source
│   └── #bottomPanel.bottom-panel
├── #secondarySidebar.secondary-sidebar
│   └── #chatView.chat-view
├── #notificationLayer.notification-layer
└── #statusBar.status-bar
```

## Development commands

```bash
npm run build
npm run check
```

Equivalent focused commands:

```bash
node scripts/build-css.mjs
node scripts/build-css.mjs --check
node scripts/build-source-files.mjs
node scripts/check-architecture.mjs
```

`npm run check` verifies generated CSS freshness, JavaScript syntax/import integrity, DOM wiring, Explorer inventory freshness, pointer-capture hardening, and the JS colony boundary.

## Current directory tree

```text
CREED/
├── AGENTS.md
├── css/
│   ├── components/
│   │   ├── activity-bar/
│   │   │   ├── activity-bar-groups.css
│   │   │   ├── activity-bar-main.css
│   │   │   ├── activity-bar-shell.css
│   │   │   └── activity-buttons.css
│   │   ├── bottom-panel/
│   │   │   ├── bottom-panel-main.css
│   │   │   ├── bottom-panel-shell.css
│   │   │   ├── bottom-panel-tabs.css
│   │   │   ├── bottom-panel-toolbar.css
│   │   │   ├── bottom-panel-views.css
│   │   │   ├── terminal-prompt.css
│   │   │   └── terminal-view.css
│   │   ├── chat/
│   │   │   ├── chat-composer.css
│   │   │   ├── chat-context.css
│   │   │   ├── chat-empty-state.css
│   │   │   ├── chat-messages.css
│   │   │   ├── chat-tools.css
│   │   │   └── chat-view-main.css
│   │   ├── editor-panel/
│   │   │   ├── editor-actions.css
│   │   │   ├── editor-breadcrumbs.css
│   │   │   ├── editor-panel-main.css
│   │   │   ├── editor-panel-shell.css
│   │   │   ├── editor-tabs.css
│   │   │   └── editor-viewport.css
│   │   ├── explorer/
│   │   │   ├── explorer-actions.css
│   │   │   ├── explorer-header.css
│   │   │   ├── explorer-main.css
│   │   │   ├── explorer-sections.css
│   │   │   ├── file-row.css
│   │   │   ├── workspace-header.css
│   │   │   └── workspace-tree.css
│   │   ├── feedback/
│   │   │   ├── feedback-main.css
│   │   │   ├── notification-layer.css
│   │   │   └── toast.css
│   │   ├── infinite-canvas/
│   │   │   ├── canvas-anchors.css
│   │   │   ├── canvas-cards.css
│   │   │   ├── canvas-grid.css
│   │   │   ├── canvas-hints.css
│   │   │   ├── canvas-lod.css
│   │   │   ├── canvas-viewport.css
│   │   │   ├── canvas-world.css
│   │   │   ├── canvas-zoom.css
│   │   │   └── infinitecanvas-main.css
│   │   ├── primary-sidebar/
│   │   │   ├── primary-sidebar-content.css
│   │   │   ├── primary-sidebar-footer.css
│   │   │   ├── primary-sidebar-header.css
│   │   │   ├── primary-sidebar-main.css
│   │   │   └── primary-sidebar-shell.css
│   │   ├── restricted-mode/
│   │   │   ├── restricted-mode-actions.css
│   │   │   ├── restricted-mode-main.css
│   │   │   └── restricted-mode-shell.css
│   │   ├── secondary-sidebar/
│   │   │   ├── secondary-sidebar-content.css
│   │   │   ├── secondary-sidebar-footer.css
│   │   │   ├── secondary-sidebar-header.css
│   │   │   ├── secondary-sidebar-main.css
│   │   │   └── secondary-sidebar-shell.css
│   │   ├── source-editor/
│   │   │   ├── source-editor-main.css
│   │   │   ├── source-editor-shell.css
│   │   │   ├── source-editor-states.css
│   │   │   ├── source-lines.css
│   │   │   ├── source-minimap.css
│   │   │   ├── source-scroller.css
│   │   │   └── source-syntax.css
│   │   ├── status-bar/
│   │   │   ├── status-bar-items.css
│   │   │   ├── status-bar-layout.css
│   │   │   └── status-bar-main.css
│   │   └── titlebar/
│   │       ├── command-center.css
│   │       ├── layout-controls.css
│   │       ├── navigation-controls.css
│   │       ├── titlebar-actions.css
│   │       ├── titlebar-brand.css
│   │       ├── titlebar-main.css
│   │       └── titlebar-shell.css
│   ├── creed-main.css
│   ├── foundation/
│   │   ├── accessibility.css
│   │   ├── design-tokens.css
│   │   ├── reset.css
│   │   ├── states.css
│   │   ├── themes.css
│   │   ├── typography.css
│   │   └── utilities.css
│   ├── generated/
│   │   └── creed.css
│   ├── layout/
│   │   ├── app-shell-main.css
│   │   ├── panel-layout.css
│   │   ├── panel-resize-main.css
│   │   ├── responsive.css
│   │   └── workbench-main.css
│   └── primitives/
│       ├── buttons.css
│       ├── icon-buttons.css
│       ├── icons.css
│       ├── inputs.css
│       ├── menus.css
│       ├── scrollbars.css
│       ├── tabs.css
│       └── toolbars.css
├── index.html
├── js/
│   ├── components/
│   │   ├── bottom-panel/
│   │   │   ├── bottom-panel-input.js
│   │   │   └── bottom-panel-main.js
│   │   ├── editor-panel/
│   │   │   ├── editor-panel-main.js
│   │   │   ├── editor-tabs.js
│   │   │   ├── source-files.js
│   │   │   └── workbench-input.js
│   │   ├── infinite-canvas/
│   │   │   ├── anchors.js
│   │   │   ├── card-input.js
│   │   │   ├── grid-lod.js
│   │   │   ├── infinitecanvas-main.js
│   │   │   ├── json-file.js
│   │   │   ├── keyboard.js
│   │   │   ├── pan-input.js
│   │   │   ├── reset-input.js
│   │   │   ├── sidebar-input.js
│   │   │   ├── viewport.js
│   │   │   └── wheel-input.js
│   │   ├── panel-resize/
│   │   │   └── panel-resize-input.js
│   │   ├── primary-sidebar/
│   │   │   ├── primary-sidebar-input.js
│   │   │   └── primary-sidebar-main.js
│   │   └── secondary-sidebar/
│   │       ├── secondary-sidebar-input.js
│   │       └── secondary-sidebar-main.js
│   ├── core/
│   │   ├── config.js
│   │   ├── coordinates.js
│   │   ├── elements.js
│   │   ├── state.js
│   │   └── storage.js
│   ├── main.js
│   └── ui/
│       ├── icons.js
│       ├── toast.js
│       ├── ui.js
│       └── unavailable-controls.js
├── main.js
├── package.json
├── README.md
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
            │       ├── js/core/config.js
            │       ├── js/core/state.js
            │       └── js/core/coordinates.js
            ├── js/components/editor-panel/editor-panel-main.js
            │   └── js/components/editor-panel/workbench-input.js
            │       ├── js/components/editor-panel/source-files.js
            │       └── js/components/editor-panel/editor-tabs.js
            │           └── js/ui/icons.js
            └── js/components/infinite-canvas/infinitecanvas-main.js
                ├── js/core/state.js
                ├── js/core/storage.js
                ├── js/ui/ui.js
                │   ├── js/components/infinite-canvas/grid-lod.js
                │   │   └── js/core/config.js
                │   └── js/core/coordinates.js
                ├── js/ui/toast.js
                ├── js/components/infinite-canvas/viewport.js
                │   ├── js/core/config.js
                │   ├── js/core/state.js
                │   └── js/core/coordinates.js
                ├── js/components/infinite-canvas/anchors.js
                │   ├── js/core/config.js
                │   ├── js/core/state.js
                │   └── js/core/coordinates.js
                ├── js/components/infinite-canvas/pan-input.js
                ├── js/components/infinite-canvas/wheel-input.js
                │   └── js/components/infinite-canvas/viewport.js
                ├── js/components/infinite-canvas/keyboard.js
                ├── js/components/infinite-canvas/sidebar-input.js
                │   └── js/core/coordinates.js
                ├── js/components/infinite-canvas/reset-input.js
                │   ├── js/core/storage.js
                │   └── js/components/infinite-canvas/viewport.js
                ├── js/components/infinite-canvas/card-input.js
                └── js/components/infinite-canvas/json-file.js

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

The CSS component `*-main.css` files continue the relationship graph through their literal sibling `@import` declarations. `css/generated/creed.css` is generated from this source graph and must not be edited directly.
