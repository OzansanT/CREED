# Changelog

All notable changes to CREED are documented here. The project follows semantic versioning.

## [2.0.0] - 2026-08-15

### Added

- Versioned CREED document schema, migration, command history and scheduled rendering.
- Full infinite-canvas builder with lasso and multi-selection, snapping, resize/rotate, hierarchy, responsive inspector, tokens, templates, connections, minimap, saved views and export formats.
- Functional browser workbench with Explorer CRUD, multi-tab source editor, Quick Open, command palette, search/replace, source control, preview, terminal, bottom panels, contextual assistant and extension contributions.
- IndexedDB durability, recovery snapshots, validated backup import/export and editor-session restoration.
- Themes, Turkish/English shell localization, layout presets, mobile overlays, keyboard navigation, accessibility announcements and reduced-motion support.
- Workspace trust, Restricted Mode, output sanitization, sandboxed preview, Content Security Policy and installable offline PWA support.
- Node test suites, recursive repository validator, HTTP smoke test and GitHub Actions CI.
- Architecture, contribution and security documentation.

### Changed

- Replaced independent canvas values with one normalized application document.
- Reworked viewport, pointer and storage flows to preserve state under zoom, rebasing, reload and unavailable browser storage.
- Expanded the static mock interface into a working local design-and-source environment.

## [1.0.0] - 2026-08-15

### Added

- Initial Codespaces-inspired shell and pan/zoom canvas prototype.
