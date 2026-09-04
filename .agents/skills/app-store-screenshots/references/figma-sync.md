# Figma sync

Use the remote Figma MCP server and its foundational `figma-use` skill. Work from a Figma Design file or selection URL; do not try to navigate the web UI to discover node IDs.

## Capability check

Confirm the current tool surface before changing the file. The workflow requires:

- `whoami` for the authenticated identity;
- `use_figma` to inspect, clone, name, lay out, and edit native nodes;
- `upload_assets` to place PNG captures as image fills;
- `get_screenshot` for visual QA;
- `download_assets` only when local final exports are requested.

If tool names or parameters differ, follow the server's current schema. Never infer a mutating parameter.

## Template contract

Each configured `templateUrl` must identify one Figma frame or component that contains exactly one node for each configured role:

- `@screenshot`: rectangle or frame receiving the captured PNG as an image fill;
- `@headline`: editable text layer;
- `@subhead`: editable text layer, optional only when omitted from both template and copy.

Inspect the template first. Preserve its Auto Layout, constraints, components, variables, effects, masks, and device treatment. Do not flatten the marketing frame. If role names are ambiguous or the template is structurally broken, stop that scene and report the exact conflict.

`editorial-zoom` campaigns may use a generated reusable structure instead of a pre-existing scene template. It must still expose the standard roles plus:

- `@zoom`: clipping frame for the enlarged detail;
- `@zoom-screenshot`: a clone that reuses the same image hash as `@screenshot`;
- `@emoji`: editable emoji text or an uploaded decorative asset;
- `@decoration`: optional app-owned asset, always separate from the screenshot.

Read [creative-composition.md](creative-composition.md) before building this structure.

## Idempotent placement

Create a generated section and organize one subsection per locale. Name frames `<index> <scene> [<locale>]`.

Before creating a frame, check `.store-screens/figma-manifest.json` and confirm the recorded node still exists in the same file:

- existing valid node: update it;
- missing/stale node: clone the source template once and replace the manifest entry;
- no manifest: search the generated section by the exact frame name before cloning.

Never overwrite or rename the source template.

## Upload the capture

Use `upload_assets` for every local PNG that is not already present with the same SHA-256 hash. Pass the target screenshot node when the tool supports direct fill placement and use the configured scale mode. Follow the tool's returned single-use upload instructions exactly when posting file bytes.

Do not:

- send base64 image data through the conversation;
- persist single-use upload URLs;
- call `figma.createImage` or `figma.createImageAsync` inside `use_figma` for an external/local file;
- replace a screenshot with a generated placeholder.

An unchanged hash may reuse the existing image already attached to that generated node.

When a zoom callout is present, upload the PNG only once for the scene. Reuse the resulting image fill on both the full screenshot and its clipped zoom clone. Assert equal `imageHash` values during validation.

## Apply copy

Use `use_figma` to update the headline and subhead from `copy.yaml`. Load the exact fonts required by each text node before changing its characters. Preserve existing text styles and layout unless a locale-specific overflow requires a deliberate adjustment.

Prefer shortening marketing copy over reducing it below the template's readable type scale. Treat right-to-left direction, alignment, punctuation, and numerals as locale-specific design decisions.

## Validate and export

Take a Figma proof screenshot after each locale and inspect all frames for long-copy and right-to-left locales. A successful write response is not visual proof. For editorial zooms, also verify the callout stays inside the configured safe margin, does not cover the headline, and contains only pixels from the matching locale/scene screenshot.

When the user requests local final PNGs, use `download_assets` on the generated frame nodes, follow the returned download instructions, and save the outputs with this convention:

```text
.store-screens/exported/<locale>/<index>_<scene>_<locale>.png
```

Validate count and dimensions locally. Temporary asset URLs expire; never present them as the durable result when a saved file or Figma node URL is available.

Current tool reference: <https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/>
