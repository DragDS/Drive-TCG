// bulk.js
// Bulk import from master XLSX: auto-parse, filter by Type/Set, select + import.
// IMPORTANT: Does NOT statically import single.js, so Bulk works even if Single is broken.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";

/************************************************************
 * Bulk session state
 ************************************************************/
let parsedCards = [];
let selectedCardIds = new Set();

/************************************************************
 * Small utilities (local)
 ************************************************************/
function setStatus(msg) {
  if (Dom.bulkStatus) Dom.bulkStatus.textContent = msg;
  else console.warn("[bulk] bulkStatus missing:", msg);
}

function safeStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

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
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
  }
  return "";
}

function generateId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "card_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseListLike(str) {
  const s = safeStr(str);
  if (!s) return [];
  return s.split(/[,;/|]+|&/g).map(x => x.trim()).filter(Boolean);
}

function parseVehicleTypes(str) {
  return parseListLike(str);
}

function parseTags(str) {
  return parseListLike(str);
}

function parseHpCon(str) {
  const s = safeStr(str);
  const m = s.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return { hp: undefined, con: undefined };
  return { hp: Number(m[1]), con: Number(m[2]) };
}

function normalizeCardShape(card) {
  return {
    id: safeStr(card.id) || generateId(),
    name: safeStr(card.name),
    type: safeStr(card.type) || "Misc",
    setName: safeStr(card.setName),
    cardNumber: safeStr(card.cardNumber),
    rarity: safeStr(card.rarity),
    vehicleTypes: Array.isArray(card.vehicleTypes) ? card.vehicleTypes : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    imageUrl: safeStr(card.imageUrl),
    notes: safeStr(card.notes),
    extra: card.extra && typeof card.extra === "object" ? card.extra : {},
    prints: Array.isArray(card.prints) ? card.prints : []
  };
}

/************************************************************
 * Display helpers
 ************************************************************/
function setTokens(setStr) {
  const raw = safeStr(setStr);
  if (!raw) return [];

  const parts = raw.split(/&|,|;|\+|\//).map(s => s.trim()).filter(Boolean);
  return Array.from(
    new Set(
      parts.map(p =>
        p.replace(/^set\s*(\d+)$/i, (_, n) => `SET ${n}`).toUpperCase()
      )
    )
  );
}

function cardDisplayLine(c) {
  return `${c.type || "(?)"} | ${c.name || "(no name)"} | ${c.setName || "SET ?"} ${c.cardNumber || "####"}`;
}

/************************************************************
 * XLSX parsing
 ************************************************************/
function inferTypeFromSheetName(sheetName) {
  const s = safeStr(sheetName).toLowerCase();
  if (s.includes("named vehicle")) return "Named Vehicle";
  if (s.includes("vehicle")) return "Vehicle";
  if (s.includes("mod")) return "Mod";
  if (s.includes("driver")) return "Driver";
  if (s.includes("crew")) return "Crew";
  if (s.includes("track")) return "Track";
  if (s.includes("condition")) return "Condition";
  if (s.includes("sponsor")) return "Crew";
  return "Misc";
}

function rowArrayFromSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) return { headers: [], data: [] };
  return { headers: rows[0].map(safeStr), data: rows.slice(1) };
}

function headerMap(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    const k = normHeader(h);
    if (k && !(k in map)) map[k] = idx;
  });
  return map;
}

function mapRowToCard(sheetType, headers, row) {
  const map = headerMap(headers);

  const type = pick(row, map, "type") || sheetType;

  const name = pick(
    row, map,
    "name", "cardname", "card name", "title",
    "crew name", "mod name", "driver name",
    "track name", "condition name",
    "vehicle name", "named vehicle name"
  );

  const notes = pick(
    row, map,
    "notes", "rules", "rule", "text", "effect", "ability", "trait",
    "crew trait",
    "driver trait",
    "condition trait",
    "track trait",
    "vehicle trait",
    "named vehicle trait",
    "mod ability"
  );

  const rarity = pick(row, map, "rarity", "rar");
  const setName = pick(row, map, "set", "setname", "setid", "printset") || "";
  const cardNumber = pick(row, map, "cardnumber", "number", "no", "#", "cardno") || "";

  const vehicleTypes = parseVehicleTypes(pick(row, map, "vehicletype", "vehicletype1", "vehicletype2"));
  const tags = parseTags(pick(row, map, "tags", "keywords"));
  const imageUrl = pick(row, map, "image", "imageurl", "img");

  const extra = {};

  if (type === "Mod") {
    extra.modBasePart = pick(row, map, "basepart", "base part", "part");
    extra.modLevel1 = pick(row, map, "level1", "l1");
    extra.modLevel2 = pick(row, map, "level2", "l2");
    extra.modLevel3 = pick(row, map, "level3", "l3");
    extra.modLevel4 = pick(row, map, "level4", "l4");
  }

  if (type === "Vehicle" || type === "Named Vehicle") {
    const hpConStr = pick(row, map, "hpcon", "hp/con", "hp");
    const hpCon = hpConStr.includes("/") ? parseHpCon(hpConStr) : {};
    extra.hp = hpCon.hp;
    extra.con = hpCon.con;
    extra.pitCost = Number(pick(row, map, "pitcost", "pit cost")) || undefined;
  }

  const prints = [];
  if (setName || cardNumber) {
    prints.push({ setName, cardNumber, isPrimary: true });
  }

  return normalizeCardShape({
    id: pick(row, map, "id", "cardid") || generateId(),
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
  });
}

function parseWorkbookToCards(workbook) {
  const out = [];
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return;
    const { headers, data } = rowArrayFromSheet(sheet);
    if (!headers.length) return;

    const sheetType = inferTypeFromSheetName(name);
    data.forEach(row => {
      if (row.some(c => safeStr(c))) {
        const card = mapRowToCard(sheetType, headers, row);
        if (card.name || card.type) out.push(card);
      }
    });
  });
  return out;
}

/************************************************************
 * Filtering / UI
 ************************************************************/
function getViewedCards() {
  const type = Dom.bulkTypeFilter?.value || "All Types";
  const set = Dom.bulkSetFilter?.value || "All Sets";
  const q = safeStr(Dom.bulkFilterInput?.value).toLowerCase();

  return parsedCards.filter(c =>
    (type === "All Types" || c.type === type) &&
    (set === "All Sets" || setTokens(c.setName).includes(set)) &&
    (!q || `${c.name} ${c.type} ${c.setName} ${c.cardNumber}`.toLowerCase().includes(q))
  );
}

function renderSelectionList() {
  const list = Dom.bulkSelectionList;
  if (!list) return;
  list.innerHTML = "";

  getViewedCards().forEach(card => {
    const li = document.createElement("li");
    li.className = "checkrow";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedCardIds.has(card.id);
    cb.onchange = () => {
      cb.checked ? selectedCardIds.add(card.id) : selectedCardIds.delete(card.id);
      renderSelectedPreview();
    };

    const label = document.createElement("div");
    label.className = "mono";
    label.textContent = cardDisplayLine(card);

    li.append(cb, label);
    list.appendChild(li);
  });
}

function renderSelectedPreview() {
  if (!Dom.bulkSelectedPreview) return;
  const selected = parsedCards.filter(c => selectedCardIds.has(c.id));
  Dom.bulkSelectedPreview.textContent = selected.length
    ? selected.map(c => `• ${cardDisplayLine(c)}`).join("\n")
    : "No cards selected for import.";
}

/************************************************************
 * Import actions
 ************************************************************/
function handleLoadAndParseXlsx() {
  const file = Dom.bulkFileInput?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const workbook = XLSX.read(e.target.result, { type: "array" });
    parsedCards = parseWorkbookToCards(workbook);
    selectedCardIds = new Set(parsedCards.map(c => c.id));
    renderSelectionList();
    renderSelectedPreview();
    setStatus(`Parsed ${parsedCards.length} cards.`);
  };
  reader.readAsArrayBuffer(file);
}

async function importSelectedIntoLibrary() {
  parsedCards.filter(c => selectedCardIds.has(c.id)).forEach(card => {
    const i = AppState.cards.findIndex(x => x.id === card.id);
    if (i >= 0) AppState.cards[i] = card;
    else AppState.cards.push(card);
  });
  setStatus("Import complete.");
}

/************************************************************
 * Init
 ************************************************************/
export function initBulk() {
  Dom.bulkFileInput?.addEventListener("change", handleLoadAndParseXlsx);
  Dom.bulkLoadBtn?.addEventListener("click", handleLoadAndParseXlsx);
  Dom.bulkImportSelectedBtn?.addEventListener("click", importSelectedIntoLibrary);
  setStatus("Waiting for file…");
}
