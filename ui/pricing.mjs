import {
  DEFAULT_PRICING_INPUT,
  TRANSPORT_MODE_LABELS,
  MODE_ETA_LABELS,
  calculatePricing,
  formatMoney
} from "./modules/pricing-calculator.mjs";
import {
  findCommissionNodesByPath,
  loadCommissionTree,
  parseCommissionRateFromTier
} from "./modules/commission-tree.js";

const STORAGE_KEY = "ozon_pricing_calculator_v1";

const state = {
  ...DEFAULT_PRICING_INPUT,
  ...readSavedState()
};

const els = {
  form: document.getElementById("pricing-form"),
  commissionRate: document.getElementById("commission-rate"),
  commissionCascader: document.getElementById("commission-cascader"),
  commissionSearch: document.getElementById("commission-search"),
  commissionClear: document.getElementById("commission-clear"),
  commissionDropdown: document.getElementById("commission-dropdown"),
  commissionHint: document.getElementById("commission-hint"),
  procurementCostCny: document.getElementById("procurement-cost"),
  packageWeightG: document.getElementById("package-weight"),
  lengthCm: document.getElementById("length-cm"),
  widthCm: document.getElementById("width-cm"),
  heightCm: document.getElementById("height-cm"),
  targetMarginRate: document.getElementById("target-margin"),
  frontDiscountRate: document.getElementById("front-discount"),
  preferredMode: document.getElementById("preferred-mode"),
  domesticFeeCny: document.getElementById("domestic-fee"),
  adRate: document.getElementById("ad-rate"),
  otherRate: document.getElementById("other-rate"),
  resultHint: document.getElementById("result-hint"),
  salePriceCny: document.getElementById("sale-price-cny"),
  salePriceRub: document.getElementById("sale-price-rub"),
  salePriceUsd: document.getElementById("sale-price-usd"),
  oldPriceCny: document.getElementById("old-price-cny"),
  oldPriceRub: document.getElementById("old-price-rub"),
  oldPriceUsd: document.getElementById("old-price-usd"),
  logisticsCards: document.getElementById("logistics-cards"),
  selectedChannel: document.getElementById("selected-channel"),
  detailTable: document.getElementById("detail-table"),
  noteBox: document.getElementById("note-box"),
  resetBtn: document.getElementById("reset-btn")
};

let commissionTree = [];
let commissionTreePromise = null;
let commissionSelectionPath = Array.isArray(state.commissionCategoryPath)
  ? state.commissionCategoryPath.map((value) => String(value)).filter(Boolean)
  : [];
let commissionActivePath = commissionSelectionPath.slice(0, 2);
let commissionSearchKeyword = "";
let commissionHoverLockUntil = 0;

bootstrap();

function bootstrap() {
  populateForm();
  bindEvents();
  render();
}

function readSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateCommissionHint(message, rate = null) {
  if (!els.commissionHint) {
    return;
  }
  const suffix = Number.isFinite(Number(rate)) ? ` 当前佣金：<strong>${Number(rate)}%</strong>` : "";
  els.commissionHint.innerHTML = `${message}${suffix}`;
}

function getCommissionPathNodes(path = commissionSelectionPath) {
  return findCommissionNodesByPath(commissionTree, path);
}

function getCommissionDisplayText(path = commissionSelectionPath) {
  const nodes = getCommissionPathNodes(path);
  if (nodes.length) {
    return nodes.map((node) => node.label).join(" / ");
  }
  return Array.isArray(state.commissionCategoryLabels) && state.commissionCategoryLabels.length
    ? state.commissionCategoryLabels.join(" / ")
    : "";
}

function normalizeCommissionSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function updateCommissionInputText() {
  if (!els.commissionSearch) {
    return;
  }
  els.commissionSearch.value = commissionSearchKeyword || getCommissionDisplayText();
  if (els.commissionClear) {
    els.commissionClear.hidden = !els.commissionSearch.value;
  }
}

function syncCommissionRateFromSelection() {
  const nodes = getCommissionPathNodes();
  const tier = nodes[2];
  const rate = parseCommissionRateFromTier(tier);
  if (Number.isFinite(rate)) {
    state.commissionRate = rate;
    if (els.commissionRate) {
      els.commissionRate.value = String(rate);
    }
    state.commissionCategoryPath = nodes.map((node) => String(node.value));
    state.commissionCategoryLabels = nodes.map((node) => String(node.label));
    state.commissionTierLabel = String(tier?.label || "");
    updateCommissionHint(`已选择：${state.commissionCategoryLabels.join(" / ")}。`, rate);
    saveState();
    render();
    return;
  }
  updateCommissionHint("请选择完整的佣金类目和售价区间。", state.commissionRate);
}

function setCommissionSelectionPath(path = []) {
  commissionSelectionPath = Array.isArray(path) ? path.map(String).filter(Boolean) : [];
  commissionActivePath = commissionSelectionPath.slice(0, 2);
  commissionSearchKeyword = "";
  updateCommissionInputText();
  syncCommissionRateFromSelection();
}

function setCommissionPickerDisabled(disabled) {
  if (els.commissionSearch) {
    els.commissionSearch.disabled = disabled;
  }
  if (els.commissionClear) {
    els.commissionClear.disabled = disabled;
  }
}

function isCommissionDropdownOpen() {
  return Boolean(els.commissionDropdown && !els.commissionDropdown.hidden);
}

function positionCommissionDropdown() {
  const dropdown = els.commissionDropdown;
  const cascader = els.commissionCascader;
  if (!dropdown || !cascader || dropdown.hidden) {
    return;
  }
  const fieldRect = cascader.closest(".field")?.getBoundingClientRect() || cascader.getBoundingClientRect();
  const width = Math.min(720, Math.max(fieldRect.width, window.innerWidth - fieldRect.left - 48));
  dropdown.style.left = "0";
  dropdown.style.top = "calc(100% + 6px)";
  dropdown.style.width = `${width}px`;
}

function getCommissionChildren(path = []) {
  if (!path.length) {
    return commissionTree;
  }
  const nodes = getCommissionPathNodes(path);
  const last = nodes[nodes.length - 1];
  return Array.isArray(last?.children) ? last.children : [];
}

function createCommissionItem(node, path, { active = false, selected = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "commission-cascader-item";
  button.classList.toggle("is-active", active);
  button.classList.toggle("is-selected", selected);

  const label = document.createElement("span");
  label.className = "commission-cascader-item-label";
  label.textContent = String(node?.label || "");
  button.appendChild(label);

  if (Array.isArray(node?.children) && node.children.length) {
    const arrow = document.createElement("span");
    arrow.className = "commission-cascader-item-arrow";
    arrow.textContent = "›";
    button.appendChild(arrow);
  }

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("mouseenter", () => {
    if (Date.now() < commissionHoverLockUntil) {
      return;
    }
    if (Array.isArray(node?.children) && node.children.length) {
      if (path.join("|") === commissionActivePath.slice(0, path.length).join("|")) {
        return;
      }
      commissionActivePath = path;
      renderCommissionDropdown();
    }
  });
  button.addEventListener("click", () => {
    if (Array.isArray(node?.children) && node.children.length) {
      commissionActivePath = path;
      commissionSearchKeyword = "";
      updateCommissionInputText();
      renderCommissionDropdown();
      return;
    }
    setCommissionSelectionPath(path);
    closeCommissionDropdown();
  });

  return button;
}

function appendCommissionMenu(parent, items, depth) {
  const menu = document.createElement("div");
  menu.className = "commission-cascader-menu";
  menu.dataset.depth = String(depth);
  items.forEach((node) => {
    const nodeValue = String(node?.value ?? "");
    const path = [...commissionActivePath.slice(0, depth), nodeValue];
    const isActive = String(commissionActivePath[depth]) === nodeValue;
    const isSelected = String(commissionSelectionPath[depth]) === nodeValue;
    menu.appendChild(createCommissionItem(node, path, { active: isActive, selected: isSelected }));
  });
  parent.appendChild(menu);
}

function collectCommissionDropdownScrollState() {
  const dropdown = els.commissionDropdown;
  const scrollState = new Map();
  if (!dropdown) {
    return scrollState;
  }
  dropdown.querySelectorAll(".commission-cascader-menu, .commission-cascader-search").forEach((node, index) => {
    const key = node.classList.contains("commission-cascader-menu")
      ? `menu:${node.dataset.depth || index}`
      : "search";
    scrollState.set(key, node.scrollTop);
  });
  return scrollState;
}

function restoreCommissionDropdownScrollState(scrollState) {
  const dropdown = els.commissionDropdown;
  if (!dropdown || !scrollState?.size) {
    return;
  }
  const applyScrollState = () => {
    dropdown.querySelectorAll(".commission-cascader-menu, .commission-cascader-search").forEach((node, index) => {
      const key = node.classList.contains("commission-cascader-menu")
        ? `menu:${node.dataset.depth || index}`
        : "search";
      if (scrollState.has(key)) {
        node.scrollTop = scrollState.get(key);
      }
    });
  };
  applyScrollState();
  requestAnimationFrame(applyScrollState);
}

function finishCommissionDropdownRender(scrollState) {
  positionCommissionDropdown();
  restoreCommissionDropdownScrollState(scrollState);
}

function collectCommissionSearchResults(nodes, keyword, path = [], acc = []) {
  if (acc.length >= 120) {
    return acc;
  }
  nodes.forEach((node) => {
    const nextPath = [...path, String(node?.value ?? "")];
    const children = Array.isArray(node?.children) ? node.children : [];
    if (children.length) {
      collectCommissionSearchResults(children, keyword, nextPath, acc);
      return;
    }
    const pathNodes = findCommissionNodesByPath(commissionTree, nextPath);
    const text = normalizeCommissionSearch(pathNodes.map((item) => item.label).join(" / "));
    const rate = parseCommissionRateFromTier(node);
    if (text.includes(keyword) || String(rate).includes(keyword.replace("%", ""))) {
      acc.push({ path: nextPath, nodes: pathNodes });
    }
  });
  return acc;
}

function renderCommissionSearchResults(dropdown) {
  const keyword = normalizeCommissionSearch(commissionSearchKeyword);
  const list = document.createElement("div");
  list.className = "commission-cascader-search";
  const results = keyword ? collectCommissionSearchResults(commissionTree, keyword) : [];
  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "commission-cascader-empty";
    empty.textContent = keyword ? "没有匹配的佣金类目" : "请输入类目关键词";
    list.appendChild(empty);
    dropdown.appendChild(list);
    return;
  }
  results.forEach((result) => {
    const leaf = result.nodes[result.nodes.length - 1];
    const button = createCommissionItem(leaf, result.path, {
      selected: result.path.join("|") === commissionSelectionPath.join("|")
    });
    button.querySelector(".commission-cascader-item-label").textContent =
      result.nodes.map((node) => node.label).join(" / ");
    list.appendChild(button);
  });
  dropdown.appendChild(list);
}

function renderCommissionDropdown() {
  const dropdown = els.commissionDropdown;
  if (!dropdown) {
    return;
  }
  const scrollState = collectCommissionDropdownScrollState();
  dropdown.replaceChildren();
  if (!commissionTree.length) {
    const empty = document.createElement("div");
    empty.className = "commission-cascader-empty";
    empty.textContent = "佣金类目加载中...";
    dropdown.appendChild(empty);
    finishCommissionDropdownRender(scrollState);
    return;
  }
  if (commissionSearchKeyword) {
    renderCommissionSearchResults(dropdown);
    finishCommissionDropdownRender(scrollState);
    return;
  }
  if (!commissionActivePath[0] && commissionTree[0]) {
    commissionActivePath = [String(commissionTree[0].value ?? "")];
    const firstChild = Array.isArray(commissionTree[0].children) ? commissionTree[0].children[0] : null;
    if (firstChild) {
      commissionActivePath.push(String(firstChild.value ?? ""));
    }
  }
  appendCommissionMenu(dropdown, commissionTree, 0);
  if (commissionActivePath[0]) {
    appendCommissionMenu(dropdown, getCommissionChildren(commissionActivePath.slice(0, 1)), 1);
  }
  if (commissionActivePath[1]) {
    appendCommissionMenu(dropdown, getCommissionChildren(commissionActivePath.slice(0, 2)), 2);
  }
  finishCommissionDropdownRender(scrollState);
}

async function ensureCommissionTreeLoaded() {
  if (commissionTree.length) {
    return commissionTree;
  }
  if (!commissionTreePromise) {
    setCommissionPickerDisabled(true);
    updateCommissionHint("正在加载平台佣金类目...", state.commissionRate);
    commissionTreePromise = loadCommissionTree().then(({ tree, source, error }) => {
      commissionTree = tree;
      setCommissionPickerDisabled(false);
      if (!tree.length) {
        updateCommissionHint(`佣金类目加载失败，仍使用当前佣金。${error?.message || ""}`, state.commissionRate);
        return tree;
      }
      updateCommissionHint(source === "cache" ? "已使用本地缓存。" : "已加载最新类目。", state.commissionRate);
      return tree;
    });
  }
  return commissionTreePromise;
}

async function openCommissionDropdown() {
  if (!els.commissionDropdown) {
    return;
  }
  els.commissionDropdown.hidden = false;
  commissionActivePath = commissionSelectionPath.slice(0, 2);
  positionCommissionDropdown();
  renderCommissionDropdown();
  await ensureCommissionTreeLoaded();
  renderCommissionDropdown();
}

function closeCommissionDropdown() {
  if (els.commissionDropdown) {
    els.commissionDropdown.hidden = true;
  }
  commissionSearchKeyword = "";
  updateCommissionInputText();
}

function handleCommissionDropdownWheel(event) {
  const dropdown = els.commissionDropdown;
  if (!dropdown || dropdown.hidden || !dropdown.contains(event.target)) {
    return;
  }
  commissionHoverLockUntil = Date.now() + 180;
  const scrollTarget = event.target.closest(".commission-cascader-menu, .commission-cascader-search");
  if (!scrollTarget) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const maxScrollTop = scrollTarget.scrollHeight - scrollTarget.clientHeight;
  const canScroll =
    maxScrollTop > 0 &&
    ((event.deltaY < 0 && scrollTarget.scrollTop > 0) ||
      (event.deltaY > 0 && scrollTarget.scrollTop < maxScrollTop));
  if (!canScroll) {
    event.preventDefault();
  }
  event.stopPropagation();
}

function bindCommissionPickerEvents() {
  els.commissionSearch?.addEventListener("focus", () => {
    els.commissionSearch.select();
    void openCommissionDropdown();
  });
  els.commissionSearch?.addEventListener("input", (event) => {
    event.stopPropagation();
    commissionSearchKeyword = els.commissionSearch.value;
    if (els.commissionClear) {
      els.commissionClear.hidden = !commissionSearchKeyword;
    }
    if (!isCommissionDropdownOpen()) {
      void openCommissionDropdown();
      return;
    }
    renderCommissionDropdown();
  });
  els.commissionSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCommissionDropdown();
    }
  });
  els.commissionClear?.addEventListener("click", (event) => {
    event.stopPropagation();
    commissionSelectionPath = [];
    commissionActivePath = [];
    commissionSearchKeyword = "";
    delete state.commissionCategoryPath;
    delete state.commissionCategoryLabels;
    delete state.commissionTierLabel;
    updateCommissionInputText();
    updateCommissionHint("请选择完整的佣金类目和售价区间。", state.commissionRate);
    saveState();
    void openCommissionDropdown();
  });
  document.addEventListener("mousedown", (event) => {
    if (
      isCommissionDropdownOpen() &&
      !els.commissionCascader?.contains(event.target) &&
      !els.commissionDropdown?.contains(event.target)
    ) {
      closeCommissionDropdown();
    }
  }, true);
  els.commissionDropdown?.addEventListener("wheel", handleCommissionDropdownWheel, { passive: false });
  window.addEventListener("resize", positionCommissionDropdown);
}

function populateForm() {
  updateCommissionInputText();
  Object.entries({
    commissionRate: state.commissionRate,
    procurementCostCny: state.procurementCostCny,
    packageWeightG: state.packageWeightG,
    lengthCm: state.lengthCm,
    widthCm: state.widthCm,
    heightCm: state.heightCm,
    targetMarginRate: state.targetMarginRate,
    frontDiscountRate: state.frontDiscountRate,
    preferredMode: state.preferredMode,
    domesticFeeCny: state.domesticFeeCny,
    adRate: state.adRate,
    otherRate: state.otherRate
  }).forEach(([key, value]) => {
    const element = els[key];
    if (element) {
      element.value = String(value);
    }
  });
}

function bindEvents() {
  els.form?.addEventListener("input", onFormChange);
  els.form?.addEventListener("change", onFormChange);
  bindCommissionPickerEvents();
  els.resetBtn?.addEventListener("click", () => {
    Object.assign(state, DEFAULT_PRICING_INPUT);
    delete state.commissionCategoryPath;
    delete state.commissionCategoryLabels;
    delete state.commissionTierLabel;
    commissionSelectionPath = [];
    commissionActivePath = [];
    commissionSearchKeyword = "";
    populateForm();
    updateCommissionHint("请选择完整的佣金类目和售价区间。", state.commissionRate);
    saveState();
    render();
  });
}

function onFormChange() {
  Object.keys(DEFAULT_PRICING_INPUT).forEach((key) => {
    if (els[key]) {
      state[key] = els[key].value;
    }
  });
  saveState();
  render();
}

function render() {
  const result = calculatePricing(state);
  renderCards(result);
  renderSelected(result);
  renderDetail(result);
  renderNotes(result);
}

function renderCards(result) {
  els.logisticsCards.innerHTML = "";
  result.bestByMode.forEach((entry) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "logistics-card";
    const isSelected = result.selected?.mode === entry.mode;
    const isDisabled = !entry.best;
    card.classList.toggle("is-selected", isSelected);
    card.classList.toggle("is-disabled", isDisabled);
    card.disabled = isDisabled;

    if (entry.best) {
      const best = entry.best;
      card.innerHTML = `
        <span class="mode-name">${TRANSPORT_MODE_LABELS[entry.mode]}</span>
        <span class="mode-transport">${best.tariff.transportLabel}</span>
        <strong>${formatMoney(best.crossBorderFeeCny)}</strong>
        <span>${best.tariff.tierLabel} · ${best.tariff.tierDesc}</span>
        <span>${MODE_ETA_LABELS[entry.mode] || "时效待补充"}</span>
      `;
      card.addEventListener("click", () => {
        state.preferredMode = entry.mode;
        populateForm();
        saveState();
        render();
      });
    } else {
      card.innerHTML = `
        <span class="mode-name">${TRANSPORT_MODE_LABELS[entry.mode]}</span>
        <span class="mode-transport">当前参数不可用</span>
        <strong>—</strong>
        <span>${entry.invalidReasons[0] || "请调整重量、尺寸或费率。"}</span>
        <span>${MODE_ETA_LABELS[entry.mode] || ""}</span>
      `;
    }

    els.logisticsCards.appendChild(card);
  });
}

function renderSelected(result) {
  const selected = result.selected;
  if (!selected) {
    els.resultHint.textContent = "当前参数下没有可用物流渠道。优先检查重量、尺寸上限，或降低目标毛利。";
    els.salePriceCny.textContent = "—";
    els.salePriceRub.textContent = "—";
    els.salePriceUsd.textContent = "—";
    els.oldPriceCny.textContent = "—";
    els.oldPriceRub.textContent = "—";
    els.oldPriceUsd.textContent = "—";
    els.selectedChannel.textContent = "未匹配到可用渠道";
    return;
  }

  const autoMode = String(state.preferredMode).toLowerCase() === "auto";
  const baseHint = autoMode
    ? `已为您匹配到最优物流方式 ${selected.tariff.channelName}（${selected.tariff.tierDesc}）`
    : `当前按 ${TRANSPORT_MODE_LABELS[selected.mode]} 模式计算，命中 ${selected.tariff.channelName}`;
  const hintParts = [baseHint];
  if (selected.autoRaisedWeight) {
    hintParts.push(`由于尺寸已落入大件区间，重量已从 ${Math.round(selected.originalWeightKg * 1000)}g 自动抬到 ${Math.round(selected.effectiveWeightKg * 1000)}g 后再计算。`);
  }
  if (selected.priceRaisedToValueBand) {
    hintParts.push(`为满足该货值档最低售价，已从 ¥${selected.targetSalePriceCny} 抬到 ¥${selected.salePriceCny} 后参与渠道比较。`);
  }
  els.resultHint.textContent = hintParts.join(" ");
  els.salePriceCny.textContent = formatMoney(selected.salePriceCny);
  els.salePriceRub.textContent = formatMoney(selected.salePriceRub, "RUB");
  els.salePriceUsd.textContent = formatMoney(selected.salePriceUsd, "USD");
  els.oldPriceCny.textContent = formatMoney(selected.strikethroughPriceCny);
  els.oldPriceRub.textContent = formatMoney(selected.strikethroughPriceRub, "RUB");
  els.oldPriceUsd.textContent = formatMoney(selected.strikethroughPriceUsd, "USD");
  els.selectedChannel.textContent = `${selected.tariff.channelName} · ${selected.tariff.transportLabel} · 计费重 ${selected.billableWeightKg}kg`;
}

function renderDetail(result) {
  const selected = result.selected;
  if (!selected) {
    els.detailTable.innerHTML = `<tr><td colspan="3" class="empty-state">暂无可展示的计费明细。</td></tr>`;
    return;
  }

  const rows = [
    ["商品利润", "利润（毛利）", formatMoney(selected.grossProfitCny)],
    ["商品利润", "利润率", `${Number(selected.grossMarginRate ?? state.targetMarginRate)}%`],
    ["商品成本", "采购成本", formatMoney(state.procurementCostCny)],
    ["商品成本", "国内运费 + 代贴单", formatMoney(state.domesticFeeCny)],
    ["商品成本", "其他（提现 / 货损等）", formatMoney(selected.otherFeeCny)],
    ["商品成本", "跨境运费", formatMoney(selected.crossBorderFeeCny)],
    ["平台费用", "尾程派送费", formatMoney(selected.lastMileFeeCny)],
    ["平台费用", `平台佣金（${state.commissionRate}%）`, formatMoney(selected.commissionFeeCny)],
    ["平台费用", "广告费", formatMoney(selected.adFeeCny)],
    ["物流信息", "渠道类型", `${selected.tariff.tierLabel} · ${selected.tariff.tierDesc}`],
    ["物流信息", "运输方式", selected.tariff.transportLabel],
    [
      "物流信息",
      "区间判定重量",
      selected.autoRaisedWeight
        ? `${selected.originalWeightKg.toFixed(3)} kg → ${selected.effectiveWeightKg.toFixed(3)} kg`
        : `${selected.effectiveWeightKg.toFixed(3)} kg`
    ],
    ["物流信息", "计费重量", `${selected.billableWeightKg} kg`],
    ["物流信息", "运费公式", `${selected.tariff.ratePerKg}元/kg + ${selected.tariff.ticketFee}元/票`],
    ["结果", "建议售价", formatMoney(selected.salePriceCny)],
    ["结果", "前台划线价", formatMoney(selected.strikethroughPriceCny)]
  ];

  els.detailTable.innerHTML = rows
    .map(
      ([group, label, value]) => `
        <tr>
          <td>${group}</td>
          <td>${label}</td>
          <td>${value}</td>
        </tr>
      `
    )
    .join("");
}

function renderNotes(result) {
  const selected = result.selected;
  const notes = [
    "运费规则来自《GUOO 产品资费测算表》中 “GUOO realFBS资费试算表”。",
    "Big / Premium Big 渠道按实重与抛重取大值，抛重系数为 12000。",
    "当尺寸已落到大件区间、但输入重量低于该区间最低重量时，系统会按“最低重量 + 100g”自动抬重后再计算。",
    "尾程派送费按 OZON rFBS 常见口径：售价的 2%，最低 15 ₽，最高 200 ₽。",
    "货值区间命中已改为按人民币售价判断，其中 7000 ₽ 档按 ¥635 作为分界。",
    "前台划线价按“售价 ÷ (1 - 促销活动)”反推。"
  ];
  if (selected?.batteryNote) {
    notes.push(`渠道限制：${selected.batteryNote}`);
  }
  els.noteBox.innerHTML = notes.map((item) => `<li>${item}</li>`).join("");
}
