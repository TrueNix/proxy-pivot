// Proxy Pivot — Firefox service worker (event page)
//
// Firefox has no chrome.proxy.settings. It exposes browser.proxy.settings, a
// BrowserSetting holding a ProxyConfig object — the closest analog to Chrome's
// API, and it supports fixed servers, SOCKS, PAC and system mode. The storage
// data model and message protocol are identical to the Chrome build, so
// popup.js / options.js are shared verbatim.

const BUILTINS = {
  direct: { id: "direct", name: "Direct", kind: "direct", color: "#6b7280" },
  system: { id: "system", name: "System", kind: "system", color: "#8b5cf6" },
};

const DEFAULT_BYPASS = ["localhost", "127.0.0.1", "::1"];

function seedProfiles() {
  return [
    {
      id: cryptoId(),
      name: "Burp Suite",
      kind: "fixed",
      scheme: "http",
      host: "127.0.0.1",
      port: 8080,
      bypass: [],
      color: "#ff6633",
    },
  ];
}

function cryptoId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

async function getState() {
  const d = await browser.storage.sync.get(["profiles", "activeId", "lastActiveId"]);
  let profiles = d.profiles;
  if (!Array.isArray(profiles)) {
    profiles = seedProfiles();
    await browser.storage.sync.set({ profiles });
  }
  return {
    profiles,
    activeId: d.activeId || "direct",
    lastActiveId: d.lastActiveId || (profiles[0] && profiles[0].id) || "direct",
  };
}

function resolveProfile(state, id) {
  if (id === "direct") return BUILTINS.direct;
  if (id === "system") return BUILTINS.system;
  return state.profiles.find((p) => p.id === id) || BUILTINS.direct;
}

// Map a profile to a Firefox ProxyConfig value.
function buildConfig(profile) {
  if (!profile || profile.kind === "direct") return { proxyType: "none" };
  if (profile.kind === "system") return { proxyType: "system" };

  if (profile.kind === "pac") {
    // Firefox autoConfig takes a URL; an inline script is passed as a data: URL.
    const url = profile.pacUrl
      ? profile.pacUrl
      : "data:application/x-javascript-config," +
        encodeURIComponent(profile.pacData || "function FindProxyForURL(u,h){return 'DIRECT';}");
    return { proxyType: "autoConfig", autoConfigUrl: url };
  }

  // fixed servers
  const passthrough = Array.from(new Set([...DEFAULT_BYPASS, ...(profile.bypass || [])])).join(", ");
  const hp = `${profile.host}:${Number(profile.port)}`;
  const scheme = profile.scheme || "http";

  if (scheme === "socks5" || scheme === "socks4") {
    return {
      proxyType: "manual",
      socks: hp,
      socksVersion: scheme === "socks4" ? 4 : 5,
      proxyDNS: true, // resolve DNS through the proxy (expected for pentest SOCKS tunnels)
      passthrough,
    };
  }

  // http / https proxy — route all protocols through it
  return {
    proxyType: "manual",
    http: hp,
    httpProxyAll: true,
    passthrough,
  };
}

async function applyProfile(id) {
  const state = await getState();
  const profile = resolveProfile(state, id);
  const config = buildConfig(profile);

  await browser.proxy.settings.set({ value: config });

  const patch = { activeId: id };
  if (id !== "direct" && id !== "system") patch.lastActiveId = id;
  await browser.storage.sync.set(patch);

  await updateBadge(id, profile);
  return { ok: true, activeId: id };
}

async function updateBadge(id, profile) {
  const isOn = id !== "direct" && id !== "system";
  const text = id === "system" ? "SYS" : isOn ? "ON" : "";
  await browser.action.setBadgeText({ text });
  await browser.action.setBadgeBackgroundColor({ color: profile.color || "#ff6633" });
  try {
    await browser.action.setBadgeTextColor({ color: "#ffffff" });
  } catch (_) {
    /* older Firefox */
  }
  const label = profile.name + (profile.host ? ` (${profile.host}:${profile.port})` : "");
  await browser.action.setTitle({ title: `Proxy Pivot — ${label}` });
}

async function toggle() {
  const state = await getState();
  if (state.activeId === "direct" || state.activeId === "system") {
    return applyProfile(state.lastActiveId || "direct");
  }
  return applyProfile("direct");
}

// Reachability probe — identical to the Chrome build.
async function probe(host, port, timeout = 2500) {
  if (!host || !port) return { status: "unknown", ms: 0, note: "no host/port" };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  const start = Date.now();
  try {
    await fetch(`http://${host}:${port}/`, {
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: ctl.signal,
    });
    clearTimeout(timer);
    return { status: "up", ms: Date.now() - start };
  } catch (_e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    if (ctl.signal.aborted) return { status: "unknown", ms, note: "timed out / filtered" };
    return { status: "down", ms };
  }
}

browser.runtime.onMessage.addListener(async (msg) => {
  try {
    switch (msg.type) {
      case "probe":
        return await probe(msg.host, msg.port, msg.timeout);
      case "getState": {
        const state = await getState();
        return { ...state, activeProfile: resolveProfile(state, state.activeId) };
      }
      case "apply":
        return await applyProfile(msg.id);
      case "toggle":
        return await toggle();
      case "saveProfiles": {
        await browser.storage.sync.set({ profiles: msg.profiles });
        const state = await getState();
        const stillExists =
          state.activeId === "direct" ||
          state.activeId === "system" ||
          state.profiles.some((p) => p.id === state.activeId);
        await applyProfile(stillExists ? state.activeId : "direct");
        return { ok: true };
      }
      default:
        return { ok: false, error: "unknown message" };
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

browser.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-proxy") toggle();
});

async function resync() {
  const state = await getState();
  await updateBadge(state.activeId, resolveProfile(state, state.activeId));
}
browser.runtime.onInstalled.addListener(resync);
browser.runtime.onStartup.addListener(resync);
