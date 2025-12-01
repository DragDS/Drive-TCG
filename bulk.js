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
 * Bulk Import
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
    const hpCon = hpConStr.includes("/")
      ? parseHpCon(hpConStr)
      : { hp: Number(hpConStr) || undefined };
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

function handleBulkParse() {
  if (!Dom.bulkInput || !Dom.bulkDelimiterSelect || !Dom.bulkHasHeaderCheckbox ||
      !Dom.bulkPreview || !Dom.bulkStatus) {
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
    return `${c.type || "Type ?"} | ${c.name || "(no name)"} | ${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  Dom.bulkPreview.textContent =
    previewLines.join("\n") +
    (cards.length > 20 ? `\n...and ${cards.length - 20} more.` : "");
  Dom.bulkPreview.dataset.parsedCards = JSON.stringify(cards);
  Dom.bulkStatus.textContent = `Parsed ${cards.length} cards. Ready to import.`;
}

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

export function initBulk() {
  if (Dom.bulkParseBtn) {
    Dom.bulkParseBtn.addEventListener("click", handleBulkParse);
  }
  if (Dom.bulkImportBtn) {
    Dom.bulkImportBtn.addEventListener("click", handleBulkImport);
  }
}
