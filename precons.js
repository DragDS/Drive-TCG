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

/**
 * Build <option> text for a card in the dropdown.
 */
function formatCardOptionLabel(card) {
  const setPart = (card.setName || "").trim();
  const numPart = (card.cardNumber || "").trim();
  const namePart = (card.name || "").trim() || "(no name)";
  const left =
    (setPart || numPart)
      ? `${setPart || "Set ?"} • ${numPart || "###"}`
      : "No Set/Number";
  return `${left} — ${namePart}`;
}

/************************************************************
 * UI actions: create precon
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

/************************************************************
 * Render precon summary cards
 ************************************************************/
function renderPrecons() {
  const grid = Dom.preconGrid;
  grid.innerHTML = "";

  const cardsSorted = [...(AppState.cards || [])];
  // Sort cards for dropdown: by setName, then cardNumber (numeric-ish), then name
  cardsSorted.sort((a, b) => {
    const setA = (a.setName || "").localeCompare(b.setName || "");
    if (setA !== 0) return setA;
    const numA = (a.cardNumber || "").localeCompare(
      b.cardNumber || "",
      undefined,
      { numeric: true }
    );
    if (numA !== 0) return numA;
    return (a.name || "").localeCompare(b.name || "");
  });

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
      li.textContent = "No cards yet – use the dropdown below to add cards.";
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

    // Controls row: ID + dropdown + count + Add button
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "4px";
    controls.style.alignItems = "center";
    controls.style.marginTop = "6px";

    const idSpan = document.createElement("span");
    idSpan.style.opacity = "0.7";
    idSpan.style.fontSize = "11px";
    idSpan.textContent = precon.id ? `ID: ${precon.id}` : "";

    // Dropdown of cards
    const select = document.createElement("select");
    select.style.flex = "1 1 160px";
    select.style.minWidth = "160px";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = cardsSorted.length
      ? "Select a card from the library…"
      : "No cards loaded (load drive-card.json)";
    select.appendChild(placeholder);

    cardsSorted.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = formatCardOptionLabel(c);
      select.appendChild(opt);
    });

    // Count input
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "1";
    countInput.value = "1";
    countInput.style.width = "48px";
    countInput.style.textAlign = "center";

    // Add button
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn ghost small";
    addBtn.textContent = "Add Card";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = select.value;
      if (!cardId) {
        alert("Please select a card from the dropdown first.");
        return;
      }
      const cardObj = AppState.cards.find(c => c.id === cardId);
      if (!cardObj) {
        alert("Selected card could not be found in the library.");
        return;
      }
      const count = Number(countInput.value) || 0;
      if (!Number.isFinite(count) || count <= 0) {
        alert("Count must be a positive number.");
        return;
      }

      addCardToPrecon(precon, cardId, count);
      saveToLocalStorage(STORAGE_KEYS.PRECONS, AppState.precons);

      setPreconsStatus(`Added ${count}x "${cardObj.name}" to "${precon.name}".`);
      renderPrecons(); // re-render to show updated list
    });

    controls.appendChild(idSpan);
    controls.appendChild(select);
    controls.appendChild(countInput);
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
 * Init: wire up the export + new precon button
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
