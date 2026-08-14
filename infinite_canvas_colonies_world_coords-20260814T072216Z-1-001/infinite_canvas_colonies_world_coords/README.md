# CREED — CSS Colonies + World Coordinate Fix

The CSS-colony and modular-JS structure is preserved.

## Update rule

When updating canvas movement, zoom, anchor, storage, or sidebar position logic:

- Treat `state.x` / `state.y` only as screen-space renderer translation offsets.
- Convert through `screenToWorld(...)` or `getViewportWorldCenter(...)` before showing, saving, or comparing world positions.
- Keep zoom operations pivot-locked by preserving the world point under the pivot.
- Clamp restored or user-provided zoom values to `MIN_ZOOM` / `MAX_ZOOM`.
- Preserve the modular-JS structure:
  - Keep shared constants in `js/config.js`.
  - Keep mutable viewport state in `js/state.js`.
  - Keep DOM lookup wiring in `js/elements.js`.
  - Keep coordinate conversions in `js/coordinates.js`.
  - Keep persistence and localStorage migrations in `js/storage.js`.
  - Keep user input handlers in their focused `*-input.js` or `keyboard.js` modules.
  - Keep `js/main.js` as orchestration glue that wires modules together.
- Preserve the CSS-colony structure:
  - Keep global design tokens, resets, and base element styles in `css/root-canvas.css`.
  - Keep `css/main-canvas.css` as the only stylesheet linked by `index.html` and the only CSS import hub.
  - Keep app shell layout rules in `css/colonies/app-layout.css`.
  - Keep shared button styling in `css/colonies/buttons.css`.
  - Keep top navigation styling in `css/colonies/navbar.css`.
  - Keep sidebar layout in `css/colonies/sidebar.css` and sidebar metric tiles in `css/colonies/sidebar-stats.css`.
  - Keep grid LOD list and badge styling in `css/colonies/lod-indicator.css`.
  - Keep canvas viewport styling in `css/colonies/canvas-shell.css`.
  - Keep dotted grid layer styling in `css/colonies/dotted-background.css`.
  - Keep transformed world content styling in `css/colonies/world-content.css`.
  - Keep anchor marker styling in `css/colonies/anchor.css`.
  - Keep zoom control styling in `css/colonies/zoom-controls.css`.
  - Keep toast and feedback styling in `css/colonies/feedback.css`.
  - Keep breakpoint-only overrides in `css/colonies/responsive.css`.

## Applied fix

The sidebar `X` / `Y` readout now displays the world coordinate under the viewport center rather than the internal `state.x` / `state.y` screen translation offsets.

- `js/coordinates.js` adds `getViewportWorldCenter(canvas, state)`.
- `js/ui.js` uses that helper for `xStat` / `yStat`.
- `state.x` / `state.y` remain unchanged as renderer translation offsets.
- `-0` is normalized to `0` in the coordinate readout.

At Home, the sidebar now reads:

```text
X 0
Y 0
Zoom 100%
```

## Run

Native ES modules are used, so serve the folder over HTTP:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
