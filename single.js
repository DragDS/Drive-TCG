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
  const parts = str.split("/");
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
 * - Ensures card.setName/cardNumber are aligned with the first print.
 */
export function normalizeCardShape(raw) {
  const base = raw || {};

  // Vehicle types & tags
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
      cardNumber: (p.cardNumber || "").trim()
    }))
    .filter(p => p.setName || p.cardNumber);

  // Try to infer from root fields if needed
  let setName = (base.setName || base.setId || "").trim();
  let cardNumber = (base.cardNumber || base.cardNo || "").trim();

  if (!prints.length && (setName || cardNumber)) {
    prints = [{ setName, cardNumber }];
  }

  // If root fields are empty but we have prints, sync them from the first print
  if (!setName && prints[0]) setName = prints[0].setName || "";
  if (!cardNumber && prints[0]) cardNumber = prints[0].cardNumber || "";

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
      cardNumber: p.cardNumber || ""
    }));
  }
  return clean;
}

export function getCardsForExport() {
  return AppState.cards.map(serializeCardForExport);
}

function updateTypeFieldVisibility() {
  const type = Dom.cardTypeInput.value || "";
  const fields = document.querySelectorAll('.field-grid .field[data-for-types]');
  fields.forEach(field => {
    const typesAttr = field.dataset.forTypes || "";
    const allowed = typesAttr.split(",").map(t => t.trim()).filter(Boolean);
    if (!allowed.length || allowed.includes(type)) {
      field.style.display = "";
    } else {
      field.style.display = "none";
    }
  });
}

/************************************************************
 * Single Card Preview & Library
 ************************************************************/
function renderSinglePreview() {
  const name = Dom.cardNameInput.value.trim() || "Untitled Card";
  const type = Dom.cardTypeInput.value.trim() || "Type ?";
  const setName = Dom.cardSetNameInput.value.trim() || "Set ?";
  const cardNumber = Dom.cardNumberInput.value.trim() || "###";
  const rarity = Dom.cardRarityInput.value.trim() || "Common";

  const vehicleTypes = parseVehicleTypes(Dom.cardVehicleTypesInput.value);
  const tags = parseTags(Dom.cardTagsInput.value);

  const extra = {};
  if (type === "Mod") {
    extra.modBasePart = Dom.modBasePartInput.value.trim() || "";
    extra.modLevel1 = Dom.modL1Input.value.trim() || "";
    extra.modLevel2 = Dom.modL2Input.value.trim() || "";
    extra.modLevel3 = Dom.modL3Input.value.trim() || "";
    extra.modLevel4 = Dom.modL4Input.value.trim() || "";
  } else if (type === "Vehicle" || type === "Named Vehicle") {
    const hpCon = parseHpCon(Dom.vehicleHpConInput.value);
    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    const pitVal = Dom.vehiclePitCostInput.value.trim();
    extra.pitCost = pitVal ? Number(pitVal) : undefined;
  }

  const prints = AppState.currentSinglePrints.length
    ? AppState.currentSinglePrints
    : (Dom.cardSetNameInput.value || Dom.cardNumberInput.value
      ? [{
        setName: setName,
        cardNumber: Dom.cardNumberInput.value.trim()
      }]
      : []);

  const card = {
    id: Dom.cardIdInput.value.trim() || "(not saved yet)",
    name,
    type,
    setName,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl: Dom.cardImageUrlInput.value.trim(),
    notes: Dom.cardNotesInput.value.trim(),
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
      const primaryMark = p.isPrimary ? "★ " : "";
      chip.textContent = `${primaryMark}${p.setName || p.setId || "SET ?"} #${p.cardNumber || "###"}`;
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
    const primaryMark = p.isPrimary ? "★ " : "";
    li.textContent = `${primaryMark}${p.setName || "Set ?"} #${p.cardNumber || "###"}`;

    li.addEventListener("click", () => {
      AppState.currentSinglePrints.splice(idx, 1);
      if (!AppState.currentSinglePrints.some(pr => pr.isPrimary) && AppState.currentSinglePrints[0]) {
        AppState.currentSinglePrints[0].isPrimary = true;
      }
      renderPrintsList();
      renderSinglePreview();
    });

    list.appendChild(li);
  });
}

function handleSetPrintPrimary() {
  if (!AppState.currentSinglePrints.length) return;
  const idx = Math.max(0, AppState.currentSinglePrints.length - 1);
  AppState.currentSinglePrints = AppState.currentSinglePrints.map((p, i) => ({
    ...p,
    isPrimary: i === idx
  }));
  renderPrintsList();
  renderSinglePreview();
}

function handleClearAllPrints() {
  AppState.currentSinglePrints = [];
  renderPrintsList();
  renderSinglePreview();
}

function handlePrintAdd() {
  const selected = Dom.printSetSelect.value;
  let setName = "";
  if (selected === "CUSTOM") {
    setName = Dom.printCustomSetInput.value.trim();
  } else {
    setName = selected || "";
  }
  const cardNumber = Dom.printCardNumberInput.value.trim();

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
  renderPrintsList();
  renderSinglePreview();
}

/************************************************************
 * Single Card Editor: Collect & Fill
 ************************************************************/
function collectSingleCardFromInputs() {
  const type = Dom.cardTypeInput.value.trim();
  const name = Dom.cardNameInput.value.trim();
  const setName = Dom.cardSetNameInput.value.trim();
  const cardNumber = Dom.cardNumberInput.value.trim();
  const rarity = Dom.cardRarityInput.value.trim();

  const vehicleTypes = parseVehicleTypes(Dom.cardVehicleTypesInput.value);
  const tags = parseTags(Dom.cardTagsInput.value);

  const extra = {};
  if (type === "Mod") {
    extra.modBasePart = Dom.modBasePartInput.value.trim() || "";
    extra.modLevel1 = Dom.modL1Input.value.trim() || "";
    extra.modLevel2 = Dom.modL2Input.value.trim() || "";
    extra.modLevel3 = Dom.modL3Input.value.trim() || "";
    extra.modLevel4 = Dom.modL4Input.value.trim() || "";
  } else if (type === "Vehicle" || type === "Named Vehicle") {
    const hpCon = parseHpCon(Dom.vehicleHpConInput.value);
    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    const pitVal = Dom.vehiclePitCostInput.value.trim();
    extra.pitCost = pitVal ? Number(pitVal) : undefined;
  }

  const prints = AppState.currentSinglePrints.length
    ? AppState.currentSinglePrints
    : (setName || cardNumber
      ? [{
        setName,
        cardNumber
      }]
      : []);

  const card = {
    id: Dom.cardIdInput.value.trim() || generateId(),
    name,
    type,
    setName,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl: Dom.cardImageUrlInput.value.trim(),
    notes: Dom.cardNotesInput.value.trim(),
    extra,
    prints
  };

  return normalizeCardShape(card);
}

function fillSingleCardInputs(card) {
  const c = normalizeCardShape(card);

  Dom.cardIdInput.value = c.id || "";
  Dom.cardNameInput.value = c.name || "";
  Dom.cardTypeInput.value = c.type || "";
  Dom.cardSetNameInput.value = c.setName || "";
  Dom.cardNumberInput.value = c.cardNumber || "";
  Dom.cardRarityInput.value = c.rarity || "";

  Dom.cardVehicleTypesInput.value = (c.vehicleTypes || []).join(", ");
  Dom.cardTagsInput.value = (c.tags || []).join(", ");
  Dom.cardImageUrlInput.value = c.imageUrl || "";
  Dom.cardNotesInput.value = c.notes || "";

  if (c.type === "Mod") {
    Dom.modBasePartInput.value = c.extra.modBasePart || "";
    Dom.modL1Input.value = c.extra.modLevel1 || "";
    Dom.modL2Input.value = c.extra.modLevel2 || "";
    Dom.modL3Input.value = c.extra.modLevel3 || "";
    Dom.modL4Input.value = c.extra.modLevel4 || "";
  } else {
    Dom.modBasePartInput.value = "";
    Dom.modL1Input.value = "";
    Dom.modL2Input.value = "";
    Dom.modL3Input.value = "";
    Dom.modL4Input.value = "";
  }

  if (c.type === "Vehicle" || c.type === "Named Vehicle") {
    Dom.vehicleHpConInput.value = formatHpCon(c.extra);
    Dom.vehiclePitCostInput.value = (c.extra.pitCost !== undefined && c.extra.pitCost !== null)
      ? String(c.extra.pitCost)
      : "";
  } else {
    Dom.vehicleHpConInput.value = "";
    Dom.vehiclePitCostInput.value = "";
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
  const card = collectSingleCardFromInputs();
  const existingIndex = AppState.cards.findIndex(c => c.id === card.id);

  if (existingIndex >= 0) {
    AppState.cards[existingIndex] = card;
    Dom.singleStatus.textContent = `Updated card: ${card.name} (${card.id})`;
  } else {
    AppState.cards.push(card);
    Dom.singleStatus.textContent = `Added new card: ${card.name} (${card.id})`;
  }

  renderCardLibraryList();
  renderSinglePreview();
}

async function handleSingleNew() {
  Dom.cardIdInput.value = "";
  Dom.cardNameInput.value = "";
  Dom.cardTypeInput.value = "Crew";
  Dom.cardSetNameInput.value = "";
  Dom.cardNumberInput.value = "";
  Dom.cardRarityInput.value = "Common";
  Dom.cardVehicleTypesInput.value = "";
  Dom.cardTagsInput.value = "";
  Dom.cardImageUrlInput.value = "";
  Dom.cardNotesInput.value = "";
  Dom.modBasePartInput.value = "";
  Dom.modL1Input.value = "";
  Dom.modL2Input.value = "";
  Dom.modL3Input.value = "";
  Dom.modL4Input.value = "";
  Dom.vehicleHpConInput.value = "";
  Dom.vehiclePitCostInput.value = "";

  AppState.currentSinglePrints = [];
  Dom.singleStatus.textContent = "Ready to create a new card.";
  updateTypeFieldVisibility();
  renderPrintsList();
  renderSinglePreview();
}

function confirmAction(title, body) {
  return new Promise(resolve => {
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
  const id = Dom.cardIdInput.value.trim();
  if (!id) {
    Dom.singleStatus.textContent = "No card selected to delete.";
    return;
  }

  const card = AppState.cards.find(c => c.id === id);
  const name = card ? card.name : id;

  const ok = await confirmAction(
    "Delete Card",
    `Are you sure you want to delete "${name}"? This cannot be undone.`
  );

  if (!ok) {
    Dom.singleStatus.textContent = "Delete cancelled.";
    return;
  }

  AppState.cards = AppState.cards.filter(c => c.id !== id);
  Dom.singleStatus.textContent = `Deleted card: ${name}`;
  await handleSingleNew();
  renderCardLibraryList();
}

/************************************************************
 * Public Init + refresh hook
 ************************************************************/

export function initSingle() {
  updateTypeFieldVisibility();
  renderPrintsList();
  renderSinglePreview();

  Dom.cardTypeInput.addEventListener("change", () => {
    updateTypeFieldVisibility();
    renderSinglePreview();
  });

  [
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
  ].forEach(el => {
    el.addEventListener("input", renderSinglePreview);
    el.addEventListener("change", renderSinglePreview);
  });

  Dom.cardLibrarySearchInput.addEventListener("input", renderCardLibraryList);

  Dom.printSetPrimaryBtn.addEventListener("click", handleSetPrintPrimary);
  Dom.printClearAllBtn.addEventListener("click", handleClearAllPrints);
  Dom.printSetSelect.addEventListener("change", () => {
    if (Dom.printSetSelect.value === "CUSTOM") {
      Dom.printCustomSetInput.focus();
    }
  });
  Dom.printCardNumberInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePrintAdd();
    }
  });

  Dom.singleSaveBtn.addEventListener("click", handleSingleSave);
  Dom.singleNewBtn.addEventListener("click", handleSingleNew);
  Dom.singleDeleteBtn.addEventListener("click", handleSingleDelete);
}

/**
 * Called after cards have changed (e.g. after loadCards or bulk import).
 */
export function refreshSingleUi() {
  renderSinglePreview();
  renderCardLibraryList();
}
