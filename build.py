#!/usr/bin/env python3
"""Build Chrome and Firefox store packages for Proxy Pivot.

Shared UI files are identical across browsers; only the manifest and the
background script differ (Chrome: chrome.proxy.settings; Firefox:
browser.proxy.settings). Each zip gets the right pair mapped to the canonical
`manifest.json` / `background.js` names.

Usage: python build.py   ->   ../proxy-pivot-<target>-<version>.zip
"""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(ROOT)

SHARED = [
    "popup.html", "popup.css", "popup.js",
    "options.html", "options.css", "options.js",
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
]

TARGETS = {
    "chrome": {"manifest": "manifest.json", "background": "background.js"},
    "firefox": {"manifest": "manifest.firefox.json", "background": "background.firefox.js"},
}


def build(target, cfg):
    version = json.load(open(os.path.join(ROOT, cfg["manifest"])))["version"]
    out = os.path.join(OUT_DIR, f"proxy-pivot-{target}-{version}.zip")
    if os.path.exists(out):
        os.remove(out)
    # (source path, name inside the zip)
    members = [(cfg["manifest"], "manifest.json"), (cfg["background"], "background.js")]
    members += [(f, f) for f in SHARED]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc in members:
            path = os.path.join(ROOT, src)
            assert os.path.exists(path), f"missing: {src}"
            z.write(path, arc)
    print(f"{target:8} v{version}  ->  {out}  ({os.path.getsize(out)} bytes, {len(members)} files)")


if __name__ == "__main__":
    for target, cfg in TARGETS.items():
        build(target, cfg)
