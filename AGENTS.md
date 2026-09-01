# ShowApp MCP contributor guide

This repository is the browser-first, local-first successor experiment for ShowApp.

- The existing `veoshot` repository is reference-only. Never modify it from this repository.
- Keep the runtime light: no Electron, Remotion, bundled Chromium, or user-provided AI keys.
- `plugins/showapp-mcp/src/core` owns domain behavior and SQLite persistence.
- MCP, CLI, HTTP, and the web editor are adapters over the same core.
- Store binary assets on disk and only metadata/paths in SQLite.
- Every user-facing text layer and screenshot asset must support arbitrary BCP-47 locales.
- Keep stdout protocol-clean when running the MCP stdio transport; diagnostics go to stderr.
- Use `npm test` and `npm run doctor` before handing off changes.
