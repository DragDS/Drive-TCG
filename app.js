// app.js
// Orchestrator: nav, modal, exports, and bootstrapping modules.

import { downloadJson, loadCards } from "./state.js";
import { Dom } from "./dom.js";
import { initSingle, refreshSingleUi, getCardsForExport } from "./single.js";
import { initBulk } from "./bulk.js";
// IMPORTANT: namespace import so missing named exports can't break loading
import * as Precons from "./precons.js";
import { initHelp } from "./help.js";

/************************************************************
 * Navigation & Sections
 ************************************************************/
function showSection(which) {
  Dom.singleSection.classList.remove("active");
  Dom.bulkSection.classList.remove("active");
  Dom.preconsSection.classList.remove("active");
  Dom.helpSection.classList.remove("active");

  if (which === "single") Dom.singleSection.classList.add("active");
  else if (which === "bulk") Dom.bulkSection.classList.add("active");
  else if (which === "precons") Dom.preconsSection.classList.add("active");
  else if (which === "help") Dom.helpSection.classList.add("active");
}

function initNav() {
  Dom.navSingleBtn.addEventListener("click", () => showSection("single"));
  Dom.navBulkBtn.addEventListener("click", () => showSection("bulk"));
  Dom.navPreconsBtn.addEventListener("click", () => showSection("precons"));
  Dom.navHelpBtn.addEventListener("click", () => showSection("help"));
}

/************************************************************
 * Modal (shared)
 ************************************************************/
function initModal() {
  Dom.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === Dom.modalBackdrop) {
      Dom.modalBackdrop.classList.remove("active");
    }
  });
}

/************************************************************
 * Global Download Buttons
 ************************************************************/
function initExportButtons() {
  Dom.downloadCardsJsonBtn.addEventListener("click", () => {
    downloadJson(getCardsForExport(), "drive-card.json");
  });
  Dom.downloadCardsJsonBtn_single.addEventListener("click", () => {
    downloadJson(getCardsForExport(), "drive-card.json");
  });
}

/************************************************************
 * Kick everything off
 ************************************************************/
(async function init() {
  // UI wiring
  initNav();
  initSingle();
  initBulk();
  if (typeof Precons.initPrecons === "function") {
    Precons.initPrecons();
  }
  initHelp();
  initModal();
  initExportButtons();

  // Load core data
  await loadCards();
  refreshSingleUi();

  // Load precons if the module provides a loader
  if (typeof Precons.loadPrecons === "function") {
    await Precons.loadPrecons();
  }

  showSection("single");
})();
