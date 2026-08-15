# Contributing to CREED

## Local setup

CREED has no production dependencies. Use Node.js 22 or newer for validation and any static HTTP server for manual testing.

```bash
npm run test:all
python -m http.server 8000
```

Open `http://localhost:8000`; direct `file://` loading does not support the module and workspace-fetch model.

## Change ownership

Read `AGENTS.md` before editing. Extend an existing feature in its owning file. Add a file only for a genuinely new responsibility, keep `main.js` as orchestration, and connect every new CSS or JavaScript module to the real runtime graph.

When repository files change:

1. Update the sorted `WORKSPACE_FILES` list in `source-files.js`.
2. Update the README Unicode repository tree.
3. Add the real link/import/export dependency.
4. Bump `CACHE_VERSION` in `service-worker.js` when the offline shell changes.
5. Add or update focused tests.

## Quality gate

Run the complete gate before opening a pull request:

```bash
npm run test:all
git diff --check
```

`npm run check` validates syntax, inventory, imports, runtime reachability, HTML IDs/references, CSP, CSS links, PWA assets and documentation inventory. `npm test` exercises document, command, canvas, workspace, durability, export, extension and security behavior. `npm run smoke` serves and fetches every repository asset.

## Pull requests

- Keep each change scoped and explain user-visible behavior.
- Use `[A]` for added files/features and `[M]` for modified files/features in the change summary.
- Include tests for new behavior and regression fixes.
- Do not commit generated coverage, logs, dependencies or credentials.
- Never weaken sandbox, trust, sanitizer or Content Security Policy boundaries without a documented security review.
