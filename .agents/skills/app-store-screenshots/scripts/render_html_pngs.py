#!/usr/bin/env python3
"""Render deterministic App Store HTML routes with a system Chrome binary."""

from __future__ import annotations

import argparse
import http.server
import json
import os
from pathlib import Path
import shutil
import socketserver
import struct
import subprocess
import tempfile
import threading
import time
from urllib.parse import quote


CHROME_CANDIDATES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def resolve_chrome(explicit: str | None) -> str:
    candidates = (explicit,) if explicit else CHROME_CANDIDATES
    for candidate in candidates:
        if not candidate:
            continue
        path = shutil.which(candidate) if os.sep not in candidate else candidate
        if path and Path(path).is_file():
            return str(path)
    raise SystemExit(
        "No system Chrome/Chromium found. Install one or pass --chrome; "
        "this helper never downloads a browser."
    )


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Not a valid PNG: {path}")
    return struct.unpack(">II", header[16:24])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("html", type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--chrome")
    return parser.parse_args()


def capture_with_chrome(command: list[str], target: Path) -> None:
    """Run Chrome until its screenshot is durably written, then close it."""
    process = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.monotonic() + 25
    last_size = -1
    stable_reads = 0
    try:
        while time.monotonic() < deadline:
            if target.is_file():
                size = target.stat().st_size
                stable_reads = stable_reads + 1 if size == last_size and size > 0 else 0
                last_size = size
                if stable_reads >= 2:
                    return
            if process.poll() is not None and not target.is_file():
                raise RuntimeError(f"Chrome exited before writing {target}")
            time.sleep(0.15)
        raise RuntimeError(f"Timed out waiting for Chrome screenshot: {target}")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)


def main() -> int:
    args = parse_args()
    html = args.html.resolve()
    manifest_path = args.manifest.resolve()
    output = args.output.resolve()
    chrome = resolve_chrome(args.chrome)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    width = int(manifest["width"])
    height = int(manifest["height"])
    renders = manifest["renders"]
    if not renders:
        raise SystemExit("Manifest has no renders")

    # Include the output path when finding the campaign root so an entry under
    # `html/` can load sibling `screenshots/` without exposing broader folders.
    serve_root = Path(
        os.path.commonpath([html.parent, manifest_path.parent, output])
    )
    entry = html.relative_to(serve_root).as_posix()
    handler = lambda *a, **kw: QuietHandler(*a, directory=str(serve_root), **kw)

    with ReusableTCPServer(("127.0.0.1", 0), handler) as server, tempfile.TemporaryDirectory(
        prefix="app-store-html-export-"
    ) as profile:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        for index, item in enumerate(renders):
            route = quote(str(item["route"]), safe="/-")
            target = output / str(item["filename"])
            target.parent.mkdir(parents=True, exist_ok=True)
            url = f"http://127.0.0.1:{port}/{entry}?render={route}"
            command = [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                f"--window-size={width},{height}",
                "--virtual-time-budget=5000",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-mode",
                "--disable-background-networking",
                "--disable-component-update",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-sync",
                "--metrics-recording-only",
                f"--user-data-dir={Path(profile) / str(index)}",
                f"--screenshot={target}",
                url,
            ]
            target.unlink(missing_ok=True)
            capture_with_chrome(command, target)
            actual = png_size(target)
            if actual != (width, height):
                raise RuntimeError(
                    f"Wrong PNG size for {target}: {actual}, expected {(width, height)}"
                )
            print(f"rendered {item['route']} -> {target}")
        server.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
