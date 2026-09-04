#!/usr/bin/env python3
"""Find an iOS marketing AppIcon and copy it into an HTML campaign."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
IGNORED_DIRECTORY_NAMES = {
    ".build",
    ".dart_tool",
    ".git",
    ".store-screens",
    "DerivedData",
    "Pods",
    "SourcePackages",
    "build",
    "node_modules",
}


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != PNG_SIGNATURE or header[12:16] != b"IHDR":
        raise ValueError(f"not a readable PNG: {path}")
    return struct.unpack(">II", header[16:24])


def validate_icon(path: Path) -> tuple[int, int]:
    if not path.is_file():
        raise ValueError(f"icon does not exist: {path}")
    width, height = png_dimensions(path)
    if width != height:
        raise ValueError(f"App Store icon must be square, got {width}x{height}: {path}")
    return width, height


def discover_icon(app_root: Path, asset_name: str) -> Path:
    marketing: set[Path] = set()
    square_1024: set[Path] = set()

    for contents in sorted(app_root.rglob("Contents.json")):
        relative_parts = contents.relative_to(app_root).parts
        if any(part in IGNORED_DIRECTORY_NAMES for part in relative_parts):
            continue
        appiconset = contents.parent
        if appiconset.name != f"{asset_name}.appiconset":
            continue
        if not any(parent.suffix == ".xcassets" for parent in contents.parents):
            continue
        try:
            data = json.loads(contents.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"cannot read asset catalog metadata {contents}: {exc}") from exc

        for image in data.get("images", []):
            filename = image.get("filename")
            if not filename:
                continue
            candidate = appiconset / filename
            if not candidate.is_file() or candidate.suffix.lower() != ".png":
                continue
            try:
                dimensions = png_dimensions(candidate)
            except ValueError:
                continue
            if dimensions == (1024, 1024):
                square_1024.add(candidate.resolve())
            if image.get("idiom") == "ios-marketing" and image.get("size") == "1024x1024":
                marketing.add(candidate.resolve())

    candidates = marketing or square_1024
    if len(candidates) == 1:
        return next(iter(candidates))
    if not candidates:
        raise ValueError(
            f"no 1024x1024 PNG found in an {asset_name}.appiconset below {app_root}; "
            "pass --source with the intended icon"
        )
    choices = "\n  ".join(str(path) for path in sorted(candidates))
    raise ValueError(f"multiple AppIcon candidates found; pass --source explicitly:\n  {choices}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bundle the real iOS App Store icon into a browser-native screenshot campaign."
    )
    parser.add_argument("app_root", type=Path, help="iOS app repository root")
    parser.add_argument("--output", required=True, type=Path, help="campaign-local .png destination")
    parser.add_argument("--source", type=Path, help="explicit source PNG; relative paths resolve from app_root")
    parser.add_argument("--asset-name", default="AppIcon", help="asset catalog icon name (default: AppIcon)")
    args = parser.parse_args()

    app_root = args.app_root.expanduser().resolve()
    if not app_root.is_dir():
        parser.error(f"app root is not a directory: {app_root}")
    if args.output.suffix.lower() != ".png":
        parser.error("--output must end in .png")

    try:
        if args.source:
            source = args.source.expanduser()
            if not source.is_absolute():
                source = app_root / source
            source = source.resolve()
        else:
            source = discover_icon(app_root, args.asset_name)
        width, height = validate_icon(source)
    except ValueError as exc:
        parser.error(str(exc))

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if source != output:
        temporary = output.with_name(f".{output.name}.tmp")
        shutil.copyfile(source, temporary)
        temporary.replace(output)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"bundled {width}x{height} AppIcon: {source} -> {output} sha256={digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
