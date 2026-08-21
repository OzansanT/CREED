# CREED Post-Roadmap Integration Audit

This audit validates interactions between roadmap features after #1–#100 were merged.

## Cross-feature defects fixed

1. AI chat cancellation: starting a New Chat while a provider request was running could leave the composer locked and could allow cancelled responses to execute tool calls.
2. Infinite Reset maximization: the Bottom Panel and Secondary Sidebar could remain maximized even after reset restored visibility and dimensions.
3. Diagnostics freshness: Problems diagnostics could use a stale rendered graph and did not automatically refresh after WorkspaceFS mutations.
4. Graph diagnostic annotations: system-graph DOM rerenders could remove diagnostic outlines until diagnostics were manually rerun.
5. Terminal branch display: the terminal prompt always displayed `(main)` even after browser-local Source Control switched branches.
6. Merge conflict keep-current: Accept Current could try to stage an unchanged HEAD file and fail.
7. Primary editor external mutations: branch switches, terminal mutations, AI patches, and other WorkspaceFS writes could leave Explorer/editor caches stale.
8. Split editor rename lifecycle: intermediate delete events during file/directory renames could discard split-editor sessions before the final rename event.

## Regression gate

`npm run check:integration` validates the cross-feature contracts above and is included in the full `npm run check` gate.
