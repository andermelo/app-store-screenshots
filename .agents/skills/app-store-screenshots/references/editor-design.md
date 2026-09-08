# Campaign editor design system

Read this before generating or editing the HTML campaign editor. The editor must look like a professional design tool, not a demo page. Start from the shell assets in `assets/editor/` and keep their contract; do not restyle from scratch per campaign.

## Files

| File | Purpose |
| --- | --- |
| `assets/editor/editor.css` | Editor chrome: tokens, light/dark themes, top bar, canvas, inspector, status bar, store preview, render mode. Copy next to `index.html` as `editor.css`, or inline it for a single-file build. |
| `assets/editor/icons.svg` | Inline SVG sprite, 24×24 viewBox, 1.5 px round strokes. Paste the `<symbol>` set into a hidden `<svg>` at the top of `<body>`; reference with `<svg class="icon"><use href="#i-undo"/></svg>`. |
| `assets/editor/shell.html` | Reference markup for the editor. Every `id` is part of the script contract. |
| `scripts/bundle_single_file.py` | Builds a self-contained HTML (standalone or Artifact fragment). |

Board artwork stays in `<style id="campaign-css">`. That block is the only CSS the PNG export embeds, so campaign tokens (`--ink`, `--teal`, …) live on `.board`, never on `:root`.

## Visual rules

- **One accent.** The shell accent (`--accent`, a calm blue) marks selection, focus and the primary action. The campaign's brand colors belong to the boards, not to the chrome. Never introduce a second chrome accent.
- **Hairlines over shadows.** Panels separate with 1 px `--line` borders. Shadows exist only on the boards, on the primary button and on overlays.
- **Small radii.** 6–8 px for controls, 12 px for overlays. No pill buttons except the App Store "GET" mimic.
- **Compact type.** UI text is 13 px system sans; labels 12 px medium; group titles 11 px uppercase with `.06em` tracking in `--text-3`; numbers and hex values in `--font-mono` with tabular figures. Never exceed weight 600 in the chrome.
- **Icons carry actions.** Every top-bar action is a 32 px icon button with `aria-label` and a `data-tip` tooltip. Only the primary export gets a text label. Icons are stroked, never filled, never emoji.
- **Boards are the hero.** The canvas ground is `--bg` with a faint 22 px dot grid; boards sit in one non-wrapping horizontal row at `--preview-scale`, with a fixed-height caption underneath (index · scene label · layout tag · export icon). Selection is a 2 px accent ring; nothing resizes or reflows on select.
- **Layouts are chosen visually.** "Layout desta tela" and "Layout padrão" are `.layout-picker` grids of `.layout-tile` buttons, each showing the `.layout-glyph` miniature of that family plus its label; the scene picker starts with an `auto` tile that follows the template sequence, and the field label echoes the resolved layout name. Never expose layout families through a plain `<select>`.
- **Inspector is tabbed.** Tabs `Design` (template, background, typography preset, frame, order) and `Texto` (headline, subhead). Fields sit in `.group` sections with `.row-2` grids; selects use the custom chevron; alignment and style are icon segmented controls; colors are a chip plus hex input.
- **Status bar states facts.** Board count, locale count, pixel size, safe margin, local-save indicator, zoom slider. No marketing copy.
- **Confirm file writes with a toast.** Edits auto-persist to `localStorage` silently; only explicit file actions (save or load `canvas-settings.json`, failed export) raise a `.toast` in `#toast-host` above the status bar: one line, a stroked check or x icon, gone after ~2.5 s. A cancelled file picker shows nothing. The save button uses `#i-save`, never the download arrow, so it reads as "persist" rather than "export".
- **Both themes, three states.** Tokens are defined on bare `:root`, redefined under `prefers-color-scheme: dark` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. The theme toggle writes `data-theme` on `<html>`; "system" removes it. This is what lets a claude.ai Artifact host stamp its own theme.
- **Localized chrome.** Write all labels, tooltips and hints in the campaign's source locale. Keep `lang` on `<html>` correct.

## Script contract

The shell markup expects these ids: `locale-seg`, `undo`, `redo`, `load-settings`, `save-settings`, `settings-file`, `toast-host`, `toggle-theme`, `theme-icon`, `appstore-preview-toggle`, `export-current`, `export-all`, `toggle-inspector`, `canvas`, `gallery`, `zoom`, `zoom-value`, `crumb-locale`, `crumb-scene`, `reset-current`, the `.tab[data-tab]` / `.panel[data-panel]` pairs, the design controls (`template-select`, `template-preview`, `default-layout` and `scene-layout` tile pickers, `scene-layout-name`, `background-*`, `font-preset`, `frame-*`, `order-label`, `move-back`, `move-forward`) and the copy controls (`<key>-text|family|size|weight|line-height|letter-spacing|align|style|color|color-text` for `headline` and `subhead`).

Segmented controls are plain `<button data-value>` groups; wrap them with a small `segControl()` helper so they expose `.value` and fire `input`/`change` like form fields. Each `.preview` renders `.board-shell > .board` followed by `.caption`; the caption is the drag handle for reordering.

Persist per-route copy state and campaign design state in `localStorage`, load `canvas-settings.json` first, keep `?render=<locale>/<scene>` deterministic, and expose review deep-links `?theme=dark|light`, `?tab=copy`, `?locale=<tag>`, `?preview=store` (never persisted).

## Asset hooks for single-file builds

So the bundler can inline everything, the page resolves paths through three hooks:

```js
const asset = path => (window.__ASSETS__ && window.__ASSETS__[path]) || path;   // runtime paths
<img data-asset="assets/app-icon.png" src="assets/app-icon.png">                  // static images
const settings = window.__CANVAS_SETTINGS__ || await fetch("canvas-settings.json") // settings
```

Downloads: browsers inside a claude.ai Artifact cannot start downloads, so `downloadBlob()` first tries `window.claude.use("downloads")` and calls `save({filename, data: blob})`; otherwise it falls back to the File System Access API or an `<a download>` link.

## Building a single file

```bash
python .agents/skills/app-store-screenshots/scripts/bundle_single_file.py \
  .store-screens/<campaign>/html/index.html \
  --output .store-screens/<campaign>/html/dist/studio.html \
  --mode standalone            # or --mode artifact
  --font-family Caveat --font-family Roboto   # optional: drop unused families
```

`standalone` is a full document that opens from disk. `artifact` is a body fragment (title + styles + markup + script) for the claude.ai Artifact tool; publish it with `capabilities: {downloads: true}`. Stay under 16 MiB: the script reports the size and fails above the limit. There are no external URLs in the shell; keep it that way (no CDNs, no Google Fonts links, no remote images) so the same file works offline and in an Artifact.

## Review checklist

Before calling the editor done, screenshot it with system Chrome at 1600×1000 in light and dark, open the `Texto` tab and the store preview, and export at least two routes with `scripts/render_html_pngs.py`. Check: one accent only, no native-looking selects, captions aligned on one baseline, tooltips present on every icon button, no horizontal page scroll except inside the board row.
