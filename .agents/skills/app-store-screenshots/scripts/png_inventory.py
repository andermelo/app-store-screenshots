#!/usr/bin/env python3
"""Validate PNG headers and print a deterministic inventory."""

from __future__ import annotations

import argparse
import hashlib
import struct
import sys
from pathlib import Path


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as stream:
        header = stream.read(24)
    if len(header) != 24 or header[:8] != PNG_SIGNATURE or header[12:16] != b"IHDR":
        raise ValueError("not a PNG with a valid IHDR header")
    return struct.unpack(">II", header[16:24])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate PNG files and print path, dimensions, bytes, and SHA-256."
    )
    parser.add_argument("root", type=Path, help="PNG file or directory to inspect")
    parser.add_argument("--expect", type=int, help="fail unless this many PNG files exist")
    parser.add_argument(
        "--same-size", action="store_true", help="fail unless every PNG has equal dimensions"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.root.is_file():
        paths = [args.root]
        display_root = args.root.parent
    elif args.root.is_dir():
        paths = sorted(args.root.rglob("*.png"))
        display_root = args.root
    else:
        print(f"error: path does not exist: {args.root}", file=sys.stderr)
        return 2

    errors: list[str] = []
    sizes: set[tuple[int, int]] = set()
    rows: list[tuple[str, int, int, int, str]] = []

    for path in paths:
        try:
            width, height = dimensions(path)
            sizes.add((width, height))
            rows.append(
                (
                    str(path.relative_to(display_root)),
                    width,
                    height,
                    path.stat().st_size,
                    sha256(path),
                )
            )
        except (OSError, ValueError) as error:
            errors.append(f"{path}: {error}")

    if args.expect is not None and len(paths) != args.expect:
        errors.append(f"expected {args.expect} PNG files, found {len(paths)}")
    if args.same_size and len(sizes) > 1:
        errors.append(f"expected one shared size, found {sorted(sizes)}")
    if not paths:
        errors.append("no PNG files found")

    print("path\tdimensions\tbytes\tsha256")
    for relative, width, height, byte_count, digest in rows:
        print(f"{relative}\t{width}x{height}\t{byte_count}\t{digest}")

    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
