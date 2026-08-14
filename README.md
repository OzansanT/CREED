# CREED

CREED is a browser-based infinite-canvas workspace presented in a Visual Studio Code/Codespaces-inspired shell. It combines pan-and-zoom world navigation, adaptive grid detail, saved canvas locations, draggable components, and a built-in source viewer.

## Run locally

Serve the repository through HTTP so ES modules and relative source-file requests work:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly with a `file://` URL is not supported because browsers restrict module and `fetch()` access.

## Main behavior

- Drag the canvas to pan.
- Use `Ctrl/Cmd + wheel` or the zoom controls to zoom around a fixed pivot.
- Press `0` to return to the world origin.
- Press `A` to save the current view and `Shift + A` to return to it.
- Use either the **Toggle primary sidebar** layout control or the **Explorer** activity button to repeatedly collapse and reopen the primary sidebar.
- Use **Canvas Controls** for coordinates, grid LOD, shortcuts, and saved-view actions.
- Use **Infinite Canvas** to return to the canvas editor; it intentionally opens no secondary sidebar panel.
- Select any Explorer file to load and display its real repository source.
- Use **Components** to add the JSON card.

## Explorer inventory

`source-files.js` contains the single Explorer manifest: `WORKSPACE_FILES`. `workbench-input.js` generates every Explorer row from that array and loads the selected file with a real relative `fetch()`.

When adding, renaming, or deleting a repository file:

1. Update `WORKSPACE_FILES` in sorted order.
2. Add or remove the file's real CSS link or JavaScript import where required.
3. Never paste source-code snapshots into the manifest.
4. Verify every Explorer row opens the corresponding file.

## Coordinate model

`state.x` and `state.y` are renderer translations in screen space. User-facing, saved, and compared locations use world coordinates through `screenToWorld(...)` or `getViewportWorldCenter(...)`. Zoom values are clamped to `MIN_ZOOM` and `MAX_ZOOM`, and zoom operations preserve the world point under the pivot.

## Repository tree

```text
CREED/
├── AGENTS.md
├── activity-bar.css
├── anchor.css
├── anchors.js
├── app-layout.css
├── buttons.css
├── canvas-shell.css
├── card-input.js
├── chat-panel.css
├── config.js
├── coordinates.js
├── dotted-background.css
├── elements.js
├── feedback.css
├── grid-lod.js
├── index.html
├── json-file.js
├── keyboard.js
├── lod-indicator.css
├── main-canvas.css
├── main.js
├── navbar.css
├── pan-input.js
├── primary-sidebar-input.js
├── README.md
├── responsive.css
├── restricted-banner.css
├── root-canvas.css
├── sidebar-input.js
├── sidebar-stats.css
├── sidebar.css
├── source-files.js
├── state.js
├── status-bar.css
├── storage.js
├── toast.js
├── ui.js
├── viewport.js
├── wheel-input.js
├── workbench-input.js
├── workbench.css
├── world-content.css
└── zoom-controls.css
```

## Entry relationships

```text
index.html
├── main-canvas.css
│   ├── root-canvas.css
│   ├── app-layout.css
│   ├── buttons.css
│   ├── restricted-banner.css
│   ├── navbar.css
│   ├── activity-bar.css
│   ├── sidebar.css
│   ├── sidebar-stats.css
│   ├── lod-indicator.css
│   ├── workbench.css
│   ├── canvas-shell.css
│   ├── dotted-background.css
│   ├── world-content.css
│   ├── anchor.css
│   ├── zoom-controls.css
│   ├── feedback.css
│   ├── chat-panel.css
│   ├── status-bar.css
│   └── responsive.css
└── main.js
    ├── state.js
    ├── elements.js
    ├── storage.js
    │   ├── config.js
    │   └── state.js
    ├── ui.js
    │   ├── grid-lod.js
    │   │   └── config.js
    │   └── coordinates.js
    ├── toast.js
    ├── viewport.js
    │   ├── config.js
    │   ├── state.js
    │   └── coordinates.js
    ├── anchors.js
    ├── pan-input.js
    ├── wheel-input.js
    │   └── viewport.js
    ├── keyboard.js
    ├── sidebar-input.js
    │   └── coordinates.js
    ├── primary-sidebar-input.js
    ├── card-input.js
    ├── json-file.js
    └── workbench-input.js
        └── source-files.js
```

## Structure rules

Follow `AGENTS.md`: update an existing feature in its owning file, create a new file only for a genuinely new responsibility, keep `main.js` as orchestration glue, preserve CSS colonies, and leave no orphan links or imports.
