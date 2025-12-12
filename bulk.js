// bulk.js
// Bulk import from master XLSX: auto-parse, filter by Type/Set, select + import.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";
import { normalizeCardShape, generateId, parseVehicleTypes, parseTags, parseHpCon, refreshSingleUi } from "./single.js";

/************************************************************
 * Bulk session state
 ************************************************************/
let parsedCards = [];             // all cards parsed from XLSX
let selectedCardIds = new Set();  // card ids selected for import

/************************************************************
 * Helpers
 ************************************************************/
function normHeader(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "")
    .replace(/[^\w]+/g, "");
}

function pick(row, map, ...keys) {
  for (const k of keys) {
    const nk = normHeader(k);
    if (nk in map) {
      const v = row[map[nk]];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function safeStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/**
 * Split a "Set" string into normalized tokens for filtering.
 * Examples:
 *  - "SET 1" -> ["SET 1"]
 *  - "SET 1 & 2 & 3" -> ["SET 1","SET 2","SET 3"]
 *  - "SET FATHERS DAY" -> ["SET FATHERS DAY"]
 *  - "1" -> ["SET 1"]
 */
function setTokens(setStr) {
  const raw = safeStr(setStr);
  if (!raw) return [];

  const parts = raw.split(/&|,|;|\+|\//).map(s => s.trim()).filter(Boolean);
  const out = [];

  for (let p of parts.length ? parts : [raw]) {
    p = p.replace(/\s+/g, " ").trim();

    // If it's just a number like "2", treat as SET 2
    if (/^\d+$/.test(p)) p = `SET ${p}`;

    // Normalize "SET2" -> "SET 2"
    p = p.replace(/^set\s*(\d+)$/i, (_, n) => `SET ${n}`);

    // Uppercase style to match your sheet naming
    p = p.toUpperCase();

    // If user typed "DRAFT" etc, keep it
    out.push(p);
  }

  // If original had no separators and included multiple sets in one string, still allow tokens
  // (already handled by split above)

  // De-dupe
  return Array.from(new Set(out));
}

function cardDisplayLine(c) {
  const type = c.type || "(?)";
  const name = c.name || "(no name)";
  const setName = c.setName || "SET ?";
  const cardNumber = c.cardNumber || "####";
  return `${type} | ${name} | ${setName} ${cardNumber}`;
}

/************************************************************
 * XLSX parsing
 ************************************************************/
function inferTypeFromSheetName(sheetName) {
  const s = safeStr(sheetName).toLowerCase();
  // map your worksheet naming to in-game card types
  if (s.includes("named vehicle")) return "Named Vehicle";
  if (s.includes("vehicle")) return "Vehicle";
  if (s.includes("mod")) return "Mod";
  if (s.includes("driver")) return "Driver";
  if (s.includes("crew")) return "Crew";
  if (s.includes("track")) return "Track";
  if (s.includes("condition")) return "Condition";
  if (s.includes("sponsor")) return "Crew"; // sponsor is a sub-type; you can tag it via notes/tags if needed
  return "Misc";
}

function rowArrayFromSheet(sheet, firstRowHeader = true) {
  // We’ll read as rows so we can build a flexible header map.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) return { headers: [], data: [] };

  if (!firstRowHeader) {
    // generate A,B,C... headers
    const colCount = Math.max(...rows.map(r => r.length));
    const headers = Array.from({ length: colCount }, (_, i) => `COL_${i + 1}`);
    return { headers, data: rows };
  }

  const headers = rows[0].map(h => safeStr(h));
  const data = rows.slice(1);
  return { headers, data };
}

function headerMap(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    const key = normHeader(h);
    if (!key) return;
    // first occurrence wins
    if (!(key in map)) map[key] = idx;
  });
  return map;
}

function mapRowToCard(sheetType, headers, row) {
  const map = headerMap(headers);

  // Core fields (auto-assigned)
  const type = pick(row, map, "type") || sheetType;
  const name = pick(row, map, "name", "cardname", "title");
  const rarity = pick(row, map, "rarity", "rar");

  // set / number (prints)
  const setName =
    pick(row, map, "set", "setname", "setid", "prints", "printset") || "";
  const cardNumber =
    pick(row, map, "cardnumber", "number", "no", "#", "cardno") || "";

  // common fields
  const vtRaw = pick(row, map, "vehicletype", "vehicletype1", "vehicletype2", "vehicletype3");
  const tagsRaw = pick(row, map, "tags", "tag", "keywords");
  const imageUrl = pick(row, map, "image", "imageurl", "img");
  const notes = pick(row, map, "notes", "rules", "text", "effect");

  const vehicleTypes = parseVehicleTypes(vtRaw);
  const tags = parseTags(tagsRaw);

  const extra = {};

  if (type === "Mod") {
    extra.modBasePart = pick(row, map, "basepart", "part", "modbase", "base");
    extra.modLevel1 = pick(row, map, "level1", "l1", "lvl1");
    extra.modLevel2 = pick(row, map, "level2", "l2", "lvl2");
    extra.modLevel3 = pick(row, map, "level3", "l3", "lvl3");
    extra.modLevel4 = pick(row, map, "level4", "l4", "lvl4");
  }

  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConStr = pick(row, map, "hpcon", "hp/con", "hp", "hitpoints");
    const hpCon = hpConStr && hpConStr.includes("/")
      ? parseHpCon(hpConStr)
      : { hp: hpConStr ? Number(hpConStr) || undefined : undefined };

    extra.hp = hpCon.hp;
    extra.con = hpCon.con;

    const pitStr = pick(row, map, "pitcost", "pit", "pitpoints");
    extra.pitCost = pitStr ? Number(pitStr) : undefined;
  }

  const prints = [];
  if (setName || cardNumber) {
    prints.push({ setName: safeStr(setName), cardNumber: safeStr(cardNumber), isPrimary: true });
  }

  const baseCard = {
    id: pick(row, map, "id", "cardid") || generateId(),
    name,
    type,
    setName: safeStr(setName),
    cardNumber: safeStr(cardNumber),
    rarity,
    vehicleTypes,
    tags,
    imageUrl,
    notes,
    extra,
    prints
  };

  const normalized = normalizeCardShape(baseCard);

  // If name is missing but sheet has a column that ended up in notes (bad mapping),
  // we still keep the row but you’ll see "(no name)" in Step 2.
  return normalized;
}

function parseWorkbookToCards(workbook) {
  const all = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const sheetType = inferTypeFromSheetName(sheetName);
    const { headers, data } = rowArrayFromSheet(sheet, true);

    // Empty or header-only sheet
    if (!headers.length || !data.length) return;

    data.forEach(row => {
      // skip completely empty rows
      const hasAny = Array.isArray(row) && row.some(cell => safeStr(cell) !== "");
      if (!hasAny) return;

      const card = mapRowToCard(sheetType, headers, row);
      // keep only usable cards
      if (card && (card.name || card.type || card.setName || card.cardNumber)) {
        all.push(card);
      }
    });
  });

  return all;
}

/************************************************************
 * Filtering + rendering
 ************************************************************/
function getAllTypes(cards) {
  const types = new Set();
  cards.forEach(c => types.add((c.type || "Misc").trim() || "Misc"));
  return ["All Types", ...Array.from(types).sort((a,b) => a.localeCompare(b))];
}

function getAllSetOptions(cards) {
  const sets = new Set();
  cards.forEach(c => {
    const tokens = setTokens(c.setName);
    tokens.forEach(t => sets.add(t));
  });

  // Ensure common ordering: SET 1..n then others
  const arr = Array.from(sets);
  const setNums = arr
    .filter(s => /^SET\s+\d+$/.test(s))
    .sort((a,b) => Number(a.replace(/\D+/g,"")) - Number(b.replace(/\D+/g,"")));

  const others = arr
    .filter(s => !/^SET\s+\d+$/.test(s))
    .sort((a,b) => a.localeCompare(b));

  return ["All Sets", ...setNums, ...others];
}

function cardMatchesType(card, typeFilter) {
  if (!typeFilter || typeFilter === "All Types") return true;
  return (card.type || "Misc") === typeFilter;
}

function cardMatchesSet(card, setFilter) {
  if (!setFilter || setFilter === "All Sets") return true;

  const tokens = setTokens(card.setName);
  // if the card has no set, treat as not matching
  if (!tokens.length) return false;

  return tokens.includes(setFilter.toUpperCase());
}

function cardMatchesText(card, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (card.name || "").toLowerCase().includes(s) ||
    (card.type || "").toLowerCase().includes(s) ||
    (card.setName || "").toLowerCase().includes(s) ||
    (card.cardNumber || "").toLowerCase().includes(s)
  );
}

function getViewedCards() {
  const typeFilter = Dom.bulkTypeFilter?.value || "All Types";
  const setFilter = Dom.bulkSetFilter?.value || "All Sets";
  const q = safeStr(Dom.bulkFilterInput?.value).trim();

  return parsedCards.filter(c =>
    cardMatchesType(c, typeFilter) &&
    cardMatchesSet(c, setFilter) &&
    cardMatchesText(c, q)
  );
}

function renderFilters() {
  if (!Dom.bulkTypeFilter || !Dom.bulkSetFilter) return;

  // TYPE
  const types = getAllTypes(parsedCards);
  Dom.bulkTypeFilter.innerHTML = "";
  types.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    Dom.bulkTypeFilter.appendChild(opt);
  });

  // SET
  const sets = getAllSetOptions(parsedCards);
  Dom.bulkSetFilter.innerHTML = "";
  sets.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    Dom.bulkSetFilter.appendChild(opt);
  });

  // Default values
  Dom.bulkTypeFilter.value = "All Types";
  Dom.bulkSetFilter.value = "All Sets";
}

function renderSelectionList() {
  if (!Dom.bulkSelectionList) return;
  const list = Dom.bulkSelectionList;
  list.innerHTML = "";

  if (!parsedCards.length) {
    const li = document.createElement("li");
    li.className = "mono";
    li.textContent = "No parsed cards yet. Load your master spreadsheet in Step 1.";
    list.appendChild(li);
    return;
  }

  const viewed = getViewedCards();
  if (!viewed.length) {
    const li = document.createElement("li");
    li.className = "mono";
    li.textContent = "No cards match the current filters.";
    list.appendChild(li);
    return;
  }

  viewed.forEach(card => {
    const li = document.createElement("li");
    li.className = "checkrow";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedCardIds.has(card.id);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedCardIds.add(card.id);
      else selectedCardIds.delete(card.id);
      renderSelectedPreview();
    });

    const label = document.createElement("div");
    label.className = "mono";
    label.textContent = cardDisplayLine(card);

    li.appendChild(checkbox);
    li.appendChild(label);
    list.appendChild(li);
  });
}

function renderSelectedPreview() {
  if (!Dom.bulkSelectedPreview) return;

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!selected.length) {
    Dom.bulkSelectedPreview.textContent = "No cards selected for import.";
    return;
  }

  const lines = selected.slice(0, 80).map(c => `• ${cardDisplayLine(c)}`);
  Dom.bulkSelectedPreview.textContent =
    `${selected.length} card(s) selected for import:\n` +
    lines.join("\n") +
    (selected.length > 80 ? `\n...and ${selected.length - 80} more.` : "");
}

/************************************************************
 * Actions
 ************************************************************/
function clearBulkSession() {
  parsedCards = [];
  selectedCardIds.clear();
  if (Dom.bulkStatus) Dom.bulkStatus.textContent = "Waiting for file…";
  if (Dom.bulkSelectionList) Dom.bulkSelectionList.innerHTML = "";
  if (Dom.bulkSelectedPreview) Dom.bulkSelectedPreview.textContent = "";
  if (Dom.bulkTypeFilter) Dom.bulkTypeFilter.innerHTML = "";
  if (Dom.bulkSetFilter) Dom.bulkSetFilter.innerHTML = "";
}

function importSelectedIntoLibrary() {
  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "Nothing parsed yet.";
    return;
  }

  const toImport = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!toImport.length) {
    Dom.bulkStatus.textContent = "No cards selected to import.";
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

  Dom.bulkStatus.textContent = `Imported ${toImport.length} card(s) (${added} added, ${updated} updated).`;

  // Keep the session (so you can import in batches) — or clear if you prefer:
  // clearBulkSession();

  refreshSingleUi();
}

/************************************************************
 * Step 1: Load & Parse XLSX (AUTO-PARSE + BUTTON)
 ************************************************************/
function handleLoadAndParseXlsx() {
  const file = Dom.bulkFileInput?.files?.[0];
  if (!file) {
    Dom.bulkStatus.textContent = "Waiting for file…";
    return;
  }

  if (typeof XLSX === "undefined") {
    Dom.bulkStatus.textContent =
      "XLSX library is not loaded. Ensure the xlsx.full.min.js script tag is included before app.js.";
    return;
  }

  Dom.bulkStatus.textContent = `Loading & parsing ${file.name}…`;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      const cards = parseWorkbookToCards(workbook);

      parsedCards = cards;

      // Select all by default (you can change this if you prefer none selected)
      selectedCardIds = new Set(parsedCards.map(c => c.id));

      renderFilters();
      renderSelectionList();
      renderSelectedPreview();

      Dom.bulkStatus.textContent = `Parsed ${parsedCards.length} cards from master spreadsheet.`;
    } catch (err) {
      console.error(err);
      Dom.bulkStatus.textContent = "Failed to parse XLSX. Check console for details.";
    }
  };

  reader.onerror = () => {
    Dom.bulkStatus.textContent = "Could not read file.";
  };

  reader.readAsArrayBuffer(file);
}

/************************************************************
 * Public init
 ************************************************************/
export function initBulk() {
  // ✅ Auto-parse when file selected
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", () => {
      const f = Dom.bulkFileInput.files?.[0];
      if (!f) {
        Dom.bulkStatus.textContent = "Waiting for file…";
        return;
      }
      handleLoadAndParseXlsx();
    });
  }

  // Optional manual button (re-parse)
  if (Dom.bulkLoadBtn) {
    Dom.bulkLoadBtn.addEventListener("click", handleLoadAndParseXlsx);
  }

  // Filters
  if (Dom.bulkTypeFilter) {
    Dom.bulkTypeFilter.addEventListener("change", () => {
      renderSelectionList();
      renderSelectedPreview();
    });
  }
  if (Dom.bulkSetFilter) {
    Dom.bulkSetFilter.addEventListener("change", () => {
      renderSelectionList();
      renderSelectedPreview();
    });
  }
  if (Dom.bulkFilterInput) {
    Dom.bulkFilterInput.addEventListener("input", () => {
      renderSelectionList();
      renderSelectedPreview();
    });
  }

  // Select/Deselect viewed
  if (Dom.bulkSelectAllViewedBtn) {
    Dom.bulkSelectAllViewedBtn.addEventListener("click", () => {
      const viewed = getViewedCards();
      viewed.forEach(c => selectedCardIds.add(c.id));
      renderSelectionList();
      renderSelectedPreview();
    });
  }

  if (Dom.bulkDeselectAllViewedBtn) {
    Dom.bulkDeselectAllViewedBtn.addEventListener("click", () => {
      const viewed = getViewedCards();
      viewed.forEach(c => selectedCardIds.delete(c.id));
      renderSelectionList();
      renderSelectedPreview();
    });
  }

  // Import / clear session
  if (Dom.bulkImportSelectedBtn) {
    Dom.bulkImportSelectedBtn.addEventListener("click", importSelectedIntoLibrary);
  }
  if (Dom.bulkClearSessionBtn) {
    Dom.bulkClearSessionBtn.addEventListener("click", clearBulkSession);
  }

  // Initial empty state
  if (Dom.bulkSelectedPreview) Dom.bulkSelectedPreview.textContent = "No cards selected for import.";
}
