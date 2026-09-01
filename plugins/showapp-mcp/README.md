# ShowApp MCP plugin

This directory is a self-contained Codex and Claude Code plugin for ShowApp.

- `dist/showapp.mjs` is a bundled 3.6 MB runtime. Chrome itself is not bundled.
- `web/` contains the build-free browser Studio.
- `skills/showapp/SKILL.md` teaches agents the capture, composition, localization, and export workflow.
- `.mcp.json` starts the same bundled server in Codex and Claude Code.

Build and verify from the repository root:

```bash
npm install
npm run build --workspace showapp-mcp
npm test
npm run doctor
```

ShowApp stores data locally under `~/.showapp` unless `SHOWAPP_DATA_DIR` is set. It never needs an AI provider key; the MCP host supplies the intelligence and ShowApp applies deterministic design operations.
