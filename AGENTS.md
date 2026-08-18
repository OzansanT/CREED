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
- New JS feature → create a new JS file.
- Existing feature update → modify its existing file.
- Keep one clear feature/responsibility per file.
- Keep `main.js` small; use it mainly to import, initialize, bind, connect, and coordinate modules.
- Do not add manual cache-version query strings to internal ES-module imports.

## Before creating a file

```text
Does a file already own this feature/component?
│
├── YES → Update that file.
│
└── NO
    └── New independent responsibility?
        ├── YES → Create new file.
        └── NO  → Use the correct existing owner.
```

Do not duplicate existing functionality.

## File integration

Every new file must be connected to the project.

- CSS: connect the source file through its owning `*-main.css`; connect a new component entry through `css/creed-main.css`; then rebuild `css/generated/creed.css`.
- JavaScript: update the required `import` / `export` relationship from the owning module or `main.js` orchestration entry.
- Remove obsolete CSS imports, JS imports, and generated inventory entries when files move or are deleted.
- Do not leave orphan files.

## Structure

Prefer modular ownership by responsibility. Use the current repository structure unless a structural change is genuinely needed.

```text
css/
├── foundation/
├── primitives/
├── layout/
├── components/
└── generated/

js modules
├── main.js
├── focused feature modules
└── focused input/controller modules
```

Do not reorganize existing files only to match an example.

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

The check must fail for stale generated CSS, duplicate or missing required IDs, missing relative JS dependencies, JavaScript syntax errors, stale Explorer inventory, legacy DOM tokens, or manual cache-versioned internal module imports.

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

```text
CREED/
├── index.html
├── ...
└── ...
```

### 3. Current file relationship tree

Regenerate the actual source relationship tree after every update.

```text
index.html
├── CSS
│   └── css/generated/creed.css
└── JavaScript
    └── main.js
        └── ...

css/creed-main.css
└── actual @import dependencies
```

Only show relationships that actually exist through HTML `<link>` / `<script>` references, CSS `@import`, or JavaScript `import` / `export` dependencies. Do not invent dependencies or use wildcard placeholders as if they were concrete relationships.

## Core rule

```text
NEW COMPONENT / FEATURE
        ↓
CREATE NEW FILE

EXISTING COMPONENT / FEATURE
        ↓
UPDATE EXISTING FILE
```
