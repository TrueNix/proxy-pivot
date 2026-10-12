# Privacy Policy — Proxy Pivot

_Last updated: 2026-10-12_

Proxy Pivot is a browser extension that lets you switch Chrome's proxy between
profiles you create. Your privacy is simple to describe because the extension is
built not to collect anything.

## What we collect

**Nothing.** Proxy Pivot does not collect, transmit, sell, or share any personal
data, browsing history, or usage analytics. There are no trackers and no third-party
services.

## What is stored, and where

The only data the extension stores are the **proxy profiles you create** — the name,
protocol, host, port, bypass list, and color of each profile, plus which profile is
active. This is saved using Chrome's `storage.sync` API, which keeps it inside your
own Chrome profile (and syncs it across your signed-in Chrome installations via
Google, under Google's own terms). It is never sent to us or to any server we control.

## Network connections

Proxy Pivot makes no network requests of its own except one:

- **Reachability test** — when you open the popup or click a health dot, the extension
  sends a single connection attempt to the proxy **host and port you entered** (e.g.
  `127.0.0.1:8080`) to check whether it is listening. No data beyond that connection
  attempt is sent, and the result (up / down) never leaves your browser.

The extension controls Chrome's proxy setting via the `proxy` permission; while a
proxy is active your traffic is routed through the proxy **you chose**, exactly as you
configured it. Proxy Pivot does not inspect, log, or modify that traffic.

## Permissions

- `proxy` — to set Chrome's proxy to your selected profile.
- `storage` — to save your profiles locally.

## Changes

If this policy changes, the updated version will be posted at this URL.

## Contact

Questions or concerns: email devproxypivot@gmail.com, or open an issue at
https://github.com/TrueNix/proxy-pivot/issues
