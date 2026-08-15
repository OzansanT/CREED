# CREED

CREED is a browser-based infinite-canvas website builder presented in a Visual Studio Code/Codespaces-inspired workbench. It combines a versioned design document, pan-and-zoom navigation, responsive components, source inspection, undoable editing commands and export tools.

## Run locally

Serve the repository through HTTP so ES modules and source-file requests work:

```bash
python -m http.server 8000
```

Open http://localhost:8000. Direct file:// loading is not supported.

Run the complete repository gate with Node.js 22 or newer:

```bash
npm run test:all
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md) for the system boundaries, contribution contract, threat model and release history.

## Canvas editing

- Drag empty canvas space to pan; use Ctrl/Cmd + wheel or the zoom controls to zoom around a fixed pivot.
- Click a component to select it. Use Ctrl/Cmd or Shift to toggle multi-selection.
- Hold Shift and drag empty canvas space to create a lasso selection.
- Drag selected components as a group. Movement snaps to the grid and nearby component centres.
- Resize from four selection handles or rotate from the handle above the selection.
- Use arrow keys to move selected components; hold Shift for ten-unit movement.
- Use Ctrl/Cmd + C, V and D to copy, paste and duplicate. Delete or Backspace removes the selection.
- Use Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y) for undo and redo.
- Fit all content or only the current selection into the viewport.
- Use the minimap to inspect the full world and jump to another location.
- Save multiple named canvas views and return to any saved location.

## Builder features

- Add Text, Image, Button, Link, Container, Section, Page Frame, File and JSON components.
- Insert the complete responsive Landing Hero template.
- Edit position, dimensions, rotation, content, URLs and breakpoint-specific presentation in Inspector.
- Switch Inspector between desktop, tablet and mobile overrides.
- Edit shared colour design tokens.
- Reorder, hide and lock components from Layers.
- Align edges and centres or distribute three or more selected components.
- Group or ungroup component trees.
- Connect exactly two selected components with a live canvas edge.
- Export a self-contained responsive HTML document, the CREED JSON document or a WordPress block mapping.

## Workbench and layout

- Explorer loads the real repository source into a shared browser workspace and supports nested folders, create, rename, delete, refresh and export operations.
- Open multiple source tabs, pin or close them, reopen a closed editor, navigate Back/Forward and deep-link to a file and line.
- Switch between a virtualized highlighted source view and an editable buffer; save changes into the browser workspace and inspect them in Source Control.
- Use Ctrl/Cmd+P for Quick Open, F1 for commands, Ctrl/Cmd+F for in-file find/replace and the Search activity for workspace-wide search/replace.
- Run the workspace in a sandboxed preview whose CSS and remapped ES modules are built from current browser-workspace content.
- Stage, diff, discard and locally commit browser-workspace changes or export a transferable patch.
- Use the safe browser terminal for file, search, source-control, diagnostics and preview commands. Problems, Output, Debug Console and Ports are separate functional panel views.
- The contextual local assistant can summarize the active file, search, report changes/diagnostics and navigate to source without sending workspace content to a remote model.
- The extension host accepts command, terminal, activity-view and component-type contributions.
- Primary sidebar, secondary sidebar and Terminal can be independently collapsed and resized.
- Panel dimensions and visibility persist across reloads and are safely clamped to the viewport.
- Narrow viewports use overlay sidebars so controller state and accessibility state remain synchronized.
- Canvas Reset restores canvas content and navigation while Infinite Reset restores the whole workspace layout.

## Durability, access and security

- IndexedDB mirrors the versioned canvas document, browser-workspace overrides, local commits, editor tabs, unsaved buffers, settings and panel layout. localStorage remains the fast canvas/layout bootstrap and legacy migration source.
- Automatic and manual recovery points retain the ten newest snapshots. Settings can export or import a complete validated CREED backup; recovery points are created before imports and destructive resets.
- Light, dark, system and high-contrast themes, reduced motion, adjustable editor type, English/Turkish shell localization and four layout presets are available from Settings.
- Keyboard navigation covers activity, sidebar, editor and bottom-panel tabs. Canvas components support focus, keyboard selection and keyboard movement; a skip link and live announcement region support assistive technology.
- Mobile viewports use a bottom activity bar, mutually exclusive overlay sidebars, a dismissible scrim, larger touch targets and a bounded terminal sheet.
- Restricted Mode prevents non-built-in extension activation until the workspace is explicitly trusted. Preview code always runs in an opaque sandbox.
- A restrictive Content Security Policy blocks external scripts/styles, plugins and unsafe URL schemes. Exported markup, CSS, URLs, class names, MIME types and download names are sanitized.
- manifest.webmanifest and the module service worker provide installation and same-origin offline caching.

## Document model

The shared state is a schema-versioned CREED document containing:

- viewport renderer translation and zoom;
- ID-based components with world transforms, parent relationships, responsive styles and props;
- selection, connections and multiple saved views;
- design tokens and UI preview state.

Legacy infiniteCanvasLODState.v3 and creedWorkspaceDocument.v1 records migrate automatically to creedWorkspaceDocument.v2. Storage writes are scheduled and safely handle unavailable or full browser storage.

Viewport translation remains screen-space renderer state. User-facing component and saved-view positions remain world-space values converted through coordinates.js. Zoom is always clamped and pivot-locked.
When renderer translation becomes extremely large, world-origin.js rebases internal coordinates while preserving logical world positions and every on-screen pixel.

## Explorer inventory

source-files.js contains the authoritative WORKSPACE_FILES manifest. workspace-store.js owns loaded source, virtual folders, dirty/staged state and local commits. explorer-input.js renders its hierarchy, while editor-workbench.js owns tabs and request ownership so stale loads cannot replace the active editor.

After adding, renaming or deleting a file:

1. Update WORKSPACE_FILES in sorted order.
2. Add or remove the real CSS link or JavaScript import.
3. Verify the manifest matches the repository.
4. Verify all HTML references and module imports resolve.

## Repository tree

```text
CREED/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── AGENTS.md
├── ARCHITECTURE.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
├── SECURITY.md
├── accessibility.js
├── activity-bar.css
├── activity-input.js
├── alignment-input.js
├── anchor.css
├── anchors.js
├── app-layout.css
├── backup-manager.js
├── bottom-panel.js
├── buttons.css
├── canvas-minimap.css
├── canvas-minimap.js
├── canvas-navigation.js
├── canvas-shell.css
├── card-input.js
├── chat-panel.css
├── clipboard-input.js
├── command-engine.js
├── component-library-input.js
├── component-registry.js
├── component-renderer.js
├── component-tree.js
├── config.js
├── connection-input.js
├── connectors.js
├── contextual-chat.js
├── coordinates.js
├── core-extension.js
├── creed-document.js
├── creed-icon.svg
├── design-token-input.js
├── design-tokens.js
├── dotted-background.css
├── download.js
├── durable-persistence.js
├── editor-workbench.js
├── elements.js
├── explorer-input.js
├── export-engine.js
├── extension-host.js
├── feedback.css
├── github-workbench.js
├── grid-lod.js
├── group-input.js
├── history-input.js
├── i18n.js
├── index.html
├── indexed-db.js
├── inspector-input.js
├── inspector.css
├── json-file.js
├── keyboard.js
├── lasso-input.js
├── layers-input.js
├── layout-presets.js
├── lod-indicator.css
├── main-canvas.css
├── main.js
├── manifest.webmanifest
├── mobile.css
├── navbar.css
├── package.json
├── pan-input.js
├── panel-resize-input.js
├── panel-resize.css
├── preview-runner.js
├── primary-sidebar-input.js
├── pwa-input.js
├── quick-open.js
├── render-scheduler.js
├── reset-input.js
├── responsive-layout.js
├── responsive-styles.js
├── responsive.css
├── restricted-banner.css
├── root-canvas.css
├── saved-views-input.js
├── scripts/
│   ├── smoke-server.mjs
│   └── validate-repo.mjs
├── secondary-sidebar-input.js
├── security.js
├── selection-input.js
├── selection-transform.js
├── selection.css
├── service-worker.js
├── settings-store.js
├── sidebar-input.js
├── sidebar-stats.css
├── sidebar.css
├── snapping.js
├── source-control.js
├── source-files.js
├── source-language.js
├── source-renderer.js
├── state-utils.js
├── state.js
├── status-bar.css
├── storage.js
├── template-input.js
├── templates.js
├── terminal-panel-input.js
├── terminal-session.js
├── tests/
│   ├── canvas.test.mjs
│   ├── document-command.test.mjs
│   ├── durable.test.mjs
│   ├── repository.test.mjs
│   ├── security-extension.test.mjs
│   └── workspace.test.mjs
├── themes.css
├── toast.js
├── ui.js
├── viewport.js
├── wheel-input.js
├── workbench-features.css
├── workbench-input.js
├── workbench.css
├── workspace-search.js
├── workspace-store.js
├── workspace-trust.js
├── world-content.css
├── world-origin.js
└── zoom-controls.css
```

## Entry relationships

```text
index.html
├── manifest.webmanifest
├── creed-icon.svg
├── main-canvas.css
├── root-canvas.css
├── app-layout.css
├── buttons.css
├── restricted-banner.css
├── navbar.css
├── activity-bar.css
├── sidebar.css
├── sidebar-stats.css
├── lod-indicator.css
├── workbench.css
├── workbench-features.css
├── canvas-shell.css
├── dotted-background.css
├── world-content.css
├── selection.css
├── canvas-minimap.css
├── inspector.css
├── anchor.css
├── zoom-controls.css
├── feedback.css
├── chat-panel.css
├── panel-resize.css
├── status-bar.css
├── responsive.css
├── themes.css
├── mobile.css
└── main.js
    ├── state.js
    ├── elements.js
    ├── storage.js
    ├── ui.js
    ├── toast.js
    ├── viewport.js
    ├── anchors.js
    ├── pan-input.js
    ├── wheel-input.js
    ├── keyboard.js
    ├── sidebar-input.js
    ├── primary-sidebar-input.js
    ├── secondary-sidebar-input.js
    ├── terminal-panel-input.js
    ├── panel-resize-input.js
    ├── reset-input.js
    ├── card-input.js
    ├── workbench-input.js
    ├── render-scheduler.js
    ├── command-engine.js
    ├── history-input.js
    ├── component-renderer.js
    ├── selection-input.js
    ├── lasso-input.js
    ├── selection-transform.js
    ├── clipboard-input.js
    ├── layers-input.js
    ├── connection-input.js
    ├── canvas-minimap.js
    ├── canvas-navigation.js
    ├── saved-views-input.js
    ├── inspector-input.js
    ├── component-library-input.js
    ├── template-input.js
    ├── export-engine.js
    ├── group-input.js
    ├── alignment-input.js
    ├── design-token-input.js
    ├── world-origin.js
    ├── extension-host.js
    ├── preview-runner.js
    ├── bottom-panel.js
    ├── contextual-chat.js
    ├── activity-input.js
    ├── workspace-search.js
    ├── source-control.js
    ├── github-workbench.js
    ├── core-extension.js
    ├── settings-store.js
    ├── i18n.js
    ├── durable-persistence.js
    ├── backup-manager.js
    ├── layout-presets.js
    ├── pwa-input.js
    ├── accessibility.js
    ├── responsive-layout.js
    └── workspace-trust.js

service-worker.js
└── source-files.js
```

Every lower-level direct ES-module import is checked by `scripts/validate-repo.mjs`; the responsibility graph is documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Structure rules

Follow AGENTS.md: modify an existing capability in its owning file, add a file only for a genuinely new responsibility, keep main.js as orchestration glue, preserve CSS colonies, and leave no orphan files, imports, links or controls.
