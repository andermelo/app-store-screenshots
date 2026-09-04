# Campaign configuration

Copy `assets/config.yaml`, `assets/copy.yaml`, and `assets/flow.yaml` to `.store-screens/` when starting a campaign. Rename `assets/flow.yaml` to `.store-screens/flow.yaml`.

## `config.yaml`

- `bundleId`: installed iOS app bundle identifier.
- `compositionTarget`: explicit `figma`, `sketch`, or `html` choice made before composition. Never infer a fallback target after a failure.
- `sourceLocale`: locale used when first authoring the Maestro flow.
- `maestro.flow`: flow path relative to `.store-screens/`.
- `maestro.deviceUdid`: exact target Simulator UDID. Resolve it before capture.
- `maestro.localeStrategy`: `launch-arguments`, `maestro-device`, or `in-app`; use the strategy that the app and installed runtime support.
- `device.orientation`: capture orientation.
- `device.expectedPixelSize`: optional `WIDTHxHEIGHT` requirement for final exports.
- `locales[].tag`: BCP-47 tag used in folders, copy, and Figma frame names.
- `locales[].maestroLocale`: device locale used by `maestro start-device`, such as `pt_BR`.
- `locales[].appleLanguage` and `appleLocale`: exact app launch values for an existing Simulator.
- `figma.fileUrl`: destination Figma Design file or selection URL.
- `figma.destinationPage` and `destinationSection`: where generated frames belong.
- `figma.*LayerName`: unique role names inside every scene template.
- `figma.imageScaleMode`: normally `FILL` or `FIT`.
- `composition.mode`: `template` for ordinary template population or `editorial-zoom` for a clean marketing board with magnified UI callouts.
- `composition.frameSize`: exact `WIDTHxHEIGHT` or a `{ width, height }` mapping for every generated board.
- `composition.background`: board background color; white is recommended when the captured app is already dark.
- `composition.safeMarginPx`: minimum canvas edge and floating-layer clearance. Values below `24` are invalid.
- `composition.zoomSource`: must be `same-locale-screenshot-clone` for `editorial-zoom`.
- `composition.zoomCountPerScene`: number of callouts; prefer one and never exceed two without an explicit request.
- `composition.emojiSource`: `native-text`, `uploaded-asset`, or `native-or-uploaded-asset`.
- `htmlFallback.enabled`: whether the user explicitly authorized browser-native composition/export when Figma is unavailable.
- `htmlFallback.entry`: HTML entry point relative to the campaign directory.
- `htmlFallback.exportManifest`: JSON render manifest relative to the campaign directory.
- `htmlFallback.editorStylesheet`: campaign copy of the skill's `assets/editor/editor.css`, normally `html/editor.css`.
- `htmlFallback.singleFile.enabled`: whether a self-contained build was requested (Artifact or offline file).
- `htmlFallback.singleFile.mode`: `standalone` (full document) or `artifact` (body fragment for the claude.ai Artifact tool).
- `htmlFallback.singleFile.output`: campaign-relative output path, normally `html/dist/studio.html`.
- `htmlFallback.singleFile.fontFamilies`: families kept in the bundle; an empty list keeps every bundled family.
- `htmlFallback.canvasSettings`: portable per-locale/per-scene typography and layout state used by interactive and batch HTML exports.
- `htmlFallback.magnifierEnabled`: must remain `false`; magnifier editing is intentionally excluded from the HTML route.
- `htmlFallback.output`: target directory for rendered PNGs. Keep the same locale/index/scene naming contract as Figma exports.
- `htmlFallback.appStorePreview.enabled`: whether the HTML editor includes a read-only App Store listing preview.
- `htmlFallback.appStorePreview.appIconSource`: resolved source PNG from the intended iOS target's AppIcon asset catalog.
- `htmlFallback.appStorePreview.appIconAssetCatalogName`: Xcode app-icon set name, normally `AppIcon`.
- `htmlFallback.appStorePreview.appIconBundledPath`: campaign-relative copy referenced by HTML, normally `html/assets/app-icon.png`.
- `scenes[].id`: stable lowercase kebab-case identifier.
- `scenes[].index`: two-digit display/export order.
- `scenes[].screenshotName`: value used by the flow's `takeScreenshot.path`, without `.png`.
- `scenes[].templateUrl`: exact Figma scene template URL.
- `scenes[].postcondition`: visible assertion proving the intended state.

## `flow.yaml`

Prefer one flow containing every scene. Put a `takeScreenshot` command after each scene's assertion and keep its path equal to `scenes[].screenshotName`.

Use stable accessibility IDs rather than localized visible text. If one locale genuinely needs a different selector, keep the override small instead of duplicating the entire flow.

## `copy.yaml`

Store marketing copy by locale and scene. Translate these strings directly; never OCR the captured bitmap.

```yaml
en-US:
  detail:
    headline: "Understand every detail"
    subhead: "The context you need, exactly when you need it."
pt-BR:
  detail:
    headline: "Entenda cada detalhe"
    subhead: "O contexto certo, exatamente quando você precisa."
```

For a missing translation, stop that locale's Figma composition rather than silently copying the source language.

Optional editorial fields may be stored with each scene:

```yaml
en-US:
  challenge:
    headline: "Can you spot the bug?"
    subhead: "One tiny symbol changes everything."
    emoji: "👀"
    zoom:
      focus: "question-and-answer-options"
      anchor: "bottom"
```

`zoom.focus` is a semantic review note, not permission to OCR or rebuild the app UI. The implementation must crop a cloned screenshot layer from the matching locale and scene.

## `figma-manifest.json`

Record generated frame node IDs/URLs and the SHA-256 hashes of their screenshot and copy. Use this state to update existing generated frames instead of duplicating them. Never store credentials or temporary asset URLs.
