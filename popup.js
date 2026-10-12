// Popup: render the profile list, let the user switch with one click.

const send = (msg) => chrome.runtime.sendMessage(msg);

const els = {
  list: document.getElementById("profileList"),
  statusValue: document.getElementById("statusValue"),
  statusDot: document.getElementById("statusDot"),
  addProfile: document.getElementById("addProfile"),
  openOptions: document.getElementById("openOptions"),
};

const SCHEME_LABEL = {
  http: "HTTP",
  https: "HTTPS",
  socks4: "SOCKS4",
  socks5: "SOCKS5",
};

function profileSub(p) {
  if (p.kind === "fixed") return `${SCHEME_LABEL[p.scheme] || p.scheme} · ${p.host}:${p.port}`;
  if (p.kind === "pac") return p.pacUrl ? "PAC · " + p.pacUrl : "PAC · inline";
  if (p.kind === "system") return "Use system settings";
  return "No proxy";
}

function makeRow(opts) {
  const { id, name, sub, color, active, editable } = opts;
  const li = document.createElement("li");
  li.className = "row" + (active ? " active" : "");
  li.dataset.id = id;

  const swatch = document.createElement("span");
  swatch.className = "swatch";
  if (color) swatch.style.background = color;

  const main = document.createElement("div");
  main.className = "row-main";
  const nm = document.createElement("div");
  nm.className = "row-name";
  nm.textContent = name;
  const sb = document.createElement("div");
  sb.className = "row-sub";
  sb.textContent = sub;
  main.append(nm, sb);

  const check = document.createElement("span");
  check.className = "check";
  check.textContent = "✓";

  li.append(swatch, main);

  if (opts.health) {
    const dot = document.createElement("span");
    dot.className = "health unknown";
    dot.title = "Click to test reachability";
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      probeRow(li, opts.health);
    });
    li.append(dot);
  }
  if (editable) {
    const edit = document.createElement("button");
    edit.className = "edit-btn";
    edit.textContent = "edit";
    edit.title = "Edit profile";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.openOptionsPage();
    });
    li.append(edit);
  }
  li.append(check);

  li.addEventListener("click", async () => {
    await send({ type: "apply", id });
    await render();
  });
  return li;
}

async function probeRow(li, hp) {
  const dot = li.querySelector(".health");
  if (!dot) return;
  dot.className = "health testing";
  dot.title = "Testing…";
  const r = await send({ type: "probe", host: hp.host, port: hp.port });
  dot.className = "health " + r.status;
  const label = { up: "Reachable", down: "Unreachable", unknown: "No response" }[r.status];
  dot.title = `${label}${r.ms != null ? ` · ${r.ms}ms` : ""} — click to re-test`;
}

async function render() {
  const state = await send({ type: "getState" });
  const { profiles, activeId, activeProfile } = state;

  els.list.innerHTML = "";

  // Built-in Direct first.
  els.list.append(
    makeRow({
      id: "direct",
      name: "Direct",
      sub: "No proxy (default)",
      color: "#6b7280",
      active: activeId === "direct",
      editable: false,
    })
  );

  const toProbe = [];
  for (const p of profiles) {
    const row = makeRow({
      id: p.id,
      name: p.name,
      sub: profileSub(p),
      color: p.color,
      active: activeId === p.id,
      editable: true,
      health: p.kind === "fixed" ? { host: p.host, port: p.port } : null,
    });
    els.list.append(row);
    if (p.kind === "fixed") toProbe.push([row, { host: p.host, port: p.port }]);
  }
  // Auto-probe every fixed profile so "is Burp up?" is answered the moment you open.
  toProbe.forEach(([row, hp]) => probeRow(row, hp));

  // Built-in System last.
  els.list.append(
    makeRow({
      id: "system",
      name: "System",
      sub: "Use system settings",
      color: "#8b5cf6",
      active: activeId === "system",
      editable: false,
    })
  );

  const on = activeId !== "direct";
  els.statusValue.textContent = activeProfile ? activeProfile.name : "Direct";
  els.statusValue.style.color = on ? activeProfile.color || "var(--accent)" : "var(--text)";
  els.statusDot.classList.toggle("on", on && activeId !== "system");
}

els.addProfile.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

render();
