// app.js
// Orchestrator: nav, modal, exports, and bootstrapping modules.

import { downloadJson, loadCards } from "./state.js";
import { Dom } from "./dom.js";
import { initSingle, refreshSingleUi, getCardsForExport } from "./single.js";
import { initBulk } from "./bulk.js";
import { initPrecons, loadPrecons } from "./precons.js";
import { initHelp } from "./help.js";

/************************************************************
 * Tiny safety helpers (prevents one crash from killing the app)
 ************************************************************/
function safeOn(el, evt, fn, label = "handler") {
  if (!el) {
    console.warn(`[admin] Missing DOM element for ${label}`);
    return;
  }
  el.addEventListener(evt, fn);
}

function safeInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[admin] ${name} failed to init:`, err);
  }
}

/************************************************************
 * Navigation & Sections
 ************************************************************/
function showSection(which) {
  // Sections
  Dom.singleSection?.classList.remove("active");
  Dom.bulkSection?.classList.remove("active");
  Dom.preconsSection?.classList.remove("active");
  Dom.helpSection?.classList.remove("active");

  // Nav buttons
  Dom.navSingleBtn?.classList.remove("active");
  Dom.navBulkBtn?.classList.remove("active");
  Dom.navPreconsBtn?.classList.remove("active");
  Dom.navHelpBtn?.classList.remove("active");

  if (which === "single") {
    Dom.singleSection?.classList.add("active");
    Dom.navSingleBtn?.classList.add("active");
  } else if (which === "bulk") {
    Dom.bulkSection?.classList.add("active");
    Dom.navBulkBtn?.classList.add("active");
  } else if (which === "precons") {
    Dom.preconsSection?.classList.add("active");
    Dom.navPreconsBtn?.classList.add("active");
  } else if (which === "help") {
    Dom.helpSection?.classList.add("active");
    Dom.navHelpBtn?.classList.add("active");
  }
}

function initNav() {
  safeOn(Dom.navSingleBtn, "click", () => showSection("single"), "navSingleBtn");
  safeOn(Dom.navBulkBtn, "click", () => showSection("bulk"), "navBulkBtn");
  safeOn(Dom.navPreconsBtn, "click", () => showSection("precons"), "navPreconsBtn");
  safeOn(Dom.navHelpBtn, "click", () => showSection("help"), "navHelpBtn");
}

/************************************************************
 * Modal (shared)
 ************************************************************/
function initModal() {
  safeOn(
    Dom.modalBackdrop,
    "click",
    (e) => {
      if (e.target === Dom.modalBackdrop) {
        Dom.modalBackdrop.classList.remove("active");
      }
    },
    "modalBackdrop"
  );
}

/************************************************************
 * Global Download Buttons
 ************************************************************/
function initExportButtons() {
  safeOn(
    Dom.downloadCardsJsonBtn,
    "click",
    () => downloadJson(getCardsForExport(), "drive-card.json"),
    "downloadCardsJsonBtn"
  );

  safeOn(
    Dom.downloadCardsJsonBtn_single,
    "click",
    () => downloadJson(getCardsForExport(), "drive-card.json"),
    "downloadCardsJsonBtn_single"
  );

  // (Precon export button is in HTML; wire it here only if Dom has it.)
  safeOn(
    Dom.downloadPreconsJsonBtn,
    "click",
    () => {
      // precons.js/state.js likely handles this; if you already wire elsewhere, remove.
      console.warn("[admin] downloadPreconsJsonBtn clicked but no handler is defined here.");
    },
    "downloadPreconsJsonBtn"
  );
}

/************************************************************
 * Kick everything off
 ************************************************************/
(async function init() {
  // Always wire nav/modal/export first (so UI isn't “dead”)
  safeInit("initNav", initNav);
  safeInit("initModal", initModal);
  safeInit("initExportButtons", initExportButtons);

  // Load core data early so downstream modules can build filters, etc.
  try {
    await loadCards();
  } catch (err) {
    console.error("[admin] loadCards failed:", err);
  }

  // Now init feature modules — isolated so one failure won't kill the rest
  safeInit("initSingle", initSingle);
  safeInit("initBulk", initBulk);
  safeInit("initPrecons", initPrecons);
  safeInit("initHelp", initHelp);

  // Refresh UI (safe)
  try {
    refreshSingleUi();
  } catch (err) {
    console.error("[admin] refreshSingleUi failed:", err);
  }

  // Load precons (safe)
  try {
    await loadPrecons();
  } catch (err) {
    console.error("[admin] loadPrecons failed:", err);
  }

  // Default view
  showSection("single");
})();
