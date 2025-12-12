// bulk.js
// Bulk import: XLSX-only, using the master spreadsheet as source of truth.

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
let parsedCards = [];            // All cards parsed from XLSX
let selectedCardIds = new Set(); // IDs of cards chosen for import

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

function inferTypeFromSheet(sheetName) {
  const n = (sheetName || "").toLowerCase();
  if (n.includes("crew")) return "Crew";
  if (n.includes("driver") && !n.includes("named")) return "Driver";
  if (n.includes("named") && n.includes("vehicle")) return "Named Vehicle";
  if (n.includes("vehicle")) return "Vehicle";
  if (n.includes("mod")) return "Mod";
  if (n.includes("condition")) return "Condition";
  if (n.includes("track")) return "Track";
  return "Misc";
}

function parseSetTokens(raw) {
  if (!raw) return [];
  return raw
    .toString()
    .split(/&|,|\//)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Map one XLSX row into a normalized card.
 */
function mapRow(sheetName, row) {
  if (!row || typeof row !== "object") return null;

  // Build a normalized key map: "modlvl1" -> value, etc.
  const norm = {};
  for (const [key, val] of Object.entries(row)) {
    const nk = normalizeHeader(key);
    if (!nk) continue;
    norm[nk] = val;
  }

  const get = (...candidates) => {
    for (const c of candidates) {
      const nk = normalizeHeader(c);
      if (nk in norm && norm[nk] != null) {
        const v = String(norm[nk]).trim();
        if (v) return v;
      }
    }
    return "";
  };

  // Core fields
  let type = get("Type"); // usually blank in master; we use sheet name instead
  if (!type) {
    type = inferTypeFromSheet(sheetName);
  }

  const name = get(
    "Crew Name",
    "Driver Name",
    "Mod Name",
    "Track Name",
    "Condition Name",
    "VEHICLE name",
    "NAMED VEHICLE NAME",
    "TOKENS/COUNTERS",
    "Name",
    "Card Name"
  );

  const setRaw = get("SET", "Set", "Set Name");
  const rarity = get("RARITY", "Rarity");
  const cardNumber = get("Card Number", "CARD #", "Card #", "No", "#");

  // Skip totally empty rows
  if (!name && !setRaw && !cardNumber) return null;

  // Vehicle type(s)
  let vehicleTypesStr = "";

  if (type === "Crew") {
    vehicleTypesStr = get("Crew Type", "Crew VEHICLE Type", "Vehicle Type");
  } else if (type === "Driver" || type === "Named Driver") {
    vehicleTypesStr = get("Driver Type", "Vehicle Type");
  } else if (type === "Vehicle" || type === "Named Vehicle") {
    vehicleTypesStr = get("Vehicle Type");
  }

  const vehicleTypes = parseVehicleTypes(vehicleTypesStr);

  // Notes / rules text – pull appropriate trait columns
  let notes = "";
  if (type === "Crew") {
    notes = get("Crew Trait", "Crew Ability", "Ability", "Notes", "Rules Text");
  } else if (type === "Driver" || type === "Named Driver") {
    notes = get("Driver Trait", "Driver Ability", "Ability", "Notes", "Rules Text");
  } else if (type === "Condition") {
    notes = get("Condition Trait", "Condition Ability", "Ability", "Notes", "Rules Text");
  } else if (type === "Track") {
    notes = get("Track Trait", "Track Ability", "Ability", "Notes", "Rules Text");
  } else if (type === "Mod") {
    const trait = get("Mod TYPE", "Mod Trait");
    const ability = get("Mod Ability", "Ability");
    notes = [trait, ability].filter(Boolean).join("\n");
  } else {
    notes = get("Ability", "Notes", "Rules Text");
  }

  // Extra/type-specific fields
  const extra = {};

  if (type === "Mod") {
    extra.modBasePart = get("Base Part", "BasePart");
    extra.modLevel1 = get("Mod Lvl 1", "Mod L1", "Level 1", "Lvl 1");
    extra.modLevel2 = get("Mod Lvl 2", "Mod L2", "Level 2", "Lvl 2");
    extra.modLevel3 = get("Mod Lvl 3", "Mod L3", "Level 3", "Lvl 3");
    extra.modLevel4 = get("Mod Lvl 4", "Mod L4", "Level 4", "Lvl 4");
  }

  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConStr = get("VEHICLE HP/CON", "HP/CON", "HP CON", "HP");
    if (hpConStr && hpConStr.includes("/")) {
      const hpCon = parseHpCon(hpConStr);
      extra.hp = hpCon.hp;
      extra.con = hpCon.con;
    }
    const pitStr = get("Pit", "PIT", "PIT COST");
    if (pitStr) {
      const n = Number(pitStr);
      extra.pitCost = Number.isFinite(n) ? n : undefined;
    }
  }

  const tags = parseTags(get("Tags", "Keywords"));

  const setTokens = parseSetTokens(setRaw);
  const baseCard = {
    id: generateId(),
    name,
    type,
    setName: setRaw,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl: "", // master file doesn't have image URLs; you can fill these later
    notes,
    extra,
    prints: setRaw || cardNumber
      ? [{
          setName: setRaw,
          cardNumber,
          isPrimary: true
        }]
      : []
  };

  const card = normalizeCardShape(baseCard);
  card._bulkSetTokens = setTokens.length ? setTokens : (setRaw ? [setRaw] : []);
  return card;
}

/************************************************************
 * Filtering helpers (Step 2)
 ************************************************************/
function getCurrentTypeFilter() {
  if (!Dom.bulkFilterTypeSelect) return "";
  const v = Dom.bulkFilterTypeSelect.value || "";
  return v === "__ALL__" ? "" : v;
}

function getCurrentSetFilter() {
  if (!Dom.bulkFilterSetSelect) return "";
  const v = Dom.bulkFilterSetSelect.value || "";
  return v === "__ALL__" ? "" : v;
}

function getFilteredCards() {
  const typeFilter = getCurrentTypeFilter();
  const setFilter = getCurrentSetFilter();

  return parsedCards.filter(card => {
    if (typeFilter && card.type !== typeFilter) return false;
    if (setFilter) {
      const sets = card._bulkSetTokens || [];
      if (!sets.includes(setFilter)) return false;
    }
    return true;
  });
}

function rebuildFilterOptions() {
  if (!parsedCards.length) {
    if (Dom.bulkFilterTypeSelect) {
      Dom.bulkFilterTypeSelect.innerHTML =
        `<option value="__ALL__">All Types</option>`;
    }
    if (Dom.bulkFilterSetSelect) {
      Dom.bulkFilterSetSelect.innerHTML =
        `<option value="__ALL__">All Sets</option>`;
    }
    return;
  }

  const typeSet = new Set();
  const setSet = new Set();

  parsedCards.forEach(card => {
    if (card.type) typeSet.add(card.type);
    (card._bulkSetTokens || []).forEach(s => setSet.add(s));
  });

  // Types
  if (Dom.bulkFilterTypeSelect) {
    Dom.bulkFilterTypeSelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "__ALL__";
    optAll.textContent = "All Types";
    Dom.bulkFilterTypeSelect.appendChild(optAll);

    Array.from(typeSet)
      .sort((a, b) => a.localeCompare(b))
      .forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        Dom.bulkFilterTypeSelect.appendChild(opt);
      });
  }

  // Sets
  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.innerHTML = "";
    const optAllS = document.createElement("option");
    optAllS.value = "__ALL__";
    optAllS.textContent = "All Sets";
    Dom.bulkFilterSetSelect.appendChild(optAllS);

    Array.from(setSet)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        Dom.bulkFilterSetSelect.appendChild(opt);
      });
  }
}

/************************************************************
 * Rendering: Step 2 & Step 3
 ************************************************************/
function renderBulkSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;

  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No cards loaded. Select Drive Cards.xlsx in Step 1.";
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
    li.className = "bulk-row";

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
    label.className = "bulk-row-label";
    label.textContent =
      `${card.type || "Type ?"} | ${card.name || "(no name)"} | ` +
      `${card.setName || "Set ?"} #${card.cardNumber || "###"}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

function renderBulkSelectedPreview() {
  const out = Dom.bulkSelectedPreview;
  if (!out) return;

  if (!parsedCards.length) {
    out.textContent = "No cards loaded yet.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 80).map(c => {
    return `• ${c.type || "Type ?"} | ${c.name || "(no name)"} | ` +
      `${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  out.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 80
      ? `\n...and ${selected.length - 80} more.`
      : "");
}

/************************************************************
 * Step 1: Load XLSX
 ************************************************************/
function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!/\.xlsx$/i.test(file.name || "")) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "Please select your Drive Cards.xlsx (.xlsx) file.";
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });

      parsedCards = [];
      selectedCardIds.clear();

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        rows.forEach(row => {
          const card = mapRow(sheetName, row);
          if (card) {
            parsedCards.push(card);
          }
        });
      });

      rebuildFilterOptions();
      renderBulkSelectionList();
      renderBulkSelectedPreview();

      if (Dom.bulkStatus) {
        Dom.bulkStatus.textContent =
          `Loaded ${parsedCards.length} card(s) from workbook. Use Step 2 to filter & select.`;
      }
    } catch (err) {
      console.error(err);
      if (Dom.bulkStatus) {
        Dom.bulkStatus.textContent = "Failed to parse XLSX file.";
      }
    }
  };
  reader.onerror = () => {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "Could not read XLSX file.";
    }
  };
  reader.readAsArrayBuffer(file);
}

/************************************************************
 * Step 2 buttons
 ************************************************************/
function handleSelectAllViewed() {
  const filtered = getFilteredCards();
  filtered.forEach(c => selectedCardIds.add(c.id));
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

function handleDeselectAllViewed() {
  const filtered = getFilteredCards();
  filtered.forEach(c => selectedCardIds.delete(c.id));
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}

/************************************************************
 * Step 3: Import / Clear
 ************************************************************/
function handleBulkImport() {
  if (!parsedCards.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "No cards loaded yet. Load Drive Cards.xlsx in Step 1.";
    }
    return;
  }

  const toImport = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!toImport.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "No cards selected to import (Step 2).";
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
      `Imported ${toImport.length} card(s) into library (${added} added, ${updated} updated).`;
  }

  // Refresh Single tab library / preview
  refreshSingleUi();
}

function handleClearSession() {
  parsedCards = [];
  selectedCardIds.clear();
  renderBulkSelectionList();
  renderBulkSelectedPreview();
  if (Dom.bulkStatus) {
    Dom.bulkStatus.textContent = "Cleared current bulk session.";
  }
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.value = "";
  }
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

  if (Dom.bulkSelectAllViewedBtn) {
    Dom.bulkSelectAllViewedBtn.addEventListener("click", handleSelectAllViewed);
  }
  if (Dom.bulkDeselectAllViewedBtn) {
    Dom.bulkDeselectAllViewedBtn.addEventListener("click", handleDeselectAllViewed);
  }

  if (Dom.bulkImportBtn) {
    Dom.bulkImportBtn.addEventListener("click", handleBulkImport);
  }
  if (Dom.bulkClearSessionBtn) {
    Dom.bulkClearSessionBtn.addEventListener("click", handleClearSession);
  }

  // Initial empty render
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
