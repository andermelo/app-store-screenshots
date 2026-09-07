---
name: app-store-screenshots
description: Create and update App Store screenshot campaigns from real iOS captures or supplied PNGs. Use for store screenshots, localized marketing boards, adding scenes to existing campaigns, and editable Figma, Sketch or HTML/PNG exports. Supports repeatable Maestro capture and existing deterministic app drivers.
---

# App Store screenshots

Use Maestro by default for Simulator capture, or reuse an existing tested app driver. Compose in the user-selected target: Figma, Sketch, or browser-native HTML. Preserve an existing campaign's target and saved state. Do not introduce a general-purpose design editor, database, bundled browser, or another capture application.

For supplied images, incremental campaign updates, or fast capture, read [fast-capture.md](.agents/skills/app-store-screenshots/references/fast-capture.md). Skip capture setup when usable screenshots already exist; validate and compose the requested scenes directly.

The focused HTML campaign editor—including copy, typography, and curated layout controls—belongs only to the HTML route described in [html-fallback.md](.agents/skills/app-store-screenshots/references/html-fallback.md). Do not open, generate, or rely on that editor during Figma or Sketch runs.

When the user explicitly asks for Goldie-style HTML controls or compatible layout choices, also read [goldie-studio-patterns.md](.agents/skills/app-store-screenshots/references/goldie-studio-patterns.md). Preserve the campaign's established composition as the first/default preset unless the user asks to replace it.

Never synthesize or retouch the product UI with an image model. Keep the real app screenshot and marketing copy as separate editable layers in the selected target.

When the campaign asks for an editorial or magnified treatment, read [creative-composition.md](.agents/skills/app-store-screenshots/references/creative-composition.md). A magnifier is always a clipped, uniformly scaled clone of the same localized screenshot asset—not OCR, reconstructed UI, or a generated approximation.

## Requirements

- For new Maestro captures: Maestro CLI with `test` and `takeScreenshot`; use 2.7.0 or newer with Xcode/iOS 26.
- For new captures: a booted iOS Simulator with the app installed and deterministic demo data. Supplied PNGs need neither Simulator nor Maestro.
- For Figma: the remote Figma MCP server with `upload_assets` and `use_figma`, Figma's foundational `figma-use` skill, and a destination Design file with edit access.
- For Sketch: an installed, verified Sketch integration capable of creating or updating native editable documents. Do not promise Sketch output until that capability passes preflight.
- For HTML: a system-installed browser; never download or bundle Chromium.

If a capability is unavailable, complete any independent local work, then report the missing piece. Do not invent Maestro, Figma, or Sketch parameters.

## Campaign workspace

Keep generated state under `.store-screens/` in the app repository:

```text
.store-screens/
  config.yaml
  copy.yaml
  flow.yaml
  raw/<locale>/<scene>.png
  exported/<locale>/<index>_<scene>_<locale>.png
  html/                         # HTML target only
  figma-manifest.json
  sketch-manifest.json
  STATUS.md
```

If these files are absent, copy `config.yaml`, `copy.yaml`, and `flow.yaml` from this skill's `.agents/skills/app-store-screenshots/assets/` directory. Read [configuration.md](.agents/skills/app-store-screenshots/references/configuration.md) before adapting them.

## Workflow

### 1. Resolve the campaign

Determine the requested scenes and locales. Reuse the target recorded in an existing campaign or explicitly selected by the user. Only when unresolved, ask: **"Where should we compose and export this campaign: Figma, Sketch, or HTML?"** Record the choice as `compositionTarget`. Resolve bundle ID and Simulator only when new capture is needed.

Do not start another target as a fallback when the selected one is blocked. Report the blocker and ask whether the user wants to switch. Figma and Sketch writes are external mutations: perform them only after that target was selected and its destination was supplied or confirmed.

Use valid BCP-47 tags for campaign folders and copy. Keep the exact Maestro/device locale and Apple launch values separately in `config.yaml`; do not derive them mechanically.

### 2. Preflight once

Read [maestro-capture.md](.agents/skills/app-store-screenshots/references/maestro-capture.md). Confirm `maestro --version`, a booted Simulator, and the installed app. Use Maestro Studio only while discovering selectors; the checked-in YAML flow is the durable automation.

Preflight only the selected composition target. For Figma, read [figma-sync.md](.agents/skills/app-store-screenshots/references/figma-sync.md), confirm the authenticated identity, inspect the target template, and resolve actual node IDs before writing. For Sketch, verify the installed integration and its current command/API help before promising native output. For HTML, confirm a system browser and read [html-fallback.md](.agents/skills/app-store-screenshots/references/html-fallback.md).

Never capture passwords, tokens, personal messages, production customer data, or other secrets. Prefer fixture accounts, seeded content, and deterministic dates/network responses.

### 3. Author one capture flow

Prefer one `flow.yaml` that visits all requested scenes and runs `takeScreenshot` at each postcondition. Use stable accessibility IDs first, visible text second, and coordinates only as a last resort.

Do not duplicate the flow per locale unless localized visible-text selectors or right-to-left layout make an override necessary. A failed step should be corrected in the smallest relevant flow section.

### 4. Capture each locale

Maestro cannot set the locale inside a Flow, and local `maestro test` does not accept `--device-locale`. Prepare the locale before executing the flow using one supported strategy from [maestro-capture.md](.agents/skills/app-store-screenshots/references/maestro-capture.md).

For each locale:

1. Set the locale and establish deterministic app state.
2. Run the same Maestro flow against the chosen Simulator.
3. Write screenshots directly to `.store-screens/raw/<locale>/` with `--test-output-dir`.
4. Verify each scene's postcondition and PNG count.
5. Run `.agents/skills/app-store-screenshots/scripts/png_inventory.py` and record results in `STATUS.md`.

Retry a failed locale/scene at most twice before stopping to fix its selector or state setup.

### 5. Compose in the selected target

Follow exactly one branch. Do not create the HTML editor alongside Figma or Sketch output unless the user later asks to switch or add HTML.

#### Figma

Follow [figma-sync.md](.agents/skills/app-store-screenshots/references/figma-sync.md):

1. Inspect the template's frame, screenshot slot, headline, and subhead nodes.
2. Create or update one generated frame per locale and scene without overwriting the source template.
3. Place each Maestro PNG into `@screenshot` with `upload_assets`.
4. Apply localized copy from `copy.yaml` with `use_figma`; keep text editable.
5. Record generated node IDs and content hashes in `figma-manifest.json` so reruns update instead of duplicate.

For `composition.mode: editorial-zoom`, preserve the full screenshot and add the configured zoom callouts as editable clipping frames. Enforce `safeMarginPx` at the outer canvas and between overlapping elements; it must never be lower than 24 px. Keep emojis and decorative app assets on independent layers so they remain replaceable without touching the product UI.

If `upload_assets` is unavailable, stop the Figma phase. Do not push image bytes through unsupported APIs inside `use_figma`.

#### Sketch

Use only a verified installed Sketch integration that produces native editable layers and artboards. Preserve the real screenshot as an image layer, marketing copy as text layers, and zoom callouts as clipped clones of the same screenshot. Record document, page, and artboard identities in `sketch-manifest.json`. If no verified integration is available, mark Sketch blocked and ask whether to switch targets; do not open the HTML editor automatically.

#### HTML

Follow [html-fallback.md](.agents/skills/app-store-screenshots/references/html-fallback.md) and build the editor from the shell in `.agents/skills/app-store-screenshots/assets/editor/` as specified in [editor-design.md](.agents/skills/app-store-screenshots/references/editor-design.md); do not restyle the chrome per campaign. This is the only branch that may create or open the focused campaign editor. When the user wants the editor inside a claude.ai Artifact or as an offline file, bundle it with `.agents/skills/app-store-screenshots/scripts/bundle_single_file.py`. Do not add a magnifier or zoom-callout editor to the HTML route; those treatments belong to Figma or Sketch. When HTML includes an App Store listing preview, resolve and bundle the app's real iOS marketing icon with `.agents/skills/app-store-screenshots/scripts/bundle_app_icon.py` before opening the editor. Treat the user's saved copy, typography, and layout state as authoritative and keep the export manifest idempotent for repeatable PNG output.

### 6. Review and export

Inspect at least one composed frame per locale and every frame for long-copy or right-to-left locales. Verify the app state, locale, crop, copy, ordering, safe margins, absence of sensitive data, and zoom-source identity when a Figma or Sketch composition includes a zoom. Record any untranslated product content visible inside the immutable screenshot as an app-localization gap; never conceal it by editing pixels.

Use the selected target's verified export path. For Figma, use `download_assets` only when the user asks for local final exports. Save files as `exported/<locale>/<index>_<scene>_<locale>.png` and validate count and dimensions locally.

## Completion conditions

Do not call the campaign complete unless:

- requested scenes have verified source PNGs; full new captures match the declared locale/scene matrix, while incremental updates verify only their requested additions;
- every capture is a readable PNG from the intended app state and locale;
- every requested composition exists exactly once in the selected target with the correct bitmap and copy;
- visual review covers every locale;
- `STATUS.md` identifies completed, skipped, and blocked phases.

Report counts, locales, scenes, local paths, and the selected target destination when used. Publishing to App Store Connect requires a separate explicit request.
