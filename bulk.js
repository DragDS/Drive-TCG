// bulk.js
// Bulk import: load .xlsx workbook, filter/select, preview, and import into AppState.cards.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";
import {
  parseVehicleTypes,
  parseTags,
  parseHpCon,
  normalizeCardShape,
  generateId,
  refreshSingleUi
} from "./single.js";

/************************************************************
 * Module-level state for bulk import
 ************************************************************/
let parsedCards = [];            // All cards parsed from workbook
let selectedCardIds = new Set(); // IDs of cards chosen for import

/************************************************************
 * Header normalization & helpers
 ************************************************************/
function normalizeHeader(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/\W+/g, "");
}

function buildNormRowMap(rowObj) {
  const norm = {};
  for (const [key, value] of Object.entries(rowObj || {})) {
    if (!key) continue;
    const nk = normalizeHeader(key);
    const v = value == null ? "" : String(value).trim();
    if (nk) {
      norm[nk] = v;
    }
  }
  return norm;
}

function getField(normRow, ...candidates) {
  for (const key of candidates) {
    const nk = normalizeHeader(key);
    if (nk in normRow && normRow[nk] !== "") {
      return normRow[nk];
    }
  }
  return "";
}

function hasAnyField(normRow, ...candidates) {
  return candidates.some((k) => {
    const nk = normalizeHeader(k);
    return nk in normRow && normRow[nk] !== "";
  });
}

/************************************************************
 * Infer card Type from sheet name when not explicitly present
 ************************************************************/
function guessTypeFromSheetName(sheetName) {
  const s = (sheetName || "").toString().toLowerCase();

  // Check more specific patterns first
  if (s.includes("named vehicle")) return "Named Vehicle";
  if (s.includes("named driver")) return "Named Driver";

  if (s.includes("vehicle")) return "Vehicle";
  if (s.includes("driver")) return "Driver";
  if (s.includes("crew")) return "Crew";
  if (s.includes("mod")) return "Mod";
  if (s.includes("condition")) return "Condition";
  if (s.includes("track")) return "Track";
  if (s.includes("misc")) return "Misc";

  return "";
}

/************************************************************
 * Map a row (object from SheetJS) into a normalized card
 ************************************************************/
function mapRowToCard(sheetType, rowObj) {
  const norm = buildNormRowMap(rowObj);

  // ----- BASIC FIELDS -----
  let type = getField(norm, "type", "cardtype", "kind");
  if (!type && sheetType) {
    type = sheetType;
  }

  let name = getField(norm, "name", "cardname", "card name", "title");

  // Fallback: any header that contains "name" (e.g. Crew Name, Mod Name, Driver Name)
  if (!name) {
    for (const [k, v] of Object.entries(norm)) {
      if (k.includes("name") && v) {
        name = v;
        break;
      }
    }
  }

  const setName = getField(norm, "set", "setname", "set name", "setid");
  const cardNumber = getField(norm, "cardnumber", "number", "no", "#", "card #");
  const rarity = getField(norm, "rarity", "rar");

  const vtRaw = getField(
    norm,
    "vehicletype",
    "vehicle type",
    "vehicletype1",
    "vehicletype2",
    "vehicletype3"
  );
  const tagsStr = getField(norm, "tags", "tag", "keywords");

  const imageUrl = getField(norm, "image", "imageurl", "art", "img");

  let notes = getField(
    norm,
    "notes",
    "rules",
    "rules text",
    "text",
    "effect",
    "cardtext"
  );

  // Fallback: any header with "trait", "text", "effect", or "ability"
  if (!notes) {
    for (const [k, v] of Object.entries(norm)) {
      if (
        v &&
        (k.includes("trait") ||
         k.includes("text") ||
         k.includes("effect") ||
         k.includes("ability"))
      ) {
        notes = v;
        break;
      }
    }
  }

  const vehicleTypes = parseVehicleTypes(vtRaw);
  const tags = parseTags(tagsStr);

  // If the row is basically empty, skip it
  if (!name && !type && !setName && !cardNumber && !notes) {
    return null;
  }

  const extra = {};

  // ----- MOD-SPECIFIC -----
  if (type === "Mod") {
    extra.modBasePart = getField(norm, "basepart", "base part", "part", "modbase");
    extra.modLevel1 = getField(norm, "level1", "l1", "lvl1");
    extra.modLevel2 = getField(norm, "level2", "l2", "lvl2");
    extra.modLevel3 = getField(norm, "level3", "l3", "lvl3");
    extra.modLevel4 = getField(norm, "level4", "l4", "lvl4");
  }

  // ----- VEHICLE / NAMED VEHICLE -----
  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConCombined = getField(norm, "hpcon", "hp/con", "hp_con", "hp and con");
    const hpOnly = getField(norm, "hp", "hitpoints", "hit points");
    const conOnly = getField(norm, "con", "constitution", "condition");

    let hpCon = { hp: undefined, con: undefined };

    if (hpConCombined && hpConCombined.includes("/")) {
      hpCon = parseHpCon(hpConCombined);
    } else {
      if (hpOnly) {
        hpCon.hp = Number(hpOnly) || undefined;
      }
      if (conOnly) {
        hpCon.con = Number(conOnly) || undefined;
      }
    }

    extra.hp = hpCon.hp;
    extra.con = hpCon.con;

    const pitStr = getField(norm, "pitcost", "pit cost", "pit", "pitpoints", "pit points");
    extra.pitCost = pitStr ? Number(pitStr) || undefined : undefined;
  }

  // ----- PRINTS -----
  const prints = [];
  if (
    hasAnyField(norm, "set", "setname", "set name", "setid") ||
    hasAnyField(norm, "cardnumber", "number", "no", "#", "card #")
  ) {
    prints.push({
      setName,
      cardNumber,
      isPrimary: true
    });
  }

  const baseCard = {
    id: getField(norm, "id", "cardid") || generateId(),
    name,
    type,
    setName,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl,
    notes,
    extra,
    prints
  };

  return normalizeCardShape(baseCard);
}

/************************************************************
 * STEP 1: Load XLSX workbook
 ************************************************************/
function parseWorkbook(workbook) {
  parsedCards = [];
  selectedCardIds.clear();

  const sheetNames = workbook.SheetNames || [];

  sheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const sheetType = guessTypeFromSheetName(sheetName);

    // Turn each row into a plain object keyed by header titles
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    rows.forEach((rowObj) => {
      const card = mapRowToCard(sheetType, rowObj);
      if (card) {
        parsedCards.push(card);
      }
    });
  });

  if (!parsedCards.length) {
    Dom.bulkStatus.textContent =
      "Workbook loaded, but no usable card rows were detected. Check sheet headers.";
  } else {
    // Pre-select everything
    selectedCardIds = new Set(parsedCards.map((c) => c.id));

    Dom.bulkStatus.textContent =
      `Loaded ${parsedCards.length} card(s) from ${sheetNames.length} sheet(s). ` +
      `Use Step 2 to filter and select.`;
  }

  refreshBulkFilterOptions();
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx");

  if (!isXlsx) {
    Dom.bulkStatus.textContent = "Please select a .xlsx Excel file (master workbook).";
    return;
  }

  if (typeof XLSX === "undefined") {
    Dom.bulkStatus.textContent =
      "XLSX library is not loaded. Check the SheetJS <script> tag in admin.html.";
    return;
  }

  Dom.bulkStatus.textContent = "Reading workbook…";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      parseWorkbook(workbook);
    } catch (err) {
      console.error(err);
      Dom.bulkStatus.textContent = "Failed to parse XLSX file.";
      parsedCards = [];
      selectedCardIds.clear();
      refreshBulkFilterOptions();
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    }
  };
  reader.onerror = () => {
    Dom.bulkStatus.textContent = "Could not read XLSX file.";
  };
  reader.readAsArrayBuffer(file);
}

/************************************************************
 * STEP 2: Filter + selection UI
 ************************************************************/
function refreshBulkFilterOptions() {
  const typeSelect = Dom.bulkFilterTypeSelect;
  const setSelect = Dom.bulkFilterSetSelect;
  if (!typeSelect || !setSelect) return;

  const prevType = typeSelect.value || "";
  const prevSet = setSelect.value || "";

  // Unique Types & Sets
  const types = Array.from(
    new Set(parsedCards.map((c) => c.type).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const sets = Array.from(
    new Set(parsedCards.map((c) => c.setName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Rebuild Type select
  typeSelect.innerHTML = "";
  const typeAll = document.createElement("option");
  typeAll.value = "";
  typeAll.textContent = "All Types";
  typeSelect.appendChild(typeAll);
  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });
  if (prevType && types.includes(prevType)) {
    typeSelect.value = prevType;
  }

  // Rebuild Set select
  setSelect.innerHTML = "";
  const setAll = document.createElement("option");
  setAll.value = "";
  setAll.textContent = "All Sets";
  setSelect.appendChild(setAll);
  sets.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    setSelect.appendChild(opt);
  });
  if (prevSet && sets.includes(prevSet)) {
    setSelect.value = prevSet;
  }
}

function getFilteredCards() {
  const typeFilter = (Dom.bulkFilterTypeSelect?.value || "").toLowerCase();
  const setFilter = (Dom.bulkFilterSetSelect?.value || "").toLowerCase();

  return parsedCards.filter((c) => {
    if (typeFilter && (c.type || "").toLowerCase() !== typeFilter) return false;
    if (setFilter && (c.setName || "").toLowerCase() !== setFilter) return false;
    return true;
  });
}

function renderBulkSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;
  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No workbook loaded yet. Use Step 1 to load your master Excel file.";
    list.appendChild(li);
    return;
  }

  const filtered = getFilteredCards();

  if (!filtered.length) {
    const li = document.createElement("li");
    li.textContent = "No cards match the current Type/Set filters.";
    list.appendChild(li);
    return;
  }

  filtered.forEach((card) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "6px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedCardIds.has(card.id);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedCardIds.add(card.id);
      } else {
        selectedCardIds.delete(card.id);
      }
      renderBulkSelectedPreview();
    });

    const label = document.createElement("span");
    label.style.fontSize = "11px";
    label.textContent =
      `(${card.type || "?"}) ${card.name || "(no name)"} — ` +
      `${card.setName || "Set ?"} #${card.cardNumber || "###"}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

/************************************************************
 * STEP 3: Selected preview & import
 ************************************************************/
function renderBulkSelectedPreview() {
  const out = Dom.bulkSelectedPreview;
  if (!out) return;

  if (!parsedCards.length) {
    out.textContent = "No workbook loaded yet.";
    return;
  }

  const selected = parsedCards.filter((c) => selectedCardIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 60).map((c) => {
    return `• (${c.type || "?"}) ${c.name || "(no name)"} — ${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  out.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 60 ? `\n...and ${selected.length - 60} more.` : "");
}

function handleBulkImport() {
  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "Nothing to import. Load a workbook in Step 1 first.";
    return;
  }

  const toImport = parsedCards.filter((c) => selectedCardIds.has(c.id));
  if (!toImport.length) {
    Dom.bulkStatus.textContent = "No cards selected to import (Step 2).";
    return;
  }

  let added = 0;
  let updated = 0;

  toImport.forEach((card) => {
    const idx = AppState.cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      AppState.cards[idx] = card;
      updated++;
    } else {
      AppState.cards.push(card);
      added++;
    }
  });

  Dom.bulkStatus.textContent =
    `Imported ${toImport.length} card(s) into the library (${added} added, ${updated} updated).`;

  // Re-render library / single-tab UI so you can immediately see changes.
  refreshSingleUi();
}

function handleBulkClear() {
  parsedCards = [];
  selectedCardIds.clear();

  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.value = "";
  }

  Dom.bulkStatus.textContent =
    "Cleared bulk import data. Load a workbook in Step 1 to start again.";

  refreshBulkFilterOptions();
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

/************************************************************
 * Public init
 ************************************************************/
export function initBulk() {
  // Step 1: file input
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", handleBulkFileChange);
  }

  // Step 2: filter changes
  if (Dom.bulkFilterTypeSelect) {
    Dom.bulkFilterTypeSelect.addEventListener("change", () => {
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }
  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.addEventListener("change", () => {
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  // Step 2: select / deselect viewed
  if (Dom.bulkSelectAllBtn) {
    Dom.bulkSelectAllBtn.addEventListener("click", () => {
      const filtered = getFilteredCards();
      filtered.forEach((c) => selectedCardIds.add(c.id));
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkDeselectAllBtn) {
    Dom.bulkDeselectAllBtn.addEventListener("click", () => {
      const filtered = getFilteredCards();
      filtered.forEach((c) => selectedCardIds.delete(c.id));
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  // Step 3: import & clear
  if (Dom.bulkImportBtn) {
    Dom.bulkImportBtn.addEventListener("click", handleBulkImport);
  }
  if (Dom.bulkClearBtn) {
    Dom.bulkClearBtn.addEventListener("click", handleBulkClear);
  }

  // Initial empty state
  refreshBulkFilterOptions();
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
