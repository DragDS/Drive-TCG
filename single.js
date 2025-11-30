// single.js
// Single-card editor: inputs, preview, prints, and card library.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";

/************************************************************
 * Utilities / shared helpers
 ************************************************************/

export function generateId() {
  return "card_" + Math.random().toString(36).slice(2, 10);
}

export function parseVehicleTypes(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseTags(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseHpCon(str) {
  if (!str) return {};
  const parts = str.split("/");
  const hp = parts[0] !== undefined && parts[0] !== "" ? Number(parts[0]) : undefined;
  const con = parts[1] !== undefined && parts[1] !== "" ? Number(parts[1]) : undefined;
  return { hp, con };
}

function formatHpCon(extra) {
  if (!extra) return "";
  const hp = extra.hp;
  const con = extra.con;
  if (hp === undefined && con === undefined) return "";
  return `${hp ?? "?"}/${con ?? "?"}`;
}

function formatExtraForSummary(card) {
  const e = card.extra || {};
  if (card.type === "Mod") {
    const levels = [e.modLevel1, e.modLevel2, e.modLevel3, e.modLevel4]
      .filter(Boolean)
      .join(" / ");
    return `Base: ${e.modBasePart || "?"}${levels ? " | Lvls: " + levels : ""}`;
  }
  if (card.type === "Vehicle" || card.type === "Named Vehicle") {
    const parts = [];
    if (e.hp !== undefined || e.con !== undefined) {
      parts.push(`HP/CON: ${e.hp || "?"}/${e.con || "?"}`);
    }
    if (e.pitCost !== undefined) {
      parts.push(`PIT: ${e.pitCost}`);
    }
    return parts.join(" | ");
  }
  return "";
}

/**
 * Normalize a raw card object from JSON or bulk import into the internal shape.
 * - Accepts old prints: [{ setId, cardNumber }]
 * - Accepts new prints: [{ setName, cardNumber }]
 * - If no prints array but setName/cardNumber fields exist, synthesizes one.
 * - Ensures card.setName/cardNumber are aligned with the first print.
 */
export function normalizeCardShape(raw) {
  const base = raw || {};

  // Vehicle types & tags
  const vehicleTypes = Array.isArray(base.vehicleTypes)
    ? base.vehicleTypes
    : (base.vehicleTypes ? [].concat(base.vehicleTypes) : []);

  const tags = Array.isArray(base.tags)
    ? base.tags
    : (base.tags ? [].concat(base.tags) : []);

  const extra = (base.extra && typeof base.extra === "object")
    ? { ...base.extra }
    : {};

  // Normalize prints
  const printsRaw = Array.isArray(base.prints) ? base.prints : [];

  let prints = printsRaw
    .map(p => ({
      setName: (p.setName || p.setId || "").trim(),
      cardNumber: (p.cardNumber || "").trim()
    }))
    .filter(p => p.setName || p.cardNumber);

  // Try to infer from root fields if needed
  let setName = (base.setName || base.setId || "").trim();
  let cardNumber = (base.cardNumber || base.cardNo || "").trim();

  if (!prints.length && (setName || cardNumber)) {
    prints = [{ setName, cardNumber }];
  }

  // If root fields are empty but we have prints, sync them from the first print
  if (!setName && prints[0]) setName = prints[0].setName || "";
  if (!cardNumber && prints[0]) cardNumber = prints[0].cardNumber || "";

  return {
    id: base.id || generateId(),
    name: base.name || "",
    type: base.type || "",
    setName,
    cardNumber,
    rarity: base.rarity || "",
    vehicleTypes,
    tags,
    im
