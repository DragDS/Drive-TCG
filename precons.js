// precons.js
// Preconstructed deck loading, rendering, and export.

import {
  STORAGE_KEYS,
  loadFromLocalStorage,
  saveToLocalStorage,
  downloadJson,
  AppState
} from "./state.js";
import { Dom } from "./dom.js";

/************************************************************
 * Render precon summary cards
 ************************************************************/
function renderPrecons() {
  const grid = Dom.preconGrid;
  grid.innerHTML = "";

  if (!AppState.precons || !AppState.precons.length) {
    const msg = document.createElement("p");
    msg.textContent = "No preconstructed decks found. Check drive-precons.json or local backup.";
    grid.appendChild(msg);
    return;
  }

  AppState.precons.forEach(precon => {
    const card = document.createElement("div");
    card.className = "precon-card";

    const h3 = document.createElement("h3");
    h3.textContent = precon.name;
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${precon.cards ? precon.cards.length : 0} cards`;
    h3.appendChild(pill);

    const desc = document.createElement("p");
    desc.style.margin = "0.15rem 0 0.4rem";
    desc.style.opacity = "0.85";
    desc.textContent = precon.description || "";

    const list = document.createElement("ul");
    if (!precon.cards || !precon.cards.length) {
      const li = document.createElement("li");
      li.textContent = "No cards yet – edit this precon in JSON.";
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

    card.appendChild(h3);
    card.appendChild(desc);
    card.appendChild(list);

    grid.appendChild(card);
  });
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
 * Init: wire up the download button
 ************************************************************/
export function initPrecons() {
  Dom.downloadPreconsJsonBtn.addEventListener("click", () => {
    downloadJson(AppState.precons, "drive-precons.json");
  });
}
