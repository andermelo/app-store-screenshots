# Goldie-inspired HTML studio patterns

Use this reference only after the user explicitly asks for Goldie-style layout or editor capabilities in the HTML composition branch.

## Source and scope

The interaction vocabulary and layout families described here are adapted from [Goldie](https://github.com/kacperkapusciak/goldie), version `0.3.1`, commit `788dd6ec4c8d5ed4d7647135ba4239fa397ccecd`. Goldie's application source is MIT licensed by Kacper Kapuściak (2026).

Port only the focused capabilities useful for an App Store screenshot campaign:

- solid and gradient background presets plus custom color/angle controls;
- campaign-wide font presets;
- template sequences and the layout families Classic, Copy Below, Hero, Offset, Tilt, Tilt Right, Duo, Duo Tilt, Panorama, Panorama Duo, and Minimal;
- per-scene layout overrides, scene reordering, bezel/screen-only treatments, editor light/dark appearance, undo/redo, and localized copy editing;
- a compact inspector that can stay on the campaign's preferred side.

Always keep the user's established campaign layout as the first/default preset. Do not import the Goldie application runtime, routing, dependencies, storage architecture, or general product shell. Implement the controls in campaign-local HTML/CSS/JavaScript and keep the product screenshots immutable.

Goldie's panorama concepts may span multiple store frames. This skill's default HTML export contract is still exactly one PNG per locale/scene, so adapt panorama geometry inside one board. Change the manifest and output count only when the user explicitly requests true cross-frame panoramas.

Do not copy Goldie's device bezel images unless the campaign separately includes their CC BY 4.0 attribution. Campaigns may instead implement lightweight CSS bezels and color treatments. Any bundled font files must retain the SIL Open Font License 1.1 notice.

## Required MIT notice

Include this notice in a campaign-local `THIRD_PARTY_NOTICES.md` whenever a generated editor contains a substantial Goldie-derived implementation:

```text
MIT License

Copyright (c) 2026 Kacper Kapuściak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Also record whether device frame artwork was copied and where font license files live. Attribution is part of completion, not a later cleanup task.
