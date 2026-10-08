#!/usr/bin/env python3
"""Decode latest (or given) CDP Page.captureScreenshot JSON to a PNG."""
import json, base64, sys, glob
from pathlib import Path

dest = Path(sys.argv[1])
if len(sys.argv) > 2:
    src = Path(sys.argv[2])
else:
    files = sorted(glob.glob("/Users/amitvaghamshi/.cursor/browser-logs/cdp-response-Page.captureScreenshot-*.json"))
    src = Path(files[-1])
data = json.loads(src.read_text())
b64 = data.get("data") or data.get("result", {}).get("data")
if not b64:
    raise SystemExit(f"no data in {src}, keys={list(data)[:10]}")
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_bytes(base64.b64decode(b64))
print(f"wrote {dest} ({dest.stat().st_size} bytes) from {src.name}")
