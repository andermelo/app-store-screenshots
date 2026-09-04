# Maestro capture

Use Maestro flows for navigation, assertions, and screenshot capture. Maestro Studio helps an agent during discovery, but the saved YAML flow remains the reproducible artifact.

## Preflight

Use Maestro 2.7.0 or newer when the target Simulator runs iOS 26 under Xcode 26. Older 2.1.x builds can install the XCUITest driver but hang while connecting to it.

```bash
maestro --version
xcrun simctl list devices booted
maestro test --help
```

Target a specific Simulator UDID rather than whichever device happens to be active.

## Flow

`takeScreenshot` writes a PNG and appends the `.png` extension. Its path is relative to the Maestro workspace/test output directory.

Prefer accessibility IDs because visible labels change by locale:

```yaml
appId: ${APP_ID}
---
- launchApp:
    stopApp: false
- tapOn:
    id: "home_tab"
- assertVisible:
    id: "home_screen"
- takeScreenshot:
    path: "home"
```

Use visible text only when the app has no stable accessibility ID. If that text is localized, pass it through an environment variable or create the smallest locale-specific override. Avoid coordinates unless no semantic selector exists.

For apps with continuous animation, wait on a concrete postcondition with `extendedWaitUntil`. Avoid `waitForAnimationToEnd`, because the screen may never become globally idle.

The example uses `stopApp: false` so a locale-specific app launch performed immediately before the test is not restarted. If the locale strategy does not require an external launch, the flow may use a normal `launchApp` instead.

## Locale strategies

Maestro locale is a device-level option: it cannot be declared inside a Flow, and local `maestro test` does not accept `--device-locale`.

Choose one strategy and record it in `STATUS.md`:

1. For an existing Simulator, prefer the app's tested localization launch arguments. A common iOS app launch is:

   ```bash
   xcrun simctl launch --terminate-running-process "$SIMULATOR_UDID" "$APP_ID" \
     -AppleLanguages "($APPLE_LANGUAGE)" \
     -AppleLocale "$APPLE_LOCALE"
   ```

   Confirm the visible locale before continuing. Keep `launchApp.stopApp: false` in the Maestro flow.

2. When its supported device/runtime is acceptable, prepare a Maestro-managed Simulator:

   ```bash
   maestro start-device --platform ios --device-locale pt_BR
   ```

   Install the app on the resulting Simulator before running the flow.

3. If the app owns its language setting, let Maestro select it in-app and verify the visible result before capturing.

Do not assume that replacing `-` with `_` converts every BCP-47 tag correctly. Store the exact values per locale in `config.yaml`.

## Run and capture

For each locale:

```bash
maestro test \
  --device "$SIMULATOR_UDID" \
  --test-output-dir ".store-screens/raw/$LOCALE" \
  -e APP_ID="$APP_ID" \
  ".store-screens/flow.yaml"
```

Run the PNG inventory after the flow:

```bash
python3 <skill-directory>/scripts/png_inventory.py \
  ".store-screens/raw/$LOCALE" --expect "$SCENE_COUNT" --same-size
```

`takeScreenshot` captures the Simulator bitmap; Figma should provide the App Store frame size, background, device treatment, and marketing copy. Do not add bezels in the raw capture.

On failure, inspect Maestro's test/debug output and fix the smallest selector or state setup. Retry at most twice. Do not enable AI analysis or upload flows to Maestro Cloud unless the user explicitly asks.

Current references:

- <https://docs.maestro.dev/reference/commands-available/takescreenshot>
- <https://docs.maestro.dev/maestro-flows/flow-control-and-logic/test-in-different-locales>
- <https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options>
