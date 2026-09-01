---
name: showapp
description: Create, capture, edit, localize, preview, and export App Store screenshots with the local ShowApp Studio and MCP tools. Use when the user asks for App Store or Play Store screenshots, screenshot localization, agent-driven browser capture, multi-screen compositions, shared backgrounds, or opening the ShowApp editor.
---

# ShowApp workflow

Use ShowApp as a local design engine. The coding agent supplies reasoning and translated copy; ShowApp supplies deterministic capture, editing, persistence, preview, and export. Never ask the user for an AI provider API key.

## Start or resume

1. Call `showapp.project_list` before creating a project unless the user clearly requested a new one.
2. Reuse the relevant existing project when possible.
3. Use `showapp.project_get` before making significant edits so you have current screen, layer, and locale identifiers.
4. Open the visual editor with `showapp.editor_open` when the user wants to see or directly adjust the design.

## Capture real app states

For web apps, use a dedicated visible Chrome session:

1. Call `showapp.browser_open` with the app URL and target viewport.
2. Call `showapp.browser_inspect` to understand the visible state.
3. Use `showapp.browser_click`, `showapp.browser_type`, `showapp.browser_press`, and `showapp.browser_wait` to reach a meaningful product state.
4. Call `showapp.browser_capture` to add that exact state as an editable screen.
5. Repeat the interaction/capture loop for each story beat.
6. Close the capture session with `showapp.browser_close` when finished.

Never capture passwords, tokens, personal messages, production customer data, or other secrets. Prefer demo accounts and deterministic fixture data.

## Compose screens

- Treat source captures as locale-aware screen assets, not flattened finished designs.
- Use editable text layers for headlines and supporting copy.
- Use image layers for logos and decorative imagery, shape layers for visual structure, and emoji layers for expressive accents.
- Use the project shared background when the design should flow continuously across screens.
- Use per-screen backgrounds when each screen needs an independent composition.
- Preserve layer ordering, safe margins, readable contrast, and a clear visual hierarchy.
- Use Focus mode for precise work and Canvas mode to assess rhythm and continuous backgrounds across the complete set.

## Localize at scale

- Use valid BCP-47 locale codes.
- Add locales in bulk with `showapp.locale_add_many`.
- Translate with the host model, keeping App Store copy concise and culturally natural.
- Apply translated layer content in bulk with `showapp.layer_localize_many`; batch large campaigns rather than issuing one tool call per string.
- Assign locale-specific source screenshots with `showapp.screen_assets_set_many` whenever the app UI itself is localized.
- Review right-to-left locales visually before export.
- Do not silently fall back when the user requests complete localization. Inspect coverage and report any locale that lacks copy or imagery.

## Export

1. Inspect the final project state.
2. Open Canvas mode for a final visual check.
3. Call `showapp.export` with `locales: "all"` unless the user requested a subset. Use `strict_localization: true` for a final release export.
4. Report the number of generated images, locale count, output directory, and ZIP path.

Exports are rendered by the user's installed Chrome. No Electron, bundled Chromium, Remotion, or external AI service is required.
