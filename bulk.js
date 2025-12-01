// bulk.js
// Bulk import: parsing, selection, preview, and importing into AppState.cards.

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
let parsedCards = [];           // All cards parsed from text/file
let selectedCardIds = new Set(); // IDs of cards chosen for import

/************************************************************
 * Delimiter + header helpers
 ************************************************************/
function detectDelimiter(value) {
  const counts = {
    tab: (value.match(/\t/g) || []).length,
    comma: (value.match(/,/g) || []).length,
    semicolon: (value.match(/;/g) || []).length,
    pipe: (value.match(/\|/g) || []).length
  };
  let best = "tab";
  let bestCount = counts.tab;
  for (const [key, val] of Object.entries(counts)) {
    if (val > bestCount) {
      best = key;
      bestCount = val;
    }
  }
  return best;
}

function splitLine(line, delimiter) {
  if (!line) return [];
  if (delimiter === "tab") return line.split("\t");
  if (delimiter === "comma") return line.split(",");
  if (delimiter === "semicolon") return line.split(";");
  if (delimiter === "pipe") return line.split("|");
  return [line];
}

function normalizeHeader(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/\W+/g, "");
}

/************************************************************
 * Map a CSV/TSV row into a normalized card
 ************************************************************/
function mapRowToCard(headers, row) {
  const norm = {};
  headers.forEach((h, i) => {
    const key = (h || "").trim();
    const value = (row[i] || "").trim();
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

  const type = get("type");
  const name = get("name", "cardname", "title");
  const setName = get("set", "setname", "setid");
  const cardNumber = get("cardnumber", "number", "no", "#");
  const rarity = get("rarity", "rar");

  const vt = get("vehicletype", "vehicletype2", "vehicletype1", "vehicletype3");
  const tagsStr = get("tags", "tag", "keywords");

  const imageUrl = get("image", "imageurl", "img");
  const notes = get("notes", "rules", "text");

  const vehicleTypes = parseVehicleTypes(vt);
  const tags = parseTags(tagsStr);

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
 * STEP 1: Parse text from textarea (or file)
 ************************************************************/
function handleBulkParse() {
  const raw = Dom.bulkInput.value || "";
  if (!raw.trim()) {
    Dom.bulkStatus.textContent = "No data to parse.";
    Dom.bulkPreview.textContent = "";
    parsedCards = [];
    selectedCardIds.clear();
    renderBulkSelectionList();
    renderBulkSelectedPreview();
    return;
  }

  let delimiter = Dom.bulkDelimiterSelect.value;
  if (delimiter === "auto") {
    delimiter = detectDelimiter(raw);
    Dom.bulkDelimiterSelect.value = delimiter;
  }

  const lines = raw.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) {
    Dom.bulkStatus.textContent = "No non-empty lines found.";
    Dom.bulkPreview.textContent = "";
    parsedCards = [];
    selectedCardIds.clear();
    renderBulkSelectionList();
    renderBulkSelectedPreview();
    return;
  }

  const headerLine = lines[0];
  const headerCells = splitLine(headerLine, delimiter);
  const dataLines = Dom.bulkHasHeaderCheckbox.checked ? lines.slice(1) : lines;

  parsedCards = dataLines
    .map(line => {
      const cells = splitLine(line, delimiter);
      return mapRowToCard(headerCells, cells);
    })
    .filter(c => c && (c.name || c.type || c.setName || c.cardNumber));

  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "Parsed 0 usable rows.";
    Dom.bulkPreview.textContent = "";
    selectedCardIds.clear();
    renderBulkSelectionList();
    renderBulkSelectedPreview();
    return;
  }

  // Pre-select everything by default
  selectedCardIds = new Set(parsedCards.map(c => c.id));

  // Step 1 preview
  const previewLines = parsedCards.slice(0, 20).map(c => {
    return `${c.type || "Type ?"} | ${c.name || "(no name)"} | ${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  Dom.bulkPreview.textContent =
    previewLines.join("\n") +
    (parsedCards.length > 20 ? `\n...and ${parsedCards.length - 20} more.` : "");

  Dom.bulkStatus.textContent = `Parsed ${parsedCards.length} cards. Use Step 2 to choose which to import.`;

  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

/************************************************************
 * STEP 2: Selection list rendering & controls
 ************************************************************/
function renderBulkSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;
  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No parsed cards yet. Run Step 1 first.";
    list.appendChild(li);
    return;
  }

  const filter = (Dom.bulkFilterInput?.value || "").toLowerCase();

  const filtered = parsedCards.filter(c => {
    const name = (c.name || "").toLowerCase();
    const type = (c.type || "").toLowerCase();
    const setName = (c.setName || "").toLowerCase();
    if (!filter) return true;
    return (
      name.includes(filter) ||
      type.includes(filter) ||
      setName.includes(filter)
    );
  });

  if (!filtered.length) {
    const li = document.createElement("li");
    li.textContent = "No cards match the current filter.";
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
    label.textContent = `${card.type || "Type ?"} | ${card.name || "(no name)"} | ${card.setName || "Set ?"} #${card.cardNumber || "###"}`;

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
    out.textContent = "No parsed cards yet.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 40).map(c => {
    return `• ${c.type || "Type ?"} | ${c.name || "(no name)"} | ${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  out.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 40 ? `\n...and ${selected.length - 40} more.` : "");
}

function handleBulkImport() {
  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "Nothing parsed yet. Run Step 1 first.";
    return;
  }

  const toImport = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!toImport.length) {
    Dom.bulkStatus.textContent = "No cards selected to import (Step 2).";
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

  // Clear parsed state (but keep any text the user pasted in case they want to tweak and reparse)
  parsedCards = [];
  selectedCardIds.clear();
  Dom.bulkPreview.textContent = "";
  Dom.bulkSelectedPreview.textContent = "";
  if (Dom.bulkSelectionList) Dom.bulkSelectionList.innerHTML = "";

  // Re-render library and preview in Single tab
  refreshSingleUi();
}

/************************************************************
 * File loading (CSV / TSV / TXT / XLSX)
 ************************************************************/
function setBulkInputAndParse(text) {
  Dom.bulkInput.value = text || "";
  handleBulkParse();
}

function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx");

  // Non-XLSX: read as plain text
  if (!isXlsx) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result || "";
      setBulkInputAndParse(text);
    };
    reader.onerror = () => {
      Dom.bulkStatus.textContent = "Could not read file.";
    };
    reader.readAsText(file);
    return;
  }

  // XLSX: requires global XLSX from SheetJS
  if (typeof XLSX === "undefined") {
    Dom.bulkStatus.textContent =
      "XLSX file selected, but XLSX library is not loaded. Check the XLSX script tag in admin.html.";
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        Dom.bulkStatus.textContent = "No sheets found in XLSX file.";
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      setBulkInputAndParse(csv);
    } catch (err) {
      console.error(err);
      Dom.bulkStatus.textContent = "Failed to parse XLSX file.";
    }
  };
  reader.onerror = () => {
    Dom.bulkStatus.textContent = "Could not read XLSX file.";
  };
  reader.readAsArrayBuffer(file);
}

/************************************************************
 * Public init
 ************************************************************/
export function initBulk() {
  Dom.bulkParseBtn.addEventListener("click", handleBulkParse);
  Dom.bulkImportBtn.addEventListener("click", handleBulkImport);

  if (Dom.bulkFilterInput) {
    Dom.bulkFilterInput.addEventListener("input", () => {
      renderBulkSelectionList();
    });
  }

  if (Dom.bulkSelectAllBtn) {
    Dom.bulkSelectAllBtn.addEventListener("click", () => {
      parsedCards.forEach(c => selectedCardIds.add(c.id));
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkDeselectAllBtn) {
    Dom.bulkDeselectAllBtn.addEventListener("click", () => {
      selectedCardIds.clear();
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", handleBulkFileChange);
  }

  // Initial empty render
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
