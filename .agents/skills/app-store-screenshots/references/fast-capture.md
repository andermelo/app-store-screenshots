# Fast, deterministic campaign updates

## Choose the work actually needed

- Existing PNG supplied: inspect it, copy it unchanged into the campaign, record source locale and SHA-256, and compose only that scene. No Simulator or Maestro preflight is needed.
- Existing campaign: retain its composition target, saved typography/layout and locale choices. Ask only if the destination is genuinely unresolved.
- New capture: use one installed build and a reusable flow per locale. Rebuild only when app code or compile-time configuration changed.
- Existing tested app driver: reuse its semantic actions and ready/checkpoint protocol when it already drives the real Simulator UI. Record that capture backend; Maestro remains the default for apps without such a driver. Never build a new driver merely to save a few screenshots.

## Capture execution

Prepare the app's supported debug scenario or fixture state once. Use the production renderer with deterministic input; do not construct substitute screenshot screens. Use stable accessibility IDs or the existing driver's keys. Wait for the scene's observable postcondition, with a timeout, before capturing. A timeout fails that scene rather than emitting a plausible but wrong screenshot.

Keep navigation and capture in a single running flow instead of issuing a separate agent/tool round trip for every tap. Use direct scenario entry for independent screens; preserve real navigation when the requested evidence is a user journey. Avoid restarting the app between scenes and avoid changing locale concurrently on one Simulator.

For a driver that exposes a capture-ready checkpoint, capture the native framebuffer while that checkpoint is held:

```bash
xcrun simctl io "$SIMULATOR_UDID" screenshot /absolute/path/to/scene.png
```

The orchestrator must wait for screenshot completion before acknowledging the checkpoint and moving to the next scene. A log line alone is insufficient if the app continues navigating before the capture completes. For continuous animation, choose a deterministic pose or assert the meaningful state; do not wait for global animation idleness. Document any deliberate capture of a moving state.

Record per scene: ID, locale, backend, postcondition, source revision/build, device, PNG dimensions, SHA-256, elapsed navigation/capture time and result. Measure elapsed time with a monotonic clock. Report measured latency; do not promise a fixed millisecond rate across devices.

## Video is a separate output

Start native recording after the app is ready. Synchronize recording and checkpoints with a common clock. Keep the raw recording. A Tuka video may accelerate playback (the Builder example used 1.85×); rendered duration is not automation latency. Review original PNGs for text/detail, and do not call fixture-backed UI proof a live backend test.

## Incremental composition

Use stable scene IDs and update the campaign config, copy, default/saved scene order and export manifest together. Appending scene 06 must also work with old browser-local order: merge new IDs into saved order without resetting prior edits. Compute counters from the current locale's scene count, not a hardcoded five.

Keep an export subset for changed routes; reuse existing exports only while their screenshot, copy and visual settings are unchanged. Refresh an older export if its visible total/order changed. Reuse bundled fonts and product art. Verify the new PNG at full resolution before handing it off.

Locale reuse requires the user's choice: a PT-BR app screenshot can be shared across EN/ES marketing boards if requested. Record `screenshotLocale` separately from marketing locale and retain the original bitmap. Never edit pixels to simulate translation.

Completion for an incremental update is scoped to requested scenes. Report updated routes and any missing localized captures, not an unconditional locales-times-scenes requirement for unrelated work.
