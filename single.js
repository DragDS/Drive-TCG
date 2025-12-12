// single.js
// Single-card editor: inputs, preview, prints, and card library.
// Hardened: safe when AppState.cards/currentSinglePrints are not initialized yet.

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
  return String(str)
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseTags(str) {
  if (!str) return [];
  return String(str)
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
  if (!el) return "";
  const v = el.value;
  return v == null ? "" : String(v).trim();
}

function setValue(el, val) {
  if (!el) return;
  el.value = val ?? "";
}

/**
 * Ensure required AppState fields exist even before loadCards finishes.
 */
function ensureSingleState() {
  if (!Array.isArray(AppState.cards)) AppState.cards = [];
  if (!Array.isArray(AppState.currentSinglePrints)) AppState.currentSinglePrints = [];
}

function formatExtraForSummary(card) {
  const e = card.extra || {};
  if (card.type === "Mod") {
    const levels = [e.modLevel1, e.modLevel2, e.modLevel3, e.modLevel4]
      .filter(v => v !== undefined && v !== null && String(v).trim() !== "")
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
 * Normalize a raw card object into the internal shape.
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

  const printsRaw = Array.isArray(base.prints) ? base.prints : [];
  let prints = printsRaw
    .map(p => ({
      setName: String((p.setName || p.setId || "")).trim(),
      cardNumber: String((p.cardNumber || "")).trim(),
      isPrimary: !!p.isPrimary
    }))
    .filter(p => p.setName || p.cardNumber);

  let setName = String((base.setName || base.setId || "")).trim();
  let cardNumber = String((base.cardNumber || base.cardNo || "")).trim();

  if (!prints.length && (setName || cardNumber)) {
    prints = [{ setName, cardNumber, isPrimary: true }];
  }

  if (!setName && prints[0]) setName = prints[0].setName || "";
  if (!cardNumber && prints[0]) cardNumber = prints[0].cardNumber || "";

  // ensure there is a primary print if prints exist
  if (prints.length && !prints.some(p => p.isPrimary)) prints[0].isPrimary = true;

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

// Export prints as { setId, cardNumber }
function serializeCardForExport(card) {
  const clean = JSON.parse(JSON.stringify(card));
  if (Array.isArray(clean.prints)) {
    clean.prints = clean.prints.map(p => ({
      setId: p.setId || p.setName || "",
      cardNumber: p.cardNumber || ""
    }));
  }
  return clean;
}

export function getCardsForExport() {
  ensureSingleState();
  return AppState.cards.map(serializeCardForExport);
}

/**
 * Optional feature: hide/show fields by type.
 * (Your admin.html doesn't include .field-grid, so this is naturally a no-op.)
 */
function updateTypeFieldVisibility() {
  if (!Dom.cardTypeInput) return;
  const type = Dom.cardTypeInput.value || "";
  const fields = document.querySelectorAll('.field-grid .field[data-for-types]');
  fields.forEach(field => {
    const typesAttr = field.dataset.forTypes || "";
    const allowed = typesAttr.split(",").map(t => t.trim()).filter(Boolean);
    field.style.display = (!allowed.length || allowed.includes(type)) ? "" : "none";
  });
}

/************************************************************
 * Single Card Preview & Library
 ************************************************************/
function renderSinglePreview() {
  ensureSingleState();
  if (!Dom.cardNameInput || !Dom.singlePreview) return;

  const name = getTrimmedValue(Dom.cardNameInput) || "Untitled Card";
  const type = getTrimmedValue(Dom.cardTypeInput) || "Type ?";
  const setName = getTrimmedValue(Dom.cardSetNameInput) || "Set ?";
  const cardNumber = getTrimmedValue(Dom.cardNumberInput) || "###";
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

  const prints =
    (AppState.currentSinglePrints && AppState.currentSinglePrints.length)
      ? AppState.currentSinglePrints
      : ((getTrimmedValue(Dom.cardSetNameInput) || getTrimmedValue(Dom.cardNumberInput))
        ? [{ setName, cardNumber: getTrimmedValue(Dom.cardNumberInput), isPrimary: true }]
        : []);

  const card = {
    id: getTrimmedValue(Dom.cardIdInput) || "(not saved yet)",
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

  const container = Dom.singlePreview;
  container.innerHTML = "";

  // Minimal preview (uses your existing CSS hooks if present)
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
  if (card.setName || card.cardNumber) {
    const printSpan = document.createElement("span");
    printSpan.className = "chip key";
    printSpan.textContent = `${card.setName || "Set ?"} • ${card.cardNumber || "###"}`;
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
      chip.textContent = `${p.isPrimary ? "★ " : ""}${p.setName || p.setId || "SET ?"} #${p.cardNumber || "###"}`;
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
  ensureSingleState();
  if (!Dom.cardLibraryList || !Dom.cardLibrarySearchInput || !Dom.libraryCount) return;

  const list = Dom.cardLibraryList;
  const search = (Dom.cardLibrarySearchInput.value || "").toLowerCase().trim();
  list.innerHTML = "";

  const source = Array.isArray(AppState.cards) ? AppState.cards : [];
  const filtered = source.filter(c => {
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

    if (card.setName || card.cardNumber) {
      const pChip = document.createElement("span");
      pChip.className = "chip key";
      pChip.textContent = `${card.setName || "Set ?"} • ${card.cardNumber || "###"}`;
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

    li.addEventListener("click", () => fillSingleCardInputs(card));
    list.appendChild(li);
  });
}

/************************************************************
 * Prints Management
 ************************************************************/
function renderPrintsList() {
  ensureSingleState();
  if (!Dom.printsList) return;

  const list = Dom.printsList;
  list.innerHTML = "";

  if (!AppState.currentSinglePrints.length) {
    const li = document.createElement("li");
    li.textContent = "No prints defined yet.";
    list.appendChild(li);
    return;
  }

  AppState.currentSinglePrints.forEach((p, idx) => {
    const li = document.createElement("li");
    li.textContent = `${p.isPrimary ? "★ " : ""}${p.setName || "Set ?"} #${p.cardNumber || "###"}`;

    li.addEventListener("click", () => {
      AppState.currentSinglePrints.splice(idx, 1);
      if (AppState.currentSinglePrints.length && !AppState.currentSinglePrints.some(pr => pr.isPrimary)) {
        AppState.currentSinglePrints[0].isPrimary = true;
      }
      renderPrintsList();
      renderSinglePreview();
    });

    list.appendChild(li);
  });
}

function handleSetPrintPrimary() {
  ensureSingleState();
  if (!AppState.currentSinglePrints.length) return;
  const idx = Math.max(0, AppState.currentSinglePrints.length - 1);
  AppState.currentSinglePrints = AppState.currentSinglePrints.map((p, i) => ({ ...p, isPrimary: i === idx }));
  renderPrintsList();
  renderSinglePreview();
}

function handleClearAllPrints() {
  ensureSingleState();
  AppState.currentSinglePrints = [];
  renderPrintsList();
  renderSinglePreview();
}

/************************************************************
 * Single Card Editor: Collect & Fill
 ************************************************************/
function collectSingleCardFromInputs() {
  ensureSingleState();

  const type = getTrimmedValue(Dom.cardTypeInput);
  const name = getTrimmedValue(Dom.cardNameInput);
  const setName = getTrimmedValue(Dom.cardSetNameInput);
  const cardNumber = getTrimmedValue(Dom.cardNumberInput);
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

  const prints =
    AppState.currentSinglePrints.length
      ? AppState.currentSinglePrints
      : ((setName || cardNumber) ? [{ setName, cardNumber, isPrimary: true }] : []);

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
  ensureSingleState();
  const c = normalizeCardShape(card);

  setValue(Dom.cardIdInput, c.id || "");
  setValue(Dom.cardNameInput, c.name || "");
  setValue(Dom.cardTypeInput, c.type || "");
  setValue(Dom.cardSetNameInput, c.setName || "");
  setValue(Dom.cardNumberInput, c.cardNumber || "");
  setValue(Dom.cardRarityInput, c.rarity || "");

  setValue(Dom.cardVehicleTypesInput, (c.vehicleTypes || []).join(", "));
  setValue(Dom.cardTagsInput, (c.tags || []).join(", "));
  setValue(Dom.cardImageUrlInput, c.imageUrl || "");
  setValue(Dom.cardNotesInput, c.notes || "");

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
    setValue(Dom.vehiclePitCostInput, (c.extra.pitCost ?? "") === "" ? "" : String(c.extra.pitCost));
  } else {
    setValue(Dom.vehicleHpConInput, "");
    setValue(Dom.vehiclePitCostInput, "");
  }

  AppState.currentSinglePrints = Array.isArray(c.prints) ? c.prints.map(p => ({ ...p })) : [];
  if (AppState.currentSinglePrints.length && !AppState.currentSinglePrints.some(p => p.isPrimary)) {
    AppState.currentSinglePrints[0].isPrimary = true;
  }

  renderPrintsList();
  updateTypeFieldVisibility();
  renderSinglePreview();
}

/************************************************************
 * Single Card Editor: Save / New / Delete
 ************************************************************/
async function handleSingleSave() {
  ensureSingleState();
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
  ensureSingleState();

  setValue(Dom.cardIdInput, "");
  setValue(Dom.cardNameInput, "");
  setValue(Dom.cardTypeInput, "Crew");
  setValue(Dom.cardSetNameInput, "");
  setValue(Dom.cardNumberInput, "");
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
  if (Dom.singleStatus) Dom.singleStatus.textContent = "Ready to create a new card.";

  updateTypeFieldVisibility();
  renderPrintsList();
  renderSinglePreview();
}

function confirmAction(title, body) {
  return new Promise(resolve => {
    if (!Dom.modalTitle || !Dom.modalBody || !Dom.modalBackdrop || !Dom.modalCancelBtn || !Dom.modalConfirmBtn) {
      resolve(window.confirm(`${title}\n\n${body}`));
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
  ensureSingleState();

  const id = getTrimmedValue(Dom.cardIdInput);
  if (!id) {
    if (Dom.singleStatus) Dom.singleStatus.textContent = "No card selected to delete.";
    return;
  }

  const card = AppState.cards.find(c => c.id === id);
  const name = card ? card.name : id;

  const ok = await confirmAction("Delete Card", `Are you sure you want to delete "${name}"? This cannot be undone.`);
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
  ensureSingleState();

  updateTypeFieldVisibility();
  renderPrintsList();
  renderSinglePreview();

  if (Dom.cardTypeInput) {
    Dom.cardTypeInput.addEventListener("change", () => {
      updateTypeFieldVisibility();
      renderSinglePreview();
    });
  }

  const previewInputs = [
    Dom.cardNameInput,
    Dom.cardSetNameInput,
    Dom.cardNumberInput,
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

  if (Dom.cardLibrarySearchInput) {
    Dom.cardLibrarySearchInput.addEventListener("input", renderCardLibraryList);
  }

  if (Dom.printSetPrimaryBtn) Dom.printSetPrimaryBtn.addEventListener("click", handleSetPrintPrimary);
  if (Dom.printClearAllBtn) Dom.printClearAllBtn.addEventListener("click", handleClearAllPrints);

  if (Dom.singleSaveBtn) Dom.singleSaveBtn.addEventListener("click", handleSingleSave);
  if (Dom.singleNewBtn) Dom.singleNewBtn.addEventListener("click", handleSingleNew);
  if (Dom.singleDeleteBtn) Dom.singleDeleteBtn.addEventListener("click", handleSingleDelete);
}

/**
 * Called after cards have changed (e.g. after loadCards or bulk import).
 */
export function refreshSingleUi() {
  ensureSingleState();
  renderSinglePreview();
  renderCardLibraryList();
}
