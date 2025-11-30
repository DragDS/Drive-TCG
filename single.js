// single.js
// Single-card editor, live preview, prints, and library list.

import { AppState } from "./state.js";
import { Dom } from "./dom.js";

let libraryFilterText = "";
let libraryCachedCards = [];

// Public: called from app.js after state has loaded.
export function initSingle() {
  setupFieldListeners();
  setupPrintsHandlers();
  setupActionButtons();
  setupLibrarySearch();
  refreshLibraryList(); // initial render
  updateSingleStatus("Ready.");
}

// Public: called by other modules (e.g. bulk.js) after cards mutate.
export function refreshLibraryList() {
  const cards = Array.isArray(AppState.cards) ? AppState.cards : [];
  libraryCachedCards = cards.slice(); // shallow copy

  const filtered = libraryFilterText.trim()
    ? filterCards(libraryCachedCards, libraryFilterText.trim())
    : libraryCachedCards;

  renderLibraryList(filtered);
}

// -----------------------
// Field & Form Handling
// -----------------------

function setupFieldListeners() {
  const inputs = [
    Dom.cardNameInput,
    Dom.cardTypeInput,
    Dom.cardSetNameInput,
    Dom.cardNumberInput,
    Dom.cardRarityInput,
    Dom.cardImageUrlInput,
    Dom.cardVehicleTypesInput,
    Dom.cardTagsInput,
    Dom.modBasePartInput,
    Dom.modL1Input,
    Dom.modL2Input,
    Dom.modL3Input,
    Dom.modL4Input,
    Dom.vehicleHpConInput,
    Dom.vehiclePitCostInput,
    Dom.cardNotesInput
  ].filter(Boolean);

  inputs.forEach((el) => {
    el.addEventListener("input", () => {
      syncTypeSpecificVisibility();
      renderPreviewFromForm();
    });
  });

  if (Dom.cardTypeInput) {
    Dom.cardTypeInput.addEventListener("change", () => {
      syncTypeSpecificVisibility();
      renderPreviewFromForm();
    });
  }

  syncTypeSpecificVisibility();
  renderPreviewFromForm();
}

function syncTypeSpecificVisibility() {
  const type = Dom.cardTypeInput ? Dom.cardTypeInput.value : "";

  const typeGroups = document.querySelectorAll("[data-for-types]");
  typeGroups.forEach((group) => {
    const allowedTypes = (group.getAttribute("data-for-types") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!type || allowedTypes.length === 0) {
      group.style.display = "";
      return;
    }

    if (allowedTypes.includes(type)) {
      group.style.display = "";
    } else {
      group.style.display = "none";
    }
  });
}

function getCardDataFromForm(includeId = true) {
  const name = Dom.cardNameInput?.value.trim() || "";
  const type = Dom.cardTypeInput?.value || "";
  const setName = Dom.cardSetNameInput?.value.trim() || "";
  const cardNumber = Dom.cardNumberInput?.value.trim() || "";
  const rarity = Dom.cardRarityInput?.value.trim() || "";
  const imageUrl = Dom.cardImageUrlInput?.value.trim() || "";
  const vehicleTypesStr = Dom.cardVehicleTypesInput?.value || "";
  const tagsStr = Dom.cardTagsInput?.value || "";
  const notes = Dom.cardNotesInput?.value || "";

  const vehicleTypes = splitCsvLike(vehicleTypesStr);
  const tags = splitCsvLike(tagsStr);

  const extra = {};

  // Mod extras
  const modBasePart = Dom.modBasePartInput?.value.trim();
  if (modBasePart) extra.modBasePart = modBasePart;

  const levels = [
    ["modLevel1", Dom.modL1Input],
    ["modLevel2", Dom.modL2Input],
    ["modLevel3", Dom.modL3Input],
    ["modLevel4", Dom.modL4Input]
  ];
  levels.forEach(([key, input]) => {
    const v = input?.value.trim();
    if (v) extra[key] = v;
  });

  // Vehicle extras
  const hpCon = Dom.vehicleHpConInput?.value.trim();
  const pitCost = Dom.vehiclePitCostInput?.value.trim();
  if (hpCon) extra.vehicleHpCon = hpCon;
  if (pitCost !== "" && pitCost != null) extra.vehiclePitCost = Number(pitCost);

  const base = {
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
    prints: Array.isArray(AppState.currentSinglePrints)
      ? AppState.currentSinglePrints.slice()
      : []
  };

  if (!includeId) return base;

  const existingId = Dom.cardIdInput?.value.trim();
  const id = existingId || inferCardId(name, type);

  return { id, ...base };
}

function applyCardToForm(card) {
  if (!card) return;

  AppState.selectedCard = card;
  AppState.currentSinglePrints = Array.isArray(card.prints) ? card.prints.slice() : [];

  if (Dom.cardIdInput) Dom.cardIdInput.value = card.id || "";
  if (Dom.cardNameInput) Dom.cardNameInput.value = card.name || "";
  if (Dom.cardTypeInput) Dom.cardTypeInput.value = card.type || "";
  if (Dom.cardSetNameInput) Dom.cardSetNameInput.value = card.setName || "";
  if (Dom.cardNumberInput) Dom.cardNumberInput.value = card.cardNumber || "";
  if (Dom.cardRarityInput) Dom.cardRarityInput.value = card.rarity || "";
  if (Dom.cardImageUrlInput) Dom.cardImageUrlInput.value = card.imageUrl || "";
  if (Dom.cardVehicleTypesInput) {
    Dom.cardVehicleTypesInput.value = (card.vehicleTypes || []).join(", ");
  }
  if (Dom.cardTagsInput) {
    Dom.cardTagsInput.value = (card.tags || []).join(", ");
  }
  if (Dom.cardNotesInput) Dom.cardNotesInput.value = card.notes || "";

  const extra = card.extra || {};
  if (Dom.modBasePartInput) Dom.modBasePartInput.value = extra.modBasePart || "";
  if (Dom.modL1Input) Dom.modL1Input.value = extra.modLevel1 || "";
  if (Dom.modL2Input) Dom.modL2Input.value = extra.modLevel2 || "";
  if (Dom.modL3Input) Dom.modL3Input.value = extra.modLevel3 || "";
  if (Dom.modL4Input) Dom.modL4Input.value = extra.modLevel4 || "";

  if (Dom.vehicleHpConInput) Dom.vehicleHpConInput.value = extra.vehicleHpCon || "";
  if (Dom.vehiclePitCostInput) {
    Dom.vehiclePitCostInput.value =
      extra.vehiclePitCost === undefined || extra.vehiclePitCost === null
        ? ""
        : String(extra.vehiclePitCost);
  }

  syncTypeSpecificVisibility();
  renderPrintsList();
  renderPreviewFromForm();
  updateSingleStatus(`Loaded card: ${card.name || card.id || "?"}`);
}

function clearForm() {
  AppState.selectedCard = null;
  AppState.currentSinglePrints = [];

  if (Dom.cardIdInput) Dom.cardIdInput.value = "";
  if (Dom.cardNameInput) Dom.cardNameInput.value = "";
  if (Dom.cardTypeInput) Dom.cardTypeInput.value = "Crew";
  if (Dom.cardSetNameInput) Dom.cardSetNameInput.value = "";
  if (Dom.cardNumberInput) Dom.cardNumberInput.value = "";
  if (Dom.cardRarityInput) Dom.cardRarityInput.value = "";
  if (Dom.cardImageUrlInput) Dom.cardImageUrlInput.value = "";
  if (Dom.cardVehicleTypesInput) Dom.cardVehicleTypesInput.value = "";
  if (Dom.cardTagsInput) Dom.cardTagsInput.value = "";
  if (Dom.cardNotesInput) Dom.cardNotesInput.value = "";

  if (Dom.modBasePartInput) Dom.modBasePartInput.value = "";
  if (Dom.modL1Input) Dom.modL1Input.value = "";
  if (Dom.modL2Input) Dom.modL2Input.value = "";
  if (Dom.modL3Input) Dom.modL3Input.value = "";
  if (Dom.modL4Input) Dom.modL4Input.value = "";
  if (Dom.vehicleHpConInput) Dom.vehicleHpConInput.value = "";
  if (Dom.vehiclePitCostInput) Dom.vehiclePitCostInput.value = "";

  renderPrintsList();
  renderPreviewFromForm();
  updateSingleStatus("New card form ready.");
}

// -----------------------
// Prints Handling
// -----------------------

function setupPrintsHandlers() {
  if (Dom.printCardNumberInput) {
    Dom.printCardNumberInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPrintFromInputs();
      }
    });
  }

  if (Dom.printSetPrimaryBtn) {
    Dom.printSetPrimaryBtn.addEventListener("click", () => {
      if (!Array.isArray(AppState.currentSinglePrints)) return;
      if (AppState.currentSinglePrints.length < 2) return;

      const last = AppState.currentSinglePrints.pop();
      AppState.currentSinglePrints.unshift(last);
      renderPrintsList();
      updateSingleStatus("Last print set as primary.");
    });
  }

  if (Dom.printClearAllBtn) {
    Dom.printClearAllBtn.addEventListener("click", () => {
      AppState.currentSinglePrints = [];
      renderPrintsList();
      updateSingleStatus("Cleared all prints for this card.");
    });
  }

  renderPrintsList();
}

function addPrintFromInputs() {
  const cardNumber = Dom.printCardNumberInput?.value.trim();
  if (!cardNumber) {
    updateSingleStatus("Enter a card number before adding a print.");
    return;
  }

  const setSelectVal = Dom.printSetSelect?.value || "";
  let setId = setSelectVal;

  if (setSelectVal === "CUSTOM") {
    const custom = Dom.printCustomSetInput?.value.trim();
    setId = custom || "Custom Set";
  } else if (!setSelectVal) {
    // fall back to card's setName if no explicit set chosen
    setId = Dom.cardSetNameInput?.value.trim() || "Unknown Set";
  }

  if (!Array.isArray(AppState.currentSinglePrints)) {
    AppState.currentSinglePrints = [];
  }

  AppState.currentSinglePrints.push({ setId, cardNumber });
  if (Dom.printCardNumberInput) Dom.printCardNumberInput.value = "";
  renderPrintsList();
  updateSingleStatus(`Added print: ${setId} #${cardNumber}`);
}

function renderPrintsList() {
  if (!Dom.printsList) return;

  const prints = Array.isArray(AppState.currentSinglePrints)
    ? AppState.currentSinglePrints
    : [];

  Dom.printsList.innerHTML = "";

  prints.forEach((p, index) => {
    const li = document.createElement("li");
    li.textContent = `${p.setId || "Unknown"} #${p.cardNumber || "?"}`;
    li.title = "Click to remove this print";
    li.addEventListener("click", () => {
      AppState.currentSinglePrints.splice(index, 1);
      renderPrintsList();
      updateSingleStatus("Removed a print.");
    });
    Dom.printsList.appendChild(li);
  });
}

// -----------------------
// Action Buttons
// -----------------------

function setupActionButtons() {
  if (Dom.singleSaveBtn) {
    Dom.singleSaveBtn.addEventListener("click", () => {
      const card = getCardDataFromForm(true);

      if (!card.name) {
        updateSingleStatus("Card name is required.");
        return;
      }
      if (!card.type) {
        updateSingleStatus("Card type is required.");
        return;
      }

      const cards = Array.isArray(AppState.cards) ? AppState.cards : [];

      const existingIndex = cards.findIndex((c) => c.id === card.id);
      if (existingIndex >= 0) {
        cards[existingIndex] = card;
        updateSingleStatus(`Updated existing card: ${card.name}`);
      } else {
        cards.push(card);
        updateSingleStatus(`Saved new card: ${card.name}`);
      }

      AppState.cards = cards;
      AppState.selectedCard = card;

      if (Dom.cardIdInput) Dom.cardIdInput.value = card.id || "";
      refreshLibraryList();
      renderPreviewFromForm();
    });
  }

  if (Dom.singleNewBtn) {
    Dom.singleNewBtn.addEventListener("click", () => {
      clearForm();
    });
  }

  if (Dom.singleDeleteBtn) {
    Dom.singleDeleteBtn.addEventListener("click", () => {
      if (!AppState.selectedCard || !AppState.selectedCard.id) {
        updateSingleStatus("No card selected to delete.");
        return;
      }

      const target = AppState.selectedCard;
      const doDelete = () => {
        const cards = Array.isArray(AppState.cards) ? AppState.cards : [];
        AppState.cards = cards.filter((c) => c.id !== target.id);
        AppState.selectedCard = null;
        AppState.currentSinglePrints = [];
        clearForm();
        refreshLibraryList();
        updateSingleStatus(`Deleted card: ${target.name || target.id}`);
      };

      // Use custom modal if available, otherwise fallback to window.confirm.
      if (window.DriveAdminModal && typeof window.DriveAdminModal.confirm === "function") {
        window.DriveAdminModal.confirm({
          title: "Delete Card",
          body: `Are you sure you want to delete "${target.name || target.id}"?`,
          confirmLabel: "Delete",
          onConfirm: doDelete
        });
      } else {
        if (window.confirm(`Delete "${target.name || target.id}"?`)) {
          doDelete();
        }
      }
    });
  }
}

// -----------------------
// Preview
// -----------------------

function renderPreviewFromForm() {
  const card = getCardDataFromForm(false);
  renderPreviewCard(card);
}

function renderPreviewCard(card) {
  if (!Dom.singlePreview) return;
  if (!card) {
    Dom.singlePreview.innerHTML = "";
    return;
  }

  const vehicleTypesLine = (card.vehicleTypes || []).join(", ");
  const tagsLine = (card.tags || []).join(", ");
  const typeBadge = card.type ? `<span class="type-badge">${escapeHtml(card.type)}</span>` : "";

  const prints = Array.isArray(card.prints) ? card.prints : [];
  const printsHtml =
    prints.length > 0
      ? `<div style="font-size:10px;color:var(--text-soft);margin-top:6px;">
           Prints:
           ${prints
             .map(
               (p) =>
                 `<span style="margin-left:4px;font-family:var(--font-mono);">${escapeHtml(
                   p.setId || "?"
                 )} #${escapeHtml(p.cardNumber || "?")}</span>`
             )
             .join("")}
        </div>`
      : "";

  Dom.singlePreview.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
      <div>
        <div style="font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">
          ${escapeHtml(card.name || "Unnamed Card")}
        </div>
        <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">
          ${escapeHtml(card.setName || "")}
          ${card.cardNumber ? ` · #${escapeHtml(card.cardNumber)}` : ""}
        </div>
      </div>
      <div>${typeBadge}</div>
    </div>

    <div style="margin-top:8px;font-size:11px;color:var(--text-soft);">
      ${vehicleTypesLine ? `<div>Vehicle Types: ${escapeHtml(vehicleTypesLine)}</div>` : ""}
      ${tagsLine ? `<div>Tags: ${escapeHtml(tagsLine)}</div>` : ""}
      ${card.rarity ? `<div>Rarity: ${escapeHtml(card.rarity)}</div>` : ""}
    </div>

    <div style="margin-top:8px;font-size:11px;font-family:var(--font-mono);white-space:pre-wrap;">
      ${escapeHtml(card.notes || "")}
    </div>

    ${printsHtml}
  `;
}

// -----------------------
// Library List
// -----------------------

function setupLibrarySearch() {
  const input = Dom.cardLibrarySearchInput;
  if (!input) return;

  input.addEventListener("input", () => {
    libraryFilterText = input.value || "";
    refreshLibraryList();
  });
}

function filterCards(cards, text) {
  const needle = text.toLowerCase();
  return cards.filter((c) => {
    const haystack = [
      c.name || "",
      c.type || "",
      c.setName || "",
      c.cardNumber || "",
      (c.tags || []).join(","),
      (c.vehicleTypes || []).join(",")
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

function renderLibraryList(cards) {
  if (!Dom.cardLibraryList) return;

  Dom.cardLibraryList.innerHTML = "";

  const countEl = Dom.libraryCount;
  if (countEl) {
    countEl.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
  }

  const sorted = cards.slice().sort((a, b) => {
    const setA = (a.setName || "").localeCompare(b.setName || "");
    if (setA !== 0) return setA;
    const nA = (a.cardNumber || "").localeCompare(b.cardNumber || "", undefined, {
      numeric: true,
      sensitivity: "base"
    });
    if (nA !== 0) return nA;
    return (a.name || "").localeCompare(b.name || "");
  });

  sorted.forEach((card) => {
    const li = document.createElement("li");
    li.className = "library-item";

    const header = document.createElement("div");
    header.className = "header";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = card.name || "(Unnamed)";

    const chips = document.createElement("div");
    chips.className = "chips";

    if (card.type) {
      const chipType = document.createElement("span");
      chipType.className = "type-badge";
      chipType.textContent = card.type;
      chips.appendChild(chipType);
    }

    if (card.setName || card.cardNumber) {
      const chipSet = document.createElement("span");
      chipSet.className = "label-pill info";
      chipSet.textContent = `${card.setName || "?"}${
        card.cardNumber ? ` · #${card.cardNumber}` : ""
      }`;
      chips.appendChild(chipSet);
    }

    header.appendChild(title);
    header.appendChild(chips);

    const sub = document.createElement("div");
    sub.className = "sub";

    if (card.vehicleTypes && card.vehicleTypes.length) {
      const spanVT = document.createElement("span");
      spanVT.textContent = `VT: ${card.vehicleTypes.join(", ")}`;
      sub.appendChild(spanVT);
    }

    if (card.tags && card.tags.length) {
      const spanTags = document.createElement("span");
      spanTags.textContent = `Tags: ${card.tags.join(", ")}`;
      sub.appendChild(spanTags);
    }

    li.appendChild(header);
    li.appendChild(sub);

    li.addEventListener("click", () => {
      applyCardToForm(card);
    });

    Dom.cardLibraryList.appendChild(li);
  });
}

// -----------------------
// Utilities
// -----------------------

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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function updateSingleStatus(msg) {
  if (Dom.singleStatus) {
    Dom.singleStatus.textContent = msg;
  }
}
