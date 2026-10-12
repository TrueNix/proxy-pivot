# Chrome Web Store listing — copy/paste fields

## Name
Proxy Pivot

## Summary (short description — max 132 chars)
One-click proxy switching for pentesters. Route into Burp Suite and back with a keystroke, with live reachability checks.

## Category
Developer Tools

## Language
English

## Detailed description
Proxy Pivot is a fast, no-nonsense proxy switcher built for pentesters and developers
who live in Burp Suite, OWASP ZAP, mitmproxy, or a SOCKS tunnel and want to flip their
browser's traffic in and out with one click.

WHAT IT DOES
• One-click switching — pick a profile from the popup and Chrome's proxy changes instantly.
• Burp-ready out of the box — ships with a profile aimed at 127.0.0.1:8080.
• Keyboard toggle — Alt+Shift+P flips the last-used proxy on and off without opening anything.
• HTTP, HTTPS, SOCKS4, SOCKS5, PAC script, and System modes.
• Live reachability dots — the popup checks whether each proxy is actually listening, so
  you instantly see if Burp's listener is up before you chase dead traffic.
• Per-profile bypass lists — hosts that skip the proxy. localhost, 127.0.0.1 and <local>
  are always bypassed so your tooling stays reachable.
• Color-coded profiles and an ON/SYS toolbar badge so you always know what's live.
• Profiles sync across your signed-in Chrome installs.

PRIVACY
Proxy Pivot collects nothing. Your profiles stay in your browser (chrome.storage.sync).
The only network call it makes is the reachability check to the proxy host YOU entered.
It does not inspect, log, or transmit your traffic.

Intended for authorized testing on systems you own or are permitted to assess.

## Permission justifications (Privacy practices tab)
proxy  — Core function: sets Chrome's proxy to the user's selected profile via chrome.proxy.settings.
storage — Stores the user's own proxy profiles (name, host, port, bypass list) locally via chrome.storage.sync. No data leaves the browser.

## Single purpose
Quickly switch the browser's proxy between user-defined profiles (such as a local
intercepting proxy like Burp Suite) and test whether each proxy is reachable.

## Data usage declarations
- Does NOT collect or use user data. Tick "I do not collect user data."
- Not being sold to third parties: confirm.
- Not used/transferred for purposes unrelated to the item's core functionality: confirm.
- Not used/transferred to determine creditworthiness or for lending: confirm.
