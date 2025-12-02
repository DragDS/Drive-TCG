// bulk.js
// Bulk import: load master .xlsx, filter by Type/Set, select, and import.

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
 * Module-level state
 ************************************************************/
let parsedCards = [];          // All parsed cards from the workbook
let selectedIds = new Set();   // IDs of cards chosen for import

/************************************************************
 * Helpers
 ************************************************************/

// Try to infer a card Type from sheet name if the sheet doesn't include a Type column.
function inferTypeFromSheetName(sheetName) {
  if (!sheetName) return "";
  const s = sheetName.toLowerCase();

  if (s.includes("mod")) return "Mod";
  if (s.includes("vehicle") || s.includes("car")) return "Vehicle";
  if (s.includes("named") && s.includes("veh")) return "Named Vehicle";
  if (s.includes("driver") && s.includes("named")) return "Named Driver";
  if (s.includes("driver")) return "Driver";
  if (s.includes("track")) return "Track";
  if (s.includes("condition")) return "Condition";
  if (s.includes("crew")) return "Crew";

  // Fallback: leave blank or "Misc"
  return "";
}

// Normalize header cell into a loose key (case / spaces / symbols ignored)
function normalizeHeader(str) {
  return (String(str || "").toLowerCase())
    .replace(/[\s_]+/g, "")
    .replace(/\W+/g, "");
}

// Core row → card mapper
function mapRowToCard(headers, row, fallbackType, sheetName) {
  const norm = {};
  headers.forEach((h, i) => {
    const key = (h || "").toString().trim();
    const value = row[i] != null ? String(row[i]).trim() : "";
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

  let type = get("type", "cardtype");
  if (!type) {
    type = fallbackType || "";
  }

  const name = get("name", "cardname", "title");
  const rawSetName = get("set", "setname", "setid");
  const cardNumber = get("cardnumber", "number", "no", "#");
  const rarity = get("rarity", "rar");

  const vt = get("vehicletype", "vehicletype1", "vehicletype2", "vehicletype3");
  const tagsStr = get("tags", "tag", "keywords");

  const imageUrl = get("image", "imageurl", "img", "art");
  const notes = get("notes", "rules", "text");

  const vehicleTypes = parseVehicleTypes(vt);
  const tags = parseTags(tagsStr);

  const extra = {};

  if (type === "Mod") {
    extra.modBasePart = get("basepart", "part", "modbase", "base");
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

  // Multi-set handling:
  // - If rawSetName contains "&" or "," we split into multiple sets.
  // - Each becomes a separate print entry.
  const prints = [];
  if (rawSetName || cardNumber) {
    const setPieces = rawSetName
      ? rawSetName.split(/[&,+]/).map(s => s.trim()).filter(Boolean)
      : [];

    if (setPieces.length) {
      setPieces.forEach(sn => {
        prints.push({
          setName: sn,
          cardNumber,
          isPrimary: false
        });
      });
      if (prints[0]) prints[0].isPrimary = true;
    } else if (rawSetName || cardNumber) {
      prints.push({
        setName: rawSetName,
        cardNumber,
        isPrimary: true
      });
    }
  }

  const baseCard = {
    id: get("id", "cardid") || generateId(),
    name,
    type,
    setName: rawSetName,
    cardNumber,
    rarity,
    vehicleTypes,
    tags,
    imageUrl,
    notes,
    extra,
    prints,
    __sheetName: sheetName || ""
  };

  // If the row is basically empty, skip
  if (!baseCard.name && !baseCard.type && !baseCard.setName && !baseCard.cardNumber) {
    return null;
  }

  return normalizeCardShape(baseCard);
}

// Helper: get all sets a card belongs to (for filters)
function getCardSetNames(card) {
  const result = new Set();

  if (Array.isArray(card.prints)) {
    card.prints.forEach(p => {
      const sn = (p.setName || p.setId || "").trim();
      if (sn) result.add(sn);
    });
  }

  const raw = (card.setName || card.setId || "").trim();
  if (raw) {
    if (raw.includes("&") || raw.includes(",")) {
      raw.split(/[&,+]/).forEach(part => {
        const sn = part.trim();
        if (sn) result.add(sn);
      });
    } else {
      result.add(raw);
    }
  }

  return Array.from(result);
}

/************************************************************
 * XLSX loading
 ************************************************************/
function handleBulkFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx");

  if (!isXlsx) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "Please select a .xlsx master spreadsheet.";
    }
    return;
  }

  if (typeof XLSX === "undefined") {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent =
        "XLSX library is not loaded. Check the SheetJS <script> tag in admin.html.";
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });

      const allCards = [];

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false
        });

        if (!rows.length) return;

        const headers = rows[0].map(h => (h != null ? String(h) : ""));
        const fallbackType = inferTypeFromSheetName(sheetName);

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const card = mapRowToCard(headers, row, fallbackType, sheetName);
          if (card) {
            allCards.push(card);
          }
        }
      });

      parsedCards = allCards;
      selectedIds = new Set(parsedCards.map(c => c.id));

      if (Dom.bulkStatus) {
        Dom.bulkStatus.textContent =
          `Loaded ${parsedCards.length} card(s) from '${file.name}'. Use Step 2 to filter and choose which ones to import.`;
      }

      rebuildFilters();
      renderCardList();
      renderSelectedPreview();
    } catch (err) {
      console.error(err);
      if (Dom.bulkStatus) {
        Dom.bulkStatus.textContent = "Failed to parse the .xlsx file.";
      }
      parsedCards = [];
      selectedIds.clear();
      renderCardList();
      renderSelectedPreview();
    }
  };
  reader.onerror = () => {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "Could not read the .xlsx file.";
    }
  };
  reader.readAsArrayBuffer(file);
}

/************************************************************
 * Filters (Type + Set)
 ************************************************************/
function rebuildFilters() {
  // Type filter
  const typeSelect = Dom.bulkFilterTypeSelect;
  const setSelect = Dom.bulkFilterSetSelect;
  if (!typeSelect || !setSelect) return;

  const typeOptions = new Set();
  parsedCards.forEach(c => {
    const t = (c.type || "").trim();
    if (t) typeOptions.add(t);
  });

  const setOptions = new Set();
  parsedCards.forEach(c => {
    getCardSetNames(c).forEach(sn => setOptions.add(sn));
  });

  // Rebuild Type select
  typeSelect.innerHTML = "";
  const allTypeOpt = document.createElement("option");
  allTypeOpt.value = "";
  allTypeOpt.textContent = "All Types";
  typeSelect.appendChild(allTypeOpt);

  Array.from(typeOptions).sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  // Rebuild Set select
  setSelect.innerHTML = "";
  const allSetOpt = document.createElement("option");
  allSetOpt.value = "";
  allSetOpt.textContent = "All Sets";
  setSelect.appendChild(allSetOpt);

  Array.from(setOptions).sort().forEach(sn => {
    const opt = document.createElement("option");
    opt.value = sn;
    opt.textContent = sn;
    setSelect.appendChild(opt);
  });
}

function getFilteredCards() {
  const typeSelect = Dom.bulkFilterTypeSelect;
  const setSelect = Dom.bulkFilterSetSelect;

  const typeFilter = typeSelect ? (typeSelect.value || "") : "";
  const setFilter = setSelect ? (setSelect.value || "") : "";

  return parsedCards.filter(card => {
    if (typeFilter && card.type !== typeFilter) return false;
    if (setFilter) {
      const sets = getCardSetNames(card);
      if (!sets.includes(setFilter)) return false;
    }
    return true;
  });
}

/************************************************************
 * Step 2: Card list + selection
 ************************************************************/
function renderCardList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;

  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.textContent = "No cards loaded yet. Load your Drive Cards.xlsx in Step 1.";
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
    li.className = "bulk-card-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bulk-card-checkbox";
    checkbox.checked = selectedIds.has(card.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(card.id);
      } else {
        selectedIds.delete(card.id);
      }
      renderSelectedPreview();
    });

    const label = document.createElement("span");
    label.className = "bulk-card-label";
    const mainSet = getCardSetNames(card)[0] || card.setName || "Set ?";
    const mainNumber = card.cardNumber || (card.prints && card.prints[0]?.cardNumber) || "###";
    label.textContent = `${card.type || "Type ?"} | ${card.name || "(no name)"} | ${mainSet} #${mainNumber}`;

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

function handleSelectAllViewed() {
  const viewed = getFilteredCards();
  viewed.forEach(c => selectedIds.add(c.id));
  renderCardList();
  renderSelectedPreview();
}

function handleDeselectAllViewed() {
  const viewed = getFilteredCards();
  viewed.forEach(c => selectedIds.delete(c.id));
  renderCardList();
  renderSelectedPreview();
}

/************************************************************
 * Step 3: Selected preview + import / clear
 ************************************************************/
function renderSelectedPreview() {
  const out = Dom.bulkSelectedPreview;
  if (!out) return;

  if (!parsedCards.length) {
    out.textContent = "No cards loaded.";
    return;
  }

  const selected = parsedCards.filter(c => selectedIds.has(c.id));

  if (!selected.length) {
    out.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 200).map(c => {
    const sets = getCardSetNames(c);
    const primarySet = sets[0] || c.setName || "Set ?";
    const num = c.cardNumber ||
      (Array.isArray(c.prints) && c.prints[0] && c.prints[0].cardNumber) ||
      "###";
    return `• ${c.type || "Type ?"} | ${c.name || "(no name)"} | ${primarySet} #${num}`;
  });

  out.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 200 ? `\n...and ${selected.length - 200} more.` : "");
}

function handleBulkImport() {
  if (!parsedCards.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "Nothing loaded yet. Load your master spreadsheet in Step 1.";
    }
    return;
  }

  const toImport = parsedCards.filter(c => selectedIds.has(c.id));
  if (!toImport.length) {
    if (Dom.bulkStatus) {
      Dom.bulkStatus.textContent = "No cards selected to import in Step 3.";
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

  // Keep the parsed data in case you want to adjust filters & re-import,
  // but you can clear it with the Clear button.
  refreshSingleUi();
  renderSelectedPreview();
}

function handleBulkClearSession() {
  parsedCards = [];
  selectedIds.clear();

  if (Dom.bulkStatus) {
    Dom.bulkStatus.textContent = "Bulk session cleared. Load a master spreadsheet to start again.";
  }
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.value = "";
  }

  renderCardList();
  renderSelectedPreview();
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
      renderCardList();
      renderSelectedPreview();
    });
  }
  if (Dom.bulkFilterSetSelect) {
    Dom.bulkFilterSetSelect.addEventListener("change", () => {
      renderCardList();
      renderSelectedPreview();
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
    Dom.bulkClearSessionBtn.addEventListener("click", handleBulkClearSession);
  }

  // Initial empty render
  renderCardList();
  renderSelectedPreview();
}
