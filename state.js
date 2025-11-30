// state.js
// Shared application state and storage helpers for DRIVE admin.

export const STORAGE_KEYS = {
  CARDS: "drive_admin_cards_json",
  PRECONS: "drive_admin_precons_json"
};

export function loadFromLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse localStorage for", key, e);
    return fallback;
  }
}

export function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value, null, 2));
  } catch (e) {
    console.warn("Failed to save localStorage for", key, e);
  }
}

// Global in-memory state for the admin tool.
export const AppState = {
  cards: [],
  selectedCardId: null,
  currentSinglePrints: [],
  precons: []
};

// Internal ID helper used by normalizeCardShape while loading from JSON.
function generateId() {
  return "card_" + Math.random().toString(36).slice(2, 10);
}

// Lightweight copy of normalizeCardShape used only when loading from drive-card.json.
// (The main admin logic also has its own version for working with cards in-memory.)
function normalizeCardShape(raw) {
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
        imageUrl: base.imageUrl || "",
        notes: base.notes || "",
        extra,
        prints
      };
    }

// Generic JSON download helper
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Load drive-card.json (with localStorage fallback) and normalize to the internal shape.
export async function loadCards() {
  const localBackup = loadFromLocalStorage(STORAGE_KEYS.CARDS, null);
  try {
    const res = await fetch("drive-card.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch drive-card.json");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("drive-card.json is not an array.");
    AppState.cards = data.map(normalizeCardShape);
    saveToLocalStorage(STORAGE_KEYS.CARDS, AppState.cards);
    return;
  } catch (e) {
    console.warn("Could not fetch drive-card.json, falling back to localStorage:", e);
  }

  if (localBackup && Array.isArray(localBackup)) {
    AppState.cards = localBackup.map(normalizeCardShape);
  } else {
    AppState.cards = [];
  }
}
