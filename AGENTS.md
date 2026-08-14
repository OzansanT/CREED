# CREED Agent Rules

## File ownership

### CSS
- New CSS component → create a new CSS file.
- Existing component update → modify its existing file.
- Do not create duplicate update files such as `-v2`, `-fix`, `-new`, `-updated`, `-copy`, or `-final`.

### JavaScript
- New JS feature → create a new JS file.
- Existing feature update → modify its existing file.
- Keep one clear feature/responsibility per file.
- Keep `main.js` small; use it mainly to import, initialize, bind, connect, and coordinate modules.

## Before creating a file

```text
Does a file already own this feature/component?
│
├── YES → Update that file.
│
└── NO
    └── New independent responsibility?
        ├── YES → Create a new file.
        └── NO  → Use the correct existing owner.
```

Do not duplicate existing functionality.

## File integration

Every new file must be connected to the project.

- CSS: update the required HTML `<link>` relationship.
- JS: update the required `import` / `export` relationship.
- Remove obsolete links/imports when files move or are deleted.
- Do not leave orphan files.

## Structure

Prefer modular ownership by responsibility. Use the current repository structure unless a structural change is genuinely needed.

```text
css/
├── base/
├── layout/
├── components/
└── pages/

js/
├── main.js
├── core/
├── features/
├── ui/
└── utils/
```

Do not reorganize existing files only to match this example.

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

Regenerate the actual linking/import tree after every update.

```text
index.html
├── CSS
│   └── ...
└── JavaScript
    └── main.js
        └── ...
```

Only show relationships that actually exist through HTML `<link>` / `<script>` references or JavaScript `import` / `export` dependencies. Do not invent dependencies.

## Core rule

```text
NEW COMPONENT / FEATURE
        ↓
CREATE NEW FILE

EXISTING COMPONENT / FEATURE
        ↓
UPDATE EXISTING FILE
```
