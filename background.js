// Proxy Pivot — service worker
// Owns all proxy state. Popup/options send messages; this is the single source of truth.

const BUILTINS = {
  direct: { id: "direct", name: "Direct", kind: "direct", color: "#6b7280" },
  system: { id: "system", name: "System", kind: "system", color: "#8b5cf6" },
};

const DEFAULT_BYPASS = ["localhost", "127.0.0.1", "<local>"];

// A sensible starter profile pointing at Burp's default listener.
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
  const d = await chrome.storage.sync.get(["profiles", "activeId", "lastActiveId"]);
  let profiles = d.profiles;
  if (!Array.isArray(profiles)) {
    profiles = seedProfiles();
    await chrome.storage.sync.set({ profiles });
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

function buildConfig(profile) {
  if (!profile || profile.kind === "direct") return { mode: "direct" };
  if (profile.kind === "system") return { mode: "system" };
  if (profile.kind === "pac") {
    const pac = profile.pacUrl
      ? { url: profile.pacUrl }
      : { data: profile.pacData || "function FindProxyForURL(u,h){return 'DIRECT';}" };
    return { mode: "pac_script", pacScript: { ...pac, mandatory: false } };
  }
  // fixed servers
  const bypass = [...DEFAULT_BYPASS, ...(profile.bypass || [])];
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: profile.scheme || "http",
        host: profile.host,
        port: Number(profile.port),
      },
      bypassList: Array.from(new Set(bypass)),
    },
  };
}

async function applyProfile(id) {
  const state = await getState();
  const profile = resolveProfile(state, id);
  const config = buildConfig(profile);

  await new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve();
    });
  });

  const patch = { activeId: id };
  if (id !== "direct" && id !== "system") patch.lastActiveId = id;
  await chrome.storage.sync.set(patch);

  await updateBadge(id, profile);
  return { ok: true, activeId: id };
}

async function updateBadge(id, profile) {
  const isOn = id !== "direct" && id !== "system";
  const text = id === "system" ? "SYS" : isOn ? "ON" : "";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: profile.color || "#ff6633" });
  try {
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  } catch (_) {
    /* older Chrome */
  }
  const label = profile.name + (profile.host ? ` (${profile.host}:${profile.port})` : "");
  await chrome.action.setTitle({ title: `Proxy Pivot — ${label}` });
}

// Keyboard shortcut: toggle between Direct and the last real proxy.
async function toggle() {
  const state = await getState();
  if (state.activeId === "direct" || state.activeId === "system") {
    return applyProfile(state.lastActiveId || "direct");
  }
  return applyProfile("direct");
}

// Reachability probe. Chrome extensions can't open raw TCP sockets, so we
// heuristically fetch http://host:port directly:
//   - resolves (even opaque/no-cors)  -> something is listening  => "up"
//   - rejects quickly (conn refused)  -> nothing there           => "down"
//   - aborts on timeout (filtered)    -> can't tell               => "unknown"
// Reliable for HTTP(S) proxies (Burp, ZAP, mitmproxy). A SOCKS-only port is
// open but won't speak HTTP, so it may report "down"/"unknown" while actually up.
async function probe(host, port, timeout = 2500) {
  if (!host || !port) return { status: "unknown", ms: 0, note: "no host/port" };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  const start = Date.now();
  try {
    await fetch(`http://${host}:${port}/`, {
      mode: "no-cors",
      cache: "no-store",
      redirect: "manual",
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "probe":
          sendResponse(await probe(msg.host, msg.port, msg.timeout));
          break;
        case "getState": {
          const state = await getState();
          const active = resolveProfile(state, state.activeId);
          sendResponse({ ...state, activeProfile: active });
          break;
        }
        case "apply":
          sendResponse(await applyProfile(msg.id));
          break;
        case "toggle":
          sendResponse(await toggle());
          break;
        case "saveProfiles":
          await chrome.storage.sync.set({ profiles: msg.profiles });
          // If the active profile was edited/removed, re-apply or fall back.
          {
            const state = await getState();
            const stillExists =
              state.activeId === "direct" ||
              state.activeId === "system" ||
              state.profiles.some((p) => p.id === state.activeId);
            await applyProfile(stillExists ? state.activeId : "direct");
          }
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // async
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-proxy") toggle();
});

// Re-assert badge on startup/install (settings persist, badge does not).
async function resync() {
  const state = await getState();
  await updateBadge(state.activeId, resolveProfile(state, state.activeId));
}
chrome.runtime.onInstalled.addListener(resync);
chrome.runtime.onStartup.addListener(resync);
