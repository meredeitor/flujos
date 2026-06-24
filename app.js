const svg = document.getElementById("flowCanvas");
const gridLayer = document.getElementById("gridLayer");
const headerLayer = document.getElementById("headerLayer");
const laneLayer = document.getElementById("laneLayer");
const selectionLayer = document.getElementById("selectionLayer");
const edgeLayer = document.getElementById("edgeLayer");
const nodeLayer = document.getElementById("nodeLayer");
const titleInput = document.getElementById("diagramTitle");
const statusText = document.getElementById("statusText");
const zoomLevel = document.getElementById("zoomLevel");
const nodeText = document.getElementById("nodeText");
const nodeOwner = document.getElementById("nodeOwner");
const nodeShape = document.getElementById("nodeShape");
const nodeWidth = document.getElementById("nodeWidth");
const lanesEnabledInput = document.getElementById("lanesEnabled");
const laneNamesInput = document.getElementById("laneNames");
const lanesHorizontalBtn = document.getElementById("lanesHorizontalBtn");
const lanesVerticalBtn = document.getElementById("lanesVerticalBtn");
const headerEnabledInput = document.getElementById("headerEnabled");
const headerCompanyInput = document.getElementById("headerCompany");
const headerDocumentInput = document.getElementById("headerDocument");
const headerResponsibleInput = document.getElementById("headerResponsible");
const headerCodeInput = document.getElementById("headerCode");
const headerDateInput = document.getElementById("headerDate");
const headerVersionInput = document.getElementById("headerVersion");
const headerPeriodInput = document.getElementById("headerPeriod");
const headerLeftLogoInput = document.getElementById("headerLeftLogoInput");
const headerRightLogoInput = document.getElementById("headerRightLogoInput");
const appVersionBadge = document.getElementById("appVersion");
const currentUserLabel = document.getElementById("currentUserLabel");
const userSelect = document.getElementById("userSelect");

const appVersion = "0.3.5";
const NS = "http://www.w3.org/2000/svg";
const storeKey = "flujos-sgc-diagram-v1";
const currentRecordKey = "flujos-sgc-current-record-v1";
const sessionUserKey = "flujos-sgc-session-user-v1";
const cloudCollection = "diagramas";
const workspace = { w: 16000, h: 10400 };
const defaultView = { x: 0, y: 0, w: 1600, h: 1000 };
const headerLayout = { x: 20, y: 20, w: 1560, topH: 125, gap: 22, bottomH: 96, reserve: 300 };
const minZoom = 0.09;
const maxZoom = 2.5;
const shapeSize = {
  terminator: { w: 220, h: 94 },
  process: { w: 240, h: 110 },
  subprocess: { w: 260, h: 110 },
  data: { w: 250, h: 110 },
  decision: { w: 220, h: 150 },
  document: { w: 240, h: 122 },
  text: { w: 190, h: 64 },
};

const diagramThemes = {
  sgi: { name: "SGI verde", stroke: "#0f766e", fills: { terminator: "#e8f7f3", process: "#ffffff", subprocess: "#ffffff", data: "#f0fdf4", decision: "#fff7ed", document: "#eff6ff" } },
  blue: { name: "Azul", stroke: "#2563eb", fills: { terminator: "#dbeafe", process: "#ffffff", subprocess: "#ffffff", data: "#e0f2fe", decision: "#fef3c7", document: "#eef2ff" } },
  amber: { name: "Ambar", stroke: "#d97706", fills: { terminator: "#fef3c7", process: "#ffffff", subprocess: "#ffffff", data: "#fffbeb", decision: "#fed7aa", document: "#fff7ed" } },
  slate: { name: "Grafito", stroke: "#475569", fills: { terminator: "#f1f5f9", process: "#ffffff", subprocess: "#ffffff", data: "#e2e8f0", decision: "#f8fafc", document: "#f1f5f9" } },
  rose: { name: "Vino", stroke: "#be123c", fills: { terminator: "#ffe4e6", process: "#ffffff", subprocess: "#ffffff", data: "#fff1f2", decision: "#ffedd5", document: "#fdf2f8" } },
};

let state = {
  title: "Proceso del SGI",
  nodes: [],
  edges: [],
  header: defaultHeader(),
  lanes: { enabled: false, orientation: "horizontal", names: ["Direccion", "Calidad", "Produccion"] },
  theme: "sgi",
};

let selectedNodeId = null;
let selectedEdgeId = null;
let selectedNodeIds = new Set();
let drag = null;
let laneResize = null;
let pan = null;
let selectBox = null;
let selectMode = false;
let connectMode = false;
let connectFrom = null;
let deferredInstall = null;
let view = { ...defaultView };
let internalClipboard = null;
let undoStack = [];
let lastStateSnapshot = "";
let historyPaused = false;
let currentRecordId = localStorage.getItem(currentRecordKey) || "";
let sessionUser = localStorage.getItem(sessionUserKey) || "";
if (sessionUser === "Hermenegildo Perez") sessionUser = "Hermenegildo Pérez";
if (sessionUser === "Omar Martinez") sessionUser = "Omar Martínez";

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function setStatus(message) {
  statusText.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    statusText.textContent = "Listo";
  }, 2200);
}

function updateSessionUI() {
  if (!currentUserLabel || !userSelect) return;
  currentUserLabel.textContent = sessionUser ? `Sesion: ${sessionUser}` : "Sin sesion";
  currentUserLabel.classList.toggle("active", Boolean(sessionUser));
  userSelect.value = sessionUser;
}

function setSessionUser(value) {
  sessionUser = value || "";
  if (sessionUser) {
    localStorage.setItem(sessionUserKey, sessionUser);
    setStatus(`Sesion iniciada: ${sessionUser}`);
  } else {
    localStorage.removeItem(sessionUserKey);
    setStatus("Selecciona usuario para guardar cambios");
  }
  updateSessionUI();
}

function requireSession() {
  if (sessionUser) return true;
  setStatus("Selecciona usuario para guardar cambios");
  userSelect?.focus();
  return false;
}

function revisionEntry(version, action) {
  return {
    version,
    action,
    by: sessionUser || "Sin sesion",
    at: new Date().toISOString(),
    appVersion,
  };
}

function createSvg(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function defaultHeader() {
  return {
    enabled: false,
    company: "BOTAS CABORCA S.A. DE C.V.",
    document: "Documento: Identificacion de Molduras",
    responsible: "Jefe de Implementaciones",
    code: "FO-DES-032",
    date: "27/05/26",
    version: "00",
    period: "V - 2026",
    leftLogo: "CABORCA\nGROUP",
    rightLogo: "SISTEMA DE TRABAJO\nCABORCA",
    leftLogoImage: "",
    rightLogoImage: "",
  };
}

function ensureHeader() {
  if (!state.header) state.header = defaultHeader();
  state.header = { ...defaultHeader(), ...state.header };
}

function ensureTheme() {
  if (!state.theme || !diagramThemes[state.theme]) state.theme = "sgi";
}

function activeTheme() {
  ensureTheme();
  return diagramThemes[state.theme];
}

function themeFill(shape) {
  const theme = activeTheme();
  return theme.fills[shape] || theme.fills.process || "#ffffff";
}

function themeStroke(node) {
  return selectedNodeIds.has(node.id) ? "#f59e0b" : activeTheme().stroke;
}

function setDiagramTheme(themeId) {
  if (!diagramThemes[themeId]) return;
  state.theme = themeId;
  save();
  render();
  setStatus(`Tema aplicado: ${diagramThemes[themeId].name}`);
}

function syncHeaderControls() {
  ensureHeader();
  headerEnabledInput.checked = Boolean(state.header.enabled);
  headerCompanyInput.value = state.header.company;
  headerDocumentInput.value = state.header.document;
  headerResponsibleInput.value = state.header.responsible;
  headerCodeInput.value = state.header.code;
  headerDateInput.value = state.header.date;
  headerVersionInput.value = state.header.version;
  headerPeriodInput.value = state.header.period;
}

function addMultilineSvgText(group, text, x, y, attrs = {}) {
  String(text || "").split("\n").forEach((line, index) => {
    group.appendChild(createSvg("text", { x, y: y + index * 28, ...attrs })).textContent = line;
  });
}

function addHeaderLogo(group, imageData, fallbackText, x, y, w, h) {
  if (imageData) {
    group.appendChild(createSvg("image", {
      class: "doc-header-image",
      href: imageData,
      x,
      y,
      width: w,
      height: h,
      preserveAspectRatio: "xMidYMid meet",
    }));
    return;
  }
  addMultilineSvgText(group, fallbackText, x + w / 2, y + h / 2 - 12, { class: "doc-header-logo", "text-anchor": "middle" });
}

function headerReservedHeight() {
  ensureHeader();
  return state.header.enabled ? headerLayout.reserve : 0;
}

function makeRoomForHeader() {
  const topLimit = headerReservedHeight() + 40;
  if (!topLimit || !state.nodes?.length) return;
  const minY = Math.min(...state.nodes.map((node) => node.y));
  if (minY >= topLimit) return;
  const deltaY = topLimit - minY;
  state.nodes.forEach((node) => {
    const size = getNodeSize(node);
    node.y = clamp(node.y + deltaY, 20, workspace.h - size.h - 20);
  });
}

function renderHeader(targetLayer = headerLayer, options = {}) {
  ensureHeader();
  targetLayer.innerHTML = "";
  if (!state.header.enabled) return;
  const x = options.x ?? headerLayout.x;
  const y = options.y ?? headerLayout.y;
  const w = options.w ?? headerLayout.w;
  const topH = headerLayout.topH;
  const bottomH = headerLayout.bottomH;
  const leftW = 320;
  const rightW = 360;
  const centerW = w - leftW - rightW;
  const group = createSvg("g", { class: "doc-header" });
  group.appendChild(createSvg("rect", { class: "doc-header-box", x, y, width: w, height: topH }));
  group.appendChild(createSvg("rect", { class: "doc-header-box", x, y: y + topH + headerLayout.gap, width: w, height: bottomH }));
  group.appendChild(createSvg("line", { class: "doc-header-line", x1: x + leftW, y1: y, x2: x + leftW, y2: y + topH }));
  group.appendChild(createSvg("line", { class: "doc-header-line", x1: x + leftW + centerW, y1: y, x2: x + leftW + centerW, y2: y + topH }));
  addHeaderLogo(group, state.header.leftLogoImage, state.header.leftLogo, x + 28, y + 14, leftW - 56, topH - 28);
  group.appendChild(createSvg("text", { class: "doc-header-company", x: x + leftW + centerW / 2, y: y + 48, "text-anchor": "middle" })).textContent = state.header.company;
  group.appendChild(createSvg("text", { class: "doc-header-document", x: x + leftW + centerW / 2, y: y + 88, "text-anchor": "middle" })).textContent = state.header.document;
  addHeaderLogo(group, state.header.rightLogoImage, state.header.rightLogo, x + leftW + centerW + 28, y + 14, rightW - 56, topH - 28);
  const infoY = y + topH + headerLayout.gap + 36;
  group.appendChild(createSvg("text", { class: "doc-header-info", x: x + 24, y: infoY })).textContent = `Responsable: ${state.header.responsible}`;
  group.appendChild(createSvg("text", { class: "doc-header-info", x: x + 24, y: infoY + 42 })).textContent = `Codigo: ${state.header.code}`;
  group.appendChild(createSvg("text", { class: "doc-header-info", x: x + 570, y: infoY })).textContent = `Fecha Revision: ${state.header.date}`;
  group.appendChild(createSvg("text", { class: "doc-header-info", x: x + 570, y: infoY + 42 })).textContent = `Version: ${state.header.version}`;
  group.appendChild(createSvg("rect", { class: "doc-header-period", x: x + w - 240, y: y + topH + headerLayout.gap + 14, width: 220, height: 48, rx: 8 }));
  group.appendChild(createSvg("text", { class: "doc-header-period-text", x: x + w - 130, y: y + topH + headerLayout.gap + 46, "text-anchor": "middle" })).textContent = state.header.period;
  targetLayer.appendChild(group);
}
function laneContentExtent(axis) {
  if (!Array.isArray(state.nodes) || !state.nodes.length) return 0;
  return state.nodes.reduce((max, node) => {
    const bounds = nodeBounds(node);
    return Math.max(max, axis === "x" ? bounds.x + bounds.w : bounds.y + bounds.h);
  }, 0);
}

function laneTotalSize() {
  ensureHeader();
  const count = Math.max(1, state.lanes?.names?.length || 1);
  if (state.lanes?.orientation === "vertical") {
    const current = Array.isArray(state.lanes.sizes) ? state.lanes.sizes.map(Number).filter((size) => Number.isFinite(size) && size > 0) : [];
    if (current.length === count) return Math.min(workspace.w, current.reduce((acc, size) => acc + size, 0));
    const minimumByLanes = count * 420;
    const minimumByHeader = state.header?.enabled ? headerLayout.x + headerLayout.w + 260 : 0;
    const minimumByContent = laneContentExtent("x") + 360;
    return Math.min(workspace.w, Math.max(minimumByLanes, minimumByHeader, minimumByContent, defaultView.w));
  }
  return workspace.h - headerReservedHeight();
}

function normalizeLaneSizes() {
  const total = laneTotalSize();
  const count = state.lanes.names.length;
  const current = Array.isArray(state.lanes.sizes) ? state.lanes.sizes.map(Number).filter((size) => Number.isFinite(size) && size > 0) : [];
  if (current.length !== count) {
    state.lanes.sizes = Array.from({ length: count }, () => total / count);
    return;
  }
  const sum = current.reduce((acc, size) => acc + size, 0);
  state.lanes.sizes = sum > 0 ? current.map((size) => (size / sum) * total) : Array.from({ length: count }, () => total / count);
}

function laneStarts() {
  normalizeLaneSizes();
  const starts = [];
  state.lanes.sizes.reduce((offset, size) => {
    starts.push(offset);
    return offset + size;
  }, 0);
  return starts;
}

function ensureLanes() {
  if (!state.lanes) {
    state.lanes = { enabled: false, orientation: "horizontal", names: ["Direccion", "Calidad", "Produccion"] };
  }
  if (state.lanes.orientation !== "vertical") state.lanes.orientation = "horizontal";
  if (!Array.isArray(state.lanes.names) || !state.lanes.names.length) {
    state.lanes.names = ["Direccion", "Calidad", "Produccion"];
  }
  normalizeLaneSizes();
}

function syncLaneControls() {
  ensureLanes();
  lanesEnabledInput.checked = Boolean(state.lanes.enabled);
  laneNamesInput.value = state.lanes.names.join("\n");
  lanesHorizontalBtn.classList.toggle("active", state.lanes.orientation === "horizontal");
  lanesVerticalBtn.classList.toggle("active", state.lanes.orientation === "vertical");
}

function renderLanes(targetLayer = laneLayer, options = {}) {
  ensureLanes();
  targetLayer.innerHTML = "";
  if (!state.lanes.enabled) return;
  const clipX = options.x ?? 0;
  const clipY = options.y ?? 0;
  const clipW = options.w ?? workspace.w;
  const clipH = options.h ?? workspace.h;
  const laneTop = headerReservedHeight();
  const laneHeight = workspace.h - laneTop;
  const vertical = state.lanes.orientation === "vertical";
  const starts = laneStarts();
  const interactive = options.interactive ?? targetLayer === laneLayer;
  state.lanes.names.forEach((name, index) => {
    const size = state.lanes.sizes[index];
    if (vertical) {
      const x = starts[index];
      if (x > clipX + clipW || x + size < clipX || laneTop > clipY + clipH || laneTop + laneHeight < clipY) return;
      targetLayer.appendChild(createSvg("rect", {
        class: `lane-bg lane-bg-${index % 2}`,
        x,
        y: laneTop,
        width: size,
        height: laneHeight,
      }));
      targetLayer.appendChild(createSvg("line", {
        class: "lane-line",
        x1: x,
        y1: laneTop,
        x2: x,
        y2: laneTop + laneHeight,
      }));
      targetLayer.appendChild(createSvg("text", {
        class: "lane-label lane-label-vertical",
        x: x + size / 2,
        y: laneTop + 42,
        "text-anchor": "middle",
      })).textContent = name || `Calle ${index + 1}`;
      if (interactive && index > 0) addLaneResizeHandle(targetLayer, index, x, laneTop, x, laneTop + laneHeight, "vertical");
      return;
    }
    const y = laneTop + starts[index];
    if (y > clipY + clipH || y + size < clipY) return;
    targetLayer.appendChild(createSvg("rect", {
      class: `lane-bg lane-bg-${index % 2}`,
      x: clipX,
      y,
      width: clipW,
      height: size,
    }));
    targetLayer.appendChild(createSvg("line", {
      class: "lane-line",
      x1: clipX,
      y1: y,
      x2: clipX + clipW,
      y2: y,
    }));
    targetLayer.appendChild(createSvg("text", {
      class: "lane-label",
      x: clipX + 24,
      y: y + 34,
    })).textContent = name || `Calle ${index + 1}`;
    if (interactive && index > 0) addLaneResizeHandle(targetLayer, index, clipX, y, clipX + clipW, y, "horizontal");
  });
}

function addLaneResizeHandle(targetLayer, index, x1, y1, x2, y2, orientation) {
  const handle = createSvg("line", {
    class: `lane-resize-handle lane-resize-${orientation}`,
    x1,
    y1,
    x2,
    y2,
    "data-lane-index": index,
  });
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const point = getPoint(event);
    laneResize = {
      index,
      orientation,
      startPoint: point,
      sizes: [...state.lanes.sizes],
    };
    svg.setPointerCapture(event.pointerId);
    setStatus("Arrastra para ajustar la calle");
  });
  targetLayer.appendChild(handle);
}
function drawGrid() {
  gridLayer.innerHTML = "";
  for (let x = 0; x <= workspace.w; x += 40) {
    gridLayer.appendChild(createSvg("line", { x1: x, y1: 0, x2: x, y2: workspace.h, stroke: "#d9e8e5", "stroke-width": 1 }));
  }
  for (let y = 0; y <= workspace.h; y += 40) {
    gridLayer.appendChild(createSvg("line", { x1: 0, y1: y, x2: workspace.w, y2: y, stroke: "#d9e8e5", "stroke-width": 1 }));
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setViewBox(nextView) {
  const nextW = clamp(nextView.w, defaultView.w / maxZoom, defaultView.w / minZoom);
  const nextH = clamp(nextView.h, defaultView.h / maxZoom, defaultView.h / minZoom);
  view = {
    x: clamp(nextView.x, 0, Math.max(0, workspace.w - nextW)),
    y: clamp(nextView.y, 0, Math.max(0, workspace.h - nextH)),
    w: nextW,
    h: nextH,
  };
  svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  zoomLevel.textContent = `${Math.round((defaultView.w / view.w) * 100)}%`;
}

function zoomAt(factor, point = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
  const nextW = clamp(view.w / factor, defaultView.w / maxZoom, defaultView.w / minZoom);
  const nextH = clamp(view.h / factor, defaultView.h / maxZoom, defaultView.h / minZoom);
  const rx = (point.x - view.x) / view.w;
  const ry = (point.y - view.y) / view.h;
  setViewBox({
    x: point.x - nextW * rx,
    y: point.y - nextH * ry,
    w: nextW,
    h: nextH,
  });
}

function resetZoom() {
  setViewBox(defaultView);
}

function updateFullscreenButton() {
  const button = document.getElementById("fullscreenBtn");
  if (!button) return;
  button.textContent = document.fullscreenElement ? "Salir" : "Pantalla";
}

async function toggleFullscreen() {
  const target = document.querySelector(".canvas-wrap");
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setStatus("Pantalla completa cerrada");
    } else if (target?.requestFullscreen) {
      await target.requestFullscreen();
      fitToDiagram();
      setStatus("Modo presentacion activo");
    } else {
      setStatus("Pantalla completa no disponible");
    }
  } catch {
    setStatus("No se pudo activar pantalla completa");
  }
  updateFullscreenButton();
}
function fitToDiagram() {
  if (!state.nodes.length) {
    resetZoom();
    return;
  }
  const padding = 160;
  const bounds = state.nodes.reduce((box, node) => {
    const size = getNodeSize(node);
    return {
      minX: Math.min(box.minX, node.x),
      minY: Math.min(box.minY, node.y),
      maxX: Math.max(box.maxX, node.x + size.w),
      maxY: Math.max(box.maxY, node.y + size.h),
    };
  }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const wantedW = Math.max(bounds.maxX - bounds.minX + padding * 2, 700);
  const wantedH = Math.max(bounds.maxY - bounds.minY + padding * 2, 440);
  const scale = Math.max(wantedW / defaultView.w, wantedH / defaultView.h);
  const nextW = clamp(defaultView.w * scale, defaultView.w / maxZoom, defaultView.w / minZoom);
  const nextH = clamp(defaultView.h * scale, defaultView.h / maxZoom, defaultView.h / minZoom);
  setViewBox({
    x: (bounds.minX + bounds.maxX) / 2 - nextW / 2,
    y: (bounds.minY + bounds.maxY) / 2 - nextH / 2,
    w: nextW,
    h: nextH,
  });
}

function centerOf(node) {
  const size = getNodeSize(node);
  return { x: node.x + size.w / 2, y: node.y + size.h / 2 };
}

function connectionPoint(node, side) {
  const size = getNodeSize(node);
  const center = centerOf(node);
  if (side === "left") return { x: node.x, y: center.y };
  if (side === "right") return { x: node.x + size.w, y: center.y };
  if (side === "top") return { x: center.x, y: node.y };
  return { x: center.x, y: node.y + size.h };
}

function automaticConnectionSides(from, to) {
  const fromCenter = centerOf(from);
  const toCenter = centerOf(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const vertical = Math.abs(dy) > Math.abs(dx);
  return {
    fromSide: vertical ? (dy >= 0 ? "bottom" : "top") : (dx >= 0 ? "right" : "left"),
    toSide: vertical ? (dy >= 0 ? "top" : "bottom") : (dx >= 0 ? "left" : "right"),
  };
}

function edgeConnectionSides(edge, from, to) {
  const auto = automaticConnectionSides(from, to);
  return {
    fromSide: edge?.fromSide || auto.fromSide,
    toSide: edge?.toSide || auto.toSide,
  };
}

function sideDirection(side) {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function edgePath(from, to, edge = null) {
  const { fromSide, toSide } = edgeConnectionSides(edge, from, to);
  const a = connectionPoint(from, fromSide);
  const b = connectionPoint(to, toSide);
  const verticalFlow = (fromSide === "bottom" && toSide === "top") || (fromSide === "top" && toSide === "bottom");
  const horizontalFlow = (fromSide === "right" && toSide === "left") || (fromSide === "left" && toSide === "right");
  if (verticalFlow) {
    const distance = Math.abs(b.y - a.y);
    const curve = Math.max(24, Math.min(90, distance * 0.28));
    const direction = Math.sign(b.y - a.y || (fromSide === "bottom" ? 1 : -1));
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + direction * curve}, ${b.x} ${b.y - direction * curve}, ${b.x} ${b.y}`;
  }
  if (horizontalFlow) {
    const distance = Math.abs(b.x - a.x);
    const curve = Math.max(24, Math.min(100, distance * 0.28));
    const direction = Math.sign(b.x - a.x || (fromSide === "right" ? 1 : -1));
    return `M ${a.x} ${a.y} C ${a.x + direction * curve} ${a.y}, ${b.x - direction * curve} ${b.y}, ${b.x} ${b.y}`;
  }
  const fromDirection = sideDirection(fromSide);
  const toDirection = sideDirection(toSide);
  const curve = Math.max(55, Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) * 0.2));
  const c1 = { x: a.x + fromDirection.x * curve, y: a.y + fromDirection.y * curve };
  const c2 = { x: b.x + toDirection.x * curve, y: b.y + toDirection.y * curve };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

function renderEdgeAnchors(edge, from, to) {
  const sides = ["top", "right", "bottom", "left"];
  const { fromSide, toSide } = edgeConnectionSides(edge, from, to);
  [{ node: from, end: "from", active: fromSide }, { node: to, end: "to", active: toSide }].forEach((item) => {
    sides.forEach((side) => {
      const point = connectionPoint(item.node, side);
      const group = createSvg("g", { class: `edge-anchor-group${side === item.active ? " active" : ""}` });
      const hitArea = createSvg("circle", {
        class: "edge-anchor-hit",
        cx: point.x,
        cy: point.y,
        r: 34,
        "data-edge-end": item.end,
        "data-edge-side": side,
      });
      const visibleHandle = createSvg("circle", {
        class: "edge-anchor",
        cx: point.x,
        cy: point.y,
        r: 14,
      });
      group.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        edge[`${item.end}Side`] = side;
        save();
        render();
        setStatus(`Conexion ajustada al lado ${side}`);
      });
      group.appendChild(hitArea);
      group.appendChild(visibleHandle);
      edgeLayer.appendChild(group);
    });
  });
}

function nodeBounds(node) {
  const size = getNodeSize(node);
  return { x: node.x, y: node.y, w: size.w, h: size.h };
}

function rectsIntersect(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function normalizeBox(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

function setSelectedNodes(ids, primaryId = null) {
  selectedNodeIds = new Set(ids);
  selectedNodeId = primaryId || ids[ids.length - 1] || null;
  selectedEdgeId = null;
}

function clearSelection() {
  selectedNodeIds = new Set();
  selectedNodeId = null;
  selectedEdgeId = null;
}

function selectedNodes() {
  return state.nodes.filter((node) => selectedNodeIds.has(node.id));
}

function shapeStyle(node) {
  return `--node-stroke:${activeTheme().stroke}`;
}

function detailStyle(node) {
  return `--node-stroke:${activeTheme().stroke}`;
}

function shapeElement(node) {
  const size = getNodeSize(node);
  if (node.shape === "text") {
    return createSvg("rect", { class: "node-shape text-box-shape", x: node.x, y: node.y, width: size.w, height: size.h, rx: 4, fill: "transparent" });
  }
  if (node.shape === "terminator") {
    return createSvg("rect", { class: "node-shape", x: node.x, y: node.y, width: size.w, height: size.h, rx: Math.min(size.h / 2, 54), fill: themeFill(node.shape), style: shapeStyle(node) });
  }
  if (node.shape === "subprocess") {
    const group = createSvg("g");
    group.appendChild(createSvg("rect", { class: "node-shape", x: node.x, y: node.y, width: size.w, height: size.h, rx: 8, fill: themeFill(node.shape), style: shapeStyle(node) }));
    group.appendChild(createSvg("line", { class: "node-shape-detail", x1: node.x + 24, y1: node.y + 8, x2: node.x + 24, y2: node.y + size.h - 8, style: detailStyle(node) }));
    group.appendChild(createSvg("line", { class: "node-shape-detail", x1: node.x + size.w - 24, y1: node.y + 8, x2: node.x + size.w - 24, y2: node.y + size.h - 8, style: detailStyle(node) }));
    return group;
  }
  if (node.shape === "data") {
    const slant = Math.min(34, size.w * 0.16);
    return createSvg("polygon", {
      class: "node-shape",
      points: `${node.x + slant},${node.y} ${node.x + size.w},${node.y} ${node.x + size.w - slant},${node.y + size.h} ${node.x},${node.y + size.h}`,
      fill: themeFill(node.shape),
      style: shapeStyle(node),
    });
  }
  if (node.shape === "decision") {
    const cx = node.x + size.w / 2;
    const cy = node.y + size.h / 2;
    return createSvg("polygon", {
      class: "node-shape",
      points: `${cx},${node.y} ${node.x + size.w},${cy} ${cx},${node.y + size.h} ${node.x},${cy}`,
      fill: themeFill(node.shape),
      style: shapeStyle(node),
    });
  }
  if (node.shape === "document") {
    const d = [
      `M ${node.x} ${node.y}`,
      `H ${node.x + size.w}`,
      `V ${node.y + size.h - 24}`,
      `C ${node.x + size.w - 60} ${node.y + size.h + 8}, ${node.x + 60} ${node.y + size.h - 56}, ${node.x} ${node.y + size.h - 18}`,
      "Z",
    ].join(" ");
    return createSvg("path", { class: "node-shape", d, fill: themeFill(node.shape), style: shapeStyle(node) });
  }
  return createSvg("rect", { class: "node-shape", x: node.x, y: node.y, width: size.w, height: size.h, rx: 8, fill: themeFill(node.shape), style: shapeStyle(node) });
}

function wrapTextLines(text, maxChars, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (!lines.length) lines.push("Sin texto");
  if (Number.isFinite(maxLines) && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\.\.\.$/, "")}...`;
    return kept;
  }
  return lines;
}

function nodeTextMaxChars(node) {
  return node.shape === "text" ? 22 : 18;
}

function nodeMaxTextLines() {
  return 20;
}

function getNodeSize(node) {
  const base = shapeSize[node.shape] || shapeSize.process;
  const lines = wrapTextLines(node.text, nodeTextMaxChars(node), nodeMaxTextLines());
  const baseSize = node.shape === "text" ? 20 : 22;
  const fontSize = Math.max(16, baseSize - Math.max(0, lines.length - 2) * 2);
  const lineHeight = Math.round(fontSize * 1.18);
  const ownerSpace = node.owner && node.shape !== "text" ? 34 : 0;
  const padding = node.shape === "decision" ? 76 : node.shape === "text" ? 28 : 48;
  return {
    w: node.w || base.w,
    h: Math.max(node.h || base.h, lines.length * lineHeight + ownerSpace + padding),
  };
}

function addWrappedText(group, text, cx, cy, maxChars, className, options = {}) {
  const maxLines = options.maxLines ?? nodeMaxTextLines();
  const baseSize = options.fontSize || 22;
  const minSize = options.minFontSize || 16;
  const lineGap = options.lineGap || 1.18;
  const lines = wrapTextLines(text, maxChars, maxLines);
  const fontSize = Math.max(minSize, baseSize - Math.max(0, lines.length - 2) * 2);
  const lineHeight = Math.round(fontSize * lineGap);
  const firstY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    group.appendChild(createSvg("text", {
      class: className,
      x: cx,
      y: firstY + index * lineHeight,
      "dominant-baseline": "middle",
      "font-size": fontSize,
      "text-anchor": "middle",
    })).textContent = line;
  });
}

function render() {
  renderHeader();
  renderLanes();
  selectionLayer.innerHTML = "";
  edgeLayer.innerHTML = "";
  nodeLayer.innerHTML = "";
  titleInput.value = state.title;

  if (selectBox) {
    const box = normalizeBox(selectBox.start, selectBox.end);
    selectionLayer.appendChild(createSvg("rect", { class: "selection-box", x: box.x, y: box.y, width: box.w, height: box.h }));
  }

  state.edges.forEach((edge) => {
    const from = state.nodes.find((node) => node.id === edge.from);
    const to = state.nodes.find((node) => node.id === edge.to);
    if (!from || !to) return;
    const a = centerOf(from);
    const b = centerOf(to);
    const edgeEl = createSvg("path", {
      class: `edge${edge.id === selectedEdgeId ? " selected" : ""}`,
      d: edgePath(from, to, edge),
      "data-edge-id": edge.id,
    });
    edgeEl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      selectedEdgeId = edge.id;
      selectedNodeId = null;
      selectedNodeIds = new Set();
      syncProperties();
      render();
    });
    edgeLayer.appendChild(edgeEl);
    if (edge.id === selectedEdgeId) renderEdgeAnchors(edge, from, to);
  });

  state.nodes.forEach((node) => {
    const size = getNodeSize(node);
    const group = createSvg("g", { class: `node${selectedNodeIds.has(node.id) ? " selected" : ""}`, "data-node-id": node.id });
    group.appendChild(shapeElement(node));
    const hasOwner = node.owner && node.shape !== "text";
    addWrappedText(group, node.text, node.x + size.w / 2, node.y + size.h / 2 - (hasOwner ? 12 : 0), nodeTextMaxChars(node), "label", { maxLines: nodeMaxTextLines(), fontSize: node.shape === "text" ? 20 : 22 });
    if (hasOwner) {
      group.appendChild(createSvg("text", {
        class: "owner",
        x: node.x + size.w / 2,
        y: node.y + size.h - 18,
        "text-anchor": "middle",
      })).textContent = node.owner;
    }
    group.addEventListener("pointerdown", nodePointerDown);
    nodeLayer.appendChild(group);
  });
}

function getPoint(event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function nodePointerDown(event) {
  const id = event.currentTarget.dataset.nodeId;
  if (connectMode) {
    handleConnectClick(id);
    return;
  }
  const node = state.nodes.find((item) => item.id === id);
  const point = getPoint(event);
  if (event.shiftKey || event.ctrlKey) {
    if (selectedNodeIds.has(id)) {
      selectedNodeIds.delete(id);
    } else {
      selectedNodeIds.add(id);
    }
    selectedNodeId = id;
    selectedEdgeId = null;
  } else if (!selectedNodeIds.has(id)) {
    setSelectedNodes([id], id);
  } else {
    selectedNodeId = id;
    selectedEdgeId = null;
  }
  drag = {
    id,
    nodes: selectedNodes().map((item) => ({ id: item.id, x: item.x, y: item.y })),
    dx: point.x - node.x,
    dy: point.y - node.y,
  };
  svg.setPointerCapture(event.pointerId);
  syncProperties();
  render();
}

function handleConnectClick(id) {
  if (!connectFrom) {
    connectFrom = id;
    selectedNodeId = id;
    setStatus("Selecciona la figura destino");
    render();
    return;
  }
  if (connectFrom !== id) {
    state.edges.push({ id: uid("edge"), from: connectFrom, to: id });
    save();
  }
  connectFrom = null;
  connectMode = false;
  document.getElementById("connectBtn").classList.remove("ghost");
  setStatus("Conexion creada");
  render();
}

function syncProperties() {
  const node = state.nodes.find((item) => item.id === selectedNodeId);
  const multiple = selectedNodeIds.size > 1;
  nodeText.disabled = !node || multiple;
  nodeOwner.disabled = !node || multiple;
  nodeShape.disabled = !node || multiple;
  nodeWidth.disabled = !node || multiple;
  nodeText.value = node && !multiple ? node.text : "";
  nodeOwner.value = node && !multiple ? node.owner || "" : "";
  nodeShape.value = node && !multiple ? node.shape : "process";
  nodeWidth.value = node && !multiple ? Math.round(getNodeSize(node).w) : "";
}

function copySelection() {
  const nodes = selectedNodes();
  if (!nodes.length) {
    setStatus("Selecciona figuras para copiar");
    return false;
  }
  const selectedIds = new Set(nodes.map((node) => node.id));
  internalClipboard = {
    nodes: nodes.map((node) => ({ ...node })),
    edges: state.edges.filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to)).map((edge) => ({ ...edge })),
  };
  setStatus(`${nodes.length} figura(s) copiadas`);
  return true;
}

function pasteSelection() {
  if (!internalClipboard || !internalClipboard.nodes.length) {
    setStatus("No hay figuras copiadas");
    return;
  }
  const idMap = new Map();
  const pastedNodes = internalClipboard.nodes.map((node) => {
    const id = uid("node");
    const size = getNodeSize(node);
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      x: clamp(node.x + 80, 20, workspace.w - size.w - 20),
      y: clamp(node.y + 80, 20, workspace.h - size.h - 20),
    };
  });
  const pastedEdges = internalClipboard.edges.map((edge) => ({ id: uid("edge"), from: idMap.get(edge.from), to: idMap.get(edge.to) }));
  state.nodes.push(...pastedNodes);
  state.edges.push(...pastedEdges);
  internalClipboard = {
    nodes: pastedNodes.map((node) => ({ ...node })),
    edges: pastedEdges.map((edge) => ({ ...edge })),
  };
  setSelectedNodes(pastedNodes.map((node) => node.id));
  save();
  syncProperties();
  render();
  setStatus("Pegado en el diagrama");
}

function duplicateSelection() {
  if (copySelection()) pasteSelection();
}

function selectionBounds(nodes) {
  return nodes.reduce((box, node) => {
    const bounds = nodeBounds(node);
    return {
      minX: Math.min(box.minX, bounds.x),
      minY: Math.min(box.minY, bounds.y),
      maxX: Math.max(box.maxX, bounds.x + bounds.w),
      maxY: Math.max(box.maxY, bounds.y + bounds.h),
    };
  }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function svgForSelection() {
  const nodes = selectedNodeIds.size ? selectedNodes() : [...state.nodes];
  if (!nodes.length) return null;
  const selectedIds = new Set(nodes.map((node) => node.id));
  const edges = state.edges.filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to));
  const bounds = selectionBounds(nodes);
  const padding = 80;
  const includeHeader = state.header?.enabled && !selectedNodeIds.size;
  const minX = includeHeader ? 0 : Math.max(0, bounds.minX - padding);
  const minY = includeHeader ? 0 : Math.max(0, bounds.minY - padding);
  const maxX = includeHeader ? Math.max(bounds.maxX + padding, headerLayout.x + headerLayout.w + 20) : bounds.maxX + padding;
  const maxY = includeHeader ? Math.max(bounds.maxY + padding, headerReservedHeight()) : bounds.maxY + padding;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  const copySvg = createSvg("svg", { xmlns: NS, viewBox: `${minX} ${minY} ${width} ${height}`, width, height });
  copySvg.appendChild(createSvg("style")).textContent = ".node-shape{stroke:var(--node-stroke,#0f766e);stroke-width:3}.node-shape-detail{stroke:var(--node-stroke,#0f766e);stroke-width:3}.text-box-shape{opacity:0;stroke:transparent;filter:none}.doc-header-box{fill:rgba(255,255,255,.94);stroke:#334155;stroke-width:2}.doc-header-line{stroke:#334155;stroke-width:2}.doc-header-company{fill:#111827;font:900 34px Arial,sans-serif}.doc-header-document{fill:#111827;font:500 28px Arial,sans-serif}.doc-header-logo{fill:#111827;font:900 25px Arial,sans-serif}.doc-header-info{fill:#111827;font:700 24px Arial,sans-serif}.doc-header-period{fill:#334155}.doc-header-period-text{fill:#fff;font:900 24px Arial,sans-serif;letter-spacing:.18em}.lane-bg{fill:rgba(15,118,110,.06)}.lane-bg-1{fill:rgba(15,118,110,.025)}.lane-line{stroke:rgba(15,118,110,.24);stroke-width:2}.lane-label{fill:rgba(16,32,29,.52);font:800 30px Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}.edge{fill:none;marker-end:url(#arrow);stroke:#334155;stroke-width:4}.label{fill:#10201d;font:800 24px Arial,sans-serif}.owner{fill:#64748b;font:700 20px Arial,sans-serif}";
  copySvg.appendChild(svg.querySelector("defs").cloneNode(true));
  copySvg.appendChild(createSvg("rect", { x: minX, y: minY, width, height, fill: "#ffffff" }));
  if (includeHeader) {
    const copyHeader = createSvg("g");
    renderHeader(copyHeader);
    copySvg.appendChild(copyHeader);
  }
  const copyLanes = createSvg("g");
  renderLanes(copyLanes, { x: minX, y: minY, w: width, h: height });
  copySvg.appendChild(copyLanes);
  const copyEdges = createSvg("g");
  const copyNodes = createSvg("g");
  edges.forEach((edge) => {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) return;
    copyEdges.appendChild(createSvg("path", { class: "edge", d: edgePath(from, to, edge) }));
  });
  nodes.forEach((node) => {
    const size = getNodeSize(node);
    const group = createSvg("g", { class: "node" });
    group.appendChild(shapeElement(node));
    const hasOwner = node.owner && node.shape !== "text";
    addWrappedText(group, node.text, node.x + size.w / 2, node.y + size.h / 2 - (hasOwner ? 12 : 0), nodeTextMaxChars(node), "label", { maxLines: nodeMaxTextLines(), fontSize: node.shape === "text" ? 20 : 22 });
    if (hasOwner) {
      group.appendChild(createSvg("text", { class: "owner", x: node.x + size.w / 2, y: node.y + size.h - 18, "text-anchor": "middle" })).textContent = node.owner;
    }
    copyNodes.appendChild(group);
  });
  copySvg.appendChild(copyEdges);
  copySvg.appendChild(copyNodes);
  return { text: new XMLSerializer().serializeToString(copySvg), width, height };
}

function exportSvgStyleText() {
  return ".node-shape{stroke:var(--node-stroke,#0f766e);stroke-width:3;filter:url(#shadow)}.node-shape-detail{stroke:var(--node-stroke,#0f766e);stroke-width:3}.text-box-shape{opacity:0;stroke:transparent;filter:none}.doc-header-box{fill:rgba(255,255,255,.94);stroke:#334155;stroke-width:2}.doc-header-line{stroke:#334155;stroke-width:2}.doc-header-company{fill:#111827;font:900 34px Arial,sans-serif}.doc-header-document{fill:#111827;font:500 28px Arial,sans-serif}.doc-header-logo{fill:#111827;font:900 25px Arial,sans-serif}.doc-header-info{fill:#111827;font:700 24px Arial,sans-serif}.doc-header-period{fill:#334155}.doc-header-period-text{fill:#fff;font:900 24px Arial,sans-serif;letter-spacing:.18em}.lane-bg{fill:rgba(15,118,110,.06)}.lane-bg-1{fill:rgba(15,118,110,.025)}.lane-line{stroke:rgba(15,118,110,.24);stroke-width:2}.lane-label{fill:rgba(16,32,29,.52);font:800 30px Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}.edge{fill:none;marker-end:url(#arrow);stroke:#334155;stroke-linecap:round;stroke-linejoin:round;stroke-width:4}.label{fill:#10201d;font-weight:800}.owner{fill:#64748b;font:700 18px Arial,sans-serif}.watermark{fill:rgba(16,32,29,.18);font:800 28px Arial,sans-serif;letter-spacing:.02em}";
}

function laneRangeForBounds(bounds, axis) {
  ensureLanes();
  const starts = laneStarts();
  const sizes = state.lanes.sizes;
  const minValue = axis === "x" ? bounds.minX : bounds.minY;
  const maxValue = axis === "x" ? bounds.maxX : bounds.maxY;
  let first = 0;
  let last = sizes.length - 1;
  starts.forEach((start, index) => {
    const end = start + sizes[index];
    if (minValue >= start && minValue <= end) first = index;
    if (maxValue >= start && maxValue <= end) last = index;
  });
  return { start: starts[first], end: starts[last] + sizes[last] };
}

function fullDiagramBounds() {
  if (!state.nodes.length) return { x: view.x, y: view.y, w: view.w, h: view.h };
  ensureLanes();
  const bounds = selectionBounds(state.nodes);
  const padding = 140;
  const includeHeader = Boolean(state.header?.enabled);
  const verticalLanes = Boolean(state.lanes?.enabled && state.lanes.orientation === "vertical");
  const horizontalLanes = Boolean(state.lanes?.enabled && state.lanes.orientation === "horizontal");

  let minX = Math.max(0, bounds.minX - padding);
  let minY = Math.max(0, bounds.minY - padding);
  let maxX = Math.min(workspace.w, bounds.maxX + padding);
  let maxY = Math.min(workspace.h, bounds.maxY + padding);

  if (includeHeader) {
    minX = 0;
    minY = 0;
    maxX = Math.max(maxX, headerLayout.x + headerLayout.w + 20);
    maxY = Math.max(maxY, headerReservedHeight());
  }

  if (verticalLanes) {
    const laneRange = laneRangeForBounds(bounds, "x");
    minX = includeHeader ? 0 : Math.max(0, laneRange.start - 40);
    maxX = Math.min(workspace.w, Math.max(maxX, laneRange.end + 40));
  }

  if (horizontalLanes) {
    const laneRange = laneRangeForBounds(bounds, "y");
    minY = includeHeader ? 0 : Math.max(0, headerReservedHeight() + laneRange.start - 40);
    maxY = Math.min(workspace.h, Math.max(maxY, headerReservedHeight() + laneRange.end + 40));
  }

  return { x: minX, y: minY, w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
}

function svgForFullDiagram() {
  const box = fullDiagramBounds();
  const clone = svg.cloneNode(true);
  clone.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  clone.querySelectorAll(".lane-resize-handle").forEach((el) => el.remove());
  clone.setAttribute("xmlns", NS);
  clone.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
  clone.setAttribute("width", box.w);
  clone.setAttribute("height", box.h);
  clone.insertBefore(createSvg("rect", { x: box.x, y: box.y, width: box.w, height: box.h, fill: "#eef6f4" }), clone.firstChild);
  clone.insertBefore(createSvg("style"), clone.firstChild).textContent = exportSvgStyleText();
  return {
    text: new XMLSerializer().serializeToString(clone),
    width: box.w,
    height: box.h,
  };
}
function svgToJpegDataUrl(svgText, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    image.onload = () => {
      const maxSide = 5200;
      const maxPixels = 14000000;
      const scale = Math.min(1.6, maxSide / width, maxSide / height, Math.sqrt(maxPixels / (width * height)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#eef6f4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.96));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo renderizar SVG"));
    };
    image.src = url;
  });
}
function svgToPngBlob(svgText, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo crear PNG"));
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo renderizar SVG"));
    };
    image.src = url;
  });
}

async function copyImageToClipboard() {
  const svgData = svgForSelection();
  if (!svgData) {
    setStatus("No hay figuras para copiar");
    return;
  }
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("Portapapeles de imagen no disponible");
    const pngBlob = await svgToPngBlob(svgData.text, svgData.width, svgData.height);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    setStatus("PNG copiado: pegalo en Excel o PowerPoint");
  } catch {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(svgData.text);
      setStatus("El navegador bloqueo PNG; copie SVG como texto");
    } else {
      setStatus("El navegador no permitio copiar imagen");
    }
  }
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeRasterLogo(dataUrl, maxW = 700, maxH = 260) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxW / image.width, maxH / image.height);
      if (scale === 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function loadHeaderLogo(file, side) {
  if (!file) return;
  ensureHeader();
  try {
    let dataUrl = await readFileAsDataUrl(file);
    if (file.type !== "image/svg+xml") dataUrl = await resizeRasterLogo(dataUrl);
    state.header[side === "left" ? "leftLogoImage" : "rightLogoImage"] = dataUrl;
    state.header.enabled = true;
    makeRoomForHeader();
    syncHeaderControls();
    save();
    render();
    setStatus(`Logo ${side === "left" ? "izquierdo" : "derecho"} cargado`);
  } catch {
    setStatus("No se pudo cargar el logo");
  }
}

function addNode(shape, x = 680, y = 360, text = "Nueva actividad", owner = "") {
  const nodeTextValue = shape === "text" && text === "Nueva actividad" ? "Texto" : text;
  const node = { id: uid("node"), shape, x, y, text: nodeTextValue, owner };
  state.nodes.push(node);
  setSelectedNodes([node.id], node.id);
  syncProperties();
  save();
  render();
}

function stateSnapshotText() {
  return JSON.stringify(state);
}

function rememberState(currentSnapshot) {
  if (historyPaused || !lastStateSnapshot || currentSnapshot === lastStateSnapshot) return;
  undoStack.push(lastStateSnapshot);
  if (undoStack.length > 80) undoStack.shift();
}

function resetUndoHistory() {
  undoStack = [];
  lastStateSnapshot = stateSnapshotText();
}

function undoLastChange() {
  const previous = undoStack.pop();
  if (!previous) {
    setStatus("No hay cambios para deshacer");
    return;
  }
  historyPaused = true;
  state = JSON.parse(previous);
  ensureHeader();
  ensureLanes();
  ensureTheme();
  clearSelection();
  titleInput.value = state.title || "Diagrama sin titulo";
  localStorage.setItem(storeKey, previous);
  lastStateSnapshot = previous;
  syncHeaderControls();
  syncLaneControls();
  syncProperties();
  render();
  historyPaused = false;
  setStatus("Cambio deshecho");
}

function save() {
  state.title = titleInput.value || "Diagrama sin titulo";
  const currentSnapshot = stateSnapshotText();
  rememberState(currentSnapshot);
  lastStateSnapshot = currentSnapshot;
  localStorage.setItem(storeKey, currentSnapshot);
}

function diagramSnapshot() {
  save();
  return JSON.parse(JSON.stringify(state));
}

function applyDiagramData(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error("Registro invalido");
  state = data;
  ensureHeader();
  ensureLanes();
  ensureTheme();
  clearSelection();
  titleInput.value = state.title || "Diagrama sin titulo";
  historyPaused = true;
  save();
  historyPaused = false;
  resetUndoHistory();
  syncHeaderControls();
  syncLaneControls();
  syncProperties();
  render();
}

async function firebaseTools() {
  if (window.flujosFirebase) return window.flujosFirebase;
  await new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 3500);
    window.addEventListener("flujos:firebase-ready", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
  if (!window.flujosFirebase) throw new Error("Firebase no disponible");
  return window.flujosFirebase;
}

function recordPayload(name) {
  const diagram = diagramSnapshot();
  return {
    name: name || diagram.title || "Diagrama sin titulo",
    title: diagram.title || "Diagrama sin titulo",
    diagram,
    appVersion,
  };
}

async function saveRecordAs() {
  if (!requireSession()) return;
  try {
    const tools = await firebaseTools();
    const name = window.prompt("Nombre del registro", titleInput.value || state.title || "Nuevo diagrama");
    if (!name) return;
    const version = 1;
    const payload = recordPayload(name.trim());
    const ref = await tools.addDoc(tools.collection(tools.db, cloudCollection), {
      ...payload,
      recordVersion: version,
      createdBy: sessionUser,
      updatedBy: sessionUser,
      revisionHistory: [revisionEntry(version, "crear")],
      createdAt: tools.serverTimestamp(),
      updatedAt: tools.serverTimestamp(),
    });
    currentRecordId = ref.id;
    localStorage.setItem(currentRecordKey, currentRecordId);
    setStatus(`Registro guardado por ${sessionUser} (v${version})`);
  } catch {
    setStatus("No se pudo guardar en Firebase");
  }
}

async function saveRecordChanges() {
  if (!requireSession()) return;
  if (!currentRecordId) {
    await saveRecordAs();
    return;
  }
  try {
    const tools = await firebaseTools();
    const ref = tools.doc(tools.db, cloudCollection, currentRecordId);
    const currentSnap = await tools.getDoc(ref);
    const currentData = currentSnap.exists() ? currentSnap.data() : {};
    const previousHistory = Array.isArray(currentData.revisionHistory) ? currentData.revisionHistory : [];
    const version = Number(currentData.recordVersion || 0) + 1;
    await tools.setDoc(ref, {
      ...recordPayload(titleInput.value || state.title),
      recordVersion: version,
      createdBy: currentData.createdBy || sessionUser,
      updatedBy: sessionUser,
      revisionHistory: [...previousHistory, revisionEntry(version, "actualizar")],
      updatedAt: tools.serverTimestamp(),
    }, { merge: true });
    setStatus(`Cambios guardados por ${sessionUser} (v${version})`);
  } catch {
    setStatus("No se pudieron guardar los cambios");
  }
}

async function openCloudRecord() {
  try {
    const tools = await firebaseTools();

    const recordsQuery = tools.query(
      tools.collection(tools.db, cloudCollection),
      tools.orderBy("updatedAt", "desc")
    );

    const snapshot = await tools.getDocs(recordsQuery);
    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (!records.length) {
      setStatus("No hay registros");
      return;
    }

    // llenar select
    const select = document.getElementById("recordsSelect");
    select.innerHTML = "";

    records.forEach(record => {
      const option = document.createElement("option");
      option.value = record.id;
      option.textContent = `${record.name || record.title || "Sin titulo"} | v${record.recordVersion || 1} | ${record.updatedBy || record.createdBy || "Sin usuario"}`;
      select.appendChild(option);
    });

    // guardar temporal
    window._recordsCache = records;

    // abrir modal
    document.getElementById("openModal").classList.remove("hidden");

  } catch (err) {
    console.error(err);
    setStatus("Error al cargar registros");
  }
}

function load() {
  const raw = localStorage.getItem(storeKey);
  if (raw) {
    try {
      state = JSON.parse(raw);
      ensureHeader();
      ensureLanes();
      ensureTheme();
      return;
    } catch {
      localStorage.removeItem(storeKey);
    }
  }
  loadDefault();
}

function loadDefault() {
  state = {
    title: "Proceso del SGI",
    header: defaultHeader(),
    lanes: { enabled: false, orientation: "horizontal", names: ["Direccion", "Calidad", "Produccion"] },
    theme: "sgi",
    nodes: [
      { id: "node-start", shape: "terminator", x: 130, y: 170, text: "Inicio", owner: "Solicitante" },
      { id: "node-review", shape: "process", x: 440, y: 160, text: "Revisar solicitud o entrada", owner: "Responsable" },
      { id: "node-decision", shape: "decision", x: 790, y: 140, text: "Cumple requisitos?", owner: "Calidad" },
      { id: "node-record", shape: "document", x: 1130, y: 160, text: "Registrar evidencia", owner: "SGI" },
      { id: "node-end", shape: "terminator", x: 1138, y: 390, text: "Fin", owner: "Proceso" },
    ],
    edges: [
      { id: "edge-1", from: "node-start", to: "node-review" },
      { id: "edge-2", from: "node-review", to: "node-decision" },
      { id: "edge-3", from: "node-decision", to: "node-record" },
      { id: "edge-4", from: "node-record", to: "node-end" },
    ],
  };
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportSvg() {
  save();
  const clone = svg.cloneNode(true);
  clone.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  clone.setAttribute("xmlns", NS);
  clone.setAttribute("viewBox", `0 0 ${workspace.w} ${workspace.h}`);
  if (!state.header?.enabled) {
    const header = `<text x="40" y="58" font-size="34" font-weight="800" fill="#10201d">${escapeXml(state.title)}</text>`;
    clone.insertAdjacentHTML("afterbegin", header);
  }
  download(`${safeName(state.title)}.svg`, clone.outerHTML, "image/svg+xml");
}


function safeName(name) {
  return String(name || "diagrama").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagrama";
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]));
}

function templateAudit() {
  state = {
    title: "Auditoria interna",
    nodes: [
      { id: uid("node"), shape: "terminator", x: 120, y: 210, text: "Programar auditoria", owner: "Calidad" },
      { id: uid("node"), shape: "process", x: 420, y: 200, text: "Preparar plan y lista de verificacion", owner: "Auditor" },
      { id: uid("node"), shape: "process", x: 760, y: 200, text: "Ejecutar auditoria", owner: "Auditor" },
      { id: uid("node"), shape: "decision", x: 1090, y: 180, text: "Hay hallazgos?", owner: "Auditor" },
      { id: uid("node"), shape: "document", x: 1060, y: 430, text: "Emitir informe y acciones", owner: "Calidad" },
    ],
    edges: [],
    theme: state.theme || "sgi",
  };
  state.edges = state.nodes.slice(0, -1).map((node, index) => ({ id: uid("edge"), from: node.id, to: state.nodes[index + 1].id }));
  clearSelection();
  save();
  syncProperties();
  render();
}

function templateNc() {
  state = {
    title: "Gestion de no conformidad",
    nodes: [
      { id: uid("node"), shape: "terminator", x: 100, y: 180, text: "Detectar no conformidad", owner: "Usuario" },
      { id: uid("node"), shape: "document", x: 390, y: 170, text: "Registrar NC", owner: "Calidad" },
      { id: uid("node"), shape: "decision", x: 720, y: 145, text: "Requiere accion correctiva?", owner: "Responsable" },
      { id: uid("node"), shape: "process", x: 1060, y: 170, text: "Definir accion y responsable", owner: "Proceso" },
      { id: uid("node"), shape: "process", x: 1060, y: 410, text: "Verificar eficacia", owner: "Calidad" },
      { id: uid("node"), shape: "terminator", x: 720, y: 430, text: "Cerrar NC", owner: "SGI" },
    ],
    edges: [],
    theme: state.theme || "sgi",
  };
  state.edges = [
    { id: uid("edge"), from: state.nodes[0].id, to: state.nodes[1].id },
    { id: uid("edge"), from: state.nodes[1].id, to: state.nodes[2].id },
    { id: uid("edge"), from: state.nodes[2].id, to: state.nodes[3].id },
    { id: uid("edge"), from: state.nodes[3].id, to: state.nodes[4].id },
    { id: uid("edge"), from: state.nodes[4].id, to: state.nodes[5].id },
  ];
  clearSelection();
  save();
  syncProperties();
  render();
}

document.querySelectorAll(".shape-tool").forEach((button) => {
  button.addEventListener("click", () => addNode(button.dataset.shape));
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.command)?.click();
  });
});

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => setDiagramTheme(button.dataset.theme));
});

document.getElementById("connectBtn").addEventListener("click", (event) => {
  connectMode = !connectMode;
  connectFrom = null;
  event.currentTarget.classList.toggle("ghost", !connectMode);
  setStatus(connectMode ? "Selecciona la figura origen" : "Conexion cancelada");
});

function deleteSelection() {
  if (selectedNodeIds.size) {
    state.nodes = state.nodes.filter((node) => !selectedNodeIds.has(node.id));
    state.edges = state.edges.filter((edge) => !selectedNodeIds.has(edge.from) && !selectedNodeIds.has(edge.to));
    clearSelection();
  } else if (selectedEdgeId) {
    state.edges = state.edges.filter((edge) => edge.id !== selectedEdgeId);
    selectedEdgeId = null;
  } else {
    setStatus("Selecciona algo para eliminar");
    return;
  }
  save();
  syncProperties();
  render();
}

document.getElementById("deleteBtn").addEventListener("click", deleteSelection);

function newDiagram() {
  currentRecordId = "";
  localStorage.removeItem(currentRecordKey);
  state = { title: "Nuevo diagrama", nodes: [], edges: [], header: defaultHeader(), lanes: { enabled: false, orientation: "horizontal", names: ["Direccion", "Calidad", "Produccion"] }, theme: "sgi" };
  clearSelection();
  titleInput.value = state.title;
  save();
  syncHeaderControls();
  syncLaneControls();
  syncProperties();
  render();
  setStatus("Nuevo diagrama listo");
}

document.getElementById("clearBtn").addEventListener("click", newDiagram);
document.getElementById("newDiagramBtn").addEventListener("click", newDiagram);

document.getElementById("auditTemplateBtn").addEventListener("click", templateAudit);
document.getElementById("ncTemplateBtn").addEventListener("click", templateNc);
document.getElementById("openRecordBtn").addEventListener("click", openCloudRecord);
document.getElementById("saveAsBtn").addEventListener("click", saveRecordAs);
document.getElementById("saveBtn").addEventListener("click", saveRecordChanges);
document.getElementById("selectAreaBtn").addEventListener("click", (event) => {
  selectMode = !selectMode;
  event.currentTarget.classList.toggle("active", selectMode);
  setStatus(selectMode ? "Arrastra un recuadro en el lienzo" : "Seleccion por area desactivada");
});
document.getElementById("copyBtn").addEventListener("click", copySelection);
document.getElementById("pasteBtn").addEventListener("click", pasteSelection);
document.getElementById("duplicateBtn").addEventListener("click", duplicateSelection);
document.getElementById("copyImageBtn").addEventListener("click", copyImageToClipboard);
headerLeftLogoInput.addEventListener("change", (event) => {
  loadHeaderLogo(event.target.files[0], "left");
  event.target.value = "";
});
headerRightLogoInput.addEventListener("change", (event) => {
  loadHeaderLogo(event.target.files[0], "right");
  event.target.value = "";
});
const headerInputs = [
  [headerEnabledInput, "enabled", "checked"],
  [headerCompanyInput, "company", "value"],
  [headerDocumentInput, "document", "value"],
  [headerResponsibleInput, "responsible", "value"],
  [headerCodeInput, "code", "value"],
  [headerDateInput, "date", "value"],
  [headerVersionInput, "version", "value"],
  [headerPeriodInput, "period", "value"],
];
headerInputs.forEach(([input, key, prop]) => {
  input.addEventListener(prop === "checked" ? "change" : "input", () => {
    ensureHeader();
    const wasEnabled = Boolean(state.header.enabled);
    state.header[key] = input[prop];
    if (key === "enabled" && !wasEnabled && state.header.enabled) makeRoomForHeader();
    save();
    render();
  });
});
lanesEnabledInput.addEventListener("change", () => {
  ensureLanes();
  state.lanes.enabled = lanesEnabledInput.checked;
  save();
  render();
});
laneNamesInput.addEventListener("input", () => {
  ensureLanes();
  state.lanes.names = laneNamesInput.value.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (!state.lanes.names.length) state.lanes.names = ["Calle 1"];
  state.lanes.sizes = [];
  ensureLanes();
  save();
  render();
});
lanesHorizontalBtn.addEventListener("click", () => {
  ensureLanes();
  if (state.lanes.orientation !== "horizontal") state.lanes.sizes = [];
  state.lanes.orientation = "horizontal";
  state.lanes.enabled = true;
  normalizeLaneSizes();
  syncLaneControls();
  save();
  render();
});
lanesVerticalBtn.addEventListener("click", () => {
  ensureLanes();
  if (state.lanes.orientation !== "vertical") state.lanes.sizes = [];
  state.lanes.orientation = "vertical";
  state.lanes.enabled = true;
  normalizeLaneSizes();
  syncLaneControls();
  save();
  render();
});
document.getElementById("addLaneBtn").addEventListener("click", () => {
  ensureLanes();
  state.lanes.names.push(`Calle ${state.lanes.names.length + 1}`);
  state.lanes.sizes = [];
  state.lanes.enabled = true;
  ensureLanes();
  syncLaneControls();
  save();
  render();
});
document.getElementById("removeLaneBtn").addEventListener("click", () => {
  ensureLanes();
  if (state.lanes.names.length > 1) {
    state.lanes.names.pop();
    state.lanes.sizes = [];
  }
  ensureLanes();
  syncLaneControls();
  save();
  render();
});
titleInput.addEventListener("input", save);

nodeText.addEventListener("input", () => {
  const node = state.nodes.find((item) => item.id === selectedNodeId);
  if (node) {
    node.text = nodeText.value;
    save();
    render();
  }
});
nodeOwner.addEventListener("input", () => {
  const node = state.nodes.find((item) => item.id === selectedNodeId);
  if (node) {
    node.owner = nodeOwner.value;
    save();
    render();
  }
});
nodeShape.addEventListener("change", () => {
  const node = state.nodes.find((item) => item.id === selectedNodeId);
  if (node) {
    node.shape = nodeShape.value;
    if (node.shape === "text") node.owner = "";
    save();
    syncProperties();
    render();
  }
});

nodeWidth.addEventListener("input", () => {
  const node = state.nodes.find((item) => item.id === selectedNodeId);
  if (node) {
    const width = Number(nodeWidth.value);
    if (!Number.isFinite(width)) return;
    node.w = clamp(width, 120, 1200);
    save();
    render();
  }
});


svg.addEventListener("pointermove", (event) => {
  if (laneResize) {
    const point = getPoint(event);
    const delta = laneResize.orientation === "vertical" ? point.x - laneResize.startPoint.x : point.y - laneResize.startPoint.y;
    const prevIndex = laneResize.index - 1;
    const nextIndex = laneResize.index;
    const minSize = 140;
    const pairTotal = laneResize.sizes[prevIndex] + laneResize.sizes[nextIndex];
    const prevSize = clamp(laneResize.sizes[prevIndex] + delta, minSize, pairTotal - minSize);
    state.lanes.sizes[prevIndex] = prevSize;
    state.lanes.sizes[nextIndex] = pairTotal - prevSize;
    render();
    return;
  }
  if (selectBox) {
    selectBox.end = getPoint(event);
    render();
    return;
  }
  if (pan) {
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - pan.clientX) / rect.width) * pan.viewW;
    const dy = ((event.clientY - pan.clientY) / rect.height) * pan.viewH;
    setViewBox({
      x: pan.viewX - dx,
      y: pan.viewY - dy,
      w: pan.viewW,
      h: pan.viewH,
    });
    return;
  }
  if (!drag) return;
  const point = getPoint(event);
  const anchor = state.nodes.find((item) => item.id === drag.id);
  if (!anchor) return;
  const targetX = point.x - drag.dx;
  const targetY = point.y - drag.dy;
  const deltaX = targetX - drag.nodes.find((item) => item.id === drag.id).x;
  const deltaY = targetY - drag.nodes.find((item) => item.id === drag.id).y;
  drag.nodes.forEach((start) => {
    const node = state.nodes.find((item) => item.id === start.id);
    if (!node) return;
    const size = getNodeSize(node);
    node.x = clamp(start.x + deltaX, 20, workspace.w - size.w - 20);
    node.y = clamp(start.y + deltaY, 20, workspace.h - size.h - 20);
  });
  render();
});

function endPointerAction() {
  if (laneResize) {
    normalizeLaneSizes();
    save();
    laneResize = null;
    setStatus("Tamano de calle actualizado");
    return;
  }
  if (selectBox) {
    const box = normalizeBox(selectBox.start, selectBox.end);
    const ids = state.nodes.filter((node) => rectsIntersect(nodeBounds(node), box)).map((node) => node.id);
    setSelectedNodes(ids);
    selectBox = null;
    selectMode = false;
    document.getElementById("selectAreaBtn").classList.remove("active");
    syncProperties();
    render();
    setStatus(ids.length ? `${ids.length} figura(s) seleccionadas` : "Sin figuras seleccionadas");
    return;
  }
  if (drag) {
    save();
    drag = null;
  }
  pan = null;
}

async function exportToPDF() {
  const svgData = svgForFullDiagram();

  try {
    const jpegDataUrl = await svgToJpegDataUrl(svgData.text, svgData.width, svgData.height);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      unit: "px",
      format: [svgData.width, svgData.height],
      hotfixes: ["px_scaling"],
      compress: true,
    });

    pdf.addImage(jpegDataUrl, "JPEG", 0, 0, svgData.width, svgData.height);
    pdf.save(`${safeName(state.title)}.pdf`);
    setStatus("PDF exportado completo");
  } catch (error) {
    console.error(error);
    setStatus("Error al generar PDF");
  }
}

svg.addEventListener("pointerup", endPointerAction);
svg.addEventListener("pointercancel", endPointerAction);

function isCanvasBackgroundTarget(target) {
  return target === svg || target === gridLayer || target.parentNode === gridLayer || target === laneLayer || target.parentNode === laneLayer;
}

svg.addEventListener("pointerdown", (event) => {
  if (isCanvasBackgroundTarget(event.target)) {
    if (selectMode) {
      const point = getPoint(event);
      selectBox = { start: point, end: point };
      svg.setPointerCapture(event.pointerId);
      render();
      return;
    }
    clearSelection();
    pan = { clientX: event.clientX, clientY: event.clientY, viewX: view.x, viewY: view.y, viewW: view.w, viewH: view.h };
    svg.setPointerCapture(event.pointerId);
    syncProperties();
    render();
  }
});

svg.addEventListener("wheel", (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  zoomAt(event.deltaY > 0 ? 0.88 : 1.12, getPoint(event));
}, { passive: false });

document.getElementById("zoomOutBtn").addEventListener("click", () => zoomAt(0.85));
document.getElementById("zoomInBtn").addEventListener("click", () => zoomAt(1.18));
document.getElementById("zoomResetBtn").addEventListener("click", resetZoom);
document.getElementById("zoomFitBtn").addEventListener("click", fitToDiagram);
document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);
userSelect?.addEventListener("change", () => setSessionUser(userSelect.value));
document.addEventListener("fullscreenchange", updateFullscreenButton);

function runShortcut(event, action) {
  event.preventDefault();
  action();
}

document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target.isContentEditable;
  if (isTyping) return;

  const key = event.key.toLowerCase();
  const commandKey = event.ctrlKey || event.metaKey;

  if (commandKey && key === "z") return runShortcut(event, undoLastChange);

  if (commandKey && event.shiftKey && key === "s") return runShortcut(event, saveRecordAs);
  if (commandKey && event.shiftKey && key === "c") return runShortcut(event, copyImageToClipboard);
  if (commandKey && event.shiftKey && key === "f") return runShortcut(event, toggleFullscreen);

  if (commandKey && key === "s") return runShortcut(event, saveRecordChanges);
  if (commandKey && key === "o") return runShortcut(event, openCloudRecord);
  if (commandKey && key === "n") return runShortcut(event, newDiagram);
  if (commandKey && key === "p") return runShortcut(event, exportToPDF);
  if (commandKey && key === "c") return runShortcut(event, copySelection);
  if (commandKey && key === "v") return runShortcut(event, pasteSelection);
  if (commandKey && key === "d") return runShortcut(event, duplicateSelection);
  if (commandKey && key === "e") return runShortcut(event, () => document.getElementById("selectAreaBtn").click());
  if (commandKey && key === "l") return runShortcut(event, () => document.getElementById("connectBtn").click());
  if (commandKey && key === "f") return runShortcut(event, fitToDiagram);
  if (commandKey && key === "0") return runShortcut(event, resetZoom);
  if (commandKey && (key === "+" || key === "=")) return runShortcut(event, () => zoomAt(1.18));
  if (commandKey && key === "-") return runShortcut(event, () => zoomAt(0.85));

  if (event.key === "Delete" || event.key === "Backspace") return runShortcut(event, deleteSelection);
  if (event.key === "Escape") return runShortcut(event, () => {
    connectMode = false;
    connectFrom = null;
    selectMode = false;
    document.getElementById("connectBtn").classList.add("ghost");
    document.getElementById("selectAreaBtn").classList.remove("active");
    setStatus("Modo cancelado");
    render();
  });
});



const closeModalBtn = document.getElementById("closeModalBtn");
const loadRecordBtn = document.getElementById("loadRecordBtn");
const openModalEl = document.getElementById("openModal");

if (closeModalBtn && openModalEl) {
  closeModalBtn.addEventListener("click", () => {
    openModalEl.classList.add("hidden");
  });
}

if (loadRecordBtn) {
  loadRecordBtn.addEventListener("click", () => {
    const select = document.getElementById("recordsSelect");
    const selectedId = select?.value;

    if (!selectedId) return;

    const record = (window._recordsCache || []).find((item) => item.id === selectedId);

    if (!record || !record.diagram) {
      setStatus("Registro invalido");
      return;
    }

    currentRecordId = record.id;
    localStorage.setItem(currentRecordKey, currentRecordId);

    applyDiagramData(record.diagram);

    openModalEl?.classList.add("hidden");

    setStatus("Registro cargado");
  });
}

document.getElementById("exportPdfBtn").addEventListener("click", exportToPDF);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => setStatus("Modo offline no disponible en archivo local"));
  });
}

if (appVersionBadge) appVersionBadge.textContent = `v${appVersion}`;
updateSessionUI();
drawGrid();
load();
ensureHeader();
ensureLanes();
ensureTheme();
resetUndoHistory();
syncHeaderControls();
syncLaneControls();
setViewBox(defaultView);
syncProperties();
render();





























