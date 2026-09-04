#!/usr/bin/env python3
"""Bundle a campaign editor into one self-contained HTML file.

Inlines editor.css, campaign fonts, screenshots, stickers, the app icon and
canvas-settings.json as data URIs so the page needs no server. Two outputs:

  --mode standalone  full document, opens from disk or any static host
  --mode artifact    body-only fragment (title + style + body markup + script)
                     for the claude.ai Artifact tool, which wraps it in its own
                     doctype/head/body skeleton

Targets: claude.ai Artifacts and offline review files.
The page must use the asset hooks documented in references/editor-design.md:
`asset(path)` for runtime paths, `data-asset` on static <img>, and
`window.__CANVAS_SETTINGS__` for settings. No third-party runtime is used.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import re
from pathlib import Path

mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("font/otf", ".otf")
mimetypes.add_type("font/woff2", ".woff2")


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("html", type=Path, help="campaign html/index.html")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--mode", choices=("standalone", "artifact"), default="standalone")
    parser.add_argument("--font-family", action="append", default=[], help="keep only @font-face rules for these families (repeatable); default keeps all")
    parser.add_argument("--screenshots", type=Path, help="screenshot root (default: <campaign>/screenshots)")
    parser.add_argument("--settings", type=Path, help="canvas-settings.json (default: next to html)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    html_path = args.html.resolve()
    html_dir = html_path.parent
    campaign = html_dir.parent
    html = html_path.read_text(encoding="utf-8")
    assets: dict[str, str] = {}
    report: dict[str, int] = {}

    # 1. editor.css -> inline <style>
    def inline_css(match: re.Match) -> str:
        css_path = html_dir / match.group(1)
        report["css"] = css_path.stat().st_size
        return f"<style id=\"editor-css\">\n{css_path.read_text(encoding='utf-8')}\n</style>"
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+\.css)">', inline_css, html)

    # 2. fonts referenced from CSS url(...)
    keep = {family.lower() for family in args.font_family}
    if keep:
        def prune(match: re.Match) -> str:
            family = re.search(r'font-family:\s*"?([^";]+)"?', match.group(0))
            return match.group(0) if family and family.group(1).strip().lower() in keep else ""
        html = re.sub(r"@font-face\s*\{[^}]*\}\s*", prune, html)
    font_bytes = 0
    def inline_font(match: re.Match) -> str:
        nonlocal font_bytes
        rel = match.group(2)
        path = html_dir / rel
        font_bytes += path.stat().st_size
        return f'url("{data_uri(path)}")'
    html = re.sub(r'url\((["\']?)((?:\.\./)?assets/fonts/[^)"\']+)\1\)', inline_font, html)
    report["fonts"] = font_bytes

    # 3. runtime asset map: screenshots + html/assets images
    screenshots = (args.screenshots or campaign / "screenshots").resolve()
    for png in sorted(screenshots.rglob("*.png")):
        rel = "../screenshots/" + png.relative_to(screenshots).as_posix()
        assets[rel] = data_uri(png)
    for image in sorted((html_dir / "assets").glob("*")):
        if image.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
            assets["assets/" + image.name] = data_uri(image)
    report["images"] = sum(len(value) for value in assets.values())

    # 4. settings
    settings_path = (args.settings or html_dir / "canvas-settings.json").resolve()
    settings = json.loads(settings_path.read_text(encoding="utf-8")) if settings_path.is_file() else None

    injection = "<script>\n" + f"window.__ASSETS__ = {json.dumps(assets)};\n"
    if settings is not None:
        injection += f"window.__CANVAS_SETTINGS__ = {json.dumps(settings)};\n"
    injection += "</script>\n"
    html = html.replace("<body>", "<body>\n" + injection, 1)

    if args.mode == "artifact":
        title = re.search(r"<title>(.*?)</title>", html, re.S)
        head_styles = "".join(re.findall(r"<style id=\"[^\"]+\">.*?</style>", html, re.S))
        body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
        html = (f"<title>{title.group(1) if title else 'Campaign editor'}</title>\n" + head_styles + "\n" + body).strip() + "\n"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    total = args.output.stat().st_size
    print(f"wrote {args.output} ({total/1_048_576:.1f} MiB; css {report.get('css',0)/1024:.0f} KiB, fonts {report['fonts']/1_048_576:.1f} MiB raw, images {report['images']/1_048_576:.1f} MiB encoded, {len(assets)} assets)")
    if total > 16 * 1_048_576:
        print("warning: larger than the 16 MiB Artifact limit; drop font families with --font-family or reduce screenshots")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
