// 承重统一按「最大总重(maxGross) − 箱体自重(tare)」计算可装载净重(maxWeight)。
// 旧版本中 40 尺箱的承重被错误地设成高于 20 尺箱（28600 > 28200），
// 实际上 40 尺箱自重更大、净载重应低于 20 尺箱，此处按 ISO 通用值修正。
const containers = [
  {
    id: "20GP",
    name: "20GP 标准箱",
    length: 5898,
    width: 2352,
    height: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    tare: 2300,
    maxGross: 30480,
    maxWeight: 28180,
  },
  {
    id: "40GP",
    name: "40GP 标准箱",
    length: 12032,
    width: 2352,
    height: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    tare: 3750,
    maxGross: 30480,
    maxWeight: 26730,
  },
  {
    id: "40HQ",
    name: "40HQ 高柜",
    length: 12032,
    width: 2352,
    height: 2698,
    doorWidth: 2340,
    doorHeight: 2585,
    tare: 3940,
    maxGross: 30480,
    maxWeight: 26540,
  },
  {
    id: "45HQ",
    name: "45HQ 高柜",
    length: 13556,
    width: 2352,
    height: 2698,
    doorWidth: 2340,
    doorHeight: 2585,
    tare: 4820,
    maxGross: 32500,
    maxWeight: 27680,
  },
];

const colors = [
  "#E84368",
  "#007892",
  "#FF5D00",
  "#4DA0DA",
  "#6A3FB4",
  "#18A058",
  "#252F45",
  "#E31D1C",
  "#00A6A6",
  "#B46A00",
  "#D81B60",
  "#5E7CE2",
  "#7A4E00",
  "#00805F",
  "#A33FE8",
  "#5C6B73",
];

const STORAGE_KEY = "container-packer-project-v1";
const HEATMAP_COLUMNS = 48;
const HEATMAP_ROWS = 16;

const sampleCargo = [
  {
    name: "家电纸箱 A",
    length: 1200,
    width: 800,
    height: 900,
    weight: 95,
    quantity: 18,
    group: "上海",
    rotatable: true,
    tiltable: true,
    stackable: true,
    maxStackLayers: 4,
    priority: 3,
  },
  {
    name: "托盘货 B",
    length: 1100,
    width: 1000,
    height: 1200,
    weight: 380,
    quantity: 10,
    group: "上海",
    rotatable: true,
    tiltable: false,
    stackable: false,
    maxStackLayers: 1,
    priority: 3,
  },
  {
    name: "长条设备 C",
    length: 2400,
    width: 600,
    height: 700,
    weight: 210,
    quantity: 8,
    group: "宁波",
    rotatable: true,
    tiltable: true,
    stackable: true,
    maxStackLayers: 3,
    priority: 2,
  },
  {
    name: "配件箱 D",
    length: 600,
    width: 500,
    height: 450,
    weight: 35,
    quantity: 40,
    group: "宁波",
    rotatable: true,
    tiltable: true,
    stackable: true,
    maxStackLayers: 6,
    priority: 1,
  },
];

const state = {
  project: {
    name: "出口装箱任务",
    customer: "",
    operator: "",
    date: new Date().toISOString().slice(0, 10),
  },
  cargo: structuredClone(sampleCargo),
  selectedContainer: "40HQ",
  maxContainers: 1,
  activeContainerNo: 1,
  renderMode: "view3d",
  view3d: { yaw: -0.62, pitch: 0.52, zoom: 1, panX: 0, panY: 0 },
  layerPercent: 100,
  loadingStep: 0,
  showHeatmap: true,
  floorLoadLimit: 2500,
  selectedHeatZone: 0,
  selectedBoxKey: "",
  manualAdjustments: {},
  validation: [],
  strategy: {
    heavyFirst: true,
    respectStack: true,
    balanceWeight: true,
  },
  result: {
    packed: [],
    unpacked: [],
    metrics: {},
  },
};

const els = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  containerSelect: document.querySelector("#containerSelect"),
  maxContainers: document.querySelector("#maxContainers"),
  activeContainerSelect: document.querySelector("#activeContainerSelect"),
  containerSpecs: document.querySelector("#containerSpecs"),
  containerBadge: document.querySelector("#containerBadge"),
  cargoTable: document.querySelector("#cargoTable"),
  rowTemplate: document.querySelector("#cargoRowTemplate"),
  addCargoBtn: document.querySelector("#addCargoBtn"),
  packBtn: document.querySelector("#packBtn"),
  resetSampleBtn: document.querySelector("#resetSampleBtn"),
  canvas: document.querySelector("#packingCanvas"),
  layerRange: document.querySelector("#layerRange"),
  layerLabel: document.querySelector("#layerLabel"),
  loadingStepRange: document.querySelector("#loadingStepRange"),
  loadingStepLabel: document.querySelector("#loadingStepLabel"),
  showHeatmap: document.querySelector("#showHeatmap"),
  floorLoadLimit: document.querySelector("#floorLoadLimit"),
  boxSelect: document.querySelector("#boxSelect"),
  resetMovesBtn: document.querySelector("#resetMovesBtn"),
  moveButtons: document.querySelectorAll("[data-move]"),
  legend: document.querySelector("#legend"),
  volumeUse: document.querySelector("#volumeUse"),
  weightUse: document.querySelector("#weightUse"),
  packedCount: document.querySelector("#packedCount"),
  usedContainerCount: document.querySelector("#usedContainerCount"),
  unpackedBadge: document.querySelector("#unpackedBadge"),
  unpackedList: document.querySelector("#unpackedList"),
  metricList: document.querySelector("#metricList"),
  insightList: document.querySelector("#insightList"),
  heatmapList: document.querySelector("#heatmapList"),
  sequenceList: document.querySelector("#sequenceList"),
  sidebarStatus: document.querySelector("#sidebarStatus"),
  sidebarDetail: document.querySelector("#sidebarDetail"),
  statusDot: document.querySelector(".status-dot"),
  reportSummary: document.querySelector("#reportSummary"),
  reportText: document.querySelector("#reportText"),
  copyReportBtn: document.querySelector("#copyReportBtn"),
  downloadReportBtn: document.querySelector("#downloadReportBtn"),
  printReportBtn: document.querySelector("#printReportBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  exportProjectBtn: document.querySelector("#exportProjectBtn"),
  projectInput: document.querySelector("#projectInput"),
  csvInput: document.querySelector("#csvInput"),
  downloadTemplateBtn: document.querySelector("#downloadTemplateBtn"),
  projectName: document.querySelector("#projectName"),
  projectCustomer: document.querySelector("#projectCustomer"),
  projectOperator: document.querySelector("#projectOperator"),
  projectDate: document.querySelector("#projectDate"),
  validationBox: document.querySelector("#validationBox"),
  renderButtons: document.querySelectorAll("[data-render]"),
  heavyFirst: document.querySelector("#heavyFirst"),
  respectStack: document.querySelector("#respectStack"),
  balanceWeight: document.querySelector("#balanceWeight"),
};

function init() {
  loadSavedProject();
  renderContainerOptions();
  renderProjectFields();
  renderStrategyFields();
  renderCargoTable();
  bindEvents();
  setup3dInteraction();
  runPacking();
  registerServiceWorker();
}

function bindEvents() {
  els.navItems.forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view));
  });

  els.containerSelect.addEventListener("change", (event) => {
    state.selectedContainer = event.target.value;
    renderContainerSpecs();
    runPacking();
    saveProject();
  });

  els.maxContainers.addEventListener("change", () => {
    state.maxContainers = clamp(Number(els.maxContainers.value) || 1, 1, 20);
    els.maxContainers.value = state.maxContainers;
    runPacking();
    saveProject();
  });

  els.activeContainerSelect.addEventListener("change", () => {
    state.activeContainerNo = Number(els.activeContainerSelect.value) || 1;
    state.loadingStep = 0;
    state.selectedBoxKey = "";
    renderPlaybackControls();
    renderFloorLoadHeatmap();
    renderMoveControls();
    renderLegend();
    renderCanvas();
  });

  els.layerRange.addEventListener("input", () => {
    state.layerPercent = Number(els.layerRange.value) || 100;
    renderMoveControls();
    renderLegend();
    renderCanvas();
  });

  els.loadingStepRange.addEventListener("input", () => {
    state.loadingStep = Number(els.loadingStepRange.value) || 0;
    renderPlaybackControls();
    renderMoveControls();
    renderLegend();
    renderCanvas();
  });

  els.showHeatmap.addEventListener("change", () => {
    state.showHeatmap = els.showHeatmap.checked;
    renderFloorLoadHeatmap();
    renderCanvas();
    saveProject();
  });

  els.floorLoadLimit.addEventListener("change", () => {
    state.floorLoadLimit = clamp(Number(els.floorLoadLimit.value) || 2500, 100, 20000);
    els.floorLoadLimit.value = state.floorLoadLimit;
    renderInsights();
    renderFloorLoadHeatmap();
    renderCanvas();
    renderReport();
    saveProject();
  });

  els.heatmapList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-zone-index]");
    if (!button) return;
    state.selectedHeatZone = Number(button.dataset.zoneIndex) || 0;
    renderFloorLoadHeatmap();
    renderCanvas();
  });

  els.boxSelect.addEventListener("change", () => {
    state.selectedBoxKey = els.boxSelect.value;
    renderCanvas();
  });

  els.moveButtons.forEach((button) => {
    button.addEventListener("click", () => moveSelectedBox(button.dataset.move));
  });

  els.resetMovesBtn.addEventListener("click", () => {
    state.manualAdjustments = {};
    runPacking();
  });

  [els.projectName, els.projectCustomer, els.projectOperator, els.projectDate].forEach((input) => {
    input.addEventListener("input", () => {
      state.project = readProjectFields();
      saveProject();
      renderReport();
    });
  });

  els.addCargoBtn.addEventListener("click", () => {
    state.cargo.push({
      name: "新货物",
      length: 1000,
      width: 800,
      height: 800,
      weight: 100,
      quantity: 1,
      group: "默认",
      rotatable: true,
      tiltable: true,
      stackable: true,
      maxStackLayers: 4,
      priority: 2,
    });
    renderCargoTable();
    runPacking();
    saveProject();
  });

  els.packBtn.addEventListener("click", () => {
    runPacking();
    saveProject();
  });
  els.resetSampleBtn.addEventListener("click", () => {
    if (!confirm("恢复样例会覆盖当前货物清单，确定继续吗？")) return;
    state.cargo = structuredClone(sampleCargo);
    renderCargoTable();
    runPacking();
    saveProject();
  });

  els.renderButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.renderMode = button.dataset.render;
      els.renderButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderCanvas();
    });
  });

  [els.heavyFirst, els.respectStack, els.balanceWeight].forEach((input) => {
    input.addEventListener("change", () => {
      state.strategy = {
        heavyFirst: els.heavyFirst.checked,
        respectStack: els.respectStack.checked,
        balanceWeight: els.balanceWeight.checked,
      };
      runPacking();
      saveProject();
    });
  });

  els.copyReportBtn.addEventListener("click", async () => {
    await copyText(els.reportText.textContent);
    temporaryButtonText(els.copyReportBtn, "已复制");
  });

  els.downloadReportBtn.addEventListener("click", downloadCsv);
  els.printReportBtn.addEventListener("click", () => window.print());
  els.saveProjectBtn.addEventListener("click", () => {
    saveProject();
    temporaryButtonText(els.saveProjectBtn, "已保存");
  });
  els.exportProjectBtn.addEventListener("click", exportProject);
  els.projectInput.addEventListener("change", handleProjectImport);
  els.downloadTemplateBtn.addEventListener("click", downloadTemplate);
  els.csvInput.addEventListener("change", handleCargoFileImport);

  window.addEventListener("resize", renderCanvas);
}

function switchView(viewName) {
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  renderCanvas();
}

function renderProjectFields() {
  els.projectName.value = state.project.name || "";
  els.projectCustomer.value = state.project.customer || "";
  els.projectOperator.value = state.project.operator || "";
  els.projectDate.value = state.project.date || "";
}

function readProjectFields() {
  return {
    name: els.projectName.value.trim(),
    customer: els.projectCustomer.value.trim(),
    operator: els.projectOperator.value.trim(),
    date: els.projectDate.value,
  };
}

function renderStrategyFields() {
  els.heavyFirst.checked = state.strategy.heavyFirst !== false;
  els.respectStack.checked = state.strategy.respectStack !== false;
  els.balanceWeight.checked = state.strategy.balanceWeight !== false;
  els.maxContainers.value = state.maxContainers;
  els.showHeatmap.checked = state.showHeatmap;
  els.floorLoadLimit.value = state.floorLoadLimit;
}

function loadSavedProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    applyProject(saved, false);
  } catch (error) {
    console.warn("无法读取本地保存的项目", error);
  }
}

function saveProject() {
  state.project = readProjectFields();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject()));
}

function serializeProject() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    project: state.project,
    selectedContainer: state.selectedContainer,
    maxContainers: state.maxContainers,
    showHeatmap: state.showHeatmap,
    floorLoadLimit: state.floorLoadLimit,
    manualAdjustments: state.manualAdjustments,
    strategy: {
      heavyFirst: els.heavyFirst?.checked ?? true,
      respectStack: els.respectStack?.checked ?? true,
      balanceWeight: els.balanceWeight?.checked ?? true,
    },
    cargo: state.cargo,
  };
}

function applyProject(project, shouldRender = true) {
  if (!project || typeof project !== "object") return;
  state.project = {
    ...state.project,
    ...(project.project || {}),
  };
  state.selectedContainer = project.selectedContainer || state.selectedContainer;
  state.maxContainers = clamp(Number(project.maxContainers) || state.maxContainers, 1, 20);
  state.showHeatmap = project.showHeatmap !== false;
  state.floorLoadLimit = clamp(Number(project.floorLoadLimit) || state.floorLoadLimit, 100, 20000);
  state.manualAdjustments = project.manualAdjustments || {};
  state.strategy = {
    ...state.strategy,
    ...(project.strategy || {}),
  };
  state.cargo = Array.isArray(project.cargo) ? normalizeCargo(project.cargo) : state.cargo;
  if (shouldRender) {
    renderProjectFields();
    renderContainerOptions();
    els.maxContainers.value = state.maxContainers;
    renderStrategyFields();
    els.showHeatmap.checked = state.showHeatmap;
    els.floorLoadLimit.value = state.floorLoadLimit;
    renderCargoTable();
    runPacking();
    saveProject();
  }
}

function normalizeCargo(cargo) {
  return cargo.map((item) => ({
    name: String(item.name || "未命名货物"),
    length: Number(item.length) || 0,
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    weight: Number(item.weight) || 0,
    quantity: Number(item.quantity) || 1,
    group: normalizeGroupName(item.group || item.destination || "默认"),
    rotatable: item.rotatable !== false,
    tiltable: item.tiltable !== false,
    stackable: item.stackable !== false,
    maxStackLayers: Math.max(1, Math.min(20, Number(item.maxStackLayers) || (item.stackable === false ? 1 : 6))),
    priority: Number(item.priority) || 2,
  }));
}

function normalizeGroupName(value) {
  return String(value || "默认").replace(/\s*\/\s*Default\s*/gi, "").trim() || "默认";
}

function renderContainerOptions() {
  els.containerSelect.innerHTML = containers
    .map((container) => `<option value="${container.id}">${container.name}</option>`)
    .join("");
  els.containerSelect.value = state.selectedContainer;
  renderContainerSpecs();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getContainer() {
  return containers.find((container) => container.id === state.selectedContainer);
}

function renderContainerSpecs() {
  const container = getContainer();
  els.containerBadge.textContent = container.id;
  els.containerSpecs.innerHTML = [
    ["内长", `${container.length.toLocaleString()} 毫米`],
    ["内宽", `${container.width.toLocaleString()} 毫米`],
    ["内高", `${container.height.toLocaleString()} 毫米`],
    ["箱门宽", `${container.doorWidth.toLocaleString()} 毫米`],
    ["箱门高", `${container.doorHeight.toLocaleString()} 毫米`],
    ["箱体自重", `${(container.tare ?? 0).toLocaleString()} 千克`],
    ["最大总重", `${(container.maxGross ?? container.maxWeight).toLocaleString()} 千克`],
    ["最大载重", `${container.maxWeight.toLocaleString()} 千克`],
  ]
    .map(([label, value]) => `<div class="spec-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderCargoTable() {
  els.cargoTable.innerHTML = "";
  state.cargo.forEach((item, index) => {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      if (input.type === "checkbox") {
        input.checked = Boolean(item[field]);
      } else {
        input.value = item[field];
      }
      input.addEventListener("input", () => updateCargo(index, field, input));
      input.addEventListener("change", () => {
        updateCargo(index, field, input);
        runPacking();
        saveProject();
      });
    });
    row.querySelector("[data-action='delete']").addEventListener("click", () => {
      state.cargo.splice(index, 1);
      renderCargoTable();
      runPacking();
    });
    els.cargoTable.append(row);
  });
}

function updateCargo(index, field, input) {
  const numericFields = ["length", "width", "height", "weight", "quantity", "maxStackLayers", "priority"];
  const item = state.cargo[index];
  item[field] = input.type === "checkbox" ? input.checked : input.value;
  if (numericFields.includes(field)) {
    item[field] = Number(input.value);
  }
}

function buildUnits() {
  const units = [];
  state.cargo.forEach((item, cargoIndex) => {
    if (getCargoIssues(item).length > 0) return;
    const quantity = Math.max(0, Number(item.quantity) || 0);
    for (let i = 0; i < quantity; i += 1) {
      units.push({
        ...item,
        cargoIndex,
        unitId: `${cargoIndex + 1}-${i + 1}`,
        volume: item.length * item.width * item.height,
      });
    }
  });
  return units.filter((item) => item.length > 0 && item.width > 0 && item.height > 0);
}

function runPacking() {
  syncTableState();
  state.validation = validateCargo();
  markInvalidRows();
  const container = getContainer();
  const units = sortUnits(buildUnits());
  const packed = [];
  let remaining = [...units];

  for (let containerNo = 1; containerNo <= state.maxContainers && remaining.length > 0; containerNo += 1) {
    const result = packContainer(remaining, container, containerNo);
    packed.push(...result.packed);
    remaining = result.unpacked;
  }

  const unpacked = remaining.map((item) => ({
    ...item,
    reason: item.reason || `超过 ${state.maxContainers} 个箱子的可用容量或规则限制`,
  }));

  applyManualAdjustments(packed, container);

  const usedContainers = Math.max(1, ...packed.map((box) => box.containerNo || 1));
  state.activeContainerNo = Math.min(state.activeContainerNo, usedContainers);

  state.result = {
    packed,
    unpacked,
    metrics: calculateMetrics(packed, unpacked, container, usedContainers),
  };

  renderResults();
  saveProject();
}

function sortUnits(units) {
  return units.sort((a, b) => {
    const priorityDiff = Number(b.priority) - Number(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (els.heavyFirst.checked && b.weight !== a.weight) return b.weight - a.weight;
    return b.volume - a.volume;
  });
}

function packContainer(units, container, containerNo) {
  const packed = [];
  const unpacked = [];
  let currentWeight = 0;
  const spaces = [
    {
      x: 0,
      y: 0,
      z: 0,
      length: container.length,
      width: container.width,
      height: container.height,
    },
  ];

  units.forEach((item) => {
    if (currentWeight + item.weight > container.maxWeight) {
      unpacked.push({ ...item, reason: "当前箱载重不足" });
      return;
    }

    const placement = findPlacement(item, spaces, packed, container);
    if (!placement) {
      unpacked.push({ ...item, reason: "当前箱剩余空间不足或规则限制" });
      return;
    }

    packed.push({
      ...item,
      ...placement,
      containerNo,
      color: colors[item.cargoIndex % colors.length],
    });
    currentWeight += item.weight;
    splitSpaces(spaces, placement);
    pruneSpaces(spaces);
  });

  return { packed, unpacked };
}

function boxKey(box) {
  return `${box.containerNo || 1}:${box.unitId}`;
}

function applyManualAdjustments(packed, container) {
  packed.forEach((box) => {
    const adjustment = state.manualAdjustments[boxKey(box)];
    if (!adjustment) return;
    const moved = { ...box, x: adjustment.x, y: adjustment.y, z: adjustment.z };
    if (canPlaceManual(moved, packed, container, box)) {
      box.x = adjustment.x;
      box.y = adjustment.y;
      box.z = adjustment.z;
    }
  });
}

function moveSelectedBox(moveToken) {
  const box = state.result.packed.find((item) => boxKey(item) === state.selectedBoxKey);
  if (!box || !moveToken) return;
  const [axis, rawDelta] = moveToken.split(":");
  const delta = Number(rawDelta);
  const moved = { ...box, [axis]: box[axis] + delta };
  const container = getContainer();
  if (!canPlaceManual(moved, state.result.packed, container, box)) {
    temporaryButtonText(els.resetMovesBtn, "位置不可用");
    return;
  }
  state.manualAdjustments[boxKey(box)] = {
    x: moved.x,
    y: moved.y,
    z: moved.z,
  };
  box.x = moved.x;
  box.y = moved.y;
  box.z = moved.z;
  renderMoveControls();
  renderCanvas();
  renderReport();
  saveProject();
}

function canPlaceManual(candidate, packed, container, originalBox) {
  const withinBounds =
    candidate.x >= 0 &&
    candidate.y >= 0 &&
    candidate.z >= 0 &&
    candidate.x + candidate.length <= container.length &&
    candidate.y + candidate.width <= container.width &&
    candidate.z + candidate.height <= container.height &&
    passesDoor(candidate, container);
  if (!withinBounds) return false;
  return !packed.some((box) => box !== originalBox && (box.containerNo || 1) === (candidate.containerNo || 1) && intersects3d(candidate, box));
}

function validateCargo() {
  const issues = [];
  state.cargo.forEach((item, index) => {
    getCargoIssues(item).forEach((message) => {
      issues.push({
        index,
        message: `第 ${index + 1} 行 ${item.name || "未命名货物"}：${message}`,
      });
    });
  });
  return issues;
}

function getCargoIssues(item) {
  const issues = [];
  if (!String(item.name || "").trim()) issues.push("名称不能为空");
  if (!isPositive(item.length)) issues.push("长度必须大于 0");
  if (!isPositive(item.width)) issues.push("宽度必须大于 0");
  if (!isPositive(item.height)) issues.push("高度必须大于 0");
  if (Number(item.weight) < 0 || Number.isNaN(Number(item.weight))) issues.push("重量不能为负数");
  if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) issues.push("数量必须为正整数");
  if (!String(item.group || "").trim()) issues.push("分组/目的地不能为空");
  if (!Number.isInteger(Number(item.maxStackLayers)) || Number(item.maxStackLayers) < 1) issues.push("最大层数必须为正整数");
  const container = getContainer();
  if (isPositive(item.length) && isPositive(item.width) && isPositive(item.height) && !canItemPassDoor(item, container)) {
    issues.push(`任意旋转后都无法通过箱门 ${container.doorWidth}×${container.doorHeight} 毫米`);
  }
  return issues;
}

function canItemPassDoor(item, container) {
  return getRotations({ ...item, rotatable: true }).some((size) => passesDoor(size, container));
}

function isPositive(value) {
  return Number(value) > 0 && !Number.isNaN(Number(value));
}

function markInvalidRows() {
  const invalidIndexes = new Set(state.validation.map((issue) => issue.index));
  [...els.cargoTable.children].forEach((row, index) => {
    row.classList.toggle("invalid-row", invalidIndexes.has(index));
  });
}

function syncTableState() {
  [...els.cargoTable.children].forEach((row, index) => {
    row.querySelectorAll("[data-field]").forEach((input) => {
      updateCargo(index, input.dataset.field, input);
    });
  });
}

function findPlacement(item, spaces, packed, container) {
  const rotations = getRotations(item);
  const sortedSpaces = [...spaces].sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);

  // 在所有可用空间中收集合法候选，做全局择优，而不是只取第一个能放下的空间，
  // 这样能减少空间碎片、提升整体空间利用率。
  const allCandidates = [];
  for (const space of sortedSpaces) {
    rotations
      .filter((size) => fits(size, space))
      .map((size) => ({
        x: space.x,
        y: space.y,
        z: space.z,
        length: size.length,
        width: size.width,
        height: size.height,
        rotation: size.rotation,
        space,
      }))
      .filter((candidate) => passesDoor(candidate, container))
      .filter((candidate) => respectsRules(candidate, item, packed, container))
      .forEach((candidate) => allCandidates.push(candidate));
  }

  if (allCandidates.length === 0) return null;
  const best = pickBestCandidate(allCandidates, packed, container, item);
  const { space, ...placement } = best;
  return placement;
}

function getRotations(item) {
  if (!item.rotatable) {
    return [{ length: item.length, width: item.width, height: item.height, rotation: "固定" }];
  }
  const base = [
    [item.length, item.width, item.height, "LWH"],
    [item.width, item.length, item.height, "WLH"],
  ];
  if (item.tiltable === false) {
    return base.map(([length, width, height, rotation]) => ({ length, width, height, rotation }));
  }
  const all = [
        ...base,
        [item.length, item.height, item.width, "LHW"],
        [item.height, item.length, item.width, "HLW"],
        [item.width, item.height, item.length, "WHL"],
        [item.height, item.width, item.length, "HWL"],
      ];

  const seen = new Set();
  return all
    .map(([length, width, height, rotation]) => ({ length, width, height, rotation }))
    .filter((size) => {
      const key = `${size.length}-${size.width}-${size.height}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fits(size, space) {
  return size.length <= space.length && size.width <= space.width && size.height <= space.height;
}

function passesDoor(candidate, container) {
  return candidate.width <= container.doorWidth && candidate.height <= container.doorHeight;
}

function respectsRules(candidate, item, packed, container) {
  const withinBounds =
    candidate.x + candidate.length <= container.length &&
    candidate.y + candidate.width <= container.width &&
      candidate.z + candidate.height <= container.height;
  if (!withinBounds) return false;

  const supports = candidate.z > 0
    ? packed.filter((box) => hasOverlap2d(candidate, box) && almostEqual(box.z + box.height, candidate.z))
    : [];
  candidate.stackLayer = supports.length ? Math.max(...supports.map((box) => Number(box.stackLayer) || 1)) + 1 : 1;

  if (candidate.stackLayer > (Number(item.maxStackLayers) || 1)) return false;
  if (supports.some((box) => candidate.stackLayer > (Number(box.maxStackLayers) || 1))) return false;

  if (els.respectStack.checked && candidate.z > 0) {
    if (supports.length === 0) return false;
    if (supports.some((box) => !box.stackable)) return false;
    const supportArea = supports.reduce((area, box) => area + overlapArea(candidate, box), 0);
    const baseArea = candidate.length * candidate.width;
    if (supportArea / baseArea < 0.62) return false;
    // 重不压轻：单件较重的货物不可压在更轻的货物之上（容许 5% 误差），
    // 避免下层被压坏，符合实际装柜安全要求。
    const tolerance = 1.05;
    if (supports.some((box) => Number(item.weight) > Number(box.weight) * tolerance)) return false;
  }

  return !packed.some((box) => intersects3d(candidate, box));
}

function pickBestCandidate(candidates, packed, container, item) {
  const balance = els.balanceWeight.checked && packed.length > 0;
  const leftWeight = balance
    ? packed
        .filter((box) => box.y + box.width / 2 < container.width / 2)
        .reduce((sum, box) => sum + box.weight, 0)
    : 0;
  const rightWeight = balance
    ? packed
        .filter((box) => box.y + box.width / 2 >= container.width / 2)
        .reduce((sum, box) => sum + box.weight, 0)
    : 0;

  const scoreOf = (c) => {
    // 紧贴度：候选体积占所在自由空间体积的比例越高，留下的碎片越少。
    const spaceVol = c.space ? c.space.length * c.space.width * c.space.height : c.length * c.width * c.height;
    const fillRatio = spaceVol > 0 ? (c.length * c.width * c.height) / spaceVol : 0;
    // 位置：优先低、靠箱尾、靠一侧（back-left），保证装载顺序自然、重心靠下。
    const position = c.z * 1000000 + (c.x + c.y);
    let balanceScore = 0;
    if (balance) {
      const left = c.y + c.width / 2 < container.width / 2;
      balanceScore = Math.abs(
        (leftWeight + (left ? item.weight : 0)) - (rightWeight + (left ? 0 : item.weight))
      );
    }
    return { position, fillRatio, balanceScore };
  };

  return candidates
    .map((c) => ({ c, s: scoreOf(c) }))
    .sort((a, b) => {
      // 先比左右配平（若开启），再比位置（低/后/侧），最后比紧贴度（碎片更少者优先）。
      if (balance && a.s.balanceScore !== b.s.balanceScore) return a.s.balanceScore - b.s.balanceScore;
      if (a.s.position !== b.s.position) return a.s.position - b.s.position;
      return b.s.fillRatio - a.s.fillRatio;
    })[0].c;
}

function splitSpaces(spaces, placement) {
  const index = spaces.findIndex(
    (space) => space.x === placement.x && space.y === placement.y && space.z === placement.z
  );
  if (index === -1) return;

  const space = spaces.splice(index, 1)[0];
  const right = {
    x: placement.x + placement.length,
    y: space.y,
    z: space.z,
    length: space.x + space.length - (placement.x + placement.length),
    width: space.width,
    height: space.height,
  };
  const front = {
    x: space.x,
    y: placement.y + placement.width,
    z: space.z,
    length: placement.length,
    width: space.y + space.width - (placement.y + placement.width),
    height: space.height,
  };
  const above = {
    x: placement.x,
    y: placement.y,
    z: placement.z + placement.height,
    length: placement.length,
    width: placement.width,
    height: space.z + space.height - (placement.z + placement.height),
  };

  [right, front, above].forEach((next) => {
    if (next.length > 0 && next.width > 0 && next.height > 0) {
      spaces.push(next);
    }
  });
}

function pruneSpaces(spaces) {
  for (let i = spaces.length - 1; i >= 0; i -= 1) {
    const current = spaces[i];
    const contained = spaces.some((space, index) => {
      if (index === i) return false;
      return (
        current.x >= space.x &&
        current.y >= space.y &&
        current.z >= space.z &&
        current.x + current.length <= space.x + space.length &&
        current.y + current.width <= space.y + space.width &&
        current.z + current.height <= space.z + space.height
      );
    });
    if (contained) spaces.splice(i, 1);
  }
}

function intersects3d(a, b) {
  return !(
    a.x + a.length <= b.x ||
    b.x + b.length <= a.x ||
    a.y + a.width <= b.y ||
    b.y + b.width <= a.y ||
    a.z + a.height <= b.z ||
    b.z + b.height <= a.z
  );
}

function hasOverlap2d(a, b) {
  return !(a.x + a.length <= b.x || b.x + b.length <= a.x || a.y + a.width <= b.y || b.y + b.width <= a.y);
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y));
  return x * y;
}

function almostEqual(a, b) {
  return Math.abs(a - b) < 0.01;
}

function calculateMetrics(packed, unpacked, container, usedContainers = 1) {
  const loadedVolume = packed.reduce((sum, box) => sum + box.length * box.width * box.height, 0);
  const loadedWeight = packed.reduce((sum, box) => sum + box.weight, 0);
  const singleVolume = container.length * container.width * container.height;
  const totalVolume = singleVolume * usedContainers;
  const containerStats = Array.from({ length: usedContainers }, (_, index) => {
    const containerNo = index + 1;
    const boxes = packed.filter((box) => box.containerNo === containerNo);
    const weight = boxes.reduce((sum, box) => sum + box.weight, 0);
    const volume = boxes.reduce((sum, box) => sum + box.length * box.width * box.height, 0);
    return {
      containerNo,
      boxes,
      count: boxes.length,
      weight,
      volume,
      volumeRate: volume / singleVolume,
      weightRate: weight / container.maxWeight,
    };
  });
  const center = packed.reduce(
    (acc, box) => {
      acc.x += (box.x + box.length / 2) * box.weight;
      acc.y += (box.y + box.width / 2) * box.weight;
      acc.z += (box.z + box.height / 2) * box.weight;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  const divider = loadedWeight || 1;

  return {
    loadedVolume,
    loadedWeight,
    totalVolume,
    volumeRate: loadedVolume / totalVolume,
    weightRate: loadedWeight / (container.maxWeight * usedContainers),
    packedCount: packed.length,
    unpackedCount: unpacked.length,
    usedContainers,
    maxContainers: state.maxContainers,
    containerStats,
    center: {
      x: center.x / divider,
      y: center.y / divider,
      z: center.z / divider,
    },
  };
}

function renderResults() {
  const { metrics, unpacked } = state.result;
  els.volumeUse.textContent = formatPercent(metrics.volumeRate);
  els.weightUse.textContent = formatPercent(metrics.weightRate);
  els.packedCount.textContent = String(metrics.packedCount);
  els.usedContainerCount.textContent = `${metrics.usedContainers}/${state.maxContainers}`;
  els.unpackedBadge.textContent = `未装 ${metrics.unpackedCount}`;
  els.sidebarStatus.textContent = metrics.unpackedCount ? "需要复核" : "方案已生成";
  els.sidebarDetail.textContent = `${metrics.packedCount} 件已装，${metrics.unpackedCount} 件未装`;
  els.statusDot.classList.toggle("ready", metrics.packedCount > 0);
  renderValidation();

  els.metricList.innerHTML = [
    ["总体积", `${(metrics.loadedVolume / 1e9).toFixed(2)} m³`],
    ["总重量", `${metrics.loadedWeight.toFixed(1)} 千克`],
    ["计划箱数", `${metrics.usedContainers} / ${state.maxContainers}`],
    ["重心纵向", `${Math.round(metrics.center.x)} 毫米`],
    ["重心横向", `${Math.round(metrics.center.y)} 毫米`],
    ["重心高度", `${Math.round(metrics.center.z)} 毫米`],
  ]
    .map(([label, value]) => `<div class="metric-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  els.unpackedList.innerHTML = unpacked.length
    ? unpacked
        .slice(0, 12)
        .map((item) => `<div class="unpacked-item">${escapeHtml(item.name)} #${item.unitId}<br>${item.reason}</div>`)
        .join("")
    : `<div class="metric-row"><span>全部货物已装入当前箱型</span><strong>通过</strong></div>`;

  renderActiveContainerOptions();
  renderInsights();
  renderFloorLoadHeatmap();
  renderPlaybackControls();
  renderLoadingSequence();
  renderMoveControls();
  renderLegend();
  renderCanvas();
  renderReport();
}

function renderActiveContainerOptions() {
  const used = state.result.metrics.usedContainers || 1;
  els.activeContainerSelect.innerHTML = Array.from({ length: used }, (_, index) => {
    const no = index + 1;
    const stat = state.result.metrics.containerStats?.[index];
    const label = stat ? `${no}号箱 · ${stat.count}件` : `${no}号箱`;
    return `<option value="${no}">${label}</option>`;
  }).join("");
  els.activeContainerSelect.value = String(state.activeContainerNo);
}

function renderMoveControls() {
  const container = getContainer();
  const cutoff = getLayerCutoff(container);
  els.layerLabel.textContent = state.layerPercent >= 100 ? "显示全部" : `0 - ${Math.round(cutoff)} 毫米`;
  const boxes = getVisiblePacked();
  if (!boxes.some((box) => boxKey(box) === state.selectedBoxKey)) {
    state.selectedBoxKey = boxes[0] ? boxKey(boxes[0]) : "";
  }
  els.boxSelect.innerHTML = boxes
    .map((box) => {
      const key = boxKey(box);
      const label = `${box.unitId} ${box.name} · x${Math.round(box.x)} y${Math.round(box.y)} z${Math.round(box.z)}`;
      return `<option value="${key}">${escapeHtml(label)}</option>`;
    })
    .join("");
  els.boxSelect.value = state.selectedBoxKey;
}

function renderPlaybackControls() {
  const total = getLoadingSequence().filter((box) => (box.containerNo || 1) === state.activeContainerNo).length;
  state.loadingStep = clamp(Number(state.loadingStep) || 0, 0, total);
  els.loadingStepRange.max = String(total);
  els.loadingStepRange.value = String(state.loadingStep);
  els.loadingStepRange.disabled = total === 0;
  els.loadingStepLabel.textContent = state.loadingStep === 0 || state.loadingStep >= total
    ? `显示全部步骤（${total}件）`
    : `显示前 ${state.loadingStep} 件 / 共 ${total} 件`;
}

function renderInsights() {
  const insights = buildInsights();
  els.insightList.innerHTML = insights
    .map((item) => `<div class="insight-item ${item.level === "warn" ? "warn" : ""}">${escapeHtml(item.text)}</div>`)
    .join("");
}

function renderFloorLoadHeatmap() {
  const summaryData = getFloorLoadSummary(state.activeContainerNo);
  const { cells, hottest, lightest, suggestion } = summaryData;
  const contributors = hottest?.contributors || [];
  const dangerCount = cells.filter((cell) => cell.level === "danger").length;
  const warnCount = cells.filter((cell) => cell.level === "warn").length;
  const summary = dangerCount
    ? `${dangerCount} 个热点超过上限`
    : warnCount
      ? `${warnCount} 个热点接近上限`
      : "箱底承重分布平稳";
  els.heatmapList.innerHTML = [
    `<div class="heatmap-item"><strong>连续承重热力图</strong><br>箱底按 ${HEATMAP_COLUMNS}×${HEATMAP_ROWS} 个承重点计算面积载荷。画布用连续色带显示当前箱内相对热度，风险判断按上限 ${state.floorLoadLimit.toLocaleString()} 千克/平方米。${summary}。</div>`,
    `<div class="heatmap-item heatmap-detail"><strong>最高热点</strong><br>${floorLoadAdvice(hottest)}
      <div class="heatmap-bar"><span class="heatmap-fill" style="width:${Math.min(100, Math.round((hottest?.rate || 0) * 100))}%;background:${hottest?.color || "#007892"}"></span></div>
      <ul>${contributors.map((item) => `<li>${escapeHtml(item.name)} #${escapeHtml(item.unitId)}：${item.weight.toFixed(0)} 千克</li>`).join("") || "<li>该热点暂无货物压载</li>"}</ul>
    </div>`,
    `<div class="heatmap-item"><strong>最低载荷点</strong><br>${lightest ? `${lightest.label}，${lightest.density.toFixed(0)} 千克/平方米，占上限 ${formatPercent(lightest.rate)}。` : "暂无数据。"}</div>`,
    suggestion
      ? `<div class="heatmap-item heatmap-suggestion"><strong>承重调整建议</strong><br>${escapeHtml(suggestion.text)}<br>优先处理：${escapeHtml(suggestion.item.name)} #${escapeHtml(suggestion.item.unitId)}，贡献 ${suggestion.item.weight.toFixed(0)} 千克。</div>`
      : `<div class="heatmap-item heatmap-suggestion"><strong>承重调整建议</strong><br>当前没有明显需要调整的承重区域。</div>`,
  ].join("");
}

function renderLoadingSequence() {
  const steps = getLoadingSequence().slice(0, 8);
  els.sequenceList.innerHTML = [
    `<div class="sequence-item"><strong>装载顺序</strong><br>建议从箱内最深处向箱门方向装载，重货和高优先级货物优先复核。</div>`,
    ...steps.map(
      (box, index) =>
        `<div class="sequence-item">${index + 1}. 箱${box.containerNo || 1} · ${escapeHtml(box.unitId)} · ${escapeHtml(
          box.name
        )}<br>${escapeHtml(box.group || "默认")} · 纵向=${Math.round(box.x)} 横向=${Math.round(box.y)} 高度=${Math.round(box.z)}</div>`
    ),
  ].join("");
}

function getLoadingSequence() {
  return [...state.result.packed].sort((a, b) => {
    return (
      (a.containerNo || 1) - (b.containerNo || 1) ||
      Number(b.priority) - Number(a.priority) ||
      b.weight - a.weight ||
      b.x - a.x ||
      a.z - b.z
    );
  });
}

function buildInsights() {
  const { metrics, unpacked } = state.result;
  const insights = [];
  if (unpacked.length > 0) {
    insights.push({
      level: "warn",
      text: `仍有 ${unpacked.length} 件未装。可增加最大箱数、换更大箱型，或检查不可堆叠/不可旋转限制。`,
    });
  }
  metrics.containerStats.forEach((stat) => {
    const left = stat.boxes.filter((box) => box.y + box.width / 2 < getContainer().width / 2).reduce((sum, box) => sum + box.weight, 0);
    const right = stat.weight - left;
    const sideDiff = stat.weight ? Math.abs(left - right) / stat.weight : 0;
    if (sideDiff > 0.22) {
      insights.push({ level: "warn", text: `${stat.containerNo}号箱左右重量差约 ${formatPercent(sideDiff)}，建议复核配载或手动微调。` });
    }
    if (stat.weightRate > 0.9) {
      insights.push({ level: "warn", text: `${stat.containerNo}号箱重量利用超过 90%，发运前建议复核限重和地磅数据。` });
    }
    const hottestZone = getFloorLoadZones(stat.containerNo).sort((a, b) => b.rate - a.rate)[0];
    if (hottestZone && hottestZone.rate > 0.8) {
      insights.push({ level: "warn", text: `${stat.containerNo}号箱${hottestZone.label}面积载荷 ${hottestZone.density.toFixed(0)} 千克/平方米，占上限 ${formatPercent(hottestZone.rate)}，建议分散重货。` });
    }
    if (stat.volumeRate < 0.5 && stat.count > 0) {
      insights.push({ level: "info", text: `${stat.containerNo}号箱空间利用偏低，可尝试降低箱数或合并低优先级货物。` });
    }
  });
  if (metrics.unpackedCount === 0 && metrics.volumeRate > 0.72) {
    insights.push({ level: "info", text: "当前方案空间利用较高，适合进入仓库复核和装柜作业排程。" });
  }
  if (insights.length === 0) {
    insights.push({ level: "info", text: "方案平稳，没有明显装载风险。建议现场复核包装强度和绑扎要求。" });
  }
  return insights.slice(0, 4);
}

function renderValidation() {
  if (state.validation.length === 0) {
    els.validationBox.innerHTML = `<div class="validation-item ok">数据校验通过，当前清单可用于装箱计算。</div>`;
    return;
  }
  els.validationBox.innerHTML = state.validation
    .slice(0, 5)
    .map((issue) => `<div class="validation-item">${escapeHtml(issue.message)}</div>`)
    .join("");
}

function renderLegend() {
  const names = [...new Map(getVisiblePacked().map((box) => [box.name, box])).values()];
  els.legend.innerHTML = names
    .map(
      (box) =>
        `<span class="legend-item"><span class="swatch" style="background:${box.color}"></span>${escapeHtml(
          box.name
        )}</span>`
    )
    .join("");
}

function getActivePacked() {
  return state.result.packed.filter((box) => (box.containerNo || 1) === state.activeContainerNo);
}

function getLayerCutoff(container = getContainer()) {
  return (container.height * state.layerPercent) / 100;
}

function getVisiblePacked() {
  const cutoff = getLayerCutoff();
  const playbackKeys = getPlaybackVisibleKeys();
  return getActivePacked().filter((box) => {
    const visibleByLayer = state.layerPercent >= 100 || box.z < cutoff || boxKey(box) === state.selectedBoxKey;
    const visibleByStep = !playbackKeys || playbackKeys.has(boxKey(box));
    return visibleByLayer && visibleByStep;
  });
}

function getPlaybackVisibleKeys() {
  const activeSequence = getLoadingSequence().filter((box) => (box.containerNo || 1) === state.activeContainerNo);
  const total = activeSequence.length;
  const step = Number(state.loadingStep) || 0;
  if (step <= 0 || step >= total) return null;
  return new Set(activeSequence.slice(0, step).map((box) => boxKey(box)));
}

function getFloorLoadZones(containerNo = state.activeContainerNo) {
  const container = getContainer();
  const columns = 3;
  const rows = 2;
  const densityLimit = Number(state.floorLoadLimit) || 2500;
  const zones = [];
  for (let xIndex = 0; xIndex < columns; xIndex += 1) {
    for (let yIndex = 0; yIndex < rows; yIndex += 1) {
      const zone = {
        x: (container.length / columns) * xIndex,
        y: (container.width / rows) * yIndex,
        length: container.length / columns,
        width: container.width / rows,
        weight: 0,
        contributors: [],
      };
      zones.push(zone);
    }
  }

  state.result.packed
    .filter((box) => (box.containerNo || 1) === containerNo)
    .forEach((box) => {
      const baseArea = box.length * box.width || 1;
      zones.forEach((zone) => {
        const sharedArea = overlapArea(box, zone);
        if (sharedArea > 0) {
          const sharedWeight = box.weight * (sharedArea / baseArea);
          zone.weight += sharedWeight;
          zone.contributors.push({
            name: box.name,
            unitId: box.unitId,
            weight: sharedWeight,
            box,
          });
        }
      });
    });

  return zones.map((zone, index) => {
    const areaM2 = (zone.length * zone.width) / 1e6;
    const density = zone.weight / (areaM2 || 1);
    const rate = density / densityLimit;
    const xLabel = ["前段", "中段", "后段"][Math.floor(index / rows)];
    const yLabel = index % rows === 0 ? "左侧" : "右侧";
    const contributors = zone.contributors
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
    return {
      ...zone,
      index,
      label: `${xLabel}${yLabel}`,
      areaM2,
      density,
      rate,
      level: rate >= 1 ? "danger" : rate >= 0.8 ? "warn" : "ok",
      contributors,
      color: heatColor(rate),
    };
  });
}

function getFloorLoadCells(containerNo = state.activeContainerNo, columns = HEATMAP_COLUMNS, rows = HEATMAP_ROWS) {
  const container = getContainer();
  const densityLimit = Number(state.floorLoadLimit) || 2500;
  const cells = [];
  for (let xIndex = 0; xIndex < columns; xIndex += 1) {
    for (let yIndex = 0; yIndex < rows; yIndex += 1) {
      cells.push({
        index: cells.length,
        column: xIndex,
        row: yIndex,
        x: (container.length / columns) * xIndex,
        y: (container.width / rows) * yIndex,
        length: container.length / columns,
        width: container.width / rows,
        weight: 0,
        contributors: [],
      });
    }
  }

  state.result.packed
    .filter((box) => (box.containerNo || 1) === containerNo)
    .forEach((box) => {
      const baseArea = box.length * box.width || 1;
      cells.forEach((cell) => {
        const sharedArea = overlapArea(box, cell);
        if (sharedArea <= 0) return;
        const sharedWeight = box.weight * (sharedArea / baseArea);
        cell.weight += sharedWeight;
        cell.contributors.push({
          name: box.name,
          unitId: box.unitId,
          weight: sharedWeight,
          box,
        });
      });
    });

  const enriched = cells.map((cell) => {
    const areaM2 = (cell.length * cell.width) / 1e6;
    const density = cell.weight / (areaM2 || 1);
    const rate = density / densityLimit;
    const xLabel = `${Math.round(cell.x)}-${Math.round(cell.x + cell.length)}毫米`;
    const yLabel = cell.row < rows / 2 ? "左侧" : "右侧";
    return {
      ...cell,
      label: `${xLabel} ${yLabel}`,
      areaM2,
      density,
      rate,
      level: rate >= 1 ? "danger" : rate >= 0.8 ? "warn" : "ok",
      contributors: cell.contributors.sort((a, b) => b.weight - a.weight).slice(0, 5),
    };
  });
  const maxDensity = Math.max(1, ...enriched.map((cell) => cell.density));
  return enriched.map((cell) => ({
    ...cell,
    visualRate: cell.density / maxDensity,
    color: heatColor(cell.density / maxDensity),
  }));
}

function getFloorLoadSummary(containerNo = state.activeContainerNo) {
  const cells = getFloorLoadCells(containerNo);
  const hottest = [...cells].sort((a, b) => b.rate - a.rate)[0];
  const lightest = [...cells].filter((cell) => cell.weight > 0).sort((a, b) => a.rate - b.rate)[0] || cells[0];
  const suggestion = getFloorLoadSuggestion(containerNo, cells);
  return { cells, hottest, lightest, suggestion };
}

function floorLoadAdvice(zone) {
  if (!zone) return "";
  const base = `面积 ${zone.areaM2.toFixed(2)} 平方米，面积载荷 ${zone.density.toFixed(0)} 千克/平方米，占上限 ${formatPercent(zone.rate)}。`;
  if (zone.level === "danger") {
    return `${base} 已超过上限，建议把该区重货向低载荷区域分散，或降低上层堆叠。`;
  }
  if (zone.level === "warn") {
    return `${base} 接近上限，建议现场重点复核箱底承重和垫板。`;
  }
  return `${base} 当前风险较低。`;
}

function getFloorLoadSuggestion(containerNo = state.activeContainerNo, cells = getFloorLoadCells(containerNo)) {
  const hottest = [...cells].sort((a, b) => b.rate - a.rate)[0];
  const lightest = [...cells].filter((cell) => cell.weight > 0).sort((a, b) => a.rate - b.rate)[0] || [...cells].sort((a, b) => a.rate - b.rate)[0];
  if (!hottest || !lightest || hottest.rate < 0.65 || !hottest.contributors.length) return null;
  const item = hottest.contributors[0];
  return {
    from: hottest,
    to: lightest,
    item,
    text: `将 ${item.name} #${item.unitId} 从${hottest.label}附近移向${lightest.label}，可优先降低最高承重区。`,
  };
}

function heatColor(rate) {
  if (rate >= 1) return "#E31D1C";
  if (rate >= 0.72) return "#FF5D00";
  if (rate >= 0.45) return "#E84368";
  return "#007892";
}

function renderCanvas() {
  const canvas = els.canvas;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const container = getContainer();
  drawContainerBase(ctx, width, height, container);
  if (state.renderMode === "view3d") draw3d(ctx, width, height, container);
  if (state.renderMode === "top") drawTop(ctx, width, height, container);
  if (state.renderMode === "heat") drawHeat(ctx, width, height, container);
  if (state.renderMode === "side") drawSide(ctx, width, height, container);
  if (state.renderMode === "iso") drawIso(ctx, width, height, container);
  const hint = document.querySelector("#view3dHint");
  if (hint) hint.style.display = state.renderMode === "view3d" ? "block" : "none";
}

// ===== 真 3D 装载视图（纯离线 canvas，可旋转/缩放/平移）=====
function rotate3dPoint(x, y, z, center, cam) {
  // 以箱体中心为原点
  let px = x - center.x;
  let py = y - center.y;
  let pz = z - center.z;
  // 绕竖直轴（z）偏航
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  let rx = px * cy - py * sy;
  let ry = px * sy + py * cy;
  // 绕水平轴俯仰
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  let ry2 = ry * cp - pz * sp;
  let rz2 = ry * sp + pz * cp;
  return { rx, depth: ry2, up: rz2 };
}

function compute3dScale(width, height, container, cam) {
  const center = { x: container.length / 2, y: container.width / 2, z: container.height / 2 };
  const corners = [];
  [0, container.length].forEach((x) =>
    [0, container.width].forEach((y) =>
      [0, container.height].forEach((z) => corners.push(rotate3dPoint(x, y, z, center, cam)))
    )
  );
  const xs = corners.map((c) => c.rx);
  const ups = corners.map((c) => c.up);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ups) - Math.min(...ups);
  const margin = 70;
  const base = Math.min((width - margin) / spanX, (height - margin) / spanY);
  return base * cam.zoom;
}

function draw3d(ctx, width, height, container) {
  const cam = state.view3d;
  const center = { x: container.length / 2, y: container.width / 2, z: container.height / 2 };
  const scale = compute3dScale(width, height, container, cam);
  const origin = { x: width / 2 + cam.panX, y: height / 2 + cam.panY };
  const toScreen = (x, y, z) => {
    const p = rotate3dPoint(x, y, z, center, cam);
    return { x: origin.x + p.rx * scale, y: origin.y - p.up * scale, depth: p.depth };
  };

  // 收集所有面（箱体地板/货物六面），按深度从远到近绘制
  const faces = [];
  const FACE_DEFS = [
    { n: "bottom", idx: [0, 1, 2, 3], shade: 0.55 },
    { n: "top", idx: [4, 5, 6, 7], shade: 1.12 },
    { n: "x0", idx: [0, 3, 7, 4], shade: 0.74 },
    { n: "x1", idx: [1, 2, 6, 5], shade: 0.86 },
    { n: "y0", idx: [0, 1, 5, 4], shade: 0.95 },
    { n: "y1", idx: [3, 2, 6, 7], shade: 0.68 },
  ];
  const boxVerts = (b) => [
    toScreen(b.x, b.y, b.z),
    toScreen(b.x + b.length, b.y, b.z),
    toScreen(b.x + b.length, b.y + b.width, b.z),
    toScreen(b.x, b.y + b.width, b.z),
    toScreen(b.x, b.y, b.z + b.height),
    toScreen(b.x + b.length, b.y, b.z + b.height),
    toScreen(b.x + b.length, b.y + b.width, b.z + b.height),
    toScreen(b.x, b.y + b.width, b.z + b.height),
  ];

  getVisiblePacked().forEach((box) => {
    const v = boxVerts(box);
    const selected = boxKey(box) === state.selectedBoxKey;
    FACE_DEFS.forEach((f) => {
      const pts = f.idx.map((i) => v[i]);
      // 不做背面剔除：六个面全部参与全局深度排序，远面先画、近面后画，
      // 这样不透明箱体一定正确遮挡，避免出现透明/缺面/穿模。
      const depth = (pts[0].depth + pts[1].depth + pts[2].depth + pts[3].depth) / 4;
      faces.push({ pts, depth, color: shadeColor(box.color, f.shade), selected });
    });
  });

  faces.sort((a, b) => b.depth - a.depth);
  faces.forEach((face) => {
    ctx.beginPath();
    face.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.strokeStyle = face.selected ? "#111722" : "rgba(20,28,42,0.35)";
    ctx.lineWidth = face.selected ? 2.4 : 0.8;
    ctx.stroke();
  });

  draw3dContainerFrame(ctx, container, toScreen);
}

function draw3dContainerFrame(ctx, container, toScreen) {
  const c = [
    toScreen(0, 0, 0),
    toScreen(container.length, 0, 0),
    toScreen(container.length, container.width, 0),
    toScreen(0, container.width, 0),
    toScreen(0, 0, container.height),
    toScreen(container.length, 0, container.height),
    toScreen(container.length, container.width, container.height),
    toScreen(0, container.width, container.height),
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  ctx.save();
  ctx.strokeStyle = "rgba(80,96,120,0.85)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 4]);
  edges.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(c[a].x, c[a].y);
    ctx.lineTo(c[b].x, c[b].y);
    ctx.stroke();
  });
  ctx.restore();
}

function shadeColor(hex, factor) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "#888888");
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  r = Math.round(Math.min(255, r * factor));
  g = Math.round(Math.min(255, g * factor));
  b = Math.round(Math.min(255, b * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

function setup3dInteraction() {
  const canvas = els.canvas;
  if (!canvas) return;
  let dragging = null;
  let last = { x: 0, y: 0 };
  const active = () => state.renderMode === "view3d";

  canvas.addEventListener("contextmenu", (e) => {
    if (active()) e.preventDefault();
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!active()) return;
    dragging = e.button === 2 || e.shiftKey ? "pan" : "rotate";
    last = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging || !active()) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (dragging === "rotate") {
      state.view3d.yaw += dx * 0.01;
      state.view3d.pitch = clamp(state.view3d.pitch + dy * 0.01, -1.45, 1.45);
    } else {
      state.view3d.panX += dx;
      state.view3d.panY += dy;
    }
    renderCanvas();
  });
  window.addEventListener("mouseup", () => {
    dragging = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!active()) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      state.view3d.zoom = clamp(state.view3d.zoom * factor, 0.25, 6);
      renderCanvas();
    },
    { passive: false }
  );
  canvas.addEventListener("dblclick", () => {
    if (!active()) return;
    state.view3d = { yaw: -0.62, pitch: 0.52, zoom: 1, panX: 0, panY: 0 };
    renderCanvas();
  });

  // 触摸：单指旋转，双指缩放/平移
  let touchState = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!active()) return;
      if (e.touches.length === 1) {
        touchState = { mode: "rotate", x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchState = {
          mode: "pinch",
          dist: touchDist(e),
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!active() || !touchState) return;
      e.preventDefault();
      if (touchState.mode === "rotate" && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchState.x;
        const dy = e.touches[0].clientY - touchState.y;
        touchState.x = e.touches[0].clientX;
        touchState.y = e.touches[0].clientY;
        state.view3d.yaw += dx * 0.01;
        state.view3d.pitch = clamp(state.view3d.pitch + dy * 0.01, -1.45, 1.45);
        renderCanvas();
      } else if (touchState.mode === "pinch" && e.touches.length === 2) {
        const dist = touchDist(e);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        state.view3d.zoom = clamp(state.view3d.zoom * (dist / touchState.dist), 0.25, 6);
        state.view3d.panX += cx - touchState.x;
        state.view3d.panY += cy - touchState.y;
        touchState.dist = dist;
        touchState.x = cx;
        touchState.y = cy;
        renderCanvas();
      }
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", () => {
    touchState = null;
  });
}

function touchDist(e) {
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.hypot(dx, dy) || 1;
}

function drawContainerBase(ctx, width, height) {
  ctx.fillStyle = "#f7fafb";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d3dce6";
  ctx.lineWidth = 1;
  for (let x = 20; x < width; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 20; y < height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawTop(ctx, width, height, container) {
  const margin = 34;
  const scale = Math.min((width - margin * 2) / container.length, (height - margin * 2) / container.width);
  const ox = (width - container.length * scale) / 2;
  const oy = (height - container.width * scale) / 2;
  drawRectFrame(ctx, ox, oy, container.length * scale, container.width * scale, "俯视图");
  if (state.showHeatmap) drawTopHeatmap(ctx, ox, oy, scale);
  getVisiblePacked().forEach((box) => {
    ctx.fillStyle = box.color;
    ctx.globalAlpha = 0.96;
    ctx.fillRect(ox + box.x * scale, oy + box.y * scale, box.length * scale, box.width * scale);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(37, 47, 69, 0.62)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(ox + box.x * scale, oy + box.y * scale, box.length * scale, box.width * scale);
    ctx.lineWidth = 1;
    if (boxKey(box) === state.selectedBoxKey) {
      ctx.strokeStyle = "#252F45";
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + box.x * scale, oy + box.y * scale, box.length * scale, box.width * scale);
      ctx.lineWidth = 1;
    }
  });
}

function drawHeat(ctx, width, height, container) {
  const margin = 48;
  const sidePanel = Math.min(300, Math.max(210, width * 0.27));
  const heatWidth = width - sidePanel - margin * 3;
  const heatHeight = height - margin * 2;
  const ox = margin;
  const oy = margin;
  const cells = getFloorLoadCells(state.activeContainerNo, HEATMAP_COLUMNS, HEATMAP_ROWS);
  const hottest = [...cells].sort((a, b) => b.rate - a.rate)[0];
  const lightest = [...cells].filter((cell) => cell.weight > 0).sort((a, b) => a.rate - b.rate)[0] || cells[0];
  const tileW = heatWidth / HEATMAP_COLUMNS;
  const tileH = heatHeight / HEATMAP_ROWS;

  drawRectFrame(ctx, ox, oy, heatWidth, heatHeight, "承重热力图");
  cells.forEach((cell) => {
    const x = ox + cell.column * tileW;
    const y = oy + cell.row * tileH;
    const w = tileW;
    const h = tileH;
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.min(0.7, cell.visualRate * 0.62);
    ctx.fillStyle = cell.color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  });
  drawHeatReferenceLines(ctx, ox, oy, heatWidth, heatHeight);
  drawHeatHotspotMarkers(ctx, ox, oy, heatWidth / container.length, heatHeight / container.width, false);
  drawHeatLegend(ctx, ox, oy + heatHeight + 18, heatWidth);

  const panelX = ox + heatWidth + margin;
  drawHeatSummaryPanel(ctx, panelX, margin, sidePanel, height - margin * 2, hottest, lightest);
}

function drawHeatReferenceLines(ctx, x, y, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(37, 47, 69, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + (width / 4) * i, y);
    ctx.lineTo(x + (width / 4) * i, y + height);
    ctx.stroke();
  }
  for (let i = 1; i < 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + (height / 2) * i);
    ctx.lineTo(x + width, y + (height / 2) * i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeatHotspotMarkers(ctx, ox, oy, scaleX, scaleY = scaleX, showText = true) {
  const hotspots = getFloorLoadCells(state.activeContainerNo, HEATMAP_COLUMNS, HEATMAP_ROWS)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
  hotspots.forEach((cell, index) => {
    const cx = ox + (cell.x + cell.length / 2) * scaleX;
    const cy = oy + (cell.y + cell.width / 2) * scaleY;
    ctx.save();
    ctx.fillStyle = "#252F45";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 13 - index * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), cx, cy + 0.5);
    if (showText) {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#252F45";
      ctx.font = "12px sans-serif";
      ctx.fillText(`${cell.density.toFixed(0)} 千克/平方米`, cx + 16, cy + 4);
    }
    ctx.restore();
  });
}

function drawHeatLegend(ctx, x, y, width) {
  const gradient = ctx.createLinearGradient(x, y, x + Math.min(width, 260), y);
  gradient.addColorStop(0, "#007892");
  gradient.addColorStop(0.45, "#E84368");
  gradient.addColorStop(0.72, "#FF5D00");
  gradient.addColorStop(1, "#E31D1C");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, Math.min(width, 260), 10);
  ctx.fillStyle = "#415461";
  ctx.font = "12px sans-serif";
  ctx.fillText("低", x, y + 28);
  ctx.fillText("相对较高", x + 98, y + 28);
  ctx.fillText("最高热点", x + 210, y + 28);
  ctx.restore();
}

function drawHeatSummaryPanel(ctx, x, y, width, height, hottest, lightest) {
  const suggestion = getFloorLoadSuggestion();
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "#d3dce6";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#252F45";
  ctx.font = "700 15px sans-serif";
  ctx.fillText("承重复核", x + 16, y + 28);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#415461";
  const lines = [
    `上限 ${state.floorLoadLimit.toLocaleString()} 千克/平方米`,
    `最高 ${hottest?.label || "-"} ${hottest ? hottest.density.toFixed(0) : 0} 千克/平方米`,
    `最低 ${lightest?.label || "-"} ${lightest ? lightest.density.toFixed(0) : 0} 千克/平方米`,
    suggestion ? `建议 ${suggestion.text}` : "建议 当前无需调整",
  ];
  lines.forEach((line, index) => {
    wrapCanvasText(ctx, line, x + 16, y + 58 + index * 52, width - 32, 18);
  });
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  let offset = 0;
  [...text].forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset);
      line = char;
      offset += lineHeight;
    } else {
      line = next;
    }
  });
  if (line) ctx.fillText(line, x, y + offset);
}

function drawSide(ctx, width, height, container) {
  const margin = 34;
  const scale = Math.min((width - margin * 2) / container.length, (height - margin * 2) / container.height);
  const ox = (width - container.length * scale) / 2;
  const oy = (height + container.height * scale) / 2;
  drawRectFrame(ctx, ox, oy - container.height * scale, container.length * scale, container.height * scale, "侧视图");
  getVisiblePacked().forEach((box) => {
    ctx.fillStyle = box.color;
    ctx.globalAlpha = 0.96;
    ctx.fillRect(ox + box.x * scale, oy - (box.z + box.height) * scale, box.length * scale, box.height * scale);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(37, 47, 69, 0.62)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(ox + box.x * scale, oy - (box.z + box.height) * scale, box.length * scale, box.height * scale);
    ctx.lineWidth = 1;
    if (boxKey(box) === state.selectedBoxKey) {
      ctx.strokeStyle = "#252F45";
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + box.x * scale, oy - (box.z + box.height) * scale, box.length * scale, box.height * scale);
      ctx.lineWidth = 1;
    }
  });
}

function drawTopHeatmap(ctx, ox, oy, scale) {
  getFloorLoadCells(state.activeContainerNo, HEATMAP_COLUMNS, HEATMAP_ROWS).forEach((zone) => {
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.min(0.34, zone.visualRate * 0.3);
    ctx.fillStyle = zone.color;
    ctx.fillRect(ox + zone.x * scale, oy + zone.y * scale, zone.length * scale, zone.width * scale);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
  drawHeatHotspotMarkers(ctx, ox, oy, scale);
}

function drawIso(ctx, width, height, container) {
  const projectedFrame = projectBox(
    { x: 0, y: 0, z: 0, length: container.length, width: container.width, height: container.height },
    { x: 0, y: 0 },
    0.08,
    0.045,
    0.1
  );
  const bounds = getProjectedBounds(Object.values(projectedFrame));
  const scale = Math.min((width - 70) / bounds.width, (height - 70) / bounds.height);
  const sx = 0.08 * scale;
  const sy = 0.045 * scale;
  const sz = 0.1 * scale;
  const origin = {
    x: 35 - bounds.minX * scale + (width - 70 - bounds.width * scale) / 2,
    y: 35 - bounds.minY * scale + (height - 70 - bounds.height * scale) / 2,
  };

  const points = projectBox({ x: 0, y: 0, z: 0, length: container.length, width: container.width, height: container.height }, origin, sx, sy, sz);
  ctx.strokeStyle = "#7d8998";
  ctx.lineWidth = 1.5;
  drawWireBox(ctx, points);
  if (state.showHeatmap) drawIsoHeatmap(ctx, origin, sx, sy);

  [...getVisiblePacked()]
    .sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z))
    .forEach((box) => {
      const projected = projectBox(box, origin, sx, sy, sz);
      drawSolidBox(ctx, projected, box.color);
      if (boxKey(box) === state.selectedBoxKey) drawSelectionBox(ctx, projected);
    });
}

function drawIsoHeatmap(ctx, origin, sx, sy) {
  getFloorLoadZones(state.activeContainerNo).forEach((zone) => {
    const corners = [
      projectPoint(zone.x, zone.y, 0, origin, sx, sy, 0),
      projectPoint(zone.x + zone.length, zone.y, 0, origin, sx, sy, 0),
      projectPoint(zone.x + zone.length, zone.y + zone.width, 0, origin, sx, sy, 0),
      projectPoint(zone.x, zone.y + zone.width, 0, origin, sx, sy, 0),
    ];
    drawPolygon(ctx, corners, zone.color, 0.16 + Math.min(0.26, zone.rate * 0.2));
    if (zone.index === state.selectedHeatZone) {
      ctx.save();
      ctx.strokeStyle = "#252F45";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      corners.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  });
}

function projectPoint(x, y, z, origin, sx, sy, sz) {
  return {
    x: origin.x + (x - y) * sx,
    y: origin.y + (x + y) * sy - z * sz,
  };
}

function drawPolygon(ctx, points, fill, alpha) {
  ctx.save();
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(37, 47, 69, 0.18)";
  ctx.stroke();
  ctx.restore();
}

function getProjectedBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function projectBox(box, origin, sx, sy, sz) {
  const project = (x, y, z) => ({
    x: origin.x + (x - y) * sx,
    y: origin.y + (x + y) * sy - z * sz,
  });
  const x0 = box.x;
  const y0 = box.y;
  const z0 = box.z;
  const x1 = box.x + box.length;
  const y1 = box.y + box.width;
  const z1 = box.z + box.height;
  return {
    a: project(x0, y0, z0),
    b: project(x1, y0, z0),
    c: project(x1, y1, z0),
    d: project(x0, y1, z0),
    e: project(x0, y0, z1),
    f: project(x1, y0, z1),
    g: project(x1, y1, z1),
    h: project(x0, y1, z1),
  };
}

function drawSolidBox(ctx, p, color) {
  drawFace(ctx, [p.e, p.f, p.g, p.h], lighten(color, 18));
  drawFace(ctx, [p.b, p.c, p.g, p.f], color);
  drawFace(ctx, [p.d, p.c, p.g, p.h], darken(color, 14));
  ctx.strokeStyle = "rgba(37,47,69,0.45)";
  ctx.lineWidth = 1.1;
  drawWireBox(ctx, p);
  ctx.lineWidth = 1;
}

function drawSelectionBox(ctx, p) {
  ctx.save();
  ctx.strokeStyle = "#252F45";
  ctx.lineWidth = 3;
  drawWireBox(ctx, p);
  ctx.restore();
}

function drawWireBox(ctx, p) {
  [
    [p.a, p.b, p.c, p.d, p.a],
    [p.e, p.f, p.g, p.h, p.e],
    [p.a, p.e],
    [p.b, p.f],
    [p.c, p.g],
    [p.d, p.h],
  ].forEach((line) => {
    ctx.beginPath();
    line.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  });
}

function drawFace(ctx, points, fill) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.98;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRectFrame(ctx, x, y, width, height, label) {
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#7f909d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#536575";
  ctx.font = "13px sans-serif";
  ctx.fillText(label, x + 10, y + 22);
}

function lighten(hex, amount) {
  return adjustColor(hex, amount);
}

function darken(hex, amount) {
  return adjustColor(hex, -amount);
}

function adjustColor(hex, amount) {
  const value = hex.replace("#", "");
  const parts = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  return `#${parts
    .map((part) => Math.max(0, Math.min(255, part + amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function renderReport() {
  const { packed, unpacked, metrics } = state.result;
  const container = getContainer();
  const grouped = packed.reduce((map, box) => {
    const key = box.name;
    map[key] = map[key] || { count: 0, weight: 0, volume: 0 };
    map[key].count += 1;
    map[key].weight += box.weight;
    map[key].volume += box.length * box.width * box.height;
    return map;
  }, {});

  els.reportSummary.innerHTML = [
    ["任务", state.project.name || "未命名"],
    ["箱型", container.name],
    ["使用箱数", `${metrics.usedContainers} / ${state.maxContainers}`],
    ["空间利用", formatPercent(metrics.volumeRate)],
    ["重量利用", formatPercent(metrics.weightRate)],
    ["已装 / 未装", `${packed.length} / ${unpacked.length}`],
  ]
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  const cargoLines = Object.entries(grouped)
    .map(
      ([name, item]) =>
        `- ${name}: ${item.count} 件, ${item.weight.toFixed(1)} 千克, ${(item.volume / 1e9).toFixed(2)} 立方米`
    )
    .join("\n");
  const sequenceLines = getLoadingSequence()
    .slice(0, 80)
    .map((box, index) => `${index + 1}. 箱${box.containerNo || 1} ${box.unitId} ${box.name} ${box.group || "默认"} 纵向=${Math.round(box.x)} 横向=${Math.round(box.y)} 高度=${Math.round(box.z)}`)
    .join("\n");
  const floorSuggestion = getFloorLoadSuggestion();
  const floorLoadLines = getFloorLoadZones(state.activeContainerNo)
    .sort((a, b) => b.rate - a.rate)
    .map((zone) => `- ${zone.label}: ${zone.weight.toFixed(0)} 千克, ${zone.density.toFixed(0)} 千克/平方米, 占上限 ${formatPercent(zone.rate)}, 主要货物 ${zone.contributors.slice(0, 2).map((item) => `${item.name}#${item.unitId}`).join("、") || "无"}`)
    .join("\n");
  const positionLines = packed
    .slice(0, 160)
    .map(
      (box) =>
        `箱${String(box.containerNo || 1).padEnd(2)} ${box.unitId.padEnd(6)} ${box.name.padEnd(12)} 纵向=${Math.round(box.x)
          .toString()
          .padStart(5)} 横向=${Math.round(box.y).toString().padStart(5)} 高度=${Math.round(box.z)
          .toString()
          .padStart(5)} 层=${box.stackLayer || 1} ${box.length}×${box.width}×${box.height} ${box.rotation}`
    )
    .join("\n");
  const unpackedLines = unpacked.map((box) => `- ${box.name} #${box.unitId}: ${box.reason}`).join("\n") || "无";

  els.reportText.textContent = `装箱报告
任务名称: ${state.project.name || "未命名"}
客户/订单: ${state.project.customer || "未填写"}
操作员: ${state.project.operator || "未填写"}
装箱日期: ${state.project.date || "未填写"}
箱型: ${container.name}
使用箱数: ${metrics.usedContainers} / ${state.maxContainers}
空间利用率: ${formatPercent(metrics.volumeRate)}
重量利用率: ${formatPercent(metrics.weightRate)}
装载重量: ${metrics.loadedWeight.toFixed(1)} 千克 / ${(container.maxWeight * metrics.usedContainers).toFixed(0)} 千克
重心: 纵向=${Math.round(metrics.center.x)}毫米, 横向=${Math.round(metrics.center.y)}毫米, 高度=${Math.round(metrics.center.z)}毫米
数据校验: ${state.validation.length === 0 ? "通过" : `${state.validation.length} 项需修正`}

货物汇总
${cargoLines || "无"}

建议装载顺序
${sequenceLines || "无"}

箱底承重复核（当前查看箱，上限 ${state.floorLoadLimit.toLocaleString()} 千克/平方米）
${floorLoadLines || "无"}
调整建议
${floorSuggestion ? floorSuggestion.text : "当前没有明显需要调整的承重区域。"}

摆放坐标
${positionLines || "无"}

未装货物
${unpackedLines}
`;
}

function downloadCsv() {
  const header = ["箱号", "货物编号", "名称", "分组", "坐标X", "坐标Y", "坐标Z", "堆叠层", "长", "宽", "高", "重量", "旋转方向"];
  const rows = state.result.packed.map((box) => [
    box.containerNo || 1,
    box.unitId,
    box.name,
    box.group || "",
    Math.round(box.x),
    Math.round(box.y),
    Math.round(box.z),
    box.stackLayer || 1,
    box.length,
    box.width,
    box.height,
    box.weight,
    box.rotation,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "装箱结果.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportProject() {
  saveProject();
  downloadText(
    `${safeFilename(state.project.name || "Cstar装箱项目")}.json`,
    JSON.stringify(serializeProject(), null, 2),
    "application/json;charset=utf-8"
  );
}

function handleProjectImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(String(reader.result));
      applyProject(project, true);
      temporaryButtonText(els.exportProjectBtn, "项目已打开");
    } catch (error) {
      alert("项目文件无法读取，请确认是从本软件导出的项目文件。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function downloadTemplate() {
  const link = document.createElement("a");
  link.href = "./templates/Cstar货物导入模板.xlsx";
  link.download = "Cstar货物导入模板.xlsx";
  link.click();
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value) {
  return String(value).trim().replace(/[\\/:*?"<>|]+/g, "-") || "Cstar装箱项目";
}

function temporaryButtonText(button, text) {
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1300);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function handleCargoFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const rows = await readCargoRows(file);
    state.cargo = rowsToCargo(rows);
    renderCargoTable();
    runPacking();
    saveProject();
  } catch (error) {
    alert(error.message || "货物文件导入失败。");
  } finally {
    event.target.value = "";
  }
}

async function readCargoRows(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) return parseXlsxRows(await file.arrayBuffer());
  if (name.endsWith(".docx")) return parseDocxRows(await file.arrayBuffer());
  throw new Error("暂不支持该文件格式。请导入逗号表、工作簿或文字文档。");
}

function rowsToCargo(rows) {
  const [header, ...body] = rows.filter((row) => row.some((cell) => String(cell || "").trim()));
  if (!header) throw new Error("货物文件为空。");
  const normalized = header.map((name) => normalizeHeader(name));
  const cargo = body
    .filter((row) => row.some(Boolean))
    .map((row) => {
      const record = Object.fromEntries(normalized.map((name, index) => [name, row[index]]));
      return {
        name: record.name || "导入货物",
        length: parseNumber(record.length),
        width: parseNumber(record.width),
        height: parseNumber(record.height),
        weight: parseNumber(record.weight),
        quantity: parseNumber(record.quantity) || 1,
        group: record.group || record.destination || "默认",
        rotatable: parseBool(record.rotatable, true),
        tiltable: parseBool(record.tiltable, true),
        stackable: parseBool(record.stackable, true),
        maxStackLayers: parseNumber(record.maxStackLayers) || 6,
        priority: parseNumber(record.priority) || 2,
      };
    });
  if (cargo.length === 0) throw new Error("没有读取到货物行。请确认第一行是字段名，后续行是货物数据。");
  return normalizeCargo(cargo);
}

function normalizeHeader(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "");
  const map = {
    name: "name",
    名称: "name",
    货物名称: "name",
    品名: "name",
    cargo: "name",
    length: "length",
    len: "length",
    长: "length",
    长度: "length",
    长mm: "length",
    width: "width",
    宽: "width",
    宽度: "width",
    宽mm: "width",
    height: "height",
    高: "height",
    高度: "height",
    高mm: "height",
    weight: "weight",
    重量: "weight",
    重量kg: "weight",
    单重: "weight",
    quantity: "quantity",
    qty: "quantity",
    数量: "quantity",
    group: "group",
    destination: "group",
    分组: "group",
    目的地: "group",
    客户: "group",
    rotatable: "rotatable",
    可旋转: "rotatable",
    旋转: "rotatable",
    stackable: "stackable",
    可堆叠: "stackable",
    堆叠: "stackable",
    maxstacklayers: "maxStackLayers",
    stacklayers: "maxStackLayers",
    最大层数: "maxStackLayers",
    最大堆叠层数: "maxStackLayers",
    堆叠层数: "maxStackLayers",
    tiltable: "tiltable",
    可倾斜: "tiltable",
    禁止倾斜: "tiltable",
    倾斜: "tiltable",
    priority: "priority",
    优先级: "priority",
  };
  return map[key] || key;
}

function parseNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function parseXlsxRows(arrayBuffer) {
  const files = await unzipFiles(arrayBuffer);
  const workbook = parseXml(textDecode(files["xl/workbook.xml"]));
  const rels = parseXml(textDecode(files["xl/_rels/workbook.xml.rels"]));
  const firstSheet = nodesByName(workbook, "sheet")[0];
  if (!firstSheet) throw new Error("工作簿没有工作表。");
  const relId = firstSheet.getAttribute("r:id");
  const rel = nodesByName(rels, "Relationship").find((item) => item.getAttribute("Id") === relId);
  const target = rel?.getAttribute("Target") || "worksheets/sheet1.xml";
  const sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
  const sheetXml = files[sheetPath] || files["xl/worksheets/sheet1.xml"];
  if (!sheetXml) throw new Error("没有读取到工作簿第一个工作表。");
  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const sheet = parseXml(textDecode(sheetXml));
  const rows = [];
  nodesByName(sheet, "row").forEach((rowNode) => {
    const row = [];
    nodesByName(rowNode, "c").forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const index = columnIndex(ref.replace(/\d+/g, ""));
      row[index] = readXlsxCell(cell, sharedStrings);
    });
    rows.push(row.map((value) => value ?? ""));
  });
  return rows;
}

function parseSharedStrings(bytes) {
  if (!bytes) return [];
  const xml = parseXml(textDecode(bytes));
  return nodesByName(xml, "si").map((item) =>
    nodesByName(item, "t").map((textNode) => textNode.textContent || "").join("")
  );
}

function readXlsxCell(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  const value = nodesByName(cell, "v")[0]?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  if (type === "inlineStr") return nodesByName(cell, "t")[0]?.textContent || "";
  return value;
}

function columnIndex(column) {
  if (!column) return 0;
  return [...column.toUpperCase()].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

async function parseDocxRows(arrayBuffer) {
  const files = await unzipFiles(arrayBuffer);
  const documentXml = files["word/document.xml"];
  if (!documentXml) throw new Error("没有读取到文字文档内容。");
  const xml = parseXml(textDecode(documentXml));
  const tables = nodesByName(xml, "tbl").map((table) =>
    nodesByName(table, "tr").map((row) =>
      nodesByName(row, "tc").map((cell) =>
        nodesByName(cell, "t").map((textNode) => textNode.textContent || "").join("")
      )
    )
  );
  const cargoTable = tables.find((table) => table.length > 1 && table[0].some((cell) => normalizeHeader(cell) === "name"));
  if (cargoTable) return cargoTable;
  const paragraphs = nodesByName(xml, "p")
    .map((paragraph) => nodesByName(paragraph, "t").map((node) => node.textContent || "").join(""))
    .filter(Boolean);
  const csvLike = paragraphs.filter((line) => line.includes(",") || line.includes("\t"));
  if (csvLike.length > 1) return csvLike.map((line) => line.split(line.includes("\t") ? "\t" : ","));
  throw new Error("文字文档中没有找到货物表格。请把货物清单放在表格中，第一行为字段名。");
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function nodesByName(root, localName) {
  return [...root.getElementsByTagName("*")].filter((node) => node.localName === localName || node.nodeName === localName);
}

function textDecode(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function unzipFiles(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const eocd = findEndOfCentralDirectory(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const files = {};
  let offset = centralOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = textDecode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    files[name] = await readZipEntry(bytes, localOffset, compressedSize, method);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function findEndOfCentralDirectory(bytes) {
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  throw new Error("文件不是有效的 XLSX/DOCX 格式。");
}

async function readZipEntry(bytes, localOffset, compressedSize, method) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("压缩包结构异常。");
  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed;
  if (method !== 8) throw new Error("文件使用了暂不支持的压缩方式。");
  if (!("DecompressionStream" in window)) {
    throw new Error("当前浏览器不支持离线解压 XLSX/DOCX，请使用最新版 Chrome、Edge 或 Safari。");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseBool(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["true", "1", "yes", "y", "是", "可"].includes(String(value).trim().toLowerCase());
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 1000) / 10}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // 离线缓存失败不影响主流程，静默跳过即可。
  });
}

window.onLanguageChanged = function () {
  try {
    renderContainerOptions();
    renderContainerSpecs();
    renderStrategyFields();
    renderCargoTable();
    if (state.result) {
      renderResults();
      renderActiveContainerOptions();
      renderMoveControls();
      renderPlaybackControls();
      renderInsights();
      renderFloorLoadHeatmap();
      renderLoadingSequence();
      renderValidation();
      renderLegend();
      renderCanvas();
      renderReport();
    }
  } catch (error) {
    // 切换语言时局部重绘失败不应中断界面。
  }
};

init();
