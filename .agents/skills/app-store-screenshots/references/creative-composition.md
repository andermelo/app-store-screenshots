# Creative editorial composition

Use this mode for clean App Store boards that keep the real app capture legible while calling attention to one strategic detail. The board may feel playful through copy, emoji, scale, overlap, and app-owned decorative assets, but the product UI must remain an untouched capture.

## Non-negotiable source fidelity

- Keep one full, readable screenshot for the exact locale and scene.
- Build every magnified detail from a clone of that same screenshot node or the same uploaded image fill.
- Scale the clone uniformly and clip it inside `@zoom`. Translate the clone to reveal the intended region; do not stretch, redraw, OCR, recolor, or regenerate it.
- Assert that `@screenshot` and `@zoom-screenshot` use the same image hash. A callout from another locale or scene is a failed composition.
- Never ask an image model to create app UI, text, icons, code, charts, or controls. Generated art is allowed only when the user explicitly requests a separate decorative bitmap and it cannot be mistaken for product UI.

## Layout contract

- `safeMarginPx` is at least 24 px. Apply it to all canvas edges and as the minimum visible clearance between the headline, device, callout, emoji, and decorative assets. Count visible shadow/blur bleed, not only the callout's CSS or Figma bounding box.
- Prefer a white or lightly tinted background when the app capture is dark. Maintain strong contrast for black headline copy and restrained gray supporting copy.
- Preserve the headline zone. A zoom may overlap the device but must not cover the headline or obscure the feature it is meant to explain.
- Use one strategic zoom per board by default. Two are acceptable only when requested and when both remain clearly subordinate to the main screenshot.
- Keep the device treatment and zoom borders consistent across all locales. Copy may reflow, but frame order, scene intent, and visual hierarchy stay aligned.
- If the user positions an interactive HTML magnifier, preserve that saved focus and geometry exactly in later exports or design-tool reconciliation.

## Emojis and decorative assets

- Prefer native editable emoji text when the required glyph renders reliably in the product font environment.
- Otherwise upload a PNG/WebP from a user-authorized library or an app-owned asset. Keep its source path in campaign configuration or status, never a temporary upload URL.
- Put each emoji or decoration on its own named layer (`@emoji` or `@decoration`). It must not be merged into the screenshot bitmap.
- Use decoration sparingly: one expressive element is usually enough. The mood can be funny; the layout must remain clean.

## Copy with attention hooks

Short questions can be used as headlines when they reveal the interaction shown on screen. Good hooks create curiosity without making claims the screenshot cannot support. Keep punctuation and idiom natural for each locale; do not translate word-for-word when a locally natural hook is stronger.

When the source screenshot itself exposes untranslated app content, record an app-localization gap in `STATUS.md`. Do not conceal the gap with a floating card or fake localized pixels.

## Figma construction

1. Create or clone the generated board without changing the source template.
2. Place `@headline`, `@subhead`, and optional `@emoji` as editable layers.
3. Upload the scene PNG to `@screenshot` with `upload_assets`.
4. Create `@zoom` as a clipping frame with a visible border and restrained shadow.
5. Clone `@screenshot` into `@zoom`, name it `@zoom-screenshot`, scale uniformly, and translate it to the configured focus region.
6. Validate outer bounds, 24 px clearance, matching image hashes, locale, and text overflow.
7. Capture a Figma proof for every locale before marking the composition complete.
