# CREED architecture

CREED is a dependency-free, browser-native application. The page loads ES modules directly, keeps the editable project in a browser workspace, and treats the infinite canvas and source workbench as two views over durable application state.

## Runtime boundaries

```text
index.html
├── CSS colonies
├── main.js
│   ├── document and command core
│   ├── canvas rendering and input controllers
│   ├── browser source workbench
│   └── persistence, settings and accessibility services
└── service-worker.js
    └── same-origin application shell
```

`main.js` is composition glue. Feature behavior stays in the module that owns the responsibility, and no runtime module may be orphaned from either `main.js` or `service-worker.js`.

## State and commands

`creed-document.js` owns the versioned document schema and migration. `state.js` exposes the active normalized document. Components are ID-based records from `component-registry.js`; relationships use IDs rather than object references.

All undoable document edits run through `command-engine.js`. Commands capture redo and undo operations, while `render-scheduler.js` coalesces visual work and persistence requests. Viewport translation is renderer state; `coordinates.js` converts local and logical world coordinates. `world-origin.js` rebases very large translations without changing logical positions or screen pixels.

## Canvas pipeline

`component-renderer.js` renders registered components and responsive styles. Focused input modules own pan, zoom, selection, transform, clipboard, layer, alignment, grouping, connection, template, saved-view and inspector behavior. `snapping.js`, `selection-transform.js` and `component-tree.js` contain pure geometry/tree operations shared by those controllers.

## Browser workbench

`workspace-store.js` is the single authority for files, virtual folders, loaded buffers, baselines, dirty/staged state and local commits. `source-files.js` is the recursive repository inventory. Explorer, editor, search, source control, terminal, preview and activity modules consume the store rather than maintaining competing file state.

Preview compilation in `preview-runner.js` resolves current workspace content, remaps local modules and inserts a preview-specific Content Security Policy. Preview output runs in an opaque sandbox and cannot inherit the parent page's privileges.

## Persistence and recovery

`storage.js` provides fast local canvas/layout bootstrap and legacy migration. `indexed-db.js` provides durable key/value storage; `durable-persistence.js` coordinates document, workspace, editor session, settings, panel layout and recovery snapshots. `backup-manager.js` validates full-workspace import/export packages and creates recovery points before destructive operations.

The browser workspace is intentionally local: its commits model source-control workflows but do not push credentials or code to a remote service.

## Trust and security

`security.js` centralizes URL, CSS, identifier, MIME and filename validation. `workspace-trust.js` supplies restricted/trusted state. `extension-host.js` permits built-in contributions in Restricted Mode and gates third-party extension activation and execution behind explicit trust.

The parent document uses a restrictive Content Security Policy, no inline event handlers, no inline scripts and no external runtime dependencies. Export and preview boundaries re-sanitize user-controlled values.

## Offline lifecycle

`manifest.webmanifest` describes the installable app. `pwa-input.js` registers `service-worker.js`, whose application shell derives from `WORKSPACE_FILES`. Changing repository content requires a service-worker cache-version bump.

## Repository invariants

- `WORKSPACE_FILES` exactly equals the recursive repository inventory and remains sorted.
- Every root CSS colony is linked once from `index.html`.
- Every runtime JavaScript file is reachable from `main.js` or `service-worker.js`.
- Every relative module import and HTML asset reference resolves.
- The README Unicode tree exactly matches the repository.
- HTML IDs are unique, bound IDs exist, controls have accessible names, and CSP invariants remain present.

Run `npm run test:all` to enforce these contracts.
