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
 * Module-level state for bulk flow
 ************************************************************/
let parsedCards = [];
let selectedCardIds = new Set();

/************************************************************
 * Delimiter helpers
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

/************************************************************
 * Row → card mapping
 ************************************************************/
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

/************************************************************
 * Rendering for Step 2 & 3
 ************************************************************/
function getFilteredParsedCards() {
  const filter = (Dom.bulkFilterInput?.value || "").toLowerCase();
  if (!filter) return parsedCards;

  return parsedCards.filter(c => {
    const name = (c.name || "").toLowerCase();
    const type = (c.type || "").toLowerCase();
    const setName = (c.setName || "").toLowerCase();
    const num = (c.cardNumber || "").toLowerCase();
    const tags = (Array.isArray(c.tags) ? c.tags.join(" ") : "").toLowerCase();
    return (
      name.includes(filter) ||
      type.includes(filter) ||
      setName.includes(filter) ||
      num.includes(filter) ||
      tags.includes(filter)
    );
  });
}

function renderBulkSelectionList() {
  const container = Dom.bulkSelectionList;
  if (!container) return;

  container.innerHTML = "";

  if (!parsedCards.length) {
    container.textContent = "No parsed cards yet. Paste text and click “Parse Text”.";
    return;
  }

  const filtered = getFilteredParsedCards();
  if (!filtered.length) {
    container.textContent = "No cards match the current filter.";
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach(card => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "6px";
    row.style.padding = "2px 0";

    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";
    label.style.flex = "1";

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

    const summary = document.createElement("span");
    summary.textContent =
      `${card.type || "Type ?"} | ` +
      `${card.name || "(no name)"} | ` +
      `${card.setName || "Set ?"} #${card.cardNumber || "###"}`;

    label.appendChild(checkbox);
    label.appendChild(summary);

    row.appendChild(label);
    frag.appendChild(row);
  });

  container.appendChild(frag);
}

function renderBulkSelectedPreview() {
  const box = Dom.bulkSelectedPreview;
  if (!box) return;

  box.innerHTML = "";

  if (!parsedCards.length) {
    box.textContent = "Nothing parsed yet.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!selected.length) {
    box.textContent = "No cards selected.";
    return;
  }

  const lines = selected.slice(0, 20).map(c => {
    return `${c.type || "Type ?"} | ${c.name || "(no name)"} | ${c.setName || "Set ?"} #${c.cardNumber || "###"}`;
  });

  const text =
    lines.join("\n") +
    (selected.length > 20 ? `\n...and ${selected.length - 20} more.` : "");

  const pre = document.createElement("pre");
  pre.style.margin = "0";
  pre.textContent = text;

  box.appendChild(pre);
}

/************************************************************
 * Step 1: Parse
 ************************************************************/
function handleBulkParse() {
  const raw = Dom.bulkInput.value || "";
  if (!raw.trim()) {
    Dom.bulkStatus.textContent = "No data to parse.";
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
    parsedCards = [];
    selectedCardIds.clear();
    renderBulkSelectionList();
    renderBulkSelectedPreview();
    return;
  }

  const headerLine = lines[0];
  const headerCells = splitLine(headerLine, delimiter);
  const dataLines = Dom.bulkHasHeaderCheckbox.checked ? lines.slice(1) : lines;

  const cards = dataLines.map(line => {
    const cells = splitLine(line, delimiter);
    return mapRowToCard(headerCells, cells);
  });

  parsedCards = cards;
  selectedCardIds = new Set(cards.map(c => c.id)); // default: all selected

  renderBulkSelectionList();
  renderBulkSelectedPreview();

  Dom.bulkStatus.textContent =
    `Parsed ${cards.length} cards. All selected by default – refine in Step 2.`;
}

/************************************************************
 * Import: Step 3
 ************************************************************/
function handleBulkImport() {
  if (!parsedCards.length) {
    Dom.bulkStatus.textContent = "Nothing parsed yet. Click “Parse Text” first.";
    return;
  }

  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));
  if (!selected.length) {
    Dom.bulkStatus.textContent = "No cards selected to import.";
    return;
  }

  let added = 0;
  let updated = 0;

  selected.forEach(card => {
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
    `Imported ${selected.length} cards (${added} added, ${updated} updated).`;

  // Clear local bulk state
  parsedCards = [];
  selectedCardIds.clear();
  Dom.bulkInput.value = "";
  if (Dom.bulkSelectionList) Dom.bulkSelectionList.innerHTML = "";
  if (Dom.bulkSelectedPreview) Dom.bulkSelectedPreview.innerHTML = "";
  if (Dom.bulkFilterInput) Dom.bulkFilterInput.value = "";

  // Re-render library and preview
  refreshSingleUi();
}

/************************************************************
 * Init wiring
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

  // Initial empty render for cleanliness
  renderBulkSelectionList();
  renderBulkSelectedPreview();
}
