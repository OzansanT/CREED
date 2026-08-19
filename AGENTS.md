# CREED Agent Rules

## File ownership

### CSS
- New CSS component → create a new CSS source file in the owning CSS colony.
- Existing component update → modify its existing CSS source file.
- Do not create duplicate update files such as `-v2`, `-fix`, `-new`, `-updated`, `-copy`, or `-final`.
- Each visual component keeps one `*-main.css` entry point that imports its focused colony files.
- `css/creed-main.css` is the CSS source entry point.
- `index.html` must load only `css/generated/creed.css`; do not add direct HTML `<link>` tags for CSS colony files.
- After CSS source changes, run `node scripts/build-css.mjs` and keep `css/generated/creed.css` synchronized.

### JavaScript
- Application JavaScript lives under `js/`; repository-root `main.js` is only the compatibility bootstrap for `js/main.js`.
- `js/main.js` is orchestration glue: import, initialize, bind, connect, and coordinate modules. Keep feature implementation out of it.
- Shared constants, mutable state, DOM lookup, coordinate conversion, and persistence belong in `js/core/`.
- UI helpers that are not owned by one component belong in `js/ui/`.
- Component behavior belongs in `js/components/<component>/`, mirroring the CSS component-colony model where practical.
- Multi-file component controllers should expose one focused `*-main.js` entry point when a stable component entry is useful.
- New JS feature → create a new file in its owning colony.
- Existing feature update → modify its existing owner file.
- Keep one clear feature/responsibility per file.
- Do not add manual cache-version query strings to internal ES-module imports.
- Do not create duplicate update files such as `-v2`, `-fix`, `-new`, `-updated`, `-copy`, or `-final`.

## Before creating a file

```text
Does a file already own this feature/component?
│
├── YES → Update that file.
│
└── NO
    └── New independent responsibility?
        ├── YES → Create new file in the owning colony.
        └── NO  → Use the correct existing owner.
```

Do not duplicate existing functionality.

## File integration

Every new file must be connected to the project.

- CSS: connect the source file through its owning `*-main.css`; connect a new component entry through `css/creed-main.css`; then rebuild `css/generated/creed.css`.
- JavaScript: connect the module through its owning component entry or `js/main.js` orchestration entry.
- Keep cross-colony dependencies explicit through relative `import` / `export` paths.
- Remove obsolete CSS imports, JS imports, and generated inventory entries when files move or are deleted.
- Do not leave orphan files.

## Structure

```text
css/
├── foundation/
├── primitives/
├── layout/
├── components/
└── generated/

js/
├── main.js
├── core/
├── components/
└── ui/
```

Component JavaScript should align with the owning workbench region rather than accumulating at repository root.

## Required validation

After code changes run:

```text
npm run check
```

After adding, renaming, or deleting repository files also run:

```text
npm run build:inventory
npm run check
```

The check must fail for stale generated CSS, duplicate or missing required IDs, missing relative JS dependencies, JavaScript syntax errors, stale Explorer inventory, legacy DOM tokens, manual cache-versioned internal module imports, or application JS leaking back into repository root.

## Required after every code or structural update

### 1. Files changed

```text
[A] Added
[M] Modified
[D] Deleted
[R] Renamed
```

### 2. Current Unicode directory tree

Regenerate the tree from the actual current repository state after every update.

### 3. Current file relationship tree

Regenerate the actual source relationship tree after every update.

Only show relationships that actually exist through HTML `<link>` / `<script>` references, CSS `@import`, or JavaScript `import` / `export` dependencies. Do not invent dependencies or use wildcard placeholders as if they were concrete relationships.

## Core rule

```text
NEW COMPONENT / FEATURE
        ↓
CREATE NEW FILE IN OWNING COLONY

EXISTING COMPONENT / FEATURE
        ↓
UPDATE EXISTING OWNER FILE
```
