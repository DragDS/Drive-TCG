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

/**
 * Safe DOM helpers so missing inputs (like modL1–modL4) don’t crash.
 */
function getTrimmedValue(el) {
  return el && typeof el.value === "string" ? el.value.trim() : "";
}

function setValue(el, val) {
  if (!el) return;
  el.value = val;
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
  if (!Dom.cardTypeInput) return;
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

  const prints = AppState.currentSinglePrints.length
    ? AppState.currentSinglePrints
    : (getTrimmedValue(Dom.cardSetNameInput) || getTrimmedValue(Dom.cardNumberInput)
      ? [{
        setName: setName,
        cardNumber: getTrimmedValue(Dom.cardNumberInput)
      }]
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

  body.appe
