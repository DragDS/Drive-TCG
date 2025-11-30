// precons.js
// Preconstructed deck loading, rendering, editing, and export.

import {
  STORAGE_KEYS,
  loadFromLocalStorage,
  saveToLocalStorage,
  downloadJson,
  AppState
} from "./state.js";
import { Dom } from "./dom.js";

/************************************************************
 * Helpers
 ************************************************************/

function setPreconsStatus(msg) {
  if (Dom.preconsStatus) {
    Dom.preconsStatus.textContent = msg;
  }
}

/**
 * Add or update a card entry inside a precon.
 */
function addCardToPrecon(precon, cardId, count) {
  if (!Array.isArray(precon.cards)) precon.cards = [];

  const existing = precon.cards.find(e => e.cardId === cardId);
  if (existing) {
    existing.count = (existing.count || 0) + count;
  } else {
    precon.cards.push({ cardId, count });
  }
}

/************************************************************
 * UI actions: create precon / add card
 ************************************************************/

/**
 * Create a new preconstructed deck via prompt dialogs.
 */
function handleNewPrecon() {
  const idRaw = prompt(
    "New deck ID (used in JSON, no spaces). Example: set1_starter",
    ""
  );
  if (idRaw == null) return; // user cancelled

  const id = idRaw.trim();
  if (!id) {
    alert("Deck ID cannot be empty.");
    return;
  }

  if (AppState.precons.some(p => p.id === id)) {
    alert("A precon with that ID already exists.");
    return;
  }

  const nameRaw = prompt("Display name for this deck:", id);
  if (nameRaw == null) return;
  const name = nameRaw.trim() || id;

  const descRaw = prompt("Short description (optional):", "");
  if (descRaw == null) return;
  const description = descRaw.trim();

  const precon = {
    id,
    name,
    description,
    cards: []
  };

  AppState.precons.push(precon);
  saveToLocalStorage(STORAGE_KEYS.PRECONS, AppState.precons);

  setPreconsStatus(`Created precon "${precon.name}".`);
  renderPrecons();
}

/**
 * Prompt-based card adding to a specific precon.
 */
function handleAddCardToPrecon(precon) {
  if (!AppState.cards || !AppState.cards.length) {
    alert("No cards are loaded yet. Make sure drive-card.json has been loaded.");
    return;
  }

  const qRaw = prompt(
    `Add card to "${precon.name}". Enter card name or card id:`,
    ""
  );
  if (qRaw == null) return;
  const q = qRaw.trim().toLowerCase();
  if (!q) return;

  // Try exact ID match first
  let matches = AppState.cards.filter(c =>
    (c.id || "").toLowerCase() === q
  );
  if (!matches.length) {
    // Fallback: partial name match
    matches = AppState.cards.filter(c =>
      (c.name || "").toLowerCase().includes(q)
    );
  }

  if (!matches.length) {
    alert("No card found matching that query.");
    return;
  }

  let card;
  if (matches.length === 1) {
    card = matches[0];
  } else {
    // Try exact name match among the partials
    const exactName = matches.find(
      c => (c.name || "").toLowerCase() === q
    );
    if (exactName) {
      card = exactName;
    } else {
      const listStr = matches
        .slice(0, 12)
        .map(c => `${c.id} — ${c.name}`)
        .join("\n");
      const chosenId = prompt(
        `Multiple cards found. Enter one of these ids:\n\n${listStr}`,
        matches[0].id
      );
      if (!chosenId) return;
      card = AppState.cards.find(c => c.id === chosenId.trim());
      if (!card) {
        alert("No card with that id was found.");
        return;
      }
    }
  }

  const countRaw = prompt(
    `How many copies of "${card.name}" to add?`,
    "1"
  );
  if (countRaw == null) return;
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) {
    alert("Count must be a positive number.");
    return;
  }

  addCardToPrecon(precon, card.id, count);
  saveToLocalStorage(STORAGE_KEYS.PRECONS, AppState.precons);

  setPreconsStatus(`Added ${count}x "${card.name}" to "${precon.name}".`);
  renderPrecons();
}

/************************************************************
 * Render precon summary cards
 ************************************************************/
function renderPrecons() {
  const grid = Dom.preconGrid;
  grid.innerHTML = "";

  if (!AppState.precons || !AppState.precons.length) {
    const msg = document.createElement("p");
    msg.textContent =
      "No preconstructed decks found. Click “New Precon” to create one, or check drive-precons.json.";
    grid.appendChild(msg);
    setPreconsStatus("No precons loaded yet.");
    return;
  }

  AppState.precons.forEach(precon => {
    const card = document.createElement("div");
    card.className = "precon-card";

    const h3 = document.createElement("h3");
    h3.textContent = precon.name;
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${precon.cards ? precon.cards.length : 0} entries`;
    h3.appendChild(pill);

    const desc = document.createElement("p");
    desc.style.margin = "0.15rem 0 0.4rem";
    desc.style.opacity = "0.85";
    desc.textContent = precon.description || "";

    const list = document.createElement("ul");
    if (!precon.cards || !precon.cards.length) {
      const li = document.createElement("li");
      li.textContent = "No cards yet – use Add Card to populate this deck.";
      list.appendChild(li);
    } else {
      precon.cards.forEach(entry => {
        const li = document.createElement("li");
        const cardObj = AppState.cards.find(c => c.id === entry.cardId);
        const name = cardObj ? cardObj.name : entry.cardId;
        li.textContent = `${entry.count || 0}x ${name}`;
        list.appendChild(li);
      });
    }

    // Controls row (ID + Add Card button)
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.justifyContent = "space-between";
    controls.style.alignItems = "center";
    controls.style.marginTop = "6px";

    const idSpan = document.createElement("span");
    idSpan.style.opacity = "0.7";
    idSpan.style.fontSize = "11px";
    idSpan.textContent = precon.id ? `ID: ${precon.id}` : "";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn ghost small";
    addBtn.textContent = "Add Card";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleAddCardToPrecon(precon);
    });

    controls.appendChild(idSpan);
    controls.appendChild(addBtn);

    card.appendChild(h3);
    card.appendChild(desc);
    card.appendChild(list);
    card.appendChild(controls);

    grid.appendChild(card);
  });

  setPreconsStatus(`${AppState.precons.length} precon deck(s) loaded.`);
}

/************************************************************
 * Load precons from JSON / localStorage
 ************************************************************/
export async function loadPrecons() {
  const localBackup = loadFromLocalStorage(STORAGE_KEYS.PRECONS, null);

  try {
    const res = await fetch("drive-precons.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch drive-precons.json");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("drive-precons.json is not an array.");
    AppState.precons = data;
    saveToLocalStorage(STORAGE_KEYS.PRECONS, AppState.precons);
    renderPrecons();
    return;
  } catch (e) {
    console.warn("Could not fetch drive-precons.json, falling back to localStorage:", e);
  }

  if (localBackup && Array.isArray(localBackup)) {
    AppState.precons = localBackup;
  } else {
    AppState.precons = [];
  }
  renderPrecons();
}

/************************************************************
 * Init: wire up the download + new precon button
 ************************************************************/
export function initPrecons() {
  // Export button (existing behavior)
  Dom.downloadPreconsJsonBtn.addEventListener("click", () => {
    downloadJson(AppState.precons, "drive-precons.json");
  });

  // Inject a "New Precon" button once, under the status line.
  if (Dom.preconsStatus && !Dom.preconsStatus.dataset.newPreconWired) {
    const btnRow = document.createElement("div");
    btnRow.style.marginTop = "6px";

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "btn ghost small";
    newBtn.textContent = "New Precon";
    newBtn.addEventListener("click", handleNewPrecon);

    btnRow.appendChild(newBtn);
    Dom.preconsStatus.parentElement.appendChild(btnRow);

    Dom.preconsStatus.dataset.newPreconWired = "1";
  }
}
