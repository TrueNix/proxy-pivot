// Options: CRUD over the profile list. Saving sends the whole list to the
// service worker, which persists it and re-applies the active profile.

const send = (msg) => chrome.runtime.sendMessage(msg);
const $ = (id) => document.getElementById(id);

const COLORS = ["#ff6633", "#22c55e", "#3b82f6", "#eab308", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

let profiles = [];
let selectedId = null;

const f = {
  name: $("f-name"),
  kind: $("f-kind"),
  scheme: $("f-scheme"),
  host: $("f-host"),
  port: $("f-port"),
  bypass: $("f-bypass"),
  pacurl: $("f-pacurl"),
  pacdata: $("f-pacdata"),
  swatches: $("f-swatches"),
};

let selectedColor = COLORS[0];

function id() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

function subFor(p) {
  if (p.kind === "fixed") return `${(p.scheme || "http").toUpperCase()} · ${p.host || "?"}:${p.port || "?"}`;
  if (p.kind === "pac") return "PAC script";
  if (p.kind === "system") return "System settings";
  return "";
}

function renderSwatches() {
  f.swatches.innerHTML = "";
  for (const c of COLORS) {
    const s = document.createElement("span");
    s.className = "sw" + (c === selectedColor ? " sel" : "");
    s.style.background = c;
    s.title = c;
    s.addEventListener("click", () => {
      selectedColor = c;
      renderSwatches();
    });
    f.swatches.append(s);
  }
}

function renderSidebar() {
  const list = $("sideList");
  list.innerHTML = "";
  if (profiles.length === 0) {
    const li = document.createElement("li");
    li.className = "side-sub";
    li.style.padding = "10px";
    li.textContent = "No profiles yet.";
    list.append(li);
    return;
  }
  for (const p of profiles) {
    const li = document.createElement("li");
    li.className = "side-item" + (p.id === selectedId ? " active" : "");
    const sw = document.createElement("span");
    sw.className = "side-swatch";
    sw.style.background = p.color || "#6b7280";
    const main = document.createElement("div");
    main.style.minWidth = "0";
    const nm = document.createElement("div");
    nm.className = "side-name";
    nm.textContent = p.name || "(unnamed)";
    const sb = document.createElement("div");
    sb.className = "side-sub";
    sb.textContent = subFor(p);
    main.append(nm, sb);
    li.append(sw, main);
    li.addEventListener("click", () => select(p.id));
    list.append(li);
  }
}

function syncKindVisibility() {
  const kind = f.kind.value;
  document.querySelectorAll("[data-kind]").forEach((el) => {
    el.hidden = el.dataset.kind !== kind;
  });
}

function fillForm(p) {
  f.name.value = p.name || "";
  f.kind.value = p.kind || "fixed";
  f.scheme.value = p.scheme || "http";
  f.host.value = p.host || "";
  f.port.value = p.port || "";
  f.bypass.value = (p.bypass || []).join("\n");
  f.pacurl.value = p.pacUrl || "";
  f.pacdata.value = p.pacData || "";
  selectedColor = p.color || COLORS[0];
  renderSwatches();
  syncKindVisibility();
  const out = $("f-test-result");
  out.textContent = "";
  out.className = "test-result";
}

function select(pid) {
  selectedId = pid;
  const p = profiles.find((x) => x.id === pid);
  $("emptyState").hidden = !!p;
  $("form").hidden = !p;
  if (p) fillForm(p);
  renderSidebar();
}

function readForm() {
  const kind = f.kind.value;
  const p = {
    id: selectedId,
    name: f.name.value.trim() || "Untitled",
    kind,
    color: selectedColor,
  };
  if (kind === "fixed") {
    p.scheme = f.scheme.value;
    p.host = f.host.value.trim();
    p.port = Number(f.port.value) || 8080;
    p.bypass = f.bypass.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (kind === "pac") {
    p.pacUrl = f.pacurl.value.trim();
    p.pacData = f.pacdata.value;
  }
  return p;
}

function validate(p) {
  if (p.kind === "fixed") {
    if (!p.host) return "Host is required.";
    if (p.port < 1 || p.port > 65535) return "Port must be 1–65535.";
  }
  if (p.kind === "pac" && !p.pacUrl && !p.pacData.trim()) {
    return "Provide a PAC URL or an inline script.";
  }
  return null;
}

let toastTimer;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1800);
}

async function save() {
  const p = readForm();
  const err = validate(p);
  if (err) {
    toast(err);
    return;
  }
  const idx = profiles.findIndex((x) => x.id === p.id);
  if (idx >= 0) profiles[idx] = p;
  else profiles.push(p);
  await send({ type: "saveProfiles", profiles });
  renderSidebar();
  toast("Saved & applied");
}

async function remove() {
  profiles = profiles.filter((x) => x.id !== selectedId);
  await send({ type: "saveProfiles", profiles });
  selectedId = null;
  $("form").hidden = true;
  $("emptyState").hidden = false;
  renderSidebar();
  toast("Deleted");
}

function createNew() {
  const p = {
    id: id(),
    name: "New profile",
    kind: "fixed",
    scheme: "http",
    host: "127.0.0.1",
    port: 8080,
    bypass: [],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  profiles.push(p);
  select(p.id);
  f.name.focus();
  f.name.select();
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  save();
});
async function testReachability() {
  const host = f.host.value.trim();
  const port = Number(f.port.value);
  const out = $("f-test-result");
  if (!host || !port) {
    out.className = "test-result down";
    out.textContent = "Enter a host and port first.";
    return;
  }
  out.className = "test-result testing";
  out.textContent = "Testing " + host + ":" + port + "…";
  const r = await send({ type: "probe", host, port });
  const label = {
    up: "✓ Reachable",
    down: "✗ Unreachable (connection refused)",
    unknown: "? No response" + (r.note ? " (" + r.note + ")" : ""),
  }[r.status];
  out.className = "test-result " + r.status;
  out.innerHTML = label + (r.ms != null ? ` <span class="ms">${r.ms}ms</span>` : "");
}

$("delete").addEventListener("click", remove);
$("new").addEventListener("click", createNew);
$("f-test").addEventListener("click", testReachability);
f.kind.addEventListener("change", syncKindVisibility);
// Clear a stale result when host/port changes.
[f.host, f.port].forEach((el) =>
  el.addEventListener("input", () => {
    $("f-test-result").textContent = "";
    $("f-test-result").className = "test-result";
  })
);

(async function init() {
  const state = await send({ type: "getState" });
  profiles = state.profiles || [];
  renderSwatches();
  renderSidebar();
  if (profiles.length) select(profiles[0].id);
})();
