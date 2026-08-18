# CREED

CREED is a browser-based infinite-canvas workbench with a Visual Studio Code/Codespaces-inspired shell. It combines an Explorer, multi-tab source viewer, infinite canvas, resizable bottom panel, secondary sidebar with chat view, and persistent layout state.

## Architecture rules

- IDs are stable JavaScript and ARIA hooks.
- Classes own presentation and use component-oriented names.
- Repeated elements use classes plus `data-*` attributes instead of sequential IDs.
- Each visual component has one `*-main.css` entry and focused CSS colony files.
- `index.html` loads only `css/generated/creed.css`.
- Edit CSS source colonies, then run `node scripts/build-css.mjs`.
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
node scripts/build-css.mjs
node scripts/build-source-files.mjs
node --check main.js
```

`npm run build` and `npm run check` provide the same commands when npm is available.

## Current directory tree

```text
CREED/
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
│   ├── primitives/
│   │   ├── buttons.css
│   │   ├── icon-buttons.css
│   │   ├── icons.css
│   │   ├── inputs.css
│   │   ├── menus.css
│   │   ├── scrollbars.css
│   │   ├── tabs.css
│   │   └── toolbars.css
│   └── creed-main.css
├── scripts/
│   ├── build-css.mjs
│   ├── check-architecture.mjs
│   └── build-source-files.mjs
├── AGENTS.md
├── README.md
├── anchors.js
├── bottom-panel-input.js
├── bottom-panel-main.js
├── card-input.js
├── config.js
├── coordinates.js
├── editor-panel-main.js
├── editor-tabs.js
├── elements.js
├── grid-lod.js
├── icons.js
├── index.html
├── infinitecanvas-main.js
├── json-file.js
├── keyboard.js
├── main.js
├── package.json
├── pan-input.js
├── panel-resize-input.js
├── primary-sidebar-input.js
├── reset-input.js
├── secondary-sidebar-input.js
├── secondary-sidebar-main.js
├── sidebar-input.js
├── source-files.js
├── state.js
├── storage.js
├── toast.js
├── ui.js
├── viewport.js
├── wheel-input.js
└── workbench-input.js
```

## Current file relationship tree

```text
index.html
├── CSS
│   └── css/generated/creed.css
└── JavaScript
    └── main.js
        ├── elements.js
        ├── toast.js
        ├── primary-sidebar-input.js
        ├── secondary-sidebar-main.js
        │   └── secondary-sidebar-input.js
        ├── bottom-panel-main.js
        │   └── bottom-panel-input.js
        ├── panel-resize-input.js
        │   ├── state.js
        │   └── storage.js
        ├── icons.js
        ├── editor-panel-main.js
        │   └── workbench-input.js
        │       ├── source-files.js
        │       └── editor-tabs.js
        │           └── icons.js
        └── infinitecanvas-main.js
            ├── state.js
            ├── storage.js
            ├── ui.js
            │   ├── grid-lod.js
            │   └── coordinates.js
            ├── toast.js
            ├── viewport.js
            ├── anchors.js
            ├── pan-input.js
            ├── wheel-input.js
            ├── keyboard.js
            ├── sidebar-input.js
            ├── reset-input.js
            ├── card-input.js
            └── json-file.js

css/creed-main.css
├── css/foundation/*.css
├── css/primitives/*.css
├── css/layout/*.css
└── css/components/*/*-main.css
    └── focused component colony files
```
