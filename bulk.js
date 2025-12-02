// bulk.js
// Bulk import: load master XLSX, filter, select, preview, and import into AppState.cards.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";
import {
  parseVehicleTypes,
  parseHpCon,
  normalizeCardShape,
  generateId,
  refreshSingleUi
} from "./single.js";

/************************************************************
 * Module-level state for bulk import
 ************************************************************/
let parsedCards = [];           // All cards parsed from the loaded workbook
let selectedCardIds = new Set(); // IDs of cards chosen for import
let availableTypes = new Set();
let availableSets = new Set();

/************************************************************
 * Helpers
 ************************************************************/
function normalizeHeader(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .replace(/\W+/g, "");
}

function normalizeSetName(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (!s) return "";
  const m = s.match(/set\s*(\d+)/i);
  if (m) return `Set ${m[1]}`;
  return s;
}

function normalizeCardNumber(value) {
  if (value === null || value === undefined) return "";
  let s = String(value).trim();
  // strip trailing ".0" etc from Excel numbers
  if (/^\d+(\.0+)?$/.test(s)) {
    s = String(parseInt(s, 10));
  }
  return s;
}

function findExistingCardId(name, type, setName, cardNumber) {
  const targetName = (name || "").trim().toLowerCase();
  const targetType = (type || "").trim().toLowerCase();
  const targetSet = (setName || "").trim().toLowerCase();
  const targetNo = (cardNumber || "").trim().toLowerCase();

  if (!targetName && !targetType && !targetSet && !targetNo) return null;

  const existing = AppState.cards.find(c => {
    const n = (c.name || "").trim().toLowerCase();
    const t = (c.type || "").trim().toLowerCase();
    const s = (c.setName || "").trim().toLowerCase();
    const no = (c.cardNumber || "").trim().toLowerCase();
    return n === targetName && t === targetType && s === targetSet && no === targetNo;
  });

  return existing ? existing.id : null;
}

/************************************************************
 * XLSX parsing (master spreadsheet)
 ************************************************************/
function parseWorkbookToCards(workbook) {
  const all = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Get rows as [ [header...], [row1...], ... ]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!rows.length) return;

    const header = rows[0];
    const headerIndex = {};

    header.forEach((h, idx) => {
      if (h !== null && h !== undefined && String(h).trim()) {
        headerIndex[normalizeHeader(h)] = idx;
      }
    });

    function get(row, ...names) {
      for (const name of names) {
        const key = normalizeHeader(name);
        const idx = headerIndex[key];
        if (idx !== undefined && idx < row.length) {
          return row[idx];
        }
      }
      return "";
    }

    // Decide card type & mapping based on sheet name
    const sheetKey = sheetName.toLowerCase().trim();

    const dataRows = rows.slice(1);
    dataRows.forEach(row => {
      const nonEmpty = row.some(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (!nonEmpty) return;

      let baseCard = null;

      if (sheetKey === "crew cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Crew Name");
        const trait = get(row, "Crew Trait");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Crew";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [],
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      } else if (sheetKey === "driver cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Driver Name");
        const trait = get(row, "Driver Trait");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Driver";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [],
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      } else if (sheetKey === "named driver cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Named Driver Name");
        const trait = get(row, "Named Driver Trait");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Named Driver";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [],
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      } else if (sheetKey === "condition cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Condition Name");
        const trait = get(row, "Condition Trait");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Condition";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [],
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      } else if (sheetKey === "track cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Track Name");
        const vtRaw = get(row, "Vehicle Type");
        const trait = get(row, "Track Trait");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Track";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        const vtClean = (vtRaw || "").toString().replace(/\//g, ",");
        const vehicleTypes = parseVehicleTypes(vtClean);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes,
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      } else if (sheetKey === "mod cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "Mod Name");
        const modTypeRaw = get(row, "Mod TYPE");
        const basePart = get(row, "Base Part");
        const ability = get(row, "Mod Ability");
        const l1 = get(row, "Mod Lvl 1");
        const l2 = get(row, "Mod Lvl 2");
        const l3 = get(row, "Mod Lvl 3");
        const l4 = get(row, "Mod Lvl 4");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !ability && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Mod";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [], // if you later want TYPE: DRAG as vehicles, we can wire this
          tags: modTypeRaw ? [String(modTypeRaw)] : [],
          imageUrl: "",
          notes: ability || "",
          extra: {
            sourceSheet: sheetName,
            modBasePart: basePart || "",
            modLevel1: l1 || "",
            modLevel2: l2 || "",
            modLevel3: l3 || "",
            modLevel4: l4 || ""
          },
          prints: []
        };
      } else if (sheetKey === "vehicle cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "VEHICLE name");
        const hpConRaw = get(row, "VEHICLE HP/CON");
        const vtRaw = get(row, "Vehicle Type");
        const pitRaw = get(row, "PIT COST");
        const trait = get(row, "TRAIT");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Vehicle";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        const hpConStr = hpConRaw ? String(hpConRaw) : "";
        const hpCon = hpConStr ? parseHpCon(hpConStr) : {};
        const vtClean = (vtRaw || "").toString().replace(/\//g, ",");
        const vehicleTypes = parseVehicleTypes(vtClean);
        const pitCost = pitRaw !== "" && pitRaw !== null && pitRaw !== undefined
          ? Number(pitRaw)
          : undefined;

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes,
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: {
            sourceSheet: sheetName,
            hp: hpCon.hp,
            con: hpCon.con,
            pitCost
          },
          prints: []
        };
      } else if (sheetKey === "named vehicle" || sheetKey === "named vehicle cards") {
        const setNameRaw = get(row, "SET");
        const name = get(row, "NAMED VEHICLE NAME");
        const hpConRaw = get(row, "VEHICLE HP/CON");
        const vtRaw = get(row, "Vehicle Type");
        const pitRaw = get(row, "PIT COST");
        const trait = get(row, "VEHICLE TRAIT");
        const rarity = get(row, "RARITY");
        const cardNoRaw = get(row, "Card Number");

        if (!name && !trait && !setNameRaw && !cardNoRaw) return;

        const setName = normalizeSetName(setNameRaw);
        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Named Vehicle";
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        const hpConStr = hpConRaw ? String(hpConRaw) : "";
        const hpCon = hpConStr ? parseHpCon(hpConStr) : {};
        const vtClean = (vtRaw || "").toString().replace(/\//g, ",");
        const vehicleTypes = parseVehicleTypes(vtClean);
        const pitCost = pitRaw !== "" && pitRaw !== null && pitRaw !== undefined
          ? Number(pitRaw)
          : undefined;

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes,
          tags: [],
          imageUrl: "",
          notes: trait || "",
          extra: {
            sourceSheet: sheetName,
            hp: hpCon.hp,
            con: hpCon.con,
            pitCost
          },
          prints: []
        };
      } else if (sheetKey === "misc") {
        const name = get(row, "TOKENS/COUNTERS");
        const ability = get(row, "ABILITY");
        const cardNoRaw = get(row, "Card Number");
        const rarity = get(row, "RARITY");

        if (!name && !ability && !cardNoRaw) return;

        const cardNumber = normalizeCardNumber(cardNoRaw);
        const type = "Misc";
        const setName = ""; // none in this sheet
        const existingId = findExistingCardId(name, type, setName, cardNumber);

        baseCard = {
          id: existingId || generateId(),
          name,
          type,
          setName,
          cardNumber,
          rarity,
          vehicleTypes: [],
          tags: [],
          imageUrl: "",
          notes: ability || "",
          extra: { sourceSheet: sheetName },
          prints: []
        };
      }

      if (baseCard) {
        // If we have setName/cardNumber, synthesize a print
        const setName = baseCard.setName || "";
        const cardNumber = baseCard.cardNumber || "";
        const prints = [];
        if (setName || cardNumber) {
          prints.push({
            setName,
            cardNumber,
            isPrimary: true
          });
        }
        baseCard.prints = prints;

        const normalized = normalizeCardShape(baseCard);
        all.push(normalized);
      }
    });
  });

  return all;
}

/************************************************************
 * Step 1: Handle file load
 ************************************************************/
function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!Dom.bulkStatus) return;
  Dom.bulkStatus.textContent = `Loading "${file.name}"...`;

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx");

  if (!isXlsx) {
    Dom.bulkStatus.textContent = "Please select an .xlsx master file (Drive Cards.xlsx).";
    return;
  }

  if (typeof XLSX === "undefined") {
    Dom.bulkStatus.textContent =
      "XLSX library is not loaded. Check the <script> tag for SheetJS in admin.html.";
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      parsedCards = parseWorkbookToCards(workbook) || [];
      selectedCardIds.clear();
      availableTypes = new Set();
      availableSets = new Set();

      parsedCards.forEach(card => {
        if (card.type) availableTypes.add(card.type);
        if (card.setName) availableSets.add(card.setName);
      });

      updateFilterDropdowns();
      renderBulkSelectionList();
      renderBulkSelectedPreview();

      if (!parsedCards.length) {
        Dom.bulkStatus.textContent =
          "Loaded the workbook, but found 0 usable rows. Check that your sheets match the expected format.";
      } else {
        Dom.bulkStatus.textContent =
          `Loaded ${parsedCards.length} card(s) from ${workbook.SheetNames.length} sheet(s).` +
          " Use Step 2 to filter and select cards for import.";
      }
    } catch (err) {
      console.error(err);
      Dom.bulkStatus.textContent = "Failed to parse XLSX file.";
      parsedCards = [];
      selectedCardIds.clear();
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
 * Step 2: Filtering & selection UI
 ************************************************************/
function updateFilterDropdowns() {
  if (Dom.bulkTypeFilterSelect) {
    const sel = Dom.bulkTypeFilterSelect;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Types";
    sel.appendChild(optAll);
    Array.from(availableTypes).sort().forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
    if (current && Array.from(availableTypes).includes(current)) {
      sel.value = current;
    }
  }

  if (Dom.bulkSetFilterSelect) {
    const sel = Dom.bulkSetFilterSelect;
    const current = sel.value;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All Sets";
    sel.appendChild(optAll);
    Array.from(availableSets).sort().forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
    if (current && Array.from(availableSets).includes(current)) {
      sel.value = current;
    }
  }
}

function getFilteredCards() {
  const typeFilter = Dom.bulkTypeFilterSelect ? Dom.bulkTypeFilterSelect.value : "";
  const setFilter = Dom.bulkSetFilterSelect ? Dom.bulkSetFilterSelect.value : "";

  return parsedCards.filter(c => {
    const okType = !typeFilter || (c.type || "") === typeFilter;
    const okSet = !setFilter || (c.setName || "") === setFilter;
    return okType && okSet;
  });
}

function renderBulkSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;

  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No file loaded yet. Use Step 1 to load your master spreadsheet.";
    list.appendChild(li);
    return;
  }

  const filtered = getFilteredCards();

  if (!filtered.length) {
    const li = document.createElement("li");
    li.textContent = "No cards match the current Type/Set filter.";
    list.appendChild(li);
    return;
  }

  filtered.forEach(card => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "6px";
    li.style.fontSize = "11px";

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
    label.textContent =
      `${card.type || "Type ?"} | ${card.name || "(no name)"} | ` +
      `${card.setName || "Set ?"} #${card.cardNumber || "###"}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

/************************************************************
 * Step 3: Selected preview & import / clear
 ************************************************************/
function renderBulkSelectedPreview() {
  const out = Dom.bulkSelectedPreview;
  if (!out) return;

  if (!parsedCards.length) {
    out.textContent = "No file loaded yet.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 40).map(c => {
    return `• ${c.type || "Type ?"} | ${c.name || "(no name)"} | ` +
           `${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  out.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 40 ? `\n...and ${selected.length - 40} more.` : "");
}

function handleBulkImport() {
  if (!parsedCards.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "No file loaded yet. Use Step 1 first.";
    }
    return;
  }

  const toImport = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!toImport.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "No cards selected to import (Step 3).";
    }
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

  if (Dom.bulkStatus) {
    Dom.bulkStatus.textContent =
      `Imported ${toImport.length} card(s) (${added} added, ${updated} updated).`;
  }

  refreshSingleUi();
}

function handleBulkClear() {
  parsedCards = [];
  selectedCardIds.clear();
  availableTypes = new Set();
  availableSets = new Set();

  if (Dom.bulkStatus) {
    Dom.bulkStatus.textContent = "Bulk session cleared. Load a file again in Step 1.";
  }
  if (Dom.bulkSelectionList) {
    Dom.bulkSelectionList.innerHTML = "";
  }
  if (Dom.bulkSelectedPreview) {
    Dom.bulkSelectedPreview.textContent = "No cards selected for import.";
  }

  if (Dom.bulkTypeFilterSelect) Dom.bulkTypeFilterSelect.value = "";
  if (Dom.bulkSetFilterSelect) Dom.bulkSetFilterSelect.value = "";
}

/************************************************************
 * Public init
 ************************************************************/
export function initBulk() {
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", handleBulkFileChange);
  }

  if (Dom.bulkTypeFilterSelect) {
    Dom.bulkTypeFilterSelect.addEventListener("change", () => {
      renderBulkSelectionList();
      renderBulkSelectedPreview();
    });
  }

  if (Dom.bulkSetFilterSelect) {
    Dom.bulkSetFilterSelect.addEventListener("change", () => {
      renderBulkSelectionList();
      renderBulkSelectedPreview();
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

  // Initial empty render
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
