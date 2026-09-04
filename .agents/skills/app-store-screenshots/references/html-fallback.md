# Browser-native HTML fallback

Use this workflow only when the campaign's selected `compositionTarget` is `html`, or after the user explicitly switches to HTML from a blocked Figma or Sketch run. Never create or open the interactive HTML editor merely because another target is unavailable.

## Constraints

- Use plain HTML, CSS, and browser JavaScript. Do not add Electron, Remotion, a general-purpose design editor, a database, or a bundled Chromium download. A focused campaign editor for copy, typography, and curated layout adjustments is allowed when the user requests it.
- Keep every localized screenshot as an immutable `<img>` layer. Do not add a magnifier or zoom-callout editor to the HTML route; route those treatments to Figma or Sketch after an explicit target choice.
- Keep headline, subhead, emoji, and decorative assets as separate DOM elements.
- Enforce the same `safeMarginPx >= 24` contract as Figma.
- Serve the campaign directory over localhost; do not depend on `file://` behavior or remote CDNs. When a campaign uses Google Fonts or another approved font source, download the required files into the campaign, declare local `@font-face` rules, and inline those files during client-side export.
- Store the entry HTML and render manifest under the campaign directory and final PNGs under `exported/<locale>/`.

## Editor design system

Build the editor from the shell in `assets/editor/` (`editor.css`, `icons.svg`, `shell.html`) and follow [editor-design.md](editor-design.md). The shell is a professional, single-accent, hairline-bordered tool with a top bar, a dot-grid canvas, a tabbed inspector and a status bar; it ships light and dark themes through tokens and reads `data-theme` from the host. Do not redesign the chrome per campaign; only the board artwork inside `<style id="campaign-css">` is campaign-specific. Copy `editor.css` next to `index.html` and record it as `htmlFallback.editorStylesheet` in `config.yaml`.

## Focused HTML editor contract

When the user wants a browser-native visual editor:

- Show one locale's complete scene set at a time behind a locale selector. Do not repeat identical locale sets side by side. Keep preview metadata rows at a fixed height so localized labels never shift the boards vertically.
- Keep the visible scene previews in one non-wrapping horizontal row at a consistent size. On narrow windows, scroll the row instead of wrapping it. Selecting a scene must not resize or reflow any preview; use only a distinct border, outline, or color treatment to identify the board being edited.
- Keep localized headline and description text independent for every `<locale>/<scene>` route. Synchronize typography and layout properties by stable scene ID across locales without replacing translated text.
- Keep the workspace header compact. Prefer a top-left icon menu with accessible names and tooltips so controls do not consume the canvas.
- An optional eye-icon action may open a read-only App Store listing preview for the currently selected locale. Build it from clones of the current live boards after removing editing guides and controls, so it reflects unsaved visual adjustments without changing campaign state. Show the real bundled app icon, localized subtitle, an accessible horizontal screenshot carousel, close/Escape handling, and optional light/dark preview themes. Label placeholder ratings, size, ranking, or other non-authoritative store metadata as illustrative; never present invented values as real App Store data. Exclude the entire listing preview from render routes and PNG exports.
- Show safe-area and selection guides only while editing. Remove these affordances from the exported image.
- Make headline and description text directly editable and expose focused typography controls for family, size, weight, line height, letter spacing, style, alignment, and color. Default to the product's real type choices when known; preserve arbitrary valid font-family stacks.
- Export the current DOM state. The user's saved copy, typography, layout, background, device treatment, and scene order are authoritative.
- Persist portable design and typography state as `canvas-settings.json`, keyed by BCP-47 locale and stable scene ID. Load that file before applying browser-local state so the same layout can be batch-rendered later.

These focused interaction controls are a campaign adjuster, not permission to grow the fallback into a general-purpose freeform design tool.

## App icon bundling

Before opening an HTML editor that has the App Store preview, copy the real product icon into the campaign so the page never depends on an absolute source-repository path:

```bash
python .agents/skills/app-store-screenshots/scripts/bundle_app_icon.py \
  /path/to/app-repository \
  --output .store-screens/campaign/html/assets/app-icon.png
```

The helper reads Xcode asset-catalog metadata and prefers the `ios-marketing` 1024×1024 PNG in `AppIcon.appiconset`. Use `--asset-name` when the target's `ASSETCATALOG_COMPILER_APPICON_NAME` is not `AppIcon`. If the repository has more than one valid candidate, resolve the intended target from the campaign bundle ID and Xcode build settings, then pass its PNG with `--source`; never guess between targets. If no suitable source icon exists, ask the user for one instead of inventing or generating it.

Record both the source path and campaign-local path in `config.yaml`. Reference only the local relative path from HTML, for example `assets/app-icon.png`, and give the `<img>` a meaningful app-name alt text. Verify the image loads with a nonzero `naturalWidth` before marking the preview ready. Treat the copied icon as a generated campaign asset under `.store-screens/`; do not alter the asset catalog or commit the copied file.

## Lightweight layout studio

When the user explicitly requests broader layout experimentation, the focused HTML editor may expose a small campaign-level design palette while remaining plain HTML/CSS/JavaScript:

- preserve the campaign's approved composition as the first and default preset;
- provide reusable layout families, template sequences, background presets plus custom color/gradient controls, campaign-wide font presets, bezel/screen-only treatments, and per-scene layout overrides;
- keep visual choices synchronized by stable scene ID across locales while localized headline and description text remain independent;
- let users reorder scenes by drag or compact move actions, and update display/export order deterministically;
- provide undo/redo for design, typography, and ordering changes, including standard keyboard shortcuts;
- keep editor appearance controls separate from exported board appearance;
- maintain one board and one exported PNG per locale/scene. Layouts inspired by multi-board panoramas must be adapted inside that single board unless the campaign manifest is explicitly changed;
- use a secondary real localized screenshot from the same campaign only when a layout calls for two devices. Never synthesize, translate, or rebuild app UI;
- keep the editable panel compact and collapsible; color swatches and template thumbnails should be dense but fully visible rather than clipped.

This is a curated App Store composition surface, not a freeform canvas. Do not add arbitrary node creation, plugins, accounts, cloud sync, a database, or a bundled rendering runtime. If implementing controls derived from an open-source studio, retain its required notices and record the exact source/version in a campaign-local third-party notice. For the Goldie-derived control vocabulary and attribution requirements, read [goldie-studio-patterns.md](goldie-studio-patterns.md).

## Render contract

The HTML must support a deterministic query route:

```text
?render=<locale>/<scene>
```

In render mode, show exactly one board at its native pixel size, positioned at `(0, 0)`, with no toolbar, margins, scrollbars, transitions, or animation. Wait for `document.fonts.ready` and every image before marking the page ready. Expose readiness as `document.documentElement.dataset.renderReady = "true"`.

Keep an `export-manifest.json` beside the HTML:

```json
{
  "width": 1206,
  "height": 2622,
  "renders": [
    {
      "route": "en-US/home",
      "filename": "en-US/01_home_en-US.png"
    }
  ]
}
```

The route list is the idempotent mapping from campaign scene to PNG. Keep locale tags valid BCP-47 and filenames deterministic.

## Single-file builds (Artifacts and offline files)

When the user wants the editor to open without a server, or inside a claude.ai Artifact, run `scripts/bundle_single_file.py`. It inlines `editor.css`, the campaign fonts, every screenshot, sticker and icon, and `canvas-settings.json`; the page resolves those through the `asset()`, `data-asset` and `window.__CANVAS_SETTINGS__` hooks described in [editor-design.md](editor-design.md). Use `--mode artifact` for the Artifact tool (body fragment, publish with the `downloads` capability so the export buttons can hand PNGs to the viewer) and `--mode standalone` for a file that opens from disk. Keep the bundle under 16 MiB; drop unused font families with `--font-family`. Record the choice under `htmlFallback.singleFile` in `config.yaml`. The shell has no external URLs; never add CDNs or remote fonts.

## Export options

The page should provide a visible export action that serializes one board to SVG `foreignObject`, converts image sources and local font files to data URLs, removes edit-only affordances, draws at native size on a canvas, and downloads PNG. The result must match the visible board's copy, typography, background, device treatment, and layout.

For repeatable batch export, use `scripts/render_html_pngs.py`. It starts a temporary localhost server and drives a system-installed Chrome/Chromium in headless screenshot mode. The helper must never download a browser. Pass `--chrome` if automatic discovery does not find an installed executable.

```bash
python .agents/skills/app-store-screenshots/scripts/render_html_pngs.py \
  .store-screens/campaign/html/index.html \
  --manifest .store-screens/campaign/html/export-manifest.json \
  --output .store-screens/campaign/exported
```

After export, run `png_inventory.py` once per locale with `--expect` and `--same-size`, then visually inspect a contact sheet covering every locale. Browser success alone is not visual proof.

## Reconciliation with Figma or Sketch

Keep content data, asset paths, typography, frame size, and safe margins outside visual markup when practical. Those values form a portable composition blueprint for a later Figma or Sketch implementation. Do not label the HTML output as editable-source parity: text and layers are editable in the HTML, but they are not native design-tool nodes.
