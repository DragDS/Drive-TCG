// bulk.js
// Bulk import: parsing, preview, and importing into AppState.cards.

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
 * XLSX helper (lazy-loaded)
 ************************************************************/
let xlsxLibPromise = null;

function loadXlsxLib() {
  if (!xlsxLibPromise) {
    // Uses ESM build of SheetJS from a CDN; no bundler needed.
    xlsxLibPromise = import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  }
  return xlsxLibPromise;
}

/************************************************************
 * Bulk Import core helpers
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

  // --- NAME ---
  const name = get(
    "name",
    "cardname",
    "title",
    "crewname",
    "modname",
    "drivername",
    "conditionname",
    "trackname",
    "vehiclename",
    "namedvehiclename",
    "tokens/counters",
    "tokenscounters"
  );

  // --- TYPE (infer from headers if missing) ---
  let type = get("type");

  if (!type) {
    if (hasAny("crewname")) type = "Crew";
    else if (hasAny("modname")) type = "Mod";
    else if (hasAny("conditionname")) type = "Condition";
    else if (hasAny("trackname")) type = "Track";
    else if (hasAny("namedvehiclename")) type = "Named Vehicle";
    else if (hasAny("vehiclename")) type = "Vehicle";
    else if (hasAny("tokens/counters", "tokenscounters")) type = "Misc";
    else if (hasAny("drivername")) type = "Driver";
  }

  // --- CORE METADATA ---
  const setName = get("set", "setname", "setid");
  const cardNumber = get("cardnumber", "number", "no", "#");
  const rarity = get("rarity", "rar");

  const vt = get("vehicletype", "vehicletype2", "vehicletype1", "vehicletype3");
  const tagsStr = get("tags", "tag", "keywords");

  const imageUrl = get("image", "imageurl", "img");

  // Notes / rules text: support master sheet trait columns as well
  const notes = get(
    "notes",
    "rules",
    "text",
    "crewtrait",
    "drivertrait",
    "conditiontrait",
    "tracktrait",
    "trait",
    "modability",
    "ability",
    "vehicletrait"
  );

  const vehicleTypes = parseVehicleTypes(vt);
  const tags = parseTags(tagsStr);

  const extra = {};

  // --- MOD EXTRAS ---
  if (type === "Mod") {
    extra.modBasePart = get("basepart", "part", "modbase");
    extra.modLevel1 = get("level1", "l1", "lvl1");
    extra.modLevel2 = get("level2", "l2", "lvl2", "modlvl2");
    extra.modLevel3 = get("level3", "l3", "lvl3", "modlvl3");
    extra.modLevel4 = get("level4", "l4", "lvl4", "modlvl4");
  }

  // --- VEHICLE / NAMED VEHICLE EXTRAS ---
  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConStr = get(
      "hpcon",
      "hp/con",
      "hp",
      "hitpoints",
      "vehiclehpcon",
      "vehiclehp/con"
    );
    let hpCon = { hp: undefined, con: undefined };

    if (hpConStr && hpConStr.includes("/")) {
      hpCon = parseHpCon(hpConStr);
    } else if (hpConStr) {
      hpCon = { hp: Number(hpConStr) || undefined, con: undefined };
    }

    extra.hp = hpCon.hp;
    extra.con = hpCon.con;

    const pitStr = get("pitcost", "pit", "pitpoints", "pitcost");
    extra.pitCost = pitStr ? Number(pitStr) : undefined;
  }

  // --- PRINTS ---
  const prints = [];
  if (
    hasAny("set", "setname", "setid") ||
    hasAny("cardnumber", "number", "no")
  ) {
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
 * Parse text in textarea
 ************************************************************/
function handleBulkParse() {
  if (
    !Dom.bulkInput ||
    !Dom.bulkDelimiterSelect ||
    !Dom.bulkHasHeaderCheckbox ||
    !Dom.bulkPreview ||
    !Dom.bulkStatus
  ) {
    console.warn("[Bulk] DOM elements missing; cannot parse.");
    return;
  }

  const raw = Dom.bulkInput.value || "";
  if (!raw.trim()) {
    Dom.bulkStatus.textContent = "No data to parse.";
    Dom.bulkPreview.textContent = "";
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
    return;
  }

  const headerLine = lines[0];
  const headerCells = splitLine(headerLine, delimiter);
  const dataLines = Dom.bulkHasHeaderCheckbox.checked ? lines.slice(1) : lines;

  const cards = dataLines.map(line => {
    const cells = splitLine(line, delimiter);
    return mapRowToCard(headerCells, cells);
  });

  const previewLines = cards.slice(0, 20).map(c => {
    return `${c.type || "Type ?"} | ${c.name || "(no name)"} | ${
      c.setName || "Set ?"
    } #${c.cardNumber || "###"}`;
  });

  Dom.bulkPreview.textContent =
    previewLines.join("\n") +
    (cards.length > 20 ? `\n...and ${cards.length - 20} more.` : "");
  Dom.bulkPreview.dataset.parsedCards = JSON.stringify(cards);
  Dom.bulkStatus.textContent = `Parsed ${cards.length} cards. Ready to import.`;
}

/************************************************************
 * Import parsed cards into AppState.cards
 ************************************************************/
function handleBulkImport() {
  if (!Dom.bulkPreview || !Dom.bulkStatus || !Dom.bulkInput) {
    console.warn("[Bulk] DOM elements missing; cannot import.");
    return;
  }

  const parsed = Dom.bulkPreview.dataset.parsedCards;
  if (!parsed) {
    Dom.bulkStatus.textContent = "Nothing parsed yet. Click 'Parse Text' first.";
    return;
  }

  let cards;
  try {
    cards = JSON.parse(parsed);
  } catch (e) {
    console.error("Failed to parse parsedCards JSON:", e);
    Dom.bulkStatus.textContent = "Internal error: could not read parsed cards.";
    return;
  }

  let added = 0;
  let updated = 0;
  cards.forEach(card => {
    const idx = AppState.cards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      AppState.cards[idx] = card;
      updated++;
    } else {
      AppState.cards.push(card);
      added++;
    }
  });

  Dom.bulkStatus.textContent = `Imported ${cards.length} cards (${added} added, ${updated} updated).`;
  Dom.bulkPreview.textContent = "";
  Dom.bulkPreview.dataset.parsedCards = "";
  Dom.bulkInput.value = "";

  // Re-render library and preview
  refreshSingleUi();
}

/************************************************************
 * File upload → textarea → parse
 ************************************************************/
async function handleBulkFileChange(e) {
  if (!Dom.bulkStatus || !Dom.bulkInput || !Dom.bulkDelimiterSelect) {
    console.warn("[Bulk] DOM elements missing; cannot handle file input.");
    return;
  }

  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();

  try {
    // CSV / TSV / TXT: read as text and feed into existing parser
    if (
      name.endsWith(".csv") ||
      name.endsWith(".tsv") ||
      name.endsWith(".txt")
    ) {
      const text = await file.text();
      Dom.bulkInput.value = text;
      Dom.bulkStatus.textContent = `Loaded file: ${file.name}. Parsing…`;
      Dom.bulkDelimiterSelect.value = "auto";
      handleBulkParse();
      return;
    }

    // XLSX / XLS: use SheetJS via CDN
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      Dom.bulkStatus.textContent = `Reading Excel file: ${file.name}…`;
      const arrayBuf = await file.arrayBuffer();
      const XLSX = await loadXlsxLib();
      const wb = XLSX.read(arrayBuf, { type: "array" });

      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      // header:1 => array-of-arrays (first row is header)
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (!rows.length) {
        Dom.bulkStatus.textContent = `Excel sheet "${sheetName}" is empty.`;
        return;
      }

      // Convert to TAB-delimited text so the existing parser can handle it.
      const lines = rows.map(row =>
        (row || [])
          .map(cell => {
            if (cell == null) return "";
            const str = String(cell);
            // Strip tabs/newlines to keep a clean TSV-like text
            return str.replace(/\t/g, " ").replace(/\r?\n/g, " ");
          })
          .join("\t")
      );

      const text = lines.join("\n");
      Dom.bulkInput.value = text;
      Dom.bulkDelimiterSelect.value = "tab";
      Dom.bulkStatus.textContent = `Loaded "${sheetName}" from ${file.name}. Parsing…`;
      handleBulkParse();
      return;
    }

    Dom.bulkStatus.textContent =
      "Unsupported file type. Please upload a CSV, TSV, TXT, or XLSX file.";
  } catch (err) {
    console.error("[Bulk] Error reading file:", err);
    Dom.bulkStatus.textContent = "Error reading file. See console for details.";
  }
}

/************************************************************
 * Init
 ************************************************************/
export function initBulk() {
  if (Dom.bulkParseBtn) {
    Dom.bulkParseBtn.addEventListener("click", handleBulkParse);
  }
  if (Dom.bulkImportBtn) {
    Dom.bulkImportBtn.addEventListener("click", handleBulkImport);
  }
  if (Dom.bulkFileInput) {
    Dom.bulkFileInput.addEventListener("change", handleBulkFileChange);
  }
}
