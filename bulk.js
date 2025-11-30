// bulk.js
// Bulk parsing, CSV/TSV auto-detection, and importing parsed cards.

import { AppState } from "./state.js";
import { refreshLibraryList } from "./single.js";
import { Dom } from "./dom.js";

let parsedCards = [];

export function initBulk() {
  const parseBtn = document.getElementById("bulkParseBtn");
  const importBtn = document.getElementById("bulkImportBtn");

  if (parseBtn) parseBtn.addEventListener("click", handleParse);
  if (importBtn) importBtn.addEventListener("click", handleImport);

  setBulkStatus("Waiting for data…");
  renderBulkPreview();
}

function handleParse() {
  const text = Dom.bulkInput ? Dom.bulkInput.value : "";
  if (!text.trim()) {
    setBulkStatus("No text to parse.");
    parsedCards = [];
    renderBulkPreview();
    return;
  }

  const delimiter = getDelimiter();
  const hasHeader = document.getElementById("bulkHasHeaderCheckbox")?.checked ?? true;

  const rows = parseDelimited(text, delimiter);
  if (!rows.length) {
    setBulkStatus("No rows detected.");
    parsedCards = [];
    renderBulkPreview();
    return;
  }

  let header = [];
  let dataRows = rows;

  if (hasHeader) {
    header = rows[0];
    dataRows = rows.slice(1);
  }

  parsedCards = dataRows
    .map((cols) => rowToCard(cols, header))
    .filter((c) => c && c.name);

  setBulkStatus(`Parsed ${parsedCards.length} card row(s).`);
  renderBulkPreview();
}

function handleImport() {
  if (!parsedCards.length) {
    setBulkStatus("No parsed cards to import.");
    return;
  }

  const cards = Array.isArray(AppState.cards) ? AppState.cards : [];

  parsedCards.forEach((card) => {
    const existingIndex = cards.findIndex(
      (c) =>
        c.id === card.id ||
        (c.name && c.type && c.name === card.name && c.type === card.type)
    );
    if (existingIndex >= 0) {
      cards[existingIndex] = card;
    } else {
      cards.push(card);
    }
  });

  AppState.cards = cards;
  refreshLibraryList();

  setBulkStatus(`Imported ${parsedCards.length} card(s) into library.`);
}

// -----------------------
// Parsing helpers
// -----------------------

function getDelimiter() {
  const select = document.getElementById("bulkDelimiterSelect");
  const choice = select?.value || "auto";
  if (choice !== "auto") {
    switch (choice) {
      case "comma":
        return ",";
      case "tab":
        return "\t";
      case "semicolon":
        return ";";
      case "pipe":
        return "|";
      default:
        return ",";
    }
  }

  const text = Dom.bulkInput ? Dom.bulkInput.value : "";

  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestScore = -1;

  candidates.forEach((d) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    const counts = lines.map((l) => l.split(d).length);
    const uniqueCounts = new Set(counts);
    if (uniqueCounts.size === 1 && counts[0] > bestScore) {
      bestScore = counts[0];
      best = d;
    }
  });

  return best;
}

function parseDelimited(text, delimiter) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);

  const rows = lines.map((line) => {
    const cols = line.split(delimiter);
    return cols.map((c) => c.trim());
  });

  return rows;
}

function rowToCard(cols, header) {
  const map = {};

  if (header && header.length) {
    header.forEach((name, idx) => {
      const key = normalizeHeaderKey(name);
      map[key] = cols[idx] || "";
    });
  } else {
    // simple positional mapping if no header row
    const keys = [
      "name",
      "type",
      "set",
      "cardnumber",
      "rarity",
      "vehicletype",
      "tags",
      "imageurl",
      "notes"
    ];
    keys.forEach((key, idx) => {
      map[key] = cols[idx] || "";
    });
  }

  const name = (map.name || "").trim();
  if (!name) return null;

  const type = (map.type || "").trim() || "Crew";
  const setName = (map.set || map.setname || "").trim();
  const cardNumber = (map.cardnumber || map.number || "").trim();
  const rarity = (map.rarity || "").trim();
  const imageUrl = (map.imageurl || "").trim();
  const notes = (map.notes || "").trim();
  const vehicleTypesStr = map.vehicletype || map.vehicletypes || "";
  const tagsStr = map.tags || "";

  const vehicleTypes = splitCsvLike(vehicleTypesStr);
  const tags = splitCsvLike(tagsStr);

  const extra = {};

  if (map.modbasepart) extra.modBasePart = map.modbasepart;
  if (map.modlevel1) extra.modLevel1 = map.modlevel1;
  if (map.modlevel2) extra.modLevel2 = map.modlevel2;
  if (map.modlevel3) extra.modLevel3 = map.modlevel3;
  if (map.modlevel4) extra.modLevel4 = map.modlevel4;

  if (map.vehiclehpcon) extra.vehicleHpCon = map.vehiclehpcon;
  if (map.vehiclepitcost) {
    const n = Number(map.vehiclepitcost);
    if (!Number.isNaN(n)) extra.vehiclePitCost = n;
  }

  const id = map.id?.trim() || inferCardId(name, type);

  return {
    id,
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
    prints: [] // prints can be edited in Single tab
  };
}

function normalizeHeaderKey(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitCsvLike(str) {
  if (!str) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function inferCardId(name, type) {
  const base = (name || "").trim() || "card";
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const typeSlug = (type || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `card_${slug}${typeSlug ? "_" + typeSlug : ""}`;
}

// -----------------------
// Bulk preview & status
// -----------------------

function renderBulkPreview() {
  const preview = document.getElementById("bulkPreview");
  if (!preview) return;

  if (!parsedCards.length) {
    preview.textContent = "";
    return;
  }

  const lines = parsedCards.map((c, idx) => {
    const setPart = c.setName ? ` · ${c.setName}` : "";
    const numPart = c.cardNumber ? ` #${c.cardNumber}` : "";
    return `${idx + 1}. ${c.name} [${c.type}]${setPart}${numPart}`;
  });

  preview.textContent = lines.join("\n");
}

function setBulkStatus(msg) {
  const el = document.getElementById("bulkStatus");
  if (el) el.textContent = msg;
}
