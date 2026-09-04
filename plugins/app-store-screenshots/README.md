# app-store-screenshots plugin

Plugin wrapper around the canonical skill in `../../.agents/skills/app-store-screenshots/`. `skills/app-store-screenshots` is a symlink to that directory; Claude Code dereferences it when the plugin is copied into its cache because the target lives inside the same marketplace.

Install from this repository:

```bash
claude plugin marketplace add /path/to/app-store-screenshots    # or: /plugin marketplace add andermelo/app-store-screenshots
claude plugin install app-store-screenshots@ander-ai
```

The plugin contains only the skill. Maestro, Xcode and a booted Simulator must already exist on the machine; Figma is reached through the Figma connector configured in Claude itself.
