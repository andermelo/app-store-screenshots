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
- **Decorative background layers are opacity-controlled, never hardcoded.** A campaign that adds an image layer behind the boards (a doodle pattern, a texture) exposes an opacity range (0-100) in the Background group, applied as `--doodle-opacity` on `.board` and read by the layer's own `opacity: var(--doodle-opacity, .6)`. Pair it with a per-scene "hide on this board" checkbox (`scene-hide-background`) so one board can opt out without discarding the setting for the rest of the campaign. Never bake a fixed opacity, or a decorative shape with no purpose (a bare circle, a blob), into board CSS without exposing a control for it — a later adjustment should happen from the sidebar, not by editing CSS by hand. The `doodle-*` ids are an internal implementation detail; **label the field generically** — "Background opacity" / "Hide background on this board" — never after the specific asset (not "Doodle opacity"), since a future campaign's decorative layer may not be a doodle at all.
- **Text highlighter is a standard Copy-tab field, per key, three states.** Every campaign's `headline` and `subhead` groups include a marker/highlighter control alongside their other typography fields, not just campaigns that ask for one — it defaults to `none` (no visible effect) so it costs nothing when unused. Wrap that element's rendered text in one inline `<mark class="hl">`, set `box-decoration-break: clone` so wrapped text gets one band per visual line (not one rectangle spanning the whole block), and blend with `mix-blend-mode: multiply` so any chosen color reads like real ink over the board rather than an opaque sticker. Offer exactly three styles per key — `none` (default, no wrapper styling), `straight` (a clean rectangle) and `brush` (the same band with an asymmetric border-radius plus a second, smaller, more-transparent copy of the band offset a few percent in position, so it reads as two uneven marker passes) — plus a 10–100 thickness range and a color field, both editable from the sidebar, independently for `headline` and `subhead`, and shared across locales like the rest of `TYPE_VISUAL_FIELDS`.
  - **Size the band with `background-size`/`background-position` on the mark itself, never with vertical padding.** Padding enlarges the element's own box, and CSS does not reserve extra line-box space for it, so a thick padded mark bleeds into the line above or below it — most visible on a tight headline `line-height`. A percentage `background-size` height plus a bottom-anchored `background-position` stays confined to that one line's box at any thickness.
  - **Never reach for `mask-image` to get a rough/brush edge.** A CSS mask clips the alpha of the *entire* element it is set on, including its text content, not just its background layer — it will silently eat words or whole lines. Keep every highlight style on `background-*`/`background-blend-mode` only, which paints behind the text and can never clip it.
  - **A `contenteditable` region can split or drop an inline wrapper mid-edit** (Enter, paste, arrow-key navigation at its boundary) — a "leave the DOM alone while focused" guard is not enough, since the damage happens *during* typing and nothing then repairs it. Re-render the wrapper from state on every `input` event, restoring the caret by plain-text character offset (`Range`/`TreeWalker(SHOW_TEXT)`, no library), so the structure is re-canonicalized after each keystroke instead of drifting.
- **Status bar states facts, and derives them.** Board count, locale count, pixel size, safe margin, local-save indicator, zoom slider. No marketing copy. **Never type a count into the markup** (`Export 15 PNGs`, `15 boards · 3 locales`, `1206 × 2622 px`): ship the `export-all-label`, `status-count`, `status-size` and `status-safe` nodes empty (or with a `—` placeholder) and fill them from `syncCounts()`, which reads the rendered `.preview .board` nodes, their `data-locale`, and `BOARD`/`SAFE`. Call it after `buildGallery()` and start `watchCounts()` (a `MutationObserver` on `#gallery`) so an agent that later adds, removes or hides boards never leaves a stale number behind.
- **Autosave is visible, never confirmed.** `#status-saved` is a three-state indicator: idle ("Saved locally" / localized), `is-saving` (small spinner + "Saving…", held ~500 ms so the eye registers it even though the write is instant), `is-saved` ("Saved :)" with a shimmer across the text and a pulse on the dot, ~2.2 s), then idle. Every `localStorage` write of campaign content calls `noteAutosave()`; rapid edits coalesce into one cycle. Zoom, locale and theme preferences are not progress and do not trigger it. Do not ask the user to confirm an autosave and do not raise a toast per edit.
- **Confirm file writes with a toast.** Edits auto-persist to `localStorage` silently; only explicit file actions (save or load `canvas-settings.json`, failed export) raise a `.toast` in `#toast-host` above the status bar: one line, a stroked check or x icon, gone after ~2.5 s. A cancelled file picker shows nothing. The save button uses `#i-save`, never the download arrow, so it reads as "persist" rather than "export".
- **Both themes, three states.** Tokens are defined on bare `:root`, redefined under `prefers-color-scheme: dark` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. The theme toggle writes `data-theme` on `<html>`; "system" removes it. This is what lets a claude.ai Artifact host stamp its own theme.
- **Chrome is always English.** Write every sidebar label, tab, tooltip, hint, toast and status-bar string in English, regardless of the campaign's source locale — this is the editor's own interface, not exported content. Keep `<html lang>` set to the campaign's source locale anyway, since it governs spellcheck and screen-reader pronunciation for the board text inside `.headline`/`.subhead`, not the chrome around it.

## Script contract

### Device switcher (iPhone/iPad)

`#device-switcher` in the topbar is a two-button group (`data-device="iphone"|"ipad"`, icons `i-smartphone`/`i-tablet`) that swaps the whole campaign to a second device's board dimensions and screenshots. Keep it `hidden` in the shell reference — show it only once a campaign actually has real captures for a second device; never show a device mode backed by upscaled or placeholder screenshots. Read the mode from `?device=ipad` in the URL (default iPhone), not from a persisted preference, and switch by navigating (`location.href = ...`), not by re-rendering in place — the two modes have different `BOARD` dimensions, scene sets and default `designState`, so a fresh load keeps that simple. Store the second device's screenshots under `screenshots/<device>/<locale>/<index>-<id>.png`, parallel to the default set, and derive `screenshotPath`/routes from the same `IS_IPAD`-style flag so one campaign file serves both.

A second device rarely has captures for every scene: filter that device's `scenes` down to only the ids with real screenshots (re-indexed 01, 02, …), rather than showing broken boards for the rest. Give the second device its own `DEFAULT_DESIGN` overrides where the first device's defaults don't fit — a decorative background layer tuned for a phone-sized board usually needs a lower default opacity on a much larger tablet canvas, for instance — and namespace persisted settings separately (a `device` field in the saved JSON, a version flag for one-time migrations) so switching devices never corrupts the other device's saved state.

### Title–description spacing (Copy sidebar)

Include `copy-gap` (range 0–240, step 1, board pixels), `copy-gap-value` and
`copy-gap-reset` in a compact Spacing group. English label: “Title → description”.
Persist `copyGap: number | null` with the selected board's per-route state,
including device and locale. `null` means existing template geometry; older saved
boards must not jump when loaded. Explicit values remove the headline's reserved
`min-height` and set the description's `margin-top`, so zero really closes the gap
below the rendered title. Never fake this by translating text over another layer.
Do not move the screenshot or change font size to implement spacing.

Update immediately on slider input, use existing autosave/undo hooks, and include
the value in settings save/load and PNG/render exports. Reset returns to template
spacing. Keep independent localized boards independent, since wrapping differs.
Verify zero, wrapped titles, reload, another locale, undo/redo, reset and an actual
export. Do not change unrelated user styles when adding this control.

The shell markup expects these ids: `locale-seg`, `undo`, `redo`, `load-settings`, `save-settings`, `settings-file`, `toast-host`, `toggle-theme`, `theme-icon`, `appstore-preview-toggle`, `export-current`, `export-all`, `toggle-inspector`, `canvas`, `gallery`, `zoom`, `zoom-value`, `crumb-locale`, `crumb-scene`, `reset-current`, the `.tab[data-tab]` / `.panel[data-panel]` pairs, the design controls (`template-select`, `template-preview`, `default-layout` and `scene-layout` tile pickers, `scene-layout-name`, `background-*`, `font-preset`, `frame-*`, `order-label`, `move-back`, `move-forward`) and the copy controls, standard for every campaign: `<key>-text|family|size|weight|line-height|letter-spacing|align|style|color|color-text|highlight|highlight-size|highlight-color|highlight-color-text` for `headline` and `subhead`. Only when a campaign also has a decorative background image layer does it additionally need `doodle-opacity`, `doodle-opacity-value` and `scene-hide-background` in the design controls — that image layer itself stays opt-in, but once it exists these controls for it are mandatory, never a hardcoded opacity. `copy-gap`, `copy-gap-value` and `copy-gap-reset` are likewise standard, in a Spacing group of the copy controls (see below). `device-switcher` and its `data-device` buttons stay `hidden` in the reference shell; wire and unhide them only for a campaign with real second-device captures (see "Device switcher" above).

Segmented controls are plain `<button data-value>` groups; wrap them with a small `segControl()` helper so they expose `.value` and fire `input`/`change` like form fields. Each `.preview` renders `.board-shell > .board` followed by `.caption`; the caption is the drag handle for reordering.

The shell script also ships `noteAutosave()` (the `#status-saved` indicator), `syncCounts()` and `watchCounts()`; wire the first into every content write and call the other two once after the gallery is built.

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

Before calling the editor done, screenshot it with system Chrome at 1600×1000 in light and dark, open the `Texto` tab and the store preview, and export at least two routes with `scripts/render_html_pngs.py`. Check: one accent only, no native-looking selects, captions aligned on one baseline, tooltips present on every icon button, no horizontal page scroll except inside the board row. Then `grep -nE "Export(ar)? [0-9]+ PNG|[0-9]+ (boards|pranchas)"` must return nothing in `index.html`, the status bar must match the number of boards in `scenes`, and editing a headline must run the indicator through saving → "Saved :)" → idle.
