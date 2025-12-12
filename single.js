// single.js
// Single-card editor: inputs, preview, prints, and card library.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";

/************************************************************
 * Utilities / shared helpers
 ************************************************************/

export function generateId() {
  return "card_" + Math.random().toString(36).slice(2, 10);
}

export function parseVehicleTypes(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseTags(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseHpCon(str) {
  if (!str) return {};
  const parts = String(str).split("/");
  const hp = parts[0] !== undefined && parts[0] !== "" ? Number(parts[0]) : undefined;
  const con = parts[1] !== undefined && parts[1] !== "" ? Number(parts[1]) : undefined;
  return { hp, con };
}

function formatHpCon(extra) {
  if (!extra) return "";
  const hp = extra.hp;
  const con = extra.con;
  if (hp === undefined && con === undefined) return "";
  return `${hp ?? "?"}/${con ?? "?"}`;
}

/**
 * Safe DOM helpers so missing inputs don’t crash.
 */
function getTrimmedValue(el) {
  return el && typeof el.value === "string" ? el.value.trim() : "";
}

function setValue(el, val) {
  if (!el) return;
  el.value = val;
}

function getPrimaryPrint(prints) {
  const arr = Array.isArray(prints) ? prints : [];
  return arr.find(p => p && p.isPrimary) || arr[0] || null;
}

function syncLegacySetNumberFromPrints() {
  const p = getPrimaryPrint(AppState.currentSinglePrints);
  const setName = p?.setName || "";
  const cardNumber = p?.cardNumber || "";

  // These inputs are hidden in the UI, but kept so downstream code stays compatible
  setValue(Dom.cardSetNameInput, setName);
  setValue(Dom.cardNumberInput, cardNumber);
}

function formatExtraForSummary(card) {
  const e = card.extra || {};
  if (card.type === "Mod") {
    const levels = [e.modLevel1, e.modLevel2, e.modLevel3, e.modLevel4]
      .filter(Boolean)
      .join(" / ");
    return `Base: ${e.modBasePart || "?"}${levels ? " | Lvls: " + levels : ""}`;
  }
  if (card.type === "Vehicle" || card.type === "Named Vehicle") {
    const parts = [];
    if (e.hp !== undefined || e.con !== undefined) {
      parts.push(`HP/CON: ${e.hp || "?"}/${e.con || "?"}`);
    }
    if (e.pitCost !== undefined) {
      parts.push(`PIT: ${e.pitCost}`);
    }
    return parts.join(" | ");
  }
  return "";
}

/**
 * Normalize a raw card object from JSON or bulk import into the internal shape.
 * - Accepts old prints: [{ setId, cardNumber }]
 * - Accepts new prints: [{ setName, cardNumber }]
 * - If no prints array but setName/cardNumber fields exist, synthesizes one.
 * - Ensures card.setName/cardNumber are aligned with the PRIMARY print (or first print).
 */
export function normalizeCardShape(raw) {
  const base = raw || {};

  const vehicleTypes = Array.isArray(base.vehicleTypes)
    ? base.vehicleTypes
    : (base.vehicleTypes ? [].concat(base.vehicleTypes) : []);

  const tags = Array.isArray(base.tags)
    ? base.tags
    : (base.tags ? [].concat(base.tags) : []);

  const extra = (base.extra && typeof base.extra === "object")
    ? { ...base.extra }
    : {};

  // Normalize prints
  const printsRaw = Array.isArray(base.prints) ? base.prints : [];
  let prints = printsRaw
    .map(p => ({
      setName: (p.setName || p.setId || "").trim(),
      cardNumber: (p.cardNumber || "").trim(),
      isPrimary: !!p.isPrimary
    }))
    .filter(p => p.setName || p.cardNumber);

  // If no prints but legacy root fields exist, synthesize one
  let legacySet = (base.setName || base.setId || "").trim();
  let legacyNum = (base.cardNumber || base.cardNo || "").trim();
  if (!prints.length && (legacySet || legacyNum)) {
    prints = [{ setName: legacySet, cardNumber: legacyNum, isPrimary: true }];
  }

  // If multiple prints and none marked primary, mark first
  if (prints.length && !prints.some(p => p.isPrimary)) {
    prints[0].isPrimary = true;
  }

  // Ensure primary print is first (so the exported legacy fields are consistent everywhere)
  if (prints.length) {
    const primaryIdx = prints.findIndex(p => p.isPrimary);
    if (primaryIdx > 0) {
      const [p] = prints.splice(primaryIdx, 1);
      prints.unshift(p);
    }
  }

  const primary = prints[0] || null;
  const setName = primary?.setName || "";
  const cardNumber = primary?.cardNumber || "";

  return {
    id: base.id || generateId(),
    name: base.name || "",
    type: base.type || "",
    setName,
    cardNumber,
    rarity: base.rarity || "",
    vehicleTypes,
    tags,
    imageUrl: base.imageUrl || "",
    notes: base.notes || "",
    extra,
    prints
  };
}

// When exporting to drive-card.json, convert prints back to { setId, cardNumber }
function serializeCardForExport(card) {
  const clean = JSON.parse(JSON.stringify(card));
  if (Array.isArray(clean.prints)) {
    clean.prints = clean.prints.map(p => ({
      setId: p.setId || p.setName || "",
      cardNumber: p.cardNumber || "",
      isPrimary: !!p.isPrimary
    }));
  }
  // ensure legacy root fields match primary print
  const primary = getPrimaryPrint(clean.prints);
  clean.setName = primary?.setId || primary?.setName || "";
  clean.cardNumber = primary?.cardNumber || "";
  return clean;
}

export function getCardsForExport() {
  return AppState.cards.map(serializeCardForExport);
}

/************************************************************
 * Single Card Preview & Library
 ************************************************************/
function renderSinglePreview() {
  if (!Dom.cardNameInput || !Dom.singlePreview) return;

  // Always sync legacy hidden fields from PRIMARY PRINT before rendering
  syncLegacySetNumberFromPrints();

  const name = getTrimmedValue(Dom.cardNameInput) || "Untitled Card";
  const type = getTrimmedValue(Dom.cardTypeInput) || "Type ?";
  const rarity = getTrimmedValue(Dom.cardRarityInput) || "Common";

  const vehicleTypes = parseVehicleTypes(getTrimmedValue(Dom.cardVehicleTypesInput));
  const tags = parseTags(getTrimmedValue(Dom.cardTagsInput));

  const extra = {};
  if (type === "Mod") {
    extra.modBasePart = getTrimmedValue(Dom.modBasePartInput) || "";
    extra.modLevel1 = getTrimmedValue(Dom.modL1Input) || "";
    extra.modLevel2 = getTrimmedValue(Dom.modL2Input) || "";
    extra.modLevel3 = getTrimmedValue(Dom.modL3Input) || "";
    extra.modLevel4 = getTrimmedValue(Dom.modL4Input) || "";
  } else if (type === "Vehicle" || type === "Named Vehicle") {
    const hpCon = parseHpCon(getTrimmedValue(Dom.vehicleHpConInput));
    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    const pitVal = getTrimmedValue(Dom.vehiclePitCostInput);
    extra.pitCost = pitVal ? Number(pitVal) : undefined;
  }

  const prints = Array.isArray(AppState.currentSinglePrints)
    ? AppState.currentSinglePrints
    : [];

  const primary = getPrimaryPrint(prints);
  const primarySet = primary?.setName || "";
  const primaryNum = primary?.cardNumber || "";

  const card = {
    id: getTrimmedValue(Dom.cardIdInput) || "(not saved yet)",
    name,
    type,
    setName: primarySet,
    cardNumber: primaryNum,
    rarity,
    vehicleTypes,
    tags,
    imageUrl: getTrimmedValue(Dom.cardImageUrlInput),
    notes: getTrimmedValue(Dom.cardNotesInput),
    extra,
    prints
  };

  const container = Dom.singlePreview;
  container.innerHTML = "";

  const frame = document.createElement("div");
  frame.className = "card-preview";

  const header = document.createElement("div");
  header.className = "card-preview-header";
  const titleEl = document.createElement("h2");
  titleEl.textContent = card.name;
  header.appendChild(titleEl);

  const metaLine = document.createElement("div");
  metaLine.className = "meta-row";

  const leftMeta = document.createElement("div");
  leftMeta.className = "meta-left";
  const typeSpan = document.createElement("span");
  typeSpan.className = "chip";
  typeSpan.textContent = card.type || "Type ?";
  leftMeta.appendChild(typeSpan);

  if (card.rarity) {
    const rarSpan = document.createElement("span");
    rarSpan.className = "chip";
    rarSpan.textContent = card.rarity;
    leftMeta.appendChild(rarSpan);
  }

  const rightMeta = document.createElement("div");
  rightMeta.className = "meta-right";

  // ✅ Only show the blue print chip if a primary print exists
  if (primarySet || primaryNum) {
    const printSpan = document.createElement("span");
    printSpan.className = "chip key";
    printSpan.textContent = `${primarySet || "SET ?"} • ${primaryNum || "###"}`;
    rightMeta.appendChild(printSpan);
  }

  metaLine.appendChild(leftMeta);
  metaLine.appendChild(rightMeta);

  const body = document.createElement("div");
  body.className = "card-preview-body";

  const imgWrap = document.createElement("div");
  imgWrap.className = "card-preview-img";
  if (card.imageUrl) {
    const img = document.createElement("img");
    img.src = card.imageUrl;
    img.alt = card.name || "Card image";
    imgWrap.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = "No image URL set. This area will show your card art.";
    imgWrap.appendChild(span);
  }

  const textWrap = document.createElement("div");
  textWrap.className = "card-preview-text";

  const line1 = document.createElement("div");
  line1.className = "meta-row";
  if (vehicleTypes.length) {
    const vtSpan = document.createElement("span");
    vtSpan.className = "chip";
    vtSpan.textContent = `Vehicle Type(s): ${vehicleTypes.join(", ")}`;
    line1.appendChild(vtSpan);
  }
  if (tags.length) {
    const tSpan = document.createElement("span");
    tSpan.className = "chip";
    tSpan.textContent = `Tags: ${tags.join(", ")}`;
    line1.appendChild(tSpan);
  }
  textWrap.appendChild(line1);

  const line2 = document.createElement("div");
  line2.className = "meta-row";
  const extraSummary = formatExtraForSummary(card);
  if (extraSummary) {
    const exSpan = document.createElement("span");
    exSpan.className = "chip";
    exSpan.textContent = extraSummary;
    line2.appendChild(exSpan);
  }
  textWrap.appendChild(line2);

  const notesDiv = document.createElement("div");
  notesDiv.className = "notes-area";
  notesDiv.textContent = card.notes || "Card notes and rules text will appear here.";
  textWrap.appendChild(notesDiv);

  body.appendChild(imgWrap);
  body.appendChild(textWrap);

  const footer = document.createElement("div");
  footer.className = "card-preview-footer";
  const printsInfo = document.createElement("div");
  printsInfo.className = "meta-row";
  const printsLabel = document.createElement("span");
  printsLabel.textContent = "Prints:";
  printsInfo.appendChild(printsLabel);

  if (prints.length) {
    prints.forEach(p => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const primaryMark = p.isPrimary ? "★ " : "";
      chip.textContent = `${primaryMark}${p.setName || "SET ?"} #${p.cardNumber || "###"}`;
      printsInfo.appendChild(chip);
    });
  } else {
    const noneSpan = document.createElement("span");
    noneSpan.className = "chip";
    noneSpan.textContent = "No prints defined yet.";
    printsInfo.appendChild(noneSpan);
  }

  footer.appendChild(printsInfo);

  frame.appendChild(header);
  frame.appendChild(metaLine);
  frame.appendChild(body);
  frame.appendChild(footer);

  container.appendChild(frame);
}

function renderCardLibraryList() {
  if (!Dom.cardLibraryList || !Dom.cardLibrarySearchInput || !Dom.libraryCount) return;

  const list = Dom.cardLibraryList;
  const search = (Dom.cardLibrarySearchInput.value || "").toLowerCase();
  list.innerHTML = "";

  const filtered = AppState.cards.filter(c => {
    const name = (c.name || "").toLowerCase();
    const type = (c.type || "").toLowerCase();
    const tags = (Array.isArray(c.tags) ? c.tags.join(" ") : String(c.tags || "")).toLowerCase();
    return !search || name.includes(search) || type.includes(search) || tags.includes(search);
  });

  Dom.libraryCount.textContent = `${filtered.length} cards`;

  filtered.sort((a, b) => {
    const setA = (a.setName || "").localeCompare(b.setName || "");
    if (setA !== 0) return setA;
    const numA = (a.cardNumber || "").localeCompare(b.cardNumber || "", undefined, { numeric: true });
    if (numA !== 0) return numA;
    return (a.name || "").localeCompare(b.name || "");
  });

  filtered.forEach(card => {
    const li = document.createElement("li");
    li.className = "library-item";

    const header = document.createElement("div");
    header.className = "header";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = card.name || "(no name)";
    header.appendChild(title);

    const chips = document.createElement("div");
    chips.className = "chips";

    if (card.type) {
      const tChip = document.createElement("span");
      tChip.className = "chip";
      tChip.textContent = card.type;
      chips.appendChild(tChip);
    }

    if (card.rarity) {
      const rChip = document.createElement("span");
      rChip.className = "chip";
      rChip.textContent = card.rarity;
      chips.appendChild(rChip);
    }

    // show derived legacy set/card (from primary print)
    if (card.setName || card.cardNumber) {
      const pChip = document.createElement("span");
      pChip.className = "chip key";
      pChip.textContent = `${card.setName || "SET ?"} • ${card.cardNumber || "###"}`;
      chips.appendChild(pChip);
    }

    header.appendChild(chips);
    li.appendChild(header);

    const sub = document.createElement("div");
    sub.className = "sub";
    const vt = Array.isArray(card.vehicleTypes) ? card.vehicleTypes.join(", ") : "";
    const tg = Array.isArray(card.tags) ? card.tags.join(", ") : "";
    sub.textContent = [vt, tg].filter(Boolean).join(" • ");
    li.appendChild(sub);

    li.addEventListener("click", () => {
      fillSingleCardInputs(card);
    });

    list.appendChild(li);
  });
}

/************************************************************
 * Prints Management (within Single Editor)
 ************************************************************/
function renderPrintsList() {
  if (!Dom.printsList) return;

  const list = Dom.printsList;
  list.innerHTML = "";

  if (!AppState.currentSinglePrints.length) {
    const li = document.createElement("li");
    li.textContent = "No prints defined yet.";
    list.appendChild(li);

    // keep legacy hidden fields empty if no prints
    syncLegacySetNumberFromPrints();
    return;
  }

  AppState.currentSinglePrints.forEach((p, idx) => {
    const li = document.createElement("li");
    const primaryMark = p.isPrimary ? "★ " : "";
    li.textContent = `${primaryMark}${p.setName || "Set ?"} #${p.cardNumber || "###"}`;

    li.addEventListener("click", () => {
      AppState.currentSinglePrints.splice(idx, 1);
      if (!AppState.currentSinglePrints.some(pr => pr.isPrimary) && AppState.currentSinglePrints[0]) {
        AppState.currentSinglePrints[0].isPrimary = true;
      }
      syncLegacySetNumberFromPrints();
      renderPrintsList();
      renderSinglePreview();
    });

    list.appendChild(li);
  });

  // keep derived legacy fields synced
  syncLegacySetNumberFromPrints();
}

function handleSetPrintPrimary() {
  if (!AppState.currentSinglePrints.length) return;
  const idx = Math.max(0, AppState.currentSinglePrints.length - 1);
  AppState.currentSinglePrints = AppState.currentSinglePrints.map((p, i) => ({
    ...p,
    isPrimary: i === idx
  }));
  syncLegacySetNumberFromPrints();
  renderPrintsList();
  renderSinglePreview();
}

function handleClearAllPrints() {
  AppState.currentSinglePrints = [];
  syncLegacySetNumberFromPrints();
  renderPrintsList();
  renderSinglePreview();
}

function handlePrintAdd() {
  if (!Dom.printSetSelect || !Dom.printCardNumberInput) return;

  const selected = Dom.printSetSelect.value;
  let setName = "";
  if (selected === "CUSTOM") {
    setName = getTrimmedValue(Dom.printCustomSetInput);
  } else {
    setName = selected || "";
  }
  const cardNumber = getTrimmedValue(Dom.printCardNumberInput);

  if (!setName && !cardNumber) {
    alert("Please provide at least a Set or Card Number for the print.");
    return;
  }

  const isFirst = AppState.currentSinglePrints.length === 0;
  AppState.currentSinglePrints.push({
    setName,
    cardNumber,
    isPrimary: isFirst
  });

  syncLegacySetNumberFromPrints();
  renderPrintsList();
  renderSinglePreview();
}

/************************************************************
 * Single Card Editor: Collect & Fill
 ************************************************************/
function collectSingleCardFromInputs() {
  const type = getTrimmedValue(Dom.cardTypeInput);
  const name = getTrimmedValue(Dom.cardNameInput);
  const rarity = getTrimmedValue(Dom.cardRarityInput);

  const vehicleTypes = parseVehicleTypes(getTrimmedValue(Dom.cardVehicleTypesInput));
  const tags = parseTags(getTrimmedValue(Dom.cardTagsInput));

  const extra = {};
  if (type === "Mod") {
    extra.modBasePart = getTrimmedValue(Dom.modBasePartInput) || "";
    extra.modLevel1 = getTrimmedValue(Dom.modL1Input) || "";
    extra.modLevel2 = getTrimmedValue(Dom.modL2Input) || "";
    extra.modLevel3 = getTrimmedValue(Dom.modL3Input) || "";
    extra.modLevel4 = getTrimmedValue(Dom.modL4Input) || "";
  } else if (type === "Vehicle" || type === "Named Vehicle") {
    const hpCon = parseHpCon(getTrimmedValue(Dom.vehicleHpConInput));
    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    const pitVal = getTrimmedValue(Dom.vehiclePitCostInput);
    extra.pitCost = pitVal ? Number(pitVal) : undefined;
  }

  const prints = Array.isArray(AppState.currentSinglePrints)
    ? AppState.currentSinglePrints
    : [];

  // derive legacy set/card from primary print
  const primary = getPrimaryPrint(prints);
  const setName = primary?.setName || "";
  const cardNumber = primary?.cardNumber || "";

  // sync hidden inputs too
  syncLegacySetNumberFromPrints();

  const card = {
    id: getTrimmedValue(Dom.cardIdInput) || generateId(),
    name,
    type,
    setName,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl: getTrimmedValue(Dom.cardImageUrlInput),
    notes: getTrimmedValue(Dom.cardNotesInput),
    extra,
    prints
  };

  return normalizeCardShape(card);
}

function fillSingleCardInputs(card) {
  const c = normalizeCardShape(card);

  setValue(Dom.cardIdInput, c.id || "");
  setValue(Dom.cardNameInput, c.name || "");
  setValue(Dom.cardTypeInput, c.type || "");
  setValue(Dom.cardRarityInput, c.rarity || "");

  setValue(Dom.cardVehicleTypesInput, (c.vehicleTypes || []).join(", "));
  setValue(Dom.cardTagsInput, (c.tags || []).join(", "));
  setValue(Dom.cardImageUrlInput, c.imageUrl || "");
  setValue(Dom.cardNotesInput, c.notes || "");

  // sync prints into editor state
  AppState.currentSinglePrints = Array.isArray(c.prints) ? c.prints.map(p => ({ ...p })) : [];
  if (AppState.currentSinglePrints.length && !AppState.currentSinglePrints.some(p => p.isPrimary)) {
    AppState.currentSinglePrints[0].isPrimary = true;
  }

  // update mod/vehicle inputs
  if (c.type === "Mod") {
    setValue(Dom.modBasePartInput, c.extra.modBasePart || "");
    setValue(Dom.modL1Input, c.extra.modLevel1 || "");
    setValue(Dom.modL2Input, c.extra.modLevel2 || "");
    setValue(Dom.modL3Input, c.extra.modLevel3 || "");
    setValue(Dom.modL4Input, c.extra.modLevel4 || "");
  } else {
    setValue(Dom.modBasePartInput, "");
    setValue(Dom.modL1Input, "");
    setValue(Dom.modL2Input, "");
    setValue(Dom.modL3Input, "");
    setValue(Dom.modL4Input, "");
  }

  if (c.type === "Vehicle" || c.type === "Named Vehicle") {
    setValue(Dom.vehicleHpConInput, formatHpCon(c.extra));
    setValue(
      Dom.vehiclePitCostInput,
      (c.extra.pitCost !== undefined && c.extra.pitCost !== null)
        ? String(c.extra.pitCost)
        : ""
    );
  } else {
    setValue(Dom.vehicleHpConInput, "");
    setValue(Dom.vehiclePitCostInput, "");
  }

  // keep legacy hidden fields synced (derived)
  syncLegacySetNumberFromPrints();

  renderPrintsList();
  renderSinglePreview();
}

/************************************************************
 * Save / New / Delete
 ************************************************************/
async function handleSingleSave() {
  const card = collectSingleCardFromInputs();
  const existingIndex = AppState.cards.findIndex(c => c.id === card.id);

  if (existingIndex >= 0) {
    AppState.cards[existingIndex] = card;
    if (Dom.singleStatus) Dom.singleStatus.textContent = `Updated card: ${card.name} (${card.id})`;
  } else {
    AppState.cards.push(card);
    if (Dom.singleStatus) Dom.singleStatus.textContent = `Added new card: ${card.name} (${card.id})`;
  }

  renderCardLibraryList();
  renderSinglePreview();
}

async function handleSingleNew() {
  setValue(Dom.cardIdInput, "");
  setValue(Dom.cardNameInput, "");
  setValue(Dom.cardTypeInput, "Crew");
  setValue(Dom.cardRarityInput, "Common");
  setValue(Dom.cardVehicleTypesInput, "");
  setValue(Dom.cardTagsInput, "");
  setValue(Dom.cardImageUrlInput, "");
  setValue(Dom.cardNotesInput, "");
  setValue(Dom.modBasePartInput, "");
  setValue(Dom.modL1Input, "");
  setValue(Dom.modL2Input, "");
  setValue(Dom.modL3Input, "");
  setValue(Dom.modL4Input, "");
  setValue(Dom.vehicleHpConInput, "");
  setValue(Dom.vehiclePitCostInput, "");

  AppState.currentSinglePrints = [];
  syncLegacySetNumberFromPrints();

  if (Dom.singleStatus) Dom.singleStatus.textContent = "Ready to create a new card.";
  renderPrintsList();
  renderSinglePreview();
}

function confirmAction(title, body) {
  return new Promise(resolve => {
    if (!Dom.modalTitle || !Dom.modalBody || !Dom.modalBackdrop ||
        !Dom.modalCancelBtn || !Dom.modalConfirmBtn) {
      const ok = window.confirm(`${title}\n\n${body}`);
      resolve(ok);
      return;
    }

    Dom.modalTitle.textContent = title;
    Dom.modalBody.textContent = body;
    Dom.modalBackdrop.classList.add("active");

    function cleanup(result) {
      Dom.modalBackdrop.classList.remove("active");
      Dom.modalCancelBtn.removeEventListener("click", onCancel);
      Dom.modalConfirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    }

    function onCancel() { cleanup(false); }
    function onConfirm() { cleanup(true); }

    Dom.modalCancelBtn.addEventListener("click", onCancel);
    Dom.modalConfirmBtn.addEventListener("click", onConfirm);
  });
}

async function handleSingleDelete() {
  const id = getTrimmedValue(Dom.cardIdInput);
  if (!id) {
    if (Dom.singleStatus) Dom.singleStatus.textContent = "No card selected to delete.";
    return;
  }

  const card = AppState.cards.find(c => c.id === id);
  const name = card ? card.name : id;

  const ok = await confirmAction(
    "Delete Card",
    `Are you sure you want to delete "${name}"? This cannot be undone.`
  );

  if (!ok) {
    if (Dom.singleStatus) Dom.singleStatus.textContent = "Delete cancelled.";
    return;
  }

  AppState.cards = AppState.cards.filter(c => c.id !== id);
  if (Dom.singleStatus) Dom.singleStatus.textContent = `Deleted card: ${name}`;
  await handleSingleNew();
  renderCardLibraryList();
}

/************************************************************
 * Public Init + refresh hook
 ************************************************************/
export function initSingle() {
  renderPrintsList();
  syncLegacySetNumberFromPrints();
  renderSinglePreview();

  const previewInputs = [
    Dom.cardNameInput,
    Dom.cardRarityInput,
    Dom.cardVehicleTypesInput,
    Dom.cardTagsInput,
    Dom.cardImageUrlInput,
    Dom.cardNotesInput,
    Dom.modBasePartInput,
    Dom.vehiclePitCostInput,
    Dom.modL1Input,
    Dom.modL2Input,
    Dom.modL3Input,
    Dom.modL4Input,
    Dom.vehicleHpConInput
  ].filter(Boolean);

  previewInputs.forEach(el => {
    el.addEventListener("input", renderSinglePreview);
    el.addEventListener("change", renderSinglePreview);
  });

  if (Dom.cardTypeInput) {
    Dom.cardTypeInput.addEventListener("change", renderSinglePreview);
  }

  if (Dom.cardLibrarySearchInput) {
    Dom.cardLibrarySearchInput.addEventListener("input", renderCardLibraryList);
  }

  if (Dom.printSetPrimaryBtn) Dom.printSetPrimaryBtn.addEventListener("click", handleSetPrintPrimary);
  if (Dom.printClearAllBtn) Dom.printClearAllBtn.addEventListener("click", handleClearAllPrints);

  if (Dom.printSetSelect) {
    Dom.printSetSelect.addEventListener("change", () => {
      if (Dom.printSetSelect.value === "CUSTOM" && Dom.printCustomSetInput) {
        Dom.printCustomSetInput.focus();
      }
    });
  }

  if (Dom.printCardNumberInput) {
    Dom.printCardNumberInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handlePrintAdd();
      }
    });
  }

  if (Dom.singleSaveBtn) Dom.singleSaveBtn.addEventListener("click", handleSingleSave);
  if (Dom.singleNewBtn) Dom.singleNewBtn.addEventListener("click", handleSingleNew);
  if (Dom.singleDeleteBtn) Dom.singleDeleteBtn.addEventListener("click", handleSingleDelete);
}

/**
 * Called after cards have changed (e.g. after loadCards or bulk import).
 */
export function refreshSingleUi() {
  renderSinglePreview();
  renderCardLibraryList();
}
