# Security policy

## Supported version

Security updates target the current `main` branch and latest tagged release.

## Reporting a vulnerability

Do not publish exploit details in a public issue. Use the repository's private GitHub Security Advisory reporting flow and include affected files, reproduction steps, impact and any suggested mitigation. Avoid including real credentials or private workspace content.

## Security model

CREED is a static, same-origin browser application. It stores project state locally and does not require an application backend. The primary risks are untrusted workspace content, extension code, preview/export injection, unsafe URL schemes, persistence corruption and service-worker cache mistakes.

Current controls include:

- a restrictive parent Content Security Policy with no inline runtime scripts or handlers;
- opaque sandboxed preview frames with a separately generated preview policy;
- Restricted Mode and explicit trust before non-built-in extension activation or command execution;
- centralized URL, CSS, identifier, MIME type and download-name validation;
- escaped/sanitized HTML, CSS and WordPress export output;
- validated, versioned document/workspace backups and recovery points before destructive restore/reset operations;
- same-origin service-worker caching derived from the authoritative repository inventory;
- path normalization that rejects absolute paths and `.`/`..` traversal segments.

## Maintainer checklist

Run `npm run test:all` and `git diff --check` for every security-sensitive change. Confirm the CSP, preview sandbox, extension trust gate, exporters, backup validation and cache version remain covered by tests. Review new dependencies and external origins explicitly; the current production runtime has none.
