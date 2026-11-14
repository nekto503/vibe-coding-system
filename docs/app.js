/* ================================================================
   WINDOWS 11 WEB — логика системы
   ================================================================ */
"use strict";

/* ---------- ССЫЛКИ ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

const desktop = $("#desktop");
const wallpaper = $("#wallpaper");
const windowsLayer = $("#windows-layer");
const taskbarApps = $("#tb-apps");

/* ---------- СОСТОЯНИЕ ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("w11-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("w11-" + k, JSON.stringify(v)); } catch (e) {} }
};

let settings = Object.assign({
  theme: "dark", accent: "#4cc2ff", wallpaper: "wp0",
  brightness: 100, volume: 65, nightlight: false
}, store.get("settings", {}));

let userName = store.get("username", "Пользователь");

/* ---------- УТИЛИТЫ ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function fmtTime(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
function fmtDate(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); }
function fmtDateLong(d) { return DOW[(d.getDay() + 6) % 7] === "" ? "" : d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " г."; }

function applySettings() {
  document.body.classList.toggle("theme-dark", settings.theme === "dark");
  document.body.classList.toggle("theme-light", settings.theme === "light");
  document.documentElement.style.setProperty("--accent", settings.accent);
  wallpaper.className = settings.wallpaper;
  const bl = settings.brightness / 100;
  const nl = settings.nightlight ? " sepia(0.35) saturate(1.15)" : "";
  desktop.style.filter = `brightness(${bl})` + nl;
  store.set("settings", settings);
}

/* ---------- ЧАСЫ ---------- */
function tickClock() {
  const d = new Date();
  $("#tray-clock .tc-time").textContent = fmtTime(d);
  $("#tray-clock .tc-date").textContent = fmtDate(d);
  $("#tray-batt").textContent = "🔋";
  const lt = $("#lock-screen .lock-time");
  if (lt) lt.textContent = fmtTime(d);
  $("#lock-screen .lock-date").textContent = d.getDate() + " " + MONTHS[d.getMonth()];
  const cf = $("#cal-flyout-date");
  if (cf) cf.textContent = fmtDateLong(d);
}
setInterval(tickClock, 1000);

/* ================================================================
   ФАЙЛОВАЯ СИСТЕМА
   ================================================================ */
const FS = {
  root: store.get("fs", null),
  save() { store.set("fs", this.root); },

  init() {
    if (this.root) return;
    this.root = {
      name: "Этот компьютер", type: "dir",
      children: [{
        name: "Локальный диск (C:)", type: "dir", children: [{
          name: "Пользователь", type: "dir", children: [
            { name: "Рабочий стол", type: "dir", children: [
              { name: "Проводник", type: "app", app: "explorer" },
              { name: "Блокнот", type: "app", app: "notepad" },
              { name: "Терминал", type: "app", app: "terminal" },
              { name: "Корзина", type: "dir", children: [] }
            ]},
            { name: "Документы", type: "dir", children: [
              { name: "Заметки.txt", type: "file", content: "Список дел:\n1. Изучить Fluent Design\n2. Выпить кофе\n3. Написать свою ОС" },
              { name: "Резюме.txt", type: "file", content: "Пользователь\n— эксперт по красивым интерфейсам." }
            ]},
            { name: "Изображения", type: "dir", children: [] },
            { name: "Музыка", type: "dir", children: [
              { name: "Chill Synth.mp3", type: "audio" },
              { name: "Night Drive.mp3", type: "audio" },
              { name: "Rainy Café.mp3", type: "audio" }
            ]},
            { name: "Загрузки", type: "dir", children: [
              { name: "setup_fluent_design.exe", type: "file", content: "" }
            ]},
            { name: "Видео", type: "dir", children: [] }
          ]
        },
        { name: "Windows", type: "dir", children: [
          { name: "System32", type: "dir", children: [
            { name: "kernel32.dll", type: "file", content: "" },
            { name: "shell32.dll", type: "file", content: "" },
            { name: "fluent.css", type: "file", content: "/* Просто красивый CSS */" }
          ]},
          { name: "explorer.exe", type: "file", content: "" },
          { name: "notepad.exe", type: "file", content: "" }
        ]}
      ]}
    ]};
    // Предустановленные "фотографии" — генерируем градиенты
    const pics = [
      ["#1a2a6c", "#b21f1f", "#fdbb2d"], ["#0f2027", "#203a43", "#2c5364"],
      ["#41295a", "#2f0743", "#000000"], ["#136a8a", "#267871", "#0f3a4a"],
      ["#3a1c71", "#d76d77", "#ffaf7b"], ["#0b486b", "#f56217", "#0b486b"]
    ];
    pics.forEach((c, i) => {
      this.root.children[0].children[0].children[2].children.push({
        name: "Обои " + (i + 1) + ".png", type: "img",
        data: makeGradientImage(c[0], c[1], c[2])
      });
    });
    this.save();
  },

  walk(path) { // path: массив имён
    let node = this.root;
    for (const seg of path) {
      if (!node.children) return null;
      const next = node.children.find(c => c.name === seg);
      if (!next) return null;
      node = next;
    }
    return node;
  },

  mkdir(path, name) {
    const d = this.walk(path);
    if (!d || !d.children) return;
    let n = name, i = 2;
    while (d.children.some(c => c.name === n)) n = name + " (" + (i++) + ")";
    d.children.push({ name: n, type: "dir", children: [] });
    this.save();
    return n;
  },

  mkfile(path, name, content) {
    const d = this.walk(path);
    if (!d || !d.children) return;
    let n = name, i = 2;
    while (d.children.some(c => c.name === n)) {
      const dot = name.lastIndexOf(".");
      n = dot > 0 ? name.slice(0, dot) + " (" + (i++) + ")" + name.slice(dot) : name + " (" + (i++) + ")";
    }
    d.children.push({ name: n, type: "file", content: content || "" });
    this.save();
    return n;
  },

  mkimg(path, name, data) {
    const d = this.walk(path);
    if (!d || !d.children) return;
    let n = name, i = 2;
    while (d.children.some(c => c.name === n)) {
      const dot = name.lastIndexOf(".");
      n = dot > 0 ? name.slice(0, dot) + " (" + (i++) + ")" + name.slice(dot) : name + " (" + (i++) + ")";
    }
    d.children.push({ name: n, type: "img", data });
    this.save();
    return n;
  },

  remove(path, name) {
    const d = this.walk(path);
    if (!d || !d.children) return;
    d.children = d.children.filter(c => c.name !== name);
    this.save();
  },

  rename(path, oldName, newName) {
    const d = this.walk(path);
    if (!d || !d.children) return;
    const c = d.children.find(x => x.name === oldName);
    if (c && newName) { c.name = newName; this.save(); }
  }
};

function makeGradientImage(c1, c2, c3) {
  const cv = document.createElement("canvas");
  cv.width = 640; cv.height = 420;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 640, 420);
  g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c3);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 420);
  const r = ctx.createRadialGradient(480, 120, 20, 480, 120, 320);
  r.addColorStop(0, "rgba(255,255,255,0.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r; ctx.fillRect(0, 0, 640, 420);
  return cv.toDataURL();
}

/* ================================================================
   РЕЕСТР ПРИЛОЖЕНИЙ
   ================================================================ */
const APPS = {
  explorer:  { name: "Проводник",    icon: "📁", w: 860, h: 560, render: renderExplorer },
  edge:      { name: "Microsoft Edge", icon: "🌐", w: 1000, h: 640, render: renderEdge },
  settings:  { name: "Параметры",    icon: "⚙️", w: 940, h: 620, single: true, render: renderSettings },
  notepad:   { name: "Блокнот",      icon: "📝", w: 640, h: 480, render: renderNotepad },
  calc:      { name: "Калькулятор",  icon: "🧮", w: 340, h: 500, single: true, render: renderCalc },
  terminal:  { name: "Терминал",     icon: "⌨️", w: 760, h: 460, render: renderTerminal },
  paint:     { name: "Paint",        icon: "🎨", w: 820, h: 600, single: true, render: renderPaint },
  photos:    { name: "Фотографии",   icon: "🖼️", w: 860, h: 580, single: true, render: renderPhotos },
  store:     { name: "Microsoft Store", icon: "🛍️", w: 880, h: 600, single: true, render: renderStore },
  taskmgr:   { name: "Диспетчер задач", icon: "📊", w: 640, h: 520, single: true, render: renderTaskMgr },
  mines:     { name: "Сапёр",        icon: "💣", w: 400, h: 520, single: true, render: renderMines },
  camera:    { name: "Камера",       icon: "📷", w: 640, h: 500, single: true, render: renderCamera },
  clock:     { name: "Часы",         icon: "🕐", w: 460, h: 340, single: true, render: renderClockApp },
  media:     { name: "Медиаплеер",   icon: "🎵", w: 480, h: 560, single: true, render: renderMedia }
};

const PINNED = store.get("pinned", ["explorer", "edge", "settings", "notepad", "terminal", "paint", "photos", "store", "calc", "mines", "camera", "media"]).filter(id => APPS[id]);
const TASKBAR_PINNED = store.get("tbpinned", ["explorer", "edge", "settings", "terminal"]).filter(id => APPS[id]);
const DESK_PATH = ["Локальный диск (C:)", "Пользователь", "Рабочий стол"];

function isOn(kind, id) {
  if (kind === "desk") { const d = FS.walk(DESK_PATH); return !!d && d.children.some(c => c.type === "app" && c.app === id); }
  return (kind === "task" ? TASKBAR_PINNED : PINNED).includes(id);
}
function togglePin(kind, id) {
  if (kind === "desk") {
    const d = FS.walk(DESK_PATH); if (!d) return;
    if (isOn("desk", id)) d.children = d.children.filter(c => !(c.type === "app" && c.app === id));
    else d.children.push({ name: APPS[id].name, type: "app", app: id });
    FS.save(); renderDesktopIcons(); return;
  }
  const list = kind === "task" ? TASKBAR_PINNED : PINNED;
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  store.set(kind === "task" ? "tbpinned" : "pinned", list);
  renderStart(); renderTaskbarApps();
}
const PIN_LABELS = {
  desk: ["Добавить на рабочий стол", "Убрать с рабочего стола"],
  task: ["Закрепить на панели задач", "Открепить от панели задач"],
  start: ["Закрепить на начальном экране", "Открепить от начального экрана"]
};
function appPinItems(id) {
  return ["start", "task", "desk"].map(k => {
    const on = isOn(k, id);
    return { ico: on ? "✓" : "＋", label: PIN_LABELS[k][on ? 1 : 0], action: () => togglePin(k, id) };
  });
}
function pinMenu(x, y, kind) {
  showMenu(x, y, Object.entries(APPS).map(([id, a]) => ({
    ico: isOn(kind, id) ? "✓" : "", label: a.name, action: () => togglePin(kind, id)
  })));
}

/* ================================================================
   ОКОННЫЙ МЕНЕДЖЕР
   ================================================================ */
let WINS = [];
let winZ = 100;
let winCount = 0;

function openApp(appId, args) {
  const app = APPS[appId];
  if (!app) return;
  closeAllFlyouts();
  if (app.single) {
    const ex = WINS.find(w => w.appId === appId);
    if (ex) { restoreWin(ex); focusWin(ex); return ex; }
  }
  const win = { id: "w" + (++winCount), appId, app, args: args || {}, minimized: false, maximized: false };
  const el = document.createElement("div");
  el.className = "window focused";
  el.style.zIndex = ++winZ;
  const dw = Math.min(app.w, innerWidth - 60), dh = Math.min(app.h, innerHeight - 100);
  const off = (WINS.length % 7) * 26;
  const x = Math.max(10, (innerWidth - dw) / 2 - 90 + off);
  const y = Math.max(10, (innerHeight - 48 - dh) / 2 - 30 + off);
  Object.assign(el.style, { left: x + "px", top: y + "px", width: dw + "px", height: dh + "px" });
  el.innerHTML = `
    <div class="win-titlebar">
      <span class="win-appico">${app.icon}</span>
      <span class="win-title">${app.name}</span>
      <div class="win-controls">
        <button class="win-btn wbtn-min" title="Свернуть"><svg viewBox="0 0 12 12"><path d="M1 6 h10"/></svg></button>
        <button class="win-btn wbtn-max" title="Развернуть"><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/></svg></button>
        <button class="win-btn wbtn-close" title="Закрыть"><svg viewBox="0 0 12 12"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5"/></svg></button>
      </div>
    </div>
    <div class="win-body"><div class="win-content"></div></div>
    ${["n","s","w","e","nw","ne","sw","se"].map(d => `<div class="rs-handle rs-${d}" data-dir="${d}"></div>`).join("")}`;
  windowsLayer.appendChild(el);
  win.el = el;
  WINS.push(win);

  // Управление
  el.addEventListener("pointerdown", () => focusWin(win));
  $(".wbtn-min", el).onclick = e => { e.stopPropagation(); minimizeWin(win); };
  $(".wbtn-max", el).onclick = e => { e.stopPropagation(); toggleMax(win); };
  $(".wbtn-close", el).onclick = e => { e.stopPropagation(); closeWin(win); };
  el.querySelector(".win-titlebar").addEventListener("dblclick", e => {
    if (!e.target.closest(".win-btn")) toggleMax(win);
  });
  makeDraggable(win);
  makeResizable(win);

  // Контент приложения
  const content = $(".win-content", el);
  app.render(content, win, win.args);

  focusWin(win);
  renderTaskbarApps();
  return win;
}

function focusWin(win) {
  WINS.forEach(w => w.el.classList.toggle("focused", w === win));
  win.el.style.zIndex = ++winZ;
  renderTaskbarApps();
}

function closeWin(win) {
  if (win.onClose) try { win.onClose(); } catch (e) {}
  win.el.classList.add("closing");
  setTimeout(() => { win.el.remove(); }, 160);
  WINS = WINS.filter(w => w !== win);
  renderTaskbarApps();
  if (win.cameraStream) win.cameraStream.getTracks().forEach(t => t.stop());
  if (win.audio) { try { win.audio.stop(); } catch (e) {} win.audio = null; }
}

function minimizeWin(win) {
  win.minimized = true;
  win.el.style.transformOrigin = "center bottom";
  win.el.style.transition = "transform .18s ease, opacity .18s ease";
  win.el.style.transform = "scale(0.75) translateY(120px)";
  win.el.style.opacity = "0";
  setTimeout(() => { win.el.classList.add("minimized"); win.el.style.transform = ""; win.el.style.opacity = ""; win.el.style.transition = ""; }, 180);
  renderTaskbarApps();
}

function restoreWin(win) {
  if (!win.minimized) return;
  win.minimized = false;
  win.el.classList.remove("minimized");
  win.el.style.transformOrigin = "center bottom";
  win.el.style.transition = "transform .18s ease, opacity .18s ease";
  win.el.style.transform = "scale(0.75) translateY(120px)";
  win.el.style.opacity = "0";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    win.el.style.transform = ""; win.el.style.opacity = ""; win.el.style.transition = "";
  }));
  renderTaskbarApps();
}

function toggleMax(win) {
  const el = win.el;
  if (win.maximized) {
    Object.assign(el.style, win.prevRect);
    el.classList.remove("maximized");
    win.maximized = false;
  } else {
    win.prevRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
    Object.assign(el.style, { left: "0px", top: "0px", width: "100%", height: "100%" });
    el.classList.add("maximized");
    win.maximized = true;
  }
  const b = $(".wbtn-max svg", el);
  b.innerHTML = win.maximized
    ? '<rect x="0.5" y="3.5" width="8" height="8" rx="1.5"/><path d="M3 3.5 V1.5 h8 v8 h-2"/>'
    : '<rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/>';
}

/* Перетаскивание + прилипание */
function makeDraggable(win) {
  const el = win.el;
  const tb = el.querySelector(".win-titlebar");
  let sx, sy, ox, oy, dragging = false, snap = null;
  const preview = $("#snap-preview");

  tb.addEventListener("pointerdown", e => {
    if (e.target.closest(".win-btn") || e.button !== 0) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    if (win.maximized) { // отлипание от максимизации
      const rw = win.prevRect && win.prevRect.width ? parseFloat(win.prevRect.width) : el.offsetWidth * 0.7;
      toggleMax(win);
      el.style.left = (e.clientX - rw / 2) + "px";
      el.style.top = Math.max(0, e.clientY - 18) + "px";
      ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top);
    } else {
      ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top);
    }
    tb.setPointerCapture(e.pointerId);
  });

  tb.addEventListener("pointermove", e => {
    if (!dragging) return;
    const x = e.clientX - ox, y = e.clientY - oy;
    el.style.left = x + "px"; el.style.top = Math.max(0, y) + "px";
    // Зоны прилипания
    if (e.clientY <= 2) snap = { l: 0, t: 0, w: "100%", h: "100%" };
    else if (e.clientX <= 2) snap = { l: 0, t: 0, w: "50%", h: "100%" };
    else if (e.clientX >= innerWidth - 3) snap = { l: "50%", t: 0, w: "50%", h: "100%" };
    else snap = null;
    if (snap) {
      Object.assign(preview.style, {
        display: "block",
        left: (typeof snap.l === "number" ? snap.l : innerWidth * snap.l / 100) + "px",
        top: "0px",
        width: (typeof snap.w === "number" ? snap.w : innerWidth * snap.w / 100) + "px",
        height: (innerHeight - 48) + "px"
      });
    } else preview.style.display = "none";
  });

  tb.addEventListener("pointerup", () => {
    dragging = false;
    preview.style.display = "none";
    if (snap) {
      if (snap.w === "100%") { if (!win.maximized) toggleMax(win); }
      else {
        if (win.maximized) toggleMax(win);
        Object.assign(el.style, { left: (innerWidth * snap.l / 100) + "px", top: "0px", width: (innerWidth * snap.w / 100) + "px", height: (innerHeight - 48 - 8) + "px" });
      }
      snap = null;
    }
  });
}

function makeResizable(win) {
  const el = win.el;
  $$(".rs-handle", el).forEach(h => {
    h.addEventListener("pointerdown", e => {
      if (win.maximized) return;
      e.preventDefault();
      focusWin(win);
      const dir = h.dataset.dir;
      const sx = e.clientX, sy = e.clientY;
      const r = { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight };
      h.setPointerCapture(e.pointerId);
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        let nx = r.x, ny = r.y, nw = r.w, nh = r.h;
        if (dir.includes("e")) nw = Math.max(380, r.w + dx);
        if (dir.includes("s")) nh = Math.max(220, r.h + dy);
        if (dir.includes("w")) { nw = Math.max(380, r.w - dx); nx = r.x + (r.w - nw); }
        if (dir.includes("n")) { nh = Math.max(220, r.h - dy); ny = r.y + (r.h - nh); }
        Object.assign(el.style, { left: nx + "px", top: ny + "px", width: nw + "px", height: nh + "px" });
      };
      const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); };
      h.addEventListener("pointermove", mv);
      h.addEventListener("pointerup", up);
    });
  });
}

function activeWin() {
  return WINS.filter(w => !w.minimized).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0] || null;
}

/* ================================================================
   ПАНЕЛЬ ЗАДАЧ
   ================================================================ */
function renderTaskbarApps() {
  const ids = [...TASKBAR_PINNED];
  WINS.forEach(w => { if (!ids.includes(w.appId)) ids.push(w.appId); });
  const act = activeWin();
  taskbarApps.innerHTML = "";
  const seen = new Set();
  ids.forEach(id => {
    if (seen.has(id)) return; seen.add(id);
    const app = APPS[id];
    const b = document.createElement("button");
    b.className = "tb-app";
    const running = WINS.filter(w => w.appId === id);
    if (running.length) b.classList.add("running");
    if (act && act.appId === id) b.classList.add("active");
    b.title = app.name;
    b.innerHTML = `<span class="ta-ico">${app.icon}</span><span class="ta-ind"></span>`;
    b.onclick = () => {
      const ws = WINS.filter(w => w.appId === id);
      if (!ws.length) { openApp(id); return; }
      const a = activeWin();
      if (a && a.appId === id) {
        const target = ws.length > 1 ? ws[(ws.indexOf(a) + 1) % ws.length] : null;
        if (target) { restoreWin(target); focusWin(target); } else minimizeWin(a);
      } else { restoreWin(ws[ws.length - 1]); focusWin(ws[ws.length - 1]); }
    };
    b.oncontextmenu = e => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, [
        { ico: app.icon, label: app.name, action: () => openApp(id) },
        { sep: true },
        ...appPinItems(id),
        ...(running.length ? [{ sep: true }, { ico: "✕", label: "Закрыть все окна", action: () => running.forEach(closeWin) }] : [])
      ]);
    };
    taskbarApps.appendChild(b);
  });
}

/* ================================================================
   ФЛАЙАУТЫ
   ================================================================ */
const flyouts = ["#start-menu", "#search-flyout", "#quick-settings", "#calendar-flyout", "#widgets-panel"];

function closeAllFlyouts(except) {
  flyouts.forEach(f => {
    if (f !== except) {
      $(f).classList.remove("open");
      if (f === "#start-menu") { $("#start-menu").classList.remove("open"); }
    }
  });
  $("#power-menu").classList.remove("open");
  if (except !== "#task-view") $("#task-view").classList.remove("open");
}

function toggleFlyout(sel) {
  const el = $(sel);
  const was = el.classList.contains("open");
  closeAllFlyouts(sel);
  el.classList.toggle("open", !was);
  if (!was && sel === "#start-menu") setTimeout(() => $("#sm-search-input").focus(), 60);
  if (!was && sel === "#search-flyout") { $("#sf-input").value = ""; renderSearchResults(""); setTimeout(() => $("#sf-input").focus(), 60); }
  if (!was && sel === "#calendar-flyout") renderCalendar();
}

$("#tb-start").onclick = () => toggleFlyout("#start-menu");
$("#tb-search").onclick = () => toggleFlyout("#search-flyout");
$("#tray-quick").onclick = () => toggleFlyout("#quick-settings");
$("#tray-clock").onclick = () => toggleFlyout("#calendar-flyout");
$("#tray-notify").onclick = () => toggleFlyout("#calendar-flyout");
$("#tb-widgets").onclick = () => toggleFlyout("#widgets-panel");
$("#tb-taskview").onclick = () => toggleTaskView();

document.addEventListener("pointerdown", e => {
  if (e.target.closest("#taskbar")) return;
  const inFly = flyouts.some(f => { const el = $(f); return el.classList.contains("open") && el.contains(e.target); });
  const inTV = $("#task-view").classList.contains("open") && e.target.closest("#task-view");
  const inCtx = e.target.closest("#ctx-menu");
  const inPm = e.target.closest("#power-menu");
  if (!inFly && !inTV && !inCtx && !inPm) closeAllFlyouts();
}, true);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeAllFlyouts(); hideMenu(); }
  if (e.key === "Enter" && $("#lock-screen").style.display === "flex") unlock();
});

/* ================================================================
   ПУСК
   ================================================================ */
const startMenu = $("#start-menu");

function renderStart() {
  const pinned = $("#sm-pinned");
  pinned.innerHTML = "";
  PINNED.forEach(id => {
    const app = APPS[id];
    const d = document.createElement("div");
    d.className = "sm-app";
    d.innerHTML = `<span class="sa-ico">${app.icon}</span><span class="sa-name">${app.name}</span>`;
    d.onclick = () => openApp(id);
    d.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); showMenu(e.clientX, e.clientY, [{ ico: app.icon, label: "Открыть", action: () => openApp(id) }, { sep: true }, ...appPinItems(id)]); };
    pinned.appendChild(d);
  });
  renderRecommended();
  renderAllApps();
}

function recentFiles() {
  const docs = FS.walk(["Локальный диск (C:)", "Пользователь", "Документы"]);
  const imgs = FS.walk(["Локальный диск (C:)", "Пользователь", "Изображения"]);
  return [...(docs ? docs.children : []), ...(imgs ? imgs.children : [])].slice(-4).reverse();
}

function renderRecommended() {
  const rec = $("#sm-recommended");
  rec.innerHTML = "";
  recentFiles().forEach(f => {
    const d = document.createElement("div");
    d.className = "sm-rec";
    const ico = f.type === "img" ? "🖼️" : f.type === "audio" ? "🎵" : "📄";
    d.innerHTML = `<span class="sr-ico">${ico}</span><div><div class="sr-name">${f.name}</div><div class="sr-sub">Недавно добавлено</div></div>`;
    d.onclick = () => openFileByName(f);
    rec.appendChild(d);
  });
}

function openFileByName(f) {
  if (f.type === "img") openApp("photos", { focusName: f.name });
  else if (f.type === "audio") openApp("media", { track: f.name });
  else {
    const docsPath = ["Локальный диск (C:)", "Пользователь", "Документы"];
    const imgsPath = ["Локальный диск (C:)", "Пользователь", "Изображения"];
    const path = (f.type === "img") ? imgsPath : docsPath;
    openApp("notepad", { path, name: f.name });
  }
}

function renderAllApps() {
  const list = $("#sm-all-list");
  list.innerHTML = "";
  Object.entries(APPS).forEach(([id, app]) => {
    const d = document.createElement("div");
    d.className = "sm-all-item";
    d.innerHTML = `<span class="ai-ico">${app.icon}</span><span>${app.name}</span>`;
    d.onclick = () => openApp(id);
    d.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); showMenu(e.clientX, e.clientY, [{ ico: app.icon, label: "Открыть", action: () => openApp(id) }, { sep: true }, ...appPinItems(id)]); };
    list.appendChild(d);
  });
}

$("#btn-all-apps").onclick = () => {
  const pinnedSec = $("#start-menu .sm-section");
  const recSec = $("#sm-recommended-section");
  const list = $("#sm-all-list");
  const show = list.style.display === "none";
  list.style.display = show ? "block" : "none";
  pinnedSec.style.display = show ? "none" : "block";
  recSec.style.display = show ? "none" : "block";
  $("#btn-all-apps").textContent = show ? "‹ Назад" : "Все приложения ›";
};

$("#sm-search-input").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  $$("#sm-pinned .sm-app").forEach(el => {
    const name = $(".sa-name", el).textContent.toLowerCase();
    el.style.display = !q || name.includes(q) ? "flex" : "none";
  });
  const list = $("#sm-all-list");
  $$("#sm-all-list .sm-all-item").forEach(el => {
    const name = el.textContent.toLowerCase();
    el.style.display = q && name.includes(q) ? "flex" : "none";
  });
  if (q) {
    $("#sm-all-list").style.display = "block";
    $("#start-menu .sm-section").style.display = "none";
    $("#sm-recommended-section").style.display = "none";
    $("#btn-all-apps").textContent = "‹ Назад";
  }
});

/* Питание */
$("#btn-power").onclick = e => { e.stopPropagation(); $("#power-menu").classList.toggle("open"); };
$$("#power-menu .pm-item").forEach(item => {
  item.onclick = () => {
    const act = item.dataset.power;
    closeAllFlyouts();
    if (act === "shutdown") shutdown(false);
    else if (act === "restart") shutdown(true);
    else if (act === "lock") lockScreen(true);
    else if (act === "sleep") sleep();
  };
});

/* ================================================================
   ПОИСК
   ================================================================ */
function renderSearchResults(q) {
  const box = $("#sf-results");
  q = q.trim().toLowerCase();
  let html = "";
  if (q) {
    const apps = Object.entries(APPS).filter(([, a]) => a.name.toLowerCase().includes(q));
    if (apps.length) {
      html += '<div class="sf-label">Лучшее соответствие</div>';
      apps.forEach(([id, a]) => {
        html += `<div class="sf-item" data-app="${id}"><span class="si-ico">${a.icon}</span><div><div class="si-name">${a.name}</div><div class="si-sub">Приложение</div></div></div>`;
      });
    }
    // Файлы
    const files = [];
    const scan = (node, path) => {
      if (!node.children) return;
      node.children.forEach(c => {
        if (c.type !== "dir" && c.name.toLowerCase().includes(q)) files.push({ f: c, path });
        if (c.type === "dir" && path.length < 5) scan(c, [...path, c.name]);
      });
    };
    scan(FS.root, []);
    if (files.length) {
      html += '<div class="sf-label">Файлы и папки</div>';
      files.slice(0, 8).forEach(({ f, path }) => {
        const ico = f.type === "img" ? "🖼️" : f.type === "audio" ? "🎵" : f.type === "dir" ? "📂" : "📄";
        html += `<div class="sf-item" data-fpath='${JSON.stringify(path)}' data-fname="${f.name}"><span class="si-ico">${ico}</span><div><div class="si-name">${f.name}</div><div class="si-sub">${path.join(" \\ ") || "Этот компьютер"}</div></div></div>`;
      });
    }
    html += `<div class="sf-label">Поиск в Интернете</div>
      <div class="sf-item" id="sf-web"><span class="si-ico">🌐</span><div><div class="si-name">${q} — искать в Google</div><div class="si-sub">Открыть в браузере</div></div></div>`;
  } else {
    html += '<div class="sf-label">Быстрый доступ</div>';
    ["explorer", "edge", "settings", "notepad"].forEach(id => {
      const a = APPS[id];
      html += `<div class="sf-item" data-app="${id}"><span class="si-ico">${a.icon}</span><div><div class="si-name">${a.name}</div><div class="si-sub">Приложение</div></div></div>`;
    });
  }
  box.innerHTML = html;
  $$(".sf-item[data-app]", box).forEach(el => el.onclick = () => { openApp(el.dataset.app); });
  $$(".sf-item[data-fname]", box).forEach(el => {
    el.onclick = () => {
      const path = JSON.parse(el.dataset.fpath);
      const name = el.dataset.fname;
      const dir = FS.walk(path);
      const f = dir && dir.children.find(c => c.name === name);
      if (!f) return;
      if (f.type === "img") openApp("photos", { focusName: name });
      else if (f.type === "audio") openApp("media", { track: name });
      else openApp("notepad", { path, name });
    };
  });
  const web = $("#sf-web");
  if (web) web.onclick = () => { openApp("edge", { search: q }); };
}

$("#sf-input").addEventListener("input", e => renderSearchResults(e.target.value));
$("#sf-input").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    if (q) { openApp("edge", { search: q }); }
  }
});

/* ================================================================
   БЫСТРЫЕ НАСТРОЙКИ
   ================================================================ */
const QS_TILES = [
  { id: "wifi", ico: "📶", label: "Wi-Fi", sub: "Fluent-Home" },
  { id: "bt", ico: "🔵", label: "Bluetooth" },
  { id: "air", ico: "✈️", label: "Режим «в самолёте»" },
  { id: "save", ico: "🔋", label: "Экономия заряда" },
  { id: "night", ico: "🌙", label: "Ночной свет" },
  { id: "a11y", ico: "♿", label: "Спец. возможности" }
];
const qsState = store.get("qs", { wifi: true, bt: false, air: false, save: false, night: false, a11y: false });

function renderQuickSettings() {
  const grid = $("#qs-grid");
  grid.innerHTML = "";
  QS_TILES.forEach(t => {
    const d = document.createElement("div");
    d.className = "qs-tile" + (qsState[t.id] ? " on" : "");
    d.innerHTML = `<span class="qt-ico">${t.ico}</span><span>${t.label}</span>`;
    d.onclick = () => {
      qsState[t.id] = !qsState[t.id];
      store.set("qs", qsState);
      renderQuickSettings();
      if (t.id === "night") { settings.nightlight = qsState.night; applySettings(); }
      if (t.id === "air" && qsState.air) { qsState.wifi = false; qsState.bt = false; store.set("qs", qsState); renderQuickSettings(); }
      if (t.id === "wifi" && qsState.wifi) { qsState.air = false; store.set("qs", qsState); renderQuickSettings(); }
    };
    grid.appendChild(d);
  });
  const b = $("#qs-brightness"), v = $("#qs-volume");
  b.value = settings.brightness; v.value = settings.volume;
  b.style.setProperty("--val", settings.brightness + "%");
  v.style.setProperty("--val", settings.volume + "%");
  $("#qs-vol-ico").textContent = settings.volume == 0 ? "🔇" : settings.volume < 40 ? "🔈" : settings.volume < 75 ? "🔉" : "🔊";
}

$("#qs-brightness").addEventListener("input", e => {
  settings.brightness = +e.target.value;
  e.target.style.setProperty("--val", settings.brightness + "%");
  applySettings();
});
$("#qs-volume").addEventListener("input", e => {
  settings.volume = +e.target.value;
  e.target.style.setProperty("--val", settings.volume + "%");
  $("#qs-vol-ico").textContent = settings.volume == 0 ? "🔇" : settings.volume < 40 ? "🔈" : settings.volume < 75 ? "🔉" : "🔊";
  store.set("settings", settings);
});
$("#qs-open-settings").onclick = () => { closeAllFlyouts(); openApp("settings"); };

/* ================================================================
   КАЛЕНДАРЬ + УВЕДОМЛЕНИЯ
   ================================================================ */
let notifs = store.get("notifs", []);
let calMonth = null;

function notify(title, body, ico) {
  notifs.unshift({ title, body, ico: ico || "💬", time: fmtTime(new Date()) });
  notifs = notifs.slice(0, 30);
  store.set("notifs", notifs);
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="t-ico">${ico || "💬"}</span><div><div class="t-title">${title}</div><div class="t-body">${body}</div></div>`;
  $("#toast-container").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 4200);
  updateNotifBadge();
}

function updateNotifBadge() {
  const badge = document.createElement("span");
  badge.className = "notif-badge" + (notifs.length ? " show" : "");
  badge.textContent = notifs.length;
  const tn = $("#tray-notify");
  const old = $(".notif-badge", tn);
  if (old) old.remove();
  tn.appendChild(badge);
}

function renderCalendar() {
  const now = new Date();
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const notifBox = $("#cal-notifs");
  notifBox.innerHTML = notifs.length
    ? notifs.slice(0, 6).map(n => `<div class="cal-notif"><span class="cn-ico">${n.ico}</span><div><div class="cn-title">${n.title}</div><div class="cn-body">${n.body}</div><div class="cn-time">${n.time}</div></div></div>`).join("")
    : '<div class="cal-empty">Нет новых уведомлений</div>';
  $("#cal-header").innerHTML = `
    <div class="cal-title">${MONTHS_NOM[calMonth.getMonth()]} ${calMonth.getFullYear()}</div>
    <div class="cal-nav">
      <button id="cal-prev">▲</button>
      <button id="cal-next">▼</button>
    </div>`;
  $("#cal-prev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); };
  $("#cal-next").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); };
  const grid = $("#cal-grid");
  let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  let startIdx = (first.getDay() + 6) % 7;
  const prevDays = new Date(calMonth.getFullYear(), calMonth.getMonth(), 0).getDate();
  for (let i = startIdx - 1; i >= 0; i--) html += `<div class="cal-day dim">${prevDays - i}</div>`;
  const days = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const isToday = d === now.getDate() && calMonth.getMonth() === now.getMonth() && calMonth.getFullYear() === now.getFullYear();
    html += `<div class="cal-day${isToday ? " today" : ""}">${d}</div>`;
  }
  const total = (startIdx + days) % 7;
  for (let d = 1; total && d <= 7 - total; d++) html += `<div class="cal-day dim">${d}</div>`;
  grid.innerHTML = html;
}

/* ================================================================
   МИНИ-ПРИЛОЖЕНИЯ
   ================================================================ */
$("#widget-notes").value = store.get("widgetNotes", "");
$("#widget-notes").addEventListener("input", e => store.set("widgetNotes", e.target.value));

/* ================================================================
   ПРЕДСТАВЛЕНИЕ ЗАДАЧ
   ================================================================ */
function toggleTaskView() {
  const tv = $("#task-view");
  const willOpen = !tv.classList.contains("open");
  closeAllFlyouts();
  tv.classList.toggle("open", willOpen);
  if (willOpen) renderTaskView();
}

function renderTaskView() {
  const tv = $("#task-view");
  tv.innerHTML = "";
  if (!WINS.length) { tv.innerHTML = '<div class="tv-empty">Нет открытых окон</div>'; return; }
  [...WINS].sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex).forEach(w => {
    const card = document.createElement("div");
    card.className = "tv-card";
    card.innerHTML = `<div class="tv-thumb">${w.app.icon}</div><div class="tv-label">${w.app.icon} ${w.app.name}</div><button class="tv-close">✕</button>`;
    card.onclick = e => {
      if (e.target.closest(".tv-close")) { closeWin(w); renderTaskView(); return; }
      restoreWin(w); focusWin(w); $("#task-view").classList.remove("open");
    };
    tv.appendChild(card);
  });
}

/* ================================================================
   КОНТЕКСТНЫЕ МЕНЮ
   ================================================================ */
const ctxMenu = $("#ctx-menu");

function showMenu(x, y, items) {
  ctxMenu.innerHTML = "";
  items.forEach(it => {
    if (it.sep) { const s = document.createElement("div"); s.className = "ctx-sep"; ctxMenu.appendChild(s); return; }
    const d = document.createElement("div");
    d.className = "ctx-item";
    d.innerHTML = `<span class="ci-ico">${it.ico}</span><span>${it.label}</span>${it.hint ? `<span class="ci-hint">${it.hint}</span>` : ""}`;
    d.onclick = () => { hideMenu(); if (it.action) it.action(); };
    ctxMenu.appendChild(d);
  });
  ctxMenu.style.display = "block";
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(x, innerWidth - mw - 6) + "px";
  ctxMenu.style.top = Math.min(y, innerHeight - mh - 6) + "px";
}

function hideMenu() { ctxMenu.style.display = "none"; }
document.addEventListener("pointerdown", e => { if (!e.target.closest("#ctx-menu")) hideMenu(); }, true);

desktop.addEventListener("contextmenu", e => {
  if (e.target.closest(".window") || e.target.closest("#desktop-icons .desk-icon")) return;
  e.preventDefault();
  showMenu(e.clientX, e.clientY, [
    { ico: "🔄", label: "Обновить", action: renderDesktopIcons },
    { sep: true },
    { ico: "📂", label: "Создать папку", action: () => {
        const p = ["Локальный диск (C:)", "Пользователь", "Рабочий стол"];
        const name = FS.mkdir(p, "Новая папка");
        notify("Проводник", "Создана папка «" + name + "» на рабочем столе", "📁");
        renderDesktopIcons();
      } },
    { ico: "📄", label: "Создать текстовый документ", action: () => {
        const p = ["Локальный диск (C:)", "Пользователь", "Рабочий стол"];
        const name = FS.mkfile(p, "Новый документ.txt", "");
        notify("Проводник", "Создан файл «" + name + "»", "📄");
        renderDesktopIcons();
      } },
    { sep: true },
    { ico: "＋", label: "Ярлыки приложений…", action: () => pinMenu(e.clientX, e.clientY, "desk") },
    { ico: "＋", label: "Приложения на панели задач…", action: () => pinMenu(e.clientX, e.clientY, "task") },
    { sep: true },
    { ico: "🖥️", label: "Параметры экрана", action: () => openApp("settings", { section: "system" }) },
    { ico: "🎨", label: "Персонализация", action: () => openApp("settings", { section: "personal" }) },
    { ico: "⌨️", label: "Открыть в терминале", action: () => openApp("terminal") }
  ]);
});

/* ================================================================
   РАБОЧИЙ СТОЛ
   ================================================================ */
function renderDesktopIcons() {
  const box = $("#desktop-icons");
  box.innerHTML = "";
  const desk = FS.walk(["Локальный диск (C:)", "Пользователь", "Рабочий стол"]);
  if (!desk) return;
  desk.children.forEach(node => {
    const d = document.createElement("div");
    d.className = "desk-icon";
    const ico = node.type === "app" ? (APPS[node.app] || {}).icon : node.type === "dir" ? "📂" : node.type === "img" ? "🖼️" : "📄";
    d.innerHTML = `<span class="di-ico">${ico}</span><span class="di-label">${node.name}</span>`;
    d.onclick = e => { $$(".desk-icon").forEach(x => x.classList.remove("selected")); d.classList.add("selected"); };
    d.ondblclick = () => openDesktopNode(node);
    d.oncontextmenu = e => {
      e.preventDefault(); e.stopPropagation();
      showMenu(e.clientX, e.clientY, [
        { ico: "📂", label: "Открыть", action: () => openDesktopNode(node) },
        { ico: "✏️", label: "Переименовать", action: () => {
            const nn = prompt("Новое имя:", node.name);
            if (nn) { FS.rename(["Локальный диск (C:)", "Пользователь", "Рабочий стол"], node.name, nn); renderDesktopIcons(); }
          } },
        { sep: true },
        { ico: "🗑️", label: node.type === "app" ? "Убрать с рабочего стола" : "Удалить", action: () => {
            const bin = FS.walk(["Локальный диск (C:)", "Пользователь", "Рабочий стол", "Корзина"]);
            if (bin) bin.children.push(node);
            FS.remove(["Локальный диск (C:)", "Пользователь", "Рабочий стол"], node.name);
            notify("Корзина", "«" + node.name + "» перемещён в корзину", "🗑️");
            renderDesktopIcons();
          } }
      ]);
    };
    box.appendChild(d);
  });
}

function openDesktopNode(node) {
  if (node.type === "app") openApp(node.app);
  else if (node.type === "dir") openApp("explorer", { path: ["Локальный диск (C:)", "Пользователь", "Рабочий стол", node.name] });
  else if (node.type === "img") openApp("photos", { focusName: node.name });
  else openApp("notepad", { path: ["Локальный диск (C:)", "Пользователь", "Рабочий стол"], name: node.name });
}

$("#taskbar").addEventListener("contextmenu", e => {
  if (e.target.closest(".tb-app") || e.target.closest(".tray-clock")) return;
  e.preventDefault();
  showMenu(e.clientX, e.clientY, [
    { ico: "＋", label: "Приложения на панели задач…", action: () => pinMenu(e.clientX, e.clientY, "task") },
    { ico: "⚙️", label: "Параметры панели задач", action: () => openApp("settings", { section: "personal" }) }
  ]);
});

$("#tb-showdesk").onclick = () => {
  const anyVisible = WINS.some(w => !w.minimized);
  WINS.forEach(w => anyVisible ? minimizeWin(w) : restoreWin(w));
};

desktop.addEventListener("click", e => {
  if (e.target === desktop || e.target === wallpaper) $$(".desk-icon").forEach(x => x.classList.remove("selected"));
});

/* ================================================================
   ПРИЛОЖЕНИЯ
   ================================================================ */

/* ---------- ПРОВОДНИК ---------- */
const EXP_QUICK = [
  { label: "Рабочий стол", ico: "🖥️", path: ["Локальный диск (C:)", "Пользователь", "Рабочий стол"] },
  { label: "Загрузки", ico: "📥", path: ["Локальный диск (C:)", "Пользователь", "Загрузки"] },
  { label: "Документы", ico: "📄", path: ["Локальный диск (C:)", "Пользователь", "Документы"] },
  { label: "Изображения", ico: "🖼️", path: ["Локальный диск (C:)", "Пользователь", "Изображения"] },
  { label: "Музыка", ico: "🎵", path: ["Локальный диск (C:)", "Пользователь", "Музыка"] },
  { label: "Видео", ico: "🎬", path: ["Локальный диск (C:)", "Пользователь", "Видео"] }
];

function renderExplorer(body, win, args) {
  win.path = args.path || ["Локальный диск (C:)", "Пользователь"];
  body.innerHTML = `
    <div class="app-toolbar">
      <button class="tool-btn" data-act="back" title="Назад"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4 3 8l4 4"/></svg></button>
      <button class="tool-btn" data-act="fwd" title="Вперёд"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button>
      <button class="tool-btn" data-act="up" title="Вверх"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg></button>
      <button class="tool-btn" data-act="refresh" title="Обновить"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.3M13.2 2.5v3h-3"/></svg></button>
    </div>
    <div class="exp-shell">
      <div class="exp-sidebar">
        <div class="exp-sb-label">Быстрый доступ</div>
        ${EXP_QUICK.map((q, i) => `<div class="exp-sb-item" data-idx="${i}"><span>${q.ico}</span><span>${q.label}</span></div>`).join("")}
        <div class="exp-sb-label">Этот компьютер</div>
        <div class="exp-sb-item" data-c="root"><span>💻</span><span>Этот компьютер</span></div>
        <div class="exp-sb-item" data-c="disk"><span>💽</span><span>Локальный диск (C:)</span></div>
      </div>
      <div class="exp-main">
        <div class="exp-crumbs" id="exp-crumbs"></div>
        <div class="exp-grid" id="exp-grid"></div>
        <div class="exp-status" id="exp-status"></div>
      </div>
    </div>`;

  const draw = () => {
    const key = JSON.stringify(win.path);
    if (!win.hist) { win.hist = [key]; win.hidx = 0; }
    else if (win.nav) win.nav = false;
    else if (win.hist[win.hidx] !== key) { win.hist = win.hist.slice(0, win.hidx + 1); win.hist.push(key); win.hidx++; }
    const node = FS.walk(win.path);
    const crumbs = $("#exp-crumbs", body);
    crumbs.innerHTML = "";
    const mkCrumb = (label, idx) => {
      const s = document.createElement("span");
      s.className = "crumb" + (idx === win.path.length ? " current" : "");
      s.textContent = label;
      s.onclick = () => { win.path = win.path.slice(0, idx); draw(); };
      crumbs.appendChild(s);
    };
    mkCrumb("Этот компьютер", 0);
    win.path.forEach((seg, i) => {
      const sep = document.createElement("span");
      sep.className = "crumb-sep"; sep.textContent = "›";
      crumbs.appendChild(sep);
      mkCrumb(seg, i + 1);
    });

    const grid = $("#exp-grid", body);
    grid.innerHTML = "";
    const kids = node && node.children ? node.children : [];
    if (!kids.length) grid.innerHTML = '<div class="exp-empty">Эта папка пуста</div>';
    kids.forEach(k => {
      const d = document.createElement("div");
      d.className = "exp-item";
      const ico = k.type === "app" ? (APPS[k.app] || {}).icon : k.type === "dir" ? "📂" : k.type === "img" ? "🖼️" : k.type === "audio" ? "🎵" : k.name.endsWith(".exe") ? "⚙️" : "📄";
      d.innerHTML = `<span class="ei-ico">${ico}</span><span class="ei-label">${k.name}</span>`;
      d.ondblclick = () => {
        if (k.type === "dir") { win.path = [...win.path, k.name]; draw(); }
        else if (k.type === "app") openApp(k.app);
        else if (k.type === "img") openApp("photos", { focusName: k.name });
        else if (k.type === "audio") openApp("media", { track: k.name });
        else openApp("notepad", { path: win.path, name: k.name });
      };
      d.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation();
        showMenu(e.clientX, e.clientY, [
          { ico: "📂", label: "Открыть", action: () => d.ondblclick() },
          { ico: "✏️", label: "Переименовать", action: () => {
              const nn = prompt("Новое имя:", k.name);
              if (nn) { FS.rename(win.path, k.name, nn); draw(); }
            } },
          { sep: true },
          { ico: "🗑️", label: "Удалить", action: () => { FS.remove(win.path, k.name); draw(); notify("Проводник", "«" + k.name + "» удалён", "🗑️"); } }
        ]);
      };
      grid.appendChild(d);
    });
    $("#exp-status", body).textContent = "Элементов: " + kids.length;
    $('[data-act="back"]', body).disabled = win.hidx <= 0;
    $('[data-act="fwd"]', body).disabled = win.hidx >= win.hist.length - 1;
    $('[data-act="up"]', body).disabled = !win.path.length;
    $$(".exp-sb-item", body).forEach(s => {
      const q = EXP_QUICK[+s.dataset.idx];
      const isActive = (q && JSON.stringify(q.path) === JSON.stringify(win.path)) ||
        (s.dataset.c === "disk" && win.path.length === 1) ||
        (s.dataset.c === "root" && !win.path.length);
      s.classList.toggle("active", !!isActive);
    });
  };

  body.addEventListener("click", e => {
    const sb = e.target.closest(".exp-sb-item");
    if (sb) {
      if (sb.dataset.idx !== undefined) win.path = [...EXP_QUICK[+sb.dataset.idx].path];
      else if (sb.dataset.c === "root") win.path = [];
      else if (sb.dataset.c === "disk") win.path = ["Локальный диск (C:)"];
      draw();
    }
    if (e.target.closest('[data-act="back"]') && win.hidx > 0) { win.hidx--; win.path = JSON.parse(win.hist[win.hidx]); win.nav = true; draw(); }
    if (e.target.closest('[data-act="fwd"]') && win.hidx < win.hist.length - 1) { win.hidx++; win.path = JSON.parse(win.hist[win.hidx]); win.nav = true; draw(); }
    if (e.target.closest('[data-act="up"]') && win.path.length) { win.path = win.path.slice(0, -1); draw(); }
    if (e.target.closest('[data-act="refresh"]')) draw();
  });
  body.addEventListener("contextmenu", e => {
    if (e.target.closest(".exp-item")) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { ico: "🔄", label: "Обновить", action: draw },
      { sep: true },
      { ico: "📂", label: "Создать папку", action: () => { FS.mkdir(win.path, "Новая папка"); draw(); } },
      { ico: "📄", label: "Создать текстовый документ", action: () => { FS.mkfile(win.path, "Новый документ.txt", ""); draw(); } }
    ]);
  });
  if (args.name) win.argsName = args.name;
  draw();
}

/* ---------- БЛОКНОТ ---------- */
function renderNotepad(body, win, args) {
  let filePath = args.path ? [...args.path] : null;
  let fileName = args.name || null;
  body.innerHTML = `
    <div class="app-toolbar">
      <button class="tool-btn" data-act="new">📄 Создать</button>
      <button class="tool-btn" data-act="save">💾 Сохранить</button>
      <div class="tool-sep"></div>
      <span style="font-size:12px;color:var(--text-3)" id="np-file"></span>
    </div>
    <textarea class="notepad-area" spellcheck="false" placeholder="Начните вводить текст…"></textarea>
    <div class="notepad-status" id="np-status">Строк: 1 &nbsp;|&nbsp; Символов: 0</div>`;

  const ta = $(".notepad-area", body);
  const updateStatus = () => {
    const v = ta.value;
    $("#np-status", body).innerHTML = "Строк: " + (v.split("\n").length) + " &nbsp;|&nbsp; Символов: " + v.length;
  };
  const setTitle = () => {
    $(".win-title", win.el).textContent = (fileName || "Безымянный") + " — Блокнот";
    $("#np-file", body).textContent = filePath ? filePath.join(" \\ ") + " \\ " + fileName : "Файл не сохранён";
  };
  if (fileName && filePath) {
    const f = FS.walk(filePath);
    const node = f && f.children.find(c => c.name === fileName);
    if (node) ta.value = node.content || "";
  }
  ta.addEventListener("input", updateStatus);
  updateStatus(); setTitle();

  body.querySelector('[data-act="save"]').onclick = () => {
    if (!filePath || !fileName) {
      const docs = ["Локальный диск (C:)", "Пользователь", "Документы"];
      fileName = prompt("Имя файла:", "Новый документ.txt") || "Новый документ.txt";
      if (!fileName.endsWith(".txt")) fileName += ".txt";
      filePath = docs;
      FS.mkfile(docs, fileName, ta.value);
      notify("Блокнот", "Файл сохранён в Документы: " + fileName, "💾");
    } else {
      const dir = FS.walk(filePath);
      const node = dir && dir.children.find(c => c.name === fileName);
      if (node) { node.content = ta.value; FS.save(); notify("Блокнот", "Изменения сохранены: " + fileName, "💾"); }
    }
    setTitle();
  };
  body.querySelector('[data-act="new"]').onclick = () => { ta.value = ""; filePath = null; fileName = null; updateStatus(); setTitle(); };
  ta.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); body.querySelector('[data-act="save"]').click(); }
  });
}

/* ---------- КАЛЬКУЛЯТОР ---------- */
function renderCalc(body, win) {
  body.innerHTML = `
    <div class="calc-wrap">
      <div class="calc-display" id="calc-expr"></div>
      <div class="calc-result" id="calc-res">0</div>
      <div class="calc-grid">
        ${["%","CE","C","⌫","1/x","x²","√x","÷","7","8","9","×","4","5","6","−","1","2","3","+","+/−","0",",","="].map(b =>
          `<button class="calc-btn ${'÷×−+='.includes(b) ? (b === '=' ? 'eq' : 'op') : (['%','CE','C','⌫','1/x','x²','√x','+/−',','].includes(b) ? 'op' : '')}" data-b="${b}">${b}</button>`).join("")}
      </div>
    </div>`;
  let cur = "0", expr = "", prev = null, op = null, fresh = true;

  const res = () => $("#calc-res", body);
  const exprEl = () => $("#calc-expr", body);
  const num = () => parseFloat(cur.replace(",", ".")) || 0;

  function applyOp() {
    if (op && prev !== null) {
      const b = num();
      let r = 0;
      if (op === "+") r = prev + b;
      if (op === "−") r = prev - b;
      if (op === "×") r = prev * b;
      if (op === "÷") r = b === 0 ? NaN : prev / b;
      cur = (isFinite(r) ? String(+r.toFixed(10)) : "Ошибка").replace(".", ",");
      prev = null; op = null;
    }
  }

  function press(b) {
    if (/^[0-9]$/.test(b)) { cur = fresh || cur === "0" ? b : cur + b; fresh = false; }
    else if (b === ",") { if (!cur.includes(",")) { cur += ","; fresh = false; } }
    else if (b === "C") { cur = "0"; expr = ""; prev = null; op = null; fresh = true; }
    else if (b === "CE") { cur = "0"; fresh = true; }
    else if (b === "⌫") { cur = cur.length > 1 ? cur.slice(0, -1) : "0"; }
    else if (b === "+/−") { cur = cur.startsWith("−") ? cur.slice(1) : "−" + cur; }
    else if (b === "x²") { cur = String(+(num() * num()).toFixed(10)).replace(".", ","); fresh = true; }
    else if (b === "√x") { cur = String(+Math.sqrt(Math.abs(num())).toFixed(10)).replace(".", ","); fresh = true; }
    else if (b === "1/x") { cur = num() === 0 ? "Ошибка" : String(+(1 / num()).toFixed(10)).replace(".", ","); fresh = true; }
    else if (b === "%") { cur = String(+(num() / 100).toFixed(10)).replace(".", ","); fresh = true; }
    else if ("÷×−+".includes(b)) {
      if (op && !fresh) applyOp();
      prev = num(); op = b; fresh = true;
      expr = String(prev).replace(".", ",") + " " + b;
    }
    else if (b === "=") { expr = ""; applyOp(); fresh = true; }
    res().textContent = cur;
    exprEl().textContent = expr;
  }
  $$(".calc-btn", body).forEach(b => b.onclick = () => press(b.dataset.b));
  win.el.addEventListener("keydown", e => {
    const k = e.key;
    if (/^[0-9]$/.test(k)) press(k);
    else if (k === ".") press(",");
    else if (["+", "-", "*", "/"].includes(k)) press({"+":"+","−":"−","*":"×","/":"÷"}[k] || k);
    else if (k === "Enter" || k === "=") press("=");
    else if (k === "Backspace") press("⌫");
    else if (k === "Escape") press("C");
  });
  win.el.tabIndex = -1;
  setTimeout(() => win.el.focus(), 50);
}

/* ---------- ТЕРМИНАЛ ---------- */
function renderTerminal(body, win) {
  body.innerHTML = `<div class="term-wrap" id="term"><div id="term-out"></div>
    <div class="term-input-line"><span class="term-prompt" id="term-prompt"></span><input class="term-input" id="term-in" autocomplete="off" spellcheck="false"></div></div>`;
  let cwd = ["Локальный диск (C:)", "Пользователь"];

  const out = $("#term-out", body);
  const inp = $("#term-in", body);
  const wrap = $("#term", body);

  const promptText = () => "C:\\" + cwd.slice(1).join("\\") + ">";
  const setPrompt = () => $("#term-prompt", body).textContent = promptText();
  const print = (html) => {
    const d = document.createElement("div");
    d.className = "term-line";
    d.innerHTML = html;
    out.appendChild(d);
    wrap.scrollTop = wrap.scrollHeight;
  };

  function run(cmdline) {
    const parts = cmdline.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts.slice(1).join(" ");
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    switch (cmd) {
      case "": break;
      case "help":
        print(`Доступные команды:
  <span class="tp">help</span>     — список команд
  <span class="tp">dir</span>      — содержимое папки
  <span class="tp">cd</span> &lt;папка&gt; — перейти в папку (.. — наверх)
  <span class="tp">type</span> &lt;файл&gt; — показать файл
  <span class="tp">echo</span> &lt;текст&gt; — вывести текст
  <span class="tp">start</span> &lt;прил&gt; — запустить приложение (edge, notepad, paint, calc…)
  <span class="tp">date</span> / <span class="tp">time</span> — дата и время
  <span class="tp">whoami</span>   — текущий пользователь
  <span class="tp">neofetch</span> — информация о системе
  <span class="tp">cls</span>      — очистить экран
  <span class="tp">shutdown</span> — выключить компьютер
  <span class="tp">exit</span>     — закрыть терминал`);
        break;
      case "dir": case "ls": {
        const d = FS.walk(cwd);
        if (!d || !d.children) { print("Папка не найдена."); break; }
        print('Содержимое папки <span class="tpath">' + esc(promptText()) + "</span>\n");
        d.children.forEach(c => {
          const isDir = c.type === "dir";
          print("  " + (isDir ? "&lt;DIR&gt;        " : "         файл ") + esc(c.name));
        });
        print("\n  Файлов и папок: " + d.children.length);
        break;
      }
      case "cd": {
        if (!arg || arg === ".") break;
        if (arg === "..") { if (cwd.length > 1) cwd.pop(); setPrompt(); break; }
        const target = FS.walk([...cwd, arg]);
        if (target && target.type === "dir") { cwd.push(arg); setPrompt(); }
        else print("Не удалось найти указанный путь: " + esc(arg));
        break;
      }
      case "type": case "cat": {
        const d = FS.walk(cwd);
        const f = d && d.children.find(c => c.name.toLowerCase() === arg.toLowerCase());
        if (f && f.type === "file") print(esc(f.content || "(пусто)"));
        else print("Файл не найден: " + esc(arg));
        break;
      }
      case "echo": print(esc(arg)); break;
      case "cls": case "clear": out.innerHTML = ""; break;
      case "date": print(esc(fmtDateLong(new Date()))); break;
      case "time": print("Текущее время: " + esc(fmtTime(new Date()))); break;
      case "whoami": print("fluentsystem\\" + esc(userName.toLowerCase())); break;
      case "ver": print("Windows 11 Web Edition [Version 10.0.22631.fluent]"); break;
      case "neofetch":
        print(`<span class="tp">        ▄▄▄▄▄  ▄▄▄▄▄</span>     fluentsystem@windows
<span class="tp">        █████  █████</span>     ─────────────────────
<span class="tp">        █████  █████</span>     ОС: Windows 11 Web Edition
<span class="tp">        ▀▀▀▀▀  ▀▀▀▀▀</span>     Ядро: Fluent Design System
<span class="tp">        ▄▄▄▄▄  ▄▄▄▄▄</span>     Оболочка: web-shell 1.0
<span class="tp">        █████  █████</span>     Разрешение: ${innerWidth}x${innerHeight}
<span class="tp">        █████  █████</span>     Тема: ${settings.theme === "dark" ? "Тёмная" : "Светлая"}
<span class="tp">        ▀▀▀▀▀  ▀▀▀▀▀</span>     ЦП: FluentCore i9 @ 4.8 ГГц
                             ГП: RTX Fluent 4090`);
        break;
      case "start": {
        const id = arg.toLowerCase().replace(".exe", "");
        if (APPS[id]) { print("Запуск: " + APPS[id].name + "…"); openApp(id); }
        else print("Приложение не найдено. Доступно: " + Object.keys(APPS).join(", "));
        break;
      }
      case "shutdown": print("Завершение работы…"); setTimeout(() => shutdown(false), 800); break;
      case "exit": closeWin(win); break;
      default: print('«' + esc(cmd) + "» не является внутренней или внешней командой. Введите <span class='tp'>help</span>.");
    }
  }

  print(`<span class="tp">Microsoft Windows [Version 10.0.22631.fluent]</span>`);
  print("(c) Корпорация Fluent. Все права защищены.\n");
  setPrompt();
  inp.focus();
  wrap.addEventListener("click", () => inp.focus());
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const v = inp.value;
      print(`<span class="tp">${promptText()}</span> ${v.replace(/</g, "&lt;")}`);
      run(v);
      inp.value = "";
    }
  });
}

/* ---------- PAINT ---------- */
function renderPaint(body, win) {
  const colors = ["#000000","#7f7f7f","#c42b1c","#ff8c00","#ffd23f","#0b7a28","#00b7c3","#0078d4","#4a5fc1","#8a3ab8","#ff69b4","#ffffff"];
  body.innerHTML = `
    <div class="app-toolbar paint-tools">
      <span style="font-size:12px;color:var(--text-3)">Кисть:</span>
      <input type="range" id="pt-size" min="1" max="40" value="6" style="width:110px">
      <div class="tool-sep"></div>
      ${colors.map((c, i) => `<button class="paint-color${i === 0 ? " sel" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}
      <div class="tool-sep"></div>
      <button class="tool-btn" data-act="erase">🧽 Ластик</button>
      <button class="tool-btn" data-act="clear">🗑️ Очистить</button>
      <button class="tool-btn primary" data-act="save">💾 Сохранить</button>
    </div>
    <div class="paint-canvas-outer"><canvas id="pt-canvas" width="760" height="460"></canvas></div>`;

  const cv = $("#pt-canvas", body);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
  let color = "#000000", size = 6, drawing = false, erase = false;

  const pos = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  };
  cv.addEventListener("pointerdown", e => {
    drawing = true; cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
  });
  cv.addEventListener("pointermove", e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = erase ? "#ffffff" : color;
    ctx.lineWidth = erase ? size * 2.5 : size;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  });
  cv.addEventListener("pointerup", () => drawing = false);

  $$(".paint-color", body).forEach(b => b.onclick = () => {
    $$(".paint-color", body).forEach(x => x.classList.remove("sel"));
    b.classList.add("sel"); color = b.dataset.c; erase = false;
  });
  $("#pt-size", body).oninput = e => size = +e.target.value;
  body.querySelector('[data-act="erase"]').onclick = () => { erase = true; };
  body.querySelector('[data-act="clear"]').onclick = () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); };
  body.querySelector('[data-act="save"]').onclick = () => {
    const name = FS.mkimg(["Локальный диск (C:)", "Пользователь", "Изображения"], "Рисунок.png", cv.toDataURL());
    notify("Paint", "Рисунок сохранён: " + name, "🎨");
  };
}

/* ---------- ФОТОГРАФИИ ---------- */
function renderPhotos(body, win, args) {
  body.innerHTML = `
    <div class="app-toolbar"><span style="font-size:13px;font-weight:600">Коллекция</span>
      <span style="font-size:11px;color:var(--text-3);margin-left:auto" id="ph-count"></span></div>
    <div class="photos-grid" id="ph-grid"></div>
    <div class="photo-viewer" id="ph-viewer"><button class="pv-close">✕</button><img id="ph-img"></div>`;
  const grid = $("#ph-grid", body);
  const imgs = FS.walk(["Локальный диск (C:)", "Пользователь", "Изображения"]);
  const list = imgs ? imgs.children.filter(c => c.type === "img") : [];
  $("#ph-count", body).textContent = "Фото: " + list.length;
  list.forEach(f => {
    const d = document.createElement("div");
    d.className = "photo-card";
    d.style.backgroundImage = "url(" + f.data + ")";
    d.title = f.name;
    d.onclick = () => { $("#ph-img", body).src = f.data; $("#ph-viewer", body).classList.add("open"); };
    grid.appendChild(d);
  });
  $(".pv-close", body).onclick = () => $("#ph-viewer", body).classList.remove("open");
  if (args.focusName) {
    const f = list.find(x => x.name === args.focusName);
    if (f) { $("#ph-img", body).src = f.data; $("#ph-viewer", body).classList.add("open"); }
  }
}

/* ---------- МАГАЗИН ---------- */
function renderStore(body, win) {
  const items = [
    ["🌀", "Fluent Browser", "Быстрый и безопасный браузер нового поколения"],
    ["🎧", "Music Fluent", "Миллионы треков и плейлисты по вкусу"],
    ["💬", "Fluent Chat", "Общайтесь с друзьями в красивом мессенджере"],
    ["🎮", "Fluent Games", "Игровой центр с тысячами казуальных игр"],
    ["📮", "Fluent Mail", "Умная почта с жестами и правилами"],
    ["🗺️", "Fluent Maps", "Карты, навигация и пробки в реальном времени"],
    ["🎬", "Fluent Video", "Кино и сериалы в 4K HDR"],
    ["🏋️", "Fluent Fit", "Тренировки, шаги и здоровье"]
  ];
  const installed = store.get("storeInstalled", []);
  body.innerHTML = `
    <div class="store-hero"><div class="sh-title">Microsoft Store</div>
      <div class="sh-sub">Приложения, игры и развлечения — всё в одном месте</div></div>
    <div class="store-grid">${items.map((it, i) => `
      <div class="store-card"><span class="st-ico">${it[0]}</span>
        <div class="st-name">${it[1]}</div>
        <div class="st-desc">${it[2]}</div>
        <button class="st-btn${installed.includes(i) ? " installed" : ""}" data-i="${i}">${installed.includes(i) ? "Установлено ✓" : "Установить"}</button>
      </div>`).join("")}</div>`;
  $$(".st-btn", body).forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (installed.includes(i)) return;
    installed.push(i);
    store.set("storeInstalled", installed);
    b.textContent = "Загрузка…";
    setTimeout(() => {
      b.textContent = "Установлено ✓";
      b.classList.add("installed");
      notify("Microsoft Store", "Приложение «" + items[i][1] + "» установлено", "🛍️");
    }, 1400);
  });
}

/* ---------- ДИСПЕТЧЕР ЗАДАЧ ---------- */
function renderTaskMgr(body, win) {
  body.innerHTML = `
    <div class="tm-wrap">
      <div class="tm-stats">
        <div class="tm-stat"><div class="tms-label">ЦП</div><div class="tms-val" id="tm-cpu">12%</div><div class="tm-spark"><div id="tm-cpu-b" style="width:12%"></div></div></div>
        <div class="tm-stat"><div class="tms-label">Память</div><div class="tms-val" id="tm-mem">46%</div><div class="tm-spark"><div id="tm-mem-b" style="width:46%"></div></div></div>
        <div class="tm-stat"><div class="tms-label">Диск</div><div class="tms-val" id="tm-disk">3%</div><div class="tm-spark"><div id="tm-disk-b" style="width:3%"></div></div></div>
      </div>
      <div class="tm-table" id="tm-rows"></div>
    </div>`;

  const sysProcs = [
    ["⚙️", "Системные процессы", null],
    ["🖥️", "Проводник", "explorer"],
    ["🛡️", "Fluent Defender", null],
    ["🧩", "Диспетчер окон рабочего стола", null]
  ];

  let cpu = 12, mem = 46;
  const draw = () => {
    cpu = Math.max(3, Math.min(95, cpu + (Math.random() * 14 - 7)));
    mem = Math.max(30, Math.min(90, mem + (Math.random() * 4 - 2)));
    const disk = Math.max(1, Math.min(80, Math.random() * 25));
    $("#tm-cpu", body).textContent = cpu.toFixed(0) + "%";
    $("#tm-mem", body).textContent = mem.toFixed(0) + "%";
    $("#tm-disk", body).textContent = disk.toFixed(0) + "%";
    $("#tm-cpu-b", body).style.width = cpu + "%";
    $("#tm-mem-b", body).style.width = mem + "%";
    $("#tm-disk-b", body).style.width = disk + "%";
    const rows = $("#tm-rows", body);
    rows.innerHTML = "";
    const all = [
      ...WINS.map(w => ({ ico: w.app.icon, name: w.app.name, id: w.id })),
      ...sysProcs.map(p => ({ ico: p[0], name: p[1], id: null }))
    ];
    all.forEach(p => {
      const load = (p.id ? (6 + Math.random() * 16) : (0.2 + Math.random() * 2.5)).toFixed(1);
      const d = document.createElement("div");
      d.className = "tm-row";
      d.innerHTML = `<span class="tr-ico">${p.ico}</span><span class="tr-name">${p.name}</span>
        <span class="tr-val">${load}%</span><span class="tr-val">${(Math.random() * 180 + 30).toFixed(0)} МБ</span>
        ${p.id ? '<button class="tr-end">Снять задачу</button>' : '<span class="tr-val" style="color:var(--text-3)">система</span>'}`;
      const btn = $(".tr-end", d);
      if (btn) btn.onclick = () => {
        const w = WINS.find(x => x.id === p.id);
        if (w) { closeWin(w); notify("Диспетчер задач", "Процесс «" + p.name + "» завершён", "📊"); draw(); }
      };
      rows.appendChild(d);
    });
  };
  draw();
  win.tmTimer = setInterval(() => { if (!win.minimized) draw(); }, 1600);
  win.onClose = () => clearInterval(win.tmTimer);
}

/* ---------- САПЁР ---------- */
function renderMines(body, win) {
  const N = 9, MINES = 10;
  let board, opened, flags, over, started;

  function init() {
    board = Array.from({ length: N }, () => Array(N).fill(0));
    opened = Array.from({ length: N }, () => Array(N).fill(false));
    flags = Array.from({ length: N }, () => Array(N).fill(false));
    over = false; started = false;
    // мины
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
      if (board[r][c] !== -1) { board[r][c] = -1; placed++; }
    }
    // числа
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (board[r][c] === -1) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc] === -1) n++;
      }
      board[r][c] = n;
    }
    draw();
  }

  function reveal(r, c) {
    if (over || opened[r][c] || flags[r][c]) return;
    opened[r][c] = true;
    if (board[r][c] === -1) { over = true; }
    else if (board[r][c] === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && !opened[rr][cc]) reveal(rr, cc);
      }
    }
  }

  function checkWin() {
    let closed = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!opened[r][c]) closed++;
    if (closed === MINES && !over) { over = true; win.state = "win"; notify("Сапёр", "Победа! Все мины найдены 🎉", "💣"); }
  }

  function draw() {
    const winText = win.state === "win" ? "🏆 Победа!" : over && win.state !== "win" ? "💥 Проигрыш" : "🚩 " + MINES;
    body.innerHTML = `
      <div class="mine-wrap">
        <div class="mine-header"><span>${winText}</span><button class="mine-reset" id="mine-reset">🙂 Заново</button></div>
        <div class="mine-grid" style="grid-template-columns:repeat(${N}, 30px)">
          ${board.map((row, r) => row.map((_, c) => {
            const isOpen = opened[r][c];
            const mine = board[r][c] === -1;
            const boom = isOpen && mine && over && win.state !== "win";
            const cls = "mine-cell" + (isOpen ? " open" : "") + (boom ? " boom" : (isOpen && board[r][c] ? " c" + board[r][c] : ""));
            const txt = isOpen ? (mine ? "💣" : board[r][c] || "") : (flags[r][c] ? "🚩" : "");
            return `<div class="${cls}" data-r="${r}" data-c="${c}">${txt}</div>`;
          }).join("")).join("")}
        </div>
        <div style="font-size:11.5px;color:var(--text-3)">ЛКМ — открыть, ПКМ — флажок</div>
      </div>`;
    $("#mine-reset", body).onclick = () => { win.state = null; init(); };
    $$(".mine-cell", body).forEach(cell => {
      const r = +cell.dataset.r, c = +cell.dataset.c;
      cell.onclick = () => {
        if (over) return;
        reveal(r, c);
        if (over && board[r][c] === -1) win.state = "lose";
        checkWin(); draw();
        if (win.state === "lose") {
          for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) if (board[rr][cc] === -1) opened[rr][cc] = true;
          draw();
        }
      };
      cell.oncontextmenu = e => {
        e.preventDefault();
        if (over || opened[r][c]) return;
        flags[r][c] = !flags[r][c];
        draw();
      };
    });
  }
  init();
}

/* ---------- КАМЕРА ---------- */
function renderCamera(body, win) {
  body.innerHTML = `
    <div class="camera-wrap">
      <div class="camera-off" id="cam-off"><span style="font-size:42px">📷</span><span>Нажмите, чтобы включить камеру</span></div>
      <video id="cam-video" autoplay playsinline style="display:none"></video>
      <div class="camera-bar"><button class="cam-btn" id="cam-snap" title="Сделать снимок">📷</button></div>
    </div>`;
  const off = $("#cam-off", body);
  const video = $("#cam-video", body);
  off.onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      win.cameraStream = stream;
      video.srcObject = stream;
      video.style.display = "block";
      off.style.display = "none";
    } catch (e) {
      off.innerHTML = '<span style="font-size:42px">🚫</span><span>Нет доступа к камере. Разрешите доступ в браузере.</span>';
    }
  };
  $("#cam-snap", body).onclick = () => {
    if (!video.videoWidth) { notify("Камера", "Сначала включите камеру", "📷"); return; }
    const cv = document.createElement("canvas");
    cv.width = video.videoWidth; cv.height = video.videoHeight;
    cv.getContext("2d").drawImage(video, 0, 0);
    const name = FS.mkimg(["Локальный диск (C:)", "Пользователь", "Изображения"], "Снимок.png", cv.toDataURL());
    notify("Камера", "Снимок сохранён: " + name, "📷");
  };
}

/* ---------- ЧАСЫ ---------- */
function renderClockApp(body, win) {
  body.innerHTML = `<div class="clock-wrap">
    <div class="clock-face" id="clk-time"></div>
    <div class="clock-date" id="clk-date"></div>
    <div class="clock-zone">Часовой пояс: (UTC+03:00) Москва</div>
  </div>`;
  const tick = () => {
    const d = new Date();
    $("#clk-time", body).textContent = fmtTime(d) + ":" + pad(d.getSeconds());
    $("#clk-date", body).textContent = fmtDateLong(d);
  };
  tick();
  win.clkTimer = setInterval(tick, 1000);
  win.onClose = () => clearInterval(win.clkTimer);
}

/* ---------- МЕДИАПЛЕЕР ---------- */
function renderMedia(body, win, args) {
  const tracks = [
    { name: "Chill Synth", artist: "Fluent Waves", notes: [220, 277, 330, 277, 220, 277, 330, 440] },
    { name: "Night Drive", artist: "Neon City", notes: [196, 247, 294, 247, 196, 165, 196, 247] },
    { name: "Rainy Café", artist: "Lo-Fi Fluent", notes: [262, 330, 392, 330, 262, 330, 392, 523] }
  ];
  let idx = args.track ? Math.max(0, tracks.findIndex(t => args.track.toLowerCase().includes(t.name.toLowerCase().slice(0, 5)))) : 0;
  if (idx < 0) idx = 0;
  let playing = false, noteStep = 0, timer = null, audioCtx = null, gain = null, osc = null, pos = 0, posTimer = null;

  body.innerHTML = `
    <div class="media-wrap" id="mw">
      <div class="media-art" id="m-art">${tracks[idx].name.includes("Night") ? "🌃" : tracks[idx].name.includes("Rainy") ? "☕" : "🎹"}</div>
      <div><div class="media-title" id="m-title"></div><div class="media-artist" id="m-artist"></div></div>
      <div class="media-vis"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
      <div class="media-bar"><span id="m-cur">0:00</span><input type="range" id="m-prog" min="0" max="180" value="0"><span id="m-total">3:00</span></div>
      <div class="media-controls">
        <button class="mc-btn" data-m="prev">⏮</button>
        <button class="mc-btn play" data-m="play" id="m-play">▶</button>
        <button class="mc-btn" data-m="next">⏭</button>
      </div>
      <div style="font-size:11.5px;color:var(--text-3)">Громкость: <span id="m-vol-lbl">${settings.volume}%</span></div>
    </div>`;

  const show = () => {
    const t = tracks[idx];
    $("#m-title", body).textContent = t.name;
    $("#m-artist", body).textContent = t.artist;
    $("#m-art", body).textContent = t.name.includes("Night") ? "🌃" : t.name.includes("Rainy") ? "☕" : "🎹";
    win.el.querySelector(".win-title").textContent = t.name + " — Медиаплеер";
  };
  show();

  function startAudio() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gain = audioCtx.createGain();
      gain.gain.value = settings.volume / 300;
      gain.connect(audioCtx.destination);
      playNote();
    } catch (e) {}
  }
  function playNote() {
    if (!audioCtx) return;
    if (osc) { try { osc.stop(); } catch (e) {} }
    const notes = tracks[idx].notes;
    osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = notes[noteStep % notes.length];
    osc.connect(gain);
    osc.start();
    gain.gain.setValueAtTime(settings.volume / 300, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.55);
    osc.stop(audioCtx.currentTime + 0.6);
    noteStep++;
  }

  function play() {
    playing = true;
    $("#m-play", body).textContent = "⏸";
    $("#mw", body).classList.add("media-playing");
    startAudio();
    timer = setInterval(playNote, 600);
    posTimer = setInterval(() => {
      pos++;
      if (pos >= 180) { nextTrack(); return; }
      $("#m-prog", body).value = pos;
      $("#m-cur", body).textContent = Math.floor(pos / 60) + ":" + pad(pos % 60);
    }, 1000);
  }
  function pause() {
    playing = false;
    $("#m-play", body).textContent = "▶";
    $("#mw", body).classList.remove("media-playing");
    clearInterval(timer); clearInterval(posTimer);
    if (osc) { try { osc.stop(); } catch (e) {} osc = null; }
  }
  function nextTrack() { idx = (idx + 1) % tracks.length; pos = 0; noteStep = 0; show(); }
  function prevTrack() { idx = (idx - 1 + tracks.length) % tracks.length; pos = 0; noteStep = 0; show(); }

  $$(".mc-btn", body).forEach(b => b.onclick = () => {
    const m = b.dataset.m;
    if (m === "play") playing ? pause() : play();
    if (m === "next") { const was = playing; pause(); nextTrack(); if (was) play(); }
    if (m === "prev") { const was = playing; pause(); prevTrack(); if (was) play(); }
  });
  $("#m-prog", body).oninput = e => {
    pos = +e.target.value;
    $("#m-cur", body).textContent = Math.floor(pos / 60) + ":" + pad(pos % 60);
  };
  win.onClose = () => { pause(); if (audioCtx) try { audioCtx.close(); } catch (e) {} };
}

/* ---------- ПАРАМЕТРЫ ---------- */
const ACCENTS = ["#4cc2ff","#0078d4","#8a3ab8","#e3008c","#c42b1c","#ff8c00","#0b7a28","#00b7c3","#6b6b7b"];
let currentSection = "system";

function renderSettings(body, win, args) {
  currentSection = (args && args.section) || "system";
  const NAV = [
    ["system", "🖥️", "Система"],
    ["devices", "📱", "Bluetooth и устройства"],
    ["network", "📶", "Сеть и Интернет"],
    ["personal", "🎨", "Персонализация"],
    ["apps", "🧩", "Приложения"],
    ["accounts", "👤", "Учётные записи"],
    ["time", "🕐", "Время и язык"],
    ["privacy", "🔒", "Конфиденциальность"],
    ["update", "🔄", "Центр обновления"]
  ];
  body.innerHTML = `
    <div class="set-shell">
      <div class="set-sidebar">
        <div class="set-user"><div class="su-ava">👤</div><div><div class="su-name">${userName}</div><div class="su-mail">user@fluent.local</div></div></div>
        ${NAV.map(n => `<div class="set-nav-item" data-sec="${n[0]}"><span class="sn-ico">${n[1]}</span><span>${n[2]}</span></div>`).join("")}
      </div>
      <div class="set-main" id="set-main"></div>
    </div>`;
  $$(".set-nav-item", body).forEach(n => n.onclick = () => { currentSection = n.dataset.sec; drawSection(); });
  const main = $("#set-main", body);

  function toggleRow(ico, title, desc, on, cb) {
    const d = document.createElement("div");
    d.className = "set-card";
    d.innerHTML = `<span class="sc-ico">${ico}</span><div class="sc-body"><div class="sc-title">${title}</div><div class="sc-desc">${desc}</div></div><div class="set-toggle${on ? " on" : ""}"></div>`;
    $(".set-toggle", d).onclick = () => cb($(".set-toggle", d));
    return d;
  }

  function drawSection() {
    $$(".set-nav-item", body).forEach(n => n.classList.toggle("active", n.dataset.sec === currentSection));
    main.innerHTML = "";
    const add = el => main.appendChild(el);

    if (currentSection === "system") {
      main.innerHTML = '<div class="set-title">Система</div><div class="set-subtitle">Об устройстве</div>';
      const specs = document.createElement("div");
      specs.className = "set-card";
      specs.innerHTML = `<span class="sc-ico">💻</span><div class="sc-body about-specs">
        <div><b>Имя устройства</b> FLUENT-PC</div>
        <div><b>Процессор</b> FluentCore i9-14900K @ 4.8 ГГц</div>
        <div><b>Оперативная память</b> 32,0 ГБ</div>
        <div><b>Тип системы</b> 64-разрядная, Web Edition</div>
        <div><b>Выпуск</b> Windows 11 Web — Fluent Design Build 22631</div></div>`;
      add(specs);
      const disp = document.createElement("div");
      disp.innerHTML = '<div class="set-subtitle">Дисплей</div>';
      add(disp);
      const br = document.createElement("div");
      br.className = "set-card";
      br.innerHTML = `<span class="sc-ico">☀️</span><div class="sc-body"><div class="sc-title">Яркость</div><div class="sc-desc">Настройка яркости встроенного дисплея</div></div>`;
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 20; slider.max = 100;
      slider.value = settings.brightness;
      slider.style.cssText = "width:160px";
      slider.oninput = () => { settings.brightness = +slider.value; applySettings(); renderQuickSettings(); };
      br.appendChild(slider);
      add(br);
      add(toggleRow("📱", "Разрешение экрана", "1920 × 1080 (рекомендуется)", true, () => notify("Параметры", "Разрешение управляется окном браузера", "🖥️")));
    }

    if (currentSection === "personal") {
      main.innerHTML = '<div class="set-title">Персонализация</div><div class="set-subtitle">Фон рабочего стола</div>';
      const gal = document.createElement("div");
      gal.className = "wp-gallery";
      const names = ["Windows 11 (тёмная)", "Закат", "Океан", "Пустыня", "Космос", "Fluent синий"];
      for (let i = 0; i < 6; i++) {
        const t = document.createElement("div");
        t.className = "wp-thumb wp" + i + (settings.wallpaper === "wp" + i ? " sel" : "");
        t.innerHTML = "<span>" + names[i] + "</span>";
        t.onclick = () => { settings.wallpaper = "wp" + i; applySettings(); drawSection(); };
        gal.appendChild(t);
      }
      add(gal);
      const sub2 = document.createElement("div");
      sub2.innerHTML = '<div class="set-subtitle">Цветовой режим</div>';
      add(sub2);
      const themeRow = document.createElement("div");
      themeRow.className = "theme-radio-row";
      ["dark", "light"].forEach(mode => {
        const o = document.createElement("div");
        o.className = "theme-opt" + (settings.theme === mode ? " sel" : "");
        o.innerHTML = `<div class="theme-preview tp-${mode}"></div><div class="to-name">${mode === "dark" ? "Тёмный" : "Светлый"}</div>`;
        o.onclick = () => { settings.theme = mode; applySettings(); drawSection(); };
        themeRow.appendChild(o);
      });
      add(themeRow);
      const sub3 = document.createElement("div");
      sub3.innerHTML = '<div class="set-subtitle">Цвет выделения</div>';
      add(sub3);
      const acc = document.createElement("div");
      acc.className = "accent-row";
      ACCENTS.forEach(c => {
        const s = document.createElement("div");
        s.className = "acc-swatch" + (settings.accent === c ? " sel" : "");
        s.style.background = c;
        s.onclick = () => { settings.accent = c; applySettings(); drawSection(); };
        acc.appendChild(s);
      });
      add(acc);
    }

    if (currentSection === "network") {
      main.innerHTML = '<div class="set-title">Сеть и Интернет</div>';
      add(toggleRow("📶", "Wi-Fi", qsState.wifi ? "Подключено — Fluent-Home" : "Отключено", qsState.wifi, t => {
        qsState.wifi = !qsState.wifi; store.set("qs", qsState); renderQuickSettings(); drawSection();
      }));
      const st = document.createElement("div");
      st.className = "set-card";
      st.innerHTML = `<span class="sc-ico">🌐</span><div class="sc-body"><div class="sc-title">Свойства сети</div><div class="sc-desc">IPv4: 192.168.1.42 · Маршрутизатор: 192.168.1.1 · DNS: 1.1.1.1</div></div>`;
      add(st);
    }

    if (currentSection === "devices") {
      main.innerHTML = '<div class="set-title">Bluetooth и устройства</div>';
      add(toggleRow("🔵", "Bluetooth", qsState.bt ? "Включено" : "Отключено", qsState.bt, () => {
        qsState.bt = !qsState.bt; store.set("qs", qsState); renderQuickSettings(); drawSection();
      }));
      [["🖱️", "Fluent Mouse", "Подключено · 87%"],["🎧", "FluentBuds Pro", "Сопряжено"],["⌨️", "Fluent Keyboard", "Подключено"]].forEach(dv => {
        const c = document.createElement("div");
        c.className = "set-card";
        c.innerHTML = `<span class="sc-ico">${dv[0]}</span><div class="sc-body"><div class="sc-title">${dv[1]}</div><div class="sc-desc">${dv[2]}</div></div>`;
        add(c);
      });
    }

    if (currentSection === "accounts") {
      main.innerHTML = '<div class="set-title">Учётные записи</div>';
      const card = document.createElement("div");
      card.className = "set-card";
      card.innerHTML = `<span class="sc-ico" style="font-size:30px">👤</span><div class="sc-body"><div class="sc-title">${userName}</div><div class="sc-desc">Локальная учётная запись · Администратор</div></div><button class="set-btn">Управление</button>`;
      add(card);
      const ren = document.createElement("div");
      ren.className = "set-card";
      ren.innerHTML = `<span class="sc-ico">✏️</span><div class="sc-body"><div class="sc-title">Изменить имя пользователя</div><div class="sc-desc">Отображается на экране блокировки и в меню «Пуск»</div></div><button class="set-btn accent">Изменить</button>`;
      $(".set-btn", ren).onclick = () => {
        const n = prompt("Новое имя пользователя:", userName);
        if (n) { userName = n; store.set("username", n); notify("Учётные записи", "Имя изменено на «" + n + "»", "👤"); drawSection(); }
      };
      add(ren);
    }

    if (currentSection === "update") {
      main.innerHTML = '<div class="set-title">Центр обновления Windows</div>';
      const card = document.createElement("div");
      card.className = "set-card";
      card.innerHTML = `<span class="sc-ico">✅</span><div class="sc-body"><div class="sc-title">Установлены последние обновления</div><div class="sc-desc">Последняя проверка: сегодня</div></div><button class="set-btn accent">Проверить наличие</button>`;
      $(".set-btn", card).onclick = () => {
        notify("Центр обновления", "Поиск обновлений…", "🔄");
        setTimeout(() => notify("Центр обновления", "Windows 11 Web обновлена. У вас новейшая версия!", "✅"), 2200);
      };
      add(card);
    }

    if (["apps", "time", "privacy"].includes(currentSection)) {
      const titles = { apps: "Приложения", time: "Время и язык", privacy: "Конфиденциальность" };
      main.innerHTML = `<div class="set-title">${titles[currentSection]}</div>`;
      const card = document.createElement("div");
      card.className = "set-card";
      const info = {
        apps: `<span class="sc-ico">🧩</span><div class="sc-body"><div class="sc-title">Установленные приложения</div><div class="sc-desc">${Object.keys(APPS).length} приложений · Магазин: ${store.get("storeInstalled", []).length} установок</div></div>`,
        time: `<span class="sc-ico">🕐</span><div class="sc-body"><div class="sc-title">Дата и время</div><div class="sc-desc">${fmtDateLong(new Date())} · Часовой пояс UTC+03:00</div></div>`,
        privacy: `<span class="sc-ico">🔒</span><div class="sc-body"><div class="sc-title">Защита и конфиденциальность</div><div class="sc-desc">Все данные хранятся локально в вашем браузере</div></div>`
      };
      card.innerHTML = info[currentSection];
      add(card);
      add(toggleRow("🔄", "Синхронизация", "Синхронизировать параметры между устройствами", false, () => notify("Параметры", "Синхронизация недоступна в веб-версии", "🔄")));
    }
  }
  drawSection();
}

/* ================================================================
   БРАУЗЕР EDGE
   ================================================================ */
const ENGINES = [
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=" },
  { id: "wiki", name: "Википедия", url: "https://ru.wikipedia.org/w/index.php?search=" },
  { id: "ecosia", name: "Ecosia", url: "https://www.ecosia.org/search?q=" },
  { id: "startpage", name: "Startpage", url: "https://www.startpage.com/do/search?q=" },
  { id: "ddg", name: "DuckDuckGo", url: "https://html.duckduckgo.com/html/?q=" }
];
function curEngine() { return ENGINES.find(x => x.id === store.get("engine", "bing")) || ENGINES[0]; }
function engineUrl(q) { return curEngine().url + encodeURIComponent(q); }

function renderEdge(body, win, args) {
  win.tabs = [];
  win.activeTab = -1;
  body.innerHTML = `
    <div class="edge-tabs" id="edge-tabs"></div>
    <div class="edge-nav">
      <button class="tool-btn" data-n="back" title="Назад">←</button>
      <button class="tool-btn" data-n="fwd" title="Вперёд">→</button>
      <button class="tool-btn" data-n="reload" title="Обновить">🔄</button>
      <button class="tool-btn" data-n="home" title="Домашняя">🏠</button>
      <select id="edge-engine" class="edge-engine" title="Поисковая система">${ENGINES.map(e => `<option value="${e.id}"${e.id === curEngine().id ? " selected" : ""}>${e.name}</option>`).join("")}</select>
      <div class="edge-addr">
        <span id="ea-lock">🔒</span>
        <input id="edge-addr-input" placeholder="Поиск или введите адрес" spellcheck="false">
      </div>
      <button class="tool-btn" data-n="ext" title="Открыть в новой вкладке браузера">↗</button>
    </div>
    <div class="edge-view">
      <div class="edge-home" id="edge-home">
        <div class="edge-logo"><b>Fluent Edge</b><span>Быстрый и красивый браузер</span></div>
        <div class="edge-searchbox"><span>🔎</span><input id="edge-search-input" placeholder="Поиск в интернете…"></div>
        <div class="edge-quick">
          ${[["🌐","Bing","https://www.bing.com"],["📚","Википедия","https://ru.wikipedia.org/wiki/Windows_11"],["🗺️","Карты","https://www.openstreetmap.org"],["🧪","Пример","https://example.com"],["📰","Новости","https://news.ycombinator.com"]].map((q,i) => `
            <div class="eq-item" data-url="${q[2]}"><div class="eq-ico">${q[0]}</div><div class="eq-name">${q[1]}</div></div>`).join("")}
        </div>
      </div>
      <iframe id="edge-frame" style="display:none" referrerpolicy="no-referrer"></iframe>
      <div class="edge-blocked" id="edge-blocked">
        <div class="eb-ico">🛡️</div>
        <div class="eb-title">Сайт запретил встраивание</div>
        <div class="eb-text">Этот сайт не разрешает открывать себя внутри других страниц (X-Frame-Options). Это защита браузера, а не ошибка системы. Вы можете открыть сайт в новой вкладке.</div>
        <button class="eb-link" id="eb-open">Открыть в новой вкладке ↗</button>
        <button class="eb-link" id="eb-engine">Попробовать другую поисковую систему</button>
        <button class="eb-link" style="background:var(--card-hover);color:var(--text)" id="eb-back">← На главную</button>
      </div>
    </div>`;

  const tabsBar = $("#edge-tabs", body);
  const frame = $("#edge-frame", body);
  const home = $("#edge-home", body);
  const blocked = $("#edge-blocked", body);
  const addrInput = $("#edge-addr-input", body);

  function newTab(url) {
    win.tabs.push({ url: url || "", title: url ? url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : "Новая вкладка", history: url ? [url] : [], hidx: url ? 0 : -1, loaded: false });
    win.activeTab = win.tabs.length - 1;
    drawTabs();
    if (url) navigate(url); else showHome();
  }

  function drawTabs() {
    tabsBar.innerHTML = win.tabs.map((t, i) => `
      <div class="edge-tab${i === win.activeTab ? " active" : ""}" data-i="${i}">
        <span class="et-title">${t.title}</span><span class="et-close" data-c="${i}">✕</span>
      </div>`).join("") + '<button class="edge-newtab" data-n="+">+</button>';
    $$(".edge-tab", tabsBar).forEach(el => {
      el.onclick = e => {
        if (e.target.classList.contains("et-close")) {
          const i = +e.target.dataset.c;
          win.tabs.splice(i, 1);
          if (!win.tabs.length) { closeWin(win); return; }
          if (win.activeTab >= win.tabs.length) win.activeTab = win.tabs.length - 1;
          drawTabs(); activateTab(win.activeTab);
          return;
        }
        win.activeTab = +el.dataset.i;
        drawTabs(); activateTab(win.activeTab);
      };
    });
    $("[data-n='+']", tabsBar).onclick = () => newTab("");
  }

  function activateTab(i) {
    const t = win.tabs[i];
    if (!t) return;
    addrInput.value = t.url;
    if (t.hidx < 0) showHome(); else navigate(t.history[t.hidx], false);
  }

  let loadTimer = null;
  function navigate(url, push = true) {
    clearTimeout(loadTimer);
    const t = win.tabs[win.activeTab];
    if (!t) return;
    if (!/^https?:/.test(url)) {
      if (url.includes(".") && !url.includes(" ")) url = "https://" + url;
      else url = engineUrl(url);
    }
    t.url = url;
    t.title = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || url;
    if (push) { t.history = t.history.slice(0, t.hidx + 1); t.history.push(url); t.hidx = t.history.length - 1; }
    addrInput.value = url;
    $("#ea-lock", body).textContent = url.startsWith("https") ? "🔒" : "⚠️";
    blocked.style.display = "none";
    home.style.display = "none";
    frame.style.display = "block";
    frame.src = url;
    drawTabs();
    // Если страница не загрузится (X-Frame-Options) — показать подсказку
    t.loaded = false;
    loadTimer = setTimeout(() => {
      if (!t.loaded) { frame.style.display = "none"; blocked.style.display = "flex"; }
    }, 4500);
  }
  frame.addEventListener("load", () => {
    // Определяем отказ X-Frame-Options: у заблокированного iframe документ доступен, но пуст
    let refused = false;
    try {
      const d = frame.contentDocument;
      refused = !d || !d.body || (d.body.children.length === 0 && !d.head);
    } catch (e) { refused = false; }
    const t = win.tabs[win.activeTab];
    if (refused) {
      frame.style.display = "none";
      blocked.style.display = "flex";
    } else {
      if (t) t.loaded = true;
      clearTimeout(loadTimer);
      blocked.style.display = "none";
    }
  });
  window.addEventListener("message", e => {
    // Ничего не делаем, оставлено для расширения
  });

  function showHome() {
    clearTimeout(loadTimer);
    frame.style.display = "none";
    blocked.style.display = "none";
    home.style.display = "flex";
    const t = win.tabs[win.activeTab];
    if (t) { t.url = ""; t.title = "Новая вкладка"; t.hidx = -1; drawTabs(); addrInput.value = ""; }
  }

  function goHome() { showHome(); }

  const goSearch = q => {
    q = q.trim();
    if (!q) return;
    const t = win.tabs[win.activeTab];
    if (/^https?:\/\//.test(q) || (q.includes(".") && !q.includes(" "))) { navigate(q); return; }
    if (t) t.query = q;
    navigate(engineUrl(q));
  };
  const engSel = $("#edge-engine", body);
  const setEngine = id => {
    store.set("engine", id); engSel.value = id;
    const t = win.tabs[win.activeTab];
    if (t && t.query) navigate(engineUrl(t.query));
  };
  engSel.onchange = () => setEngine(engSel.value);
  $("#eb-engine", body).onclick = () => {
    const i = ENGINES.indexOf(curEngine());
    setEngine(ENGINES[(i + 1) % ENGINES.length].id);
  };
  body.querySelector('[data-n="ext"]').onclick = () => {
    const t = win.tabs[win.activeTab];
    if (t && t.url) window.open(t.url, "_blank");
  };

  addrInput.addEventListener("keydown", e => { if (e.key === "Enter") goSearch(addrInput.value); });
  $("#edge-search-input", body).addEventListener("keydown", e => { if (e.key === "Enter") goSearch(e.target.value); });
  body.querySelector('[data-n="back"]').onclick = () => {
    const t = win.tabs[win.activeTab];
    if (t && t.hidx > 0) { t.hidx--; drawTabs(); navigate(t.history[t.hidx], false); }
  };
  body.querySelector('[data-n="fwd"]').onclick = () => {
    const t = win.tabs[win.activeTab];
    if (t && t.hidx < t.history.length - 1) { t.hidx++; drawTabs(); navigate(t.history[t.hidx], false); }
  };
  body.querySelector('[data-n="reload"]').onclick = () => {
    const t = win.tabs[win.activeTab];
    if (t && t.hidx >= 0) navigate(t.history[t.hidx], false); else showHome();
  };
  body.querySelector('[data-n="home"]').onclick = goHome;
  $("#eb-back", body).onclick = goHome;
  $("#eb-open", body).onclick = () => {
    const t = win.tabs[win.activeTab];
    if (t && t.url) window.open(t.url, "_blank");
  };
  $$(".eq-item", body).forEach(el => el.onclick = () => navigate(el.dataset.url));

  newTab("");
  if (args && args.search) goSearch(args.search);
  if (args && args.url) navigate(args.url);
}

/* ================================================================
   ЭКРАНЫ: ЗАГРУЗКА / БЛОКИРОВКА / ПИТАНИЕ
   ================================================================ */
const bootScreen = $("#boot-screen");
const lockScreen = $("#lock-screen");
const shutdownScreen = $("#shutdown-screen");

function showLock() {
  lockScreen.style.display = "flex";
  lockScreen.classList.remove("auth");
  tickClock();
}

function lockScreenGoAuth() { lockScreen.classList.add("auth"); }

lockScreen.addEventListener("click", e => {
  if (!lockScreen.classList.contains("auth")) { lockScreenGoAuth(); return; }
  if (e.target.closest(".lock-btn") || e.target.closest(".lock-user")) unlock();
});

function unlock() {
  lockScreen.style.opacity = "0";
  lockScreen.style.transform = "scale(1.05)";
  setTimeout(() => {
    lockScreen.style.display = "none";
    lockScreen.style.opacity = "";
    lockScreen.style.transform = "";
    lockScreen.classList.remove("auth");
    setTimeout(() => notify("Добро пожаловать!", "С возвращением, " + userName + "! Система готова к работе 👋", "🪟"), 900);
  }, 450);
}

function shutdown(restart) {
  closeAllFlyouts();
  WINS.slice().forEach(closeWin);
  shutdownScreen.style.display = "flex";
  $(".shutdown-text", shutdownScreen).textContent = restart ? "Перезагрузка…" : "Завершение работы…";
  $(".power-off", shutdownScreen).style.display = "none";
  setTimeout(() => {
    if (restart) {
      shutdownScreen.style.display = "none";
      bootScreen.style.display = "flex";
      bootScreen.style.opacity = "1";
      startBootSequence();
    } else {
      $(".boot-spinner", shutdownScreen).style.display = "none";
      $(".shutdown-text", shutdownScreen).style.display = "none";
      $(".power-off", shutdownScreen).style.display = "block";
    }
  }, 2400);
}

function sleep() {
  closeAllFlyouts();
  const zzz = document.createElement("div");
  zzz.id = "sleep-screen";
  zzz.style.cssText = "position:fixed;inset:0;background:#000;z-index:9400;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:60px;color:#555;font-size:13px";
  zzz.textContent = "Нажмите, чтобы разбудить";
  document.body.appendChild(zzz);
  zzz.onclick = () => { zzz.remove(); showLock(); };
}

function startBootSequence() {
  bootScreen.style.display = "flex";
  bootScreen.style.opacity = "1";
  setTimeout(() => {
    bootScreen.style.opacity = "0";
    setTimeout(() => { bootScreen.style.display = "none"; showLock(); }, 500);
  }, 2000);
}

$("#btn-power-on").onclick = () => {
  shutdownScreen.style.display = "none";
  startBootSequence();
};

/* ================================================================
   ИНИЦИАЛИЗАЦИЯ
   ================================================================ */
function init() {
  FS.init();
  applySettings();
  renderQuickSettings();
  renderStart();
  renderDesktopIcons();
  renderTaskbarApps();
  updateNotifBadge();
  tickClock();
  startBootSequence();
  // Приветственное уведомление после разблокировки (одноразово)
  if (!store.get("welcomed", false)) {
    store.set("welcomed", true);
    setTimeout(() => {
      notifs = [];
      store.set("notifs", notifs);
    }, 100);
  }
}

init();
