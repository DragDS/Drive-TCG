// bulk.js
// Bulk import: load workbook, filter by Type/Set, select cards, import into AppState.cards.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";
import {
  normalizeCardShape,
  generateId,
  refreshSingleUi,
  parseVehicleTypes,
  parseTags,
  parseHpCon
} from "./single.js";

/************************************************************
 * In-memory state for bulk import
 ************************************************************/
let parsedCards = [];            // All cards discovered from the workbook
let selectedCardIds = new Set(); // IDs of cards selected for import

/************************************************************
 * Small helpers
 ************************************************************/
function normalizeHeader(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/\W+/g, "");
}

// Very small heuristic to decide if the first row looks like a header row
function looksLikeHeaderRow(cells) {
  const interesting = ["name", "cardname", "title", "set", "setname", "rarity", "cardnumber", "type"];
  return cells.some(cell => interesting.includes(normalizeHeader(cell)));
}

// If there is no header row, assume a standard layout for the first few columns
const NO_HEADER_DEFAULTS = ["set", "name", "notes", "rarity", "cardnumber"];

// Infer card type from sheet name (Crew, Driver, Condition, etc.)
function normalizeSheetTypeName(sheetName) {
  const n = (sheetName || "").toLowerCase();

  if (n.includes("named driver")) return "Named Driver";
  if (n.includes("named vehicle")) return "Named Vehicle";
  if (n.includes("driver")) return "Driver";
  if (n.includes("vehicle")) return "Vehicle";
  if (n.includes("crew")) return "Crew";
  if (n.includes("mod")) return "Mod";
  if (n.includes("track")) return "Track";
  if (n.includes("condition")) return "Condition";

  return sheetName || "";
}

/************************************************************
 * Map a single row (from one sheet) to a normalized card
 ************************************************************/
function mapRowToCard(headers, rowArray, defaultType) {
  const norm = {};
  headers.forEach((h, i) => {
    const key = (h || "").toString().trim();
    const value = (rowArray[i] || "").toString().trim();
    if (!key) return;
    const nk = normalizeHeader(key);
    norm[nk] = value;
  });

  const get = (...keys) => {
    for (const key of keys) {
      const nk = normalizeHeader(key);
      if (nk in norm) return norm[nk];
    }
    return "";
  };

  const hasAny = (...keys) => {
    return keys.some(k => {
      const nk = normalizeHeader(k);
      return nk in norm && norm[nk];
    });
  };

  const rawType = get("type");
  const type = rawType || defaultType || "";

  const name = get("name", "cardname", "title");
  const setName = get("set", "setname", "setid");
  const cardNumber = get("cardnumber", "number", "no", "#");
  const rarity = get("rarity", "rar");

  const vt = get("vehicletype", "vehicletype1", "vehicletype2", "vehicletype3");
  const tagsStr = get("tags", "tag", "keywords");

  const imageUrl = get("image", "imageurl", "img");
  const notes = get("notes", "rules", "text");

  const vehicleTypes = parseVehicleTypes ? parseVehicleTypes(vt) : [];
  const tags = parseTags ? parseTags(tagsStr) : [];

  const extra = {};

  if (type === "Mod") {
    extra.modBasePart = get("basepart", "part", "modbase");
    extra.modLevel1 = get("level1", "l1", "lvl1");
    extra.modLevel2 = get("level2", "l2", "lvl2");
    extra.modLevel3 = get("level3", "l3", "lvl3");
    extra.modLevel4 = get("level4", "l4", "lvl4");
  }

  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConStr = get("hpcon", "hp/con", "hp", "hitpoints");
    const hpCon = hpConStr && hpConStr.includes("/")
      ? parseHpCon(hpConStr)
      : { hp: hpConStr ? Number(hpConStr) || undefined : undefined };

    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    const pitStr = get("pitcost", "pit", "pitpoints");
    extra.pitCost = pitStr ? Number(pitStr) : undefined;
  }

  const prints = [];
  if (hasAny("set", "setname", "setid") || hasAny("cardnumber", "number", "no")) {
    prints.push({
      setName,
      cardNumber,
      isPrimary: true
    });
  }

  const baseCard = {
    id: get("id", "cardid") || generateId(),
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
 * Parse a full XLSX workbook into card objects
 ************************************************************/
function parseWorkbook(workbook) {
  const allCards = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Get rows as arrays: [ [cell0, cell1, ...], [row2...], ... ]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (!rows.length) return;

    const headerRow = (rows[0] || []).map(v => (v == null ? "" : String(v)));
    const isHeader = looksLikeHeaderRow(headerRow);

    let headers;
    let dataRows;

    if (isHeader) {
      headers = headerRow;
      dataRows = rows.slice(1);
    } else {
      headers = headerRow.map((_, idx) => NO_HEADER_DEFAULTS[idx] || `col${idx + 1}`);
      dataRows = rows;
    }

    const defaultType = normalizeSheetTypeName(sheetName);

    dataRows.forEach(row => {
      const arr = (row || []).map(v => (v == null ? "" : String(v)));
      const card = mapRowToCard(headers, arr, defaultType);
      if (card && (card.name || card.type || card.setName || card.cardNumber)) {
        allCards.push(card);
      }
    });
  });

  return allCards;
}

/************************************************************
 * Filters & rendering helpers
 ************************************************************/
function getDistinctTypes() {
  const set = new Set();
  parsedCards.forEach(c => {
    if (c.type) set.add(c.type);
  });
  return Array.from(set).sort();
}

function getDistinctSets() {
  const set = new Set();
  parsedCards.forEach(c => {
    if (c.setName) set.add(c.setName);
  });
  return Array.from(set).sort();
}

function populateFilterOptions() {
  // Type filter
  if (Dom.bulkFilterTypeSelect) {
    Dom.bulkFilterTypeSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Types";
    Dom.bulkFilterTypeSelect.appendChild(optAll);

    getDistinctTypes().forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      Dom.bulkFilterTypeSelect.appendChild(opt);
    });
  }

  // Set filter
  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Sets";
    Dom.bulkFilterSetSelect.appendChild(optAll);

    getDistinctSets().forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      Dom.bulkFilterSetSelect.appendChild(opt);
    });
  }
}

function getFilteredCards() {
  const typeFilter = Dom.bulkFilterTypeSelect?.value || "";
  const setFilter = Dom.bulkFilterSetSelect?.value || "";

  return parsedCards.filter(card => {
    const matchesType = !typeFilter || card.type === typeFilter;
    const matchesSet = !setFilter || card.setName === setFilter;
    return matchesType && matchesSet;
  });
}

/************************************************************
 * Step 2: render filtered list with checkboxes
 ************************************************************/
function renderBulkSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;

  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No cards loaded yet. Use Step 1 to load a workbook.";
    list.appendChild(li);
    return;
  }

  const filtered = getFilteredCards();

  if (!filtered.length) {
    const li = document.createElement("li");
    li.textContent = "No cards match the current filters.";
    list.appendChild(li);
    return;
  }

  filtered.forEach(card => {
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
    const type = card.type || "Type ?";
    const setName = card.setName || "Set ?";
    const name = card.name || "(no name)";
    const number = card.cardNumber || "###";
    label.textContent = `[${type}] [${setName}] ${name} (#${number})`;

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

/************************************************************
 * Step 3: selected preview
 ************************************************************/
function renderBulkSelectedPreview() {
  const out = Dom.bulkSelectedPreview;
  if (!out) return;

  if (!parsedCards.length) {
    out.textContent = "No cards loaded yet.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected yet.";
    return;
  }

  const lines = selected.slice(0, 80).map(c => {
    const type = c.type || "Type ?";
    const setName = c.setName || "Set ?";
    const name = c.name || "(no name)";
    const number = c.cardNumber || "###";
    return `• [${type}] [${setName}] ${name} (#${number})`;
  });

  out.textContent =
    `${selected.length} card(s) selected:\n` +
    lines.join("\n") +
    (selected.length > 80 ? `\n...and ${selected.length - 80} more.` : "");
}

/************************************************************
 * Step 1: load XLSX workbook
 ************************************************************/
function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx");

  if (!isXlsx) {
    Dom.bulkStatus.textContent = "Please load a .xlsx master workbook.";
    parsedCards = [];
    selectedCardIds.clear();
    renderBulkSelectionList();
    renderBulkSelectedPreview();
    return;
  }

  if (typeof XLSX === "undefined") {
    Dom.bulkStatus.textContent =
      "XLSX library not found. Check the <script> tag in admin.html.";
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });

      parsedCards = parseWorkbook(workbook);
      selectedCardIds.clear();

      if (!parsedCards.length) {
        Dom.bulkStatus.textContent = "Workbook loaded, but no usable card rows were found.";
      } else {
        Dom.bulkStatus.textContent =
          `Loaded ${parsedCards.length} cards from ${workbook.SheetNames.length} sheet(s). Use Step 2 to filter and select.`;
      }

      populateFilterOptions();
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    } catch (err) {
      console.error(err);
      Dom.bulkStatus.textContent = "Failed to parse workbook.";
      parsedCards = [];
      selectedCardIds.clear();
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    }
  };
  reader.onerror = () => {
    Dom.bulkStatus.textContent = "Could not read the selected file.";
  };
  reader.readAsArrayBuffer(file);
}

/************************************************************
 * Step 3: import & clear
 ************************************************************/
function handleBulkImport() {
  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "No cards loaded. Use Step 1 first.";
    return;
  }

  const toImport = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!toImport.length) {
    Dom.bulkStatus.textContent = "No cards selected to import (Step 3).";
    return;
  }

  let added = 0;
  let updated = 0;

  toImport.forEach(card => {
    const idx = AppState.cards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      AppState.cards[idx] = card;
      updated++;
    } else {
      AppState.cards.push(card);
      added++;
    }
  });

  Dom.bulkStatus.textContent =
    `Imported ${toImport.length} card(s) (${added} added, ${updated} updated).`;

  // Keep data loaded so you can change filters or select more.
  refreshSingleUi();
  renderBulkSelectedPreview();
}

function handleBulkClear() {
  parsedCards = [];
  selectedCardIds.clear();

  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.value = "";
  }

  if (Dom.bulkFilterTypeSelect) {
    Dom.bulkFilterTypeSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Types";
    Dom.bulkFilterTypeSelect.appendChild(optAll);
  }

  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Sets";
    Dom.bulkFilterSetSelect.appendChild(optAll);
  }

  Dom.bulkStatus.textContent = "Cleared bulk data. Load a workbook again with Step 1.";
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

/************************************************************
 * Public init
 ************************************************************/
export function initBulk() {
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", handleBulkFileChange);
  }

  if (Dom.bulkFilterTypeSelect) {
    Dom.bulkFilterTypeSelect.addEventListener("change", () => {
      renderBulkSelectionList();
    });
  }

  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.addEventListener("change", () => {
      renderBulkSelectionList();
    });
  }

  if (Dom.bulkSelectAllBtn) {
    Dom.bulkSelectAllBtn.addEventListener("click", () => {
      const filtered = getFilteredCards();
      filtered.forEach(c => selectedCardIds.add(c.id));
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkDeselectAllBtn) {
    Dom.bulkDeselectAllBtn.addEventListener("click", () => {
      const filtered = getFilteredCards();
      filtered.forEach(c => selectedCardIds.delete(c.id));
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkImportBtn) {
    Dom.bulkImportBtn.addEventListener("click", handleBulkImport);
  }

  if (Dom.bulkClearBtn) {
    Dom.bulkClearBtn.addEventListener("click", handleBulkClear);
  }

  // Initial empty state
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
