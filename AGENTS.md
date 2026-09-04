# App Store screenshots skill contributor guide

This repository is the `app-store-screenshots` skill: a skill-first replacement for the earlier ShowApp runtime.

- The canonical skill lives at `.agents/skills/app-store-screenshots/`.
- `.claude/skills/app-store-screenshots` and `plugins/app-store-screenshots/skills/app-store-screenshots` are symlinks to the canonical directory so Claude Code discovers the skill in this repo and the plugin marketplace can package it. Never copy the skill; keep the symlinks.
- The HTML editor chrome comes from `assets/editor/` (`editor.css`, `icons.svg`, `shell.html`) and `references/editor-design.md`. Change the design system there, not inside a campaign.
- Keep the root `SKILL.md` copy aligned with the canonical entrypoint. Its links may differ only so they resolve correctly from the repository root.
- Do not restore the deleted ShowApp runtime (Node server, custom editor, database) unless the user explicitly requests it. The deliverable is the skill plus its Figma, Sketch, HTML and Artifact outputs; no server of our own.
- The existing `veoshot` repository is reference-only. Never modify it from this repository.
- Keep the solution lightweight: no Electron, Remotion, bundled Chromium, database, custom editor, or user-provided AI keys.
- Maestro owns Simulator interaction and capture. Figma owns editable composition. Codex owns orchestration, localization, and review.
- Every user-facing text layer and screenshot asset must support arbitrary valid BCP-47 locales.
- Store generated campaign files under `.store-screens/`; do not commit screenshots, temporary asset URLs, credentials, or production data.
- Never invent Maestro options or Figma MCP parameters. Verify the installed command help or current official documentation before changing tool-specific instructions.
- Prefer Maestro accessibility-ID selectors. Localized visible-text selectors may require small locale-specific overrides.
- Use Figma `upload_assets` for external PNGs and `use_figma` for editable nodes. Do not embed local image bytes through unsupported Figma Plugin API calls.
- Do not overwrite source Figma templates. Generated frames must be idempotently tracked in `figma-manifest.json`.
- Figma writes and App Store Connect publishing require an explicit user request.

Before handing off skill changes:

```bash
uv run --with pyyaml python \
  ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/app-store-screenshots

git diff --check
```

When the editor shell changes, regenerate a campaign editor, screenshot it in light and dark, and export two routes with `render_html_pngs.py`; also run `bundle_single_file.py --mode artifact` and confirm the bundle stays under 16 MiB.

When Maestro instructions change, verify them against `maestro --help` and the relevant subcommand help. When the PNG helper changes, smoke-test it against a valid PNG and verify `--expect` and `--same-size` failure behavior.
