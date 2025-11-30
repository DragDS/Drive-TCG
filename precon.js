// precons.js
// Read-only rendering of preconstructed decks.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";

export function initPrecons() {
  renderPrecons();
}

function renderPrecons() {
  const grid = Dom.preconGrid || document.getElementById("preconGrid");
  const status = document.getElementById("preconsStatus");

  if (!grid) return;

  const precons = Array.isArray(AppState.precons) ? AppState.precons : [];

  grid.innerHTML = "";

  if (!precons.length) {
    if (status) status.textContent = "No precons loaded.";
    return;
  }

  const cardsById = new Map(
    (Array.isArray(AppState.cards) ? AppState.cards : []).map((c) => [c.id, c])
  );

  precons.forEach((deck) => {
    const card = document.createElement("div");
    card.className = "precon-card";

    const h3 = document.createElement("h3");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = deck.name || "(Unnamed Deck)";

    const badge = document.createElement("span");
    badge.className = "label-pill info";
    badge.textContent = (deck.cards && deck.cards.length
      ? `${deck.cards.length} entries`
      : "Empty"
    );

    h3.appendChild(nameSpan);
    h3.appendChild(badge);

    card.appendChild(h3);

    if (deck.description) {
      const p = document.createElement("p");
      p.style.margin = "2px 0 4px";
      p.style.fontSize = "11px";
      p.style.color = "var(--text-soft)";
      p.textContent = deck.description;
      card.appendChild(p);
    }

    const ul = document.createElement("ul");

    (deck.cards || []).forEach((entry) => {
      const li = document.createElement("li");
      const count = entry.count ?? 1;
      const cardData = cardsById.get(entry.cardId);

      if (cardData) {
        const setLabel = cardData.setName || "?";
        const numLabel = cardData.cardNumber ? ` #${cardData.cardNumber}` : "";
        li.textContent = `${count}x ${cardData.name} [${cardData.type || "?"}] · ${setLabel}${numLabel}`;
      } else {
        li.textContent = `${count}x [Missing] ${entry.cardId}`;
      }

      ul.appendChild(li);
    });

    card.appendChild(ul);

    grid.appendChild(card);
  });

  if (status) {
    status.textContent = `Loaded ${precons.length} preconstructed deck(s).`;
  }
}
