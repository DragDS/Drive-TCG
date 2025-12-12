// app.js
// Orchestrator: nav, modal, exports, and bootstrapping modules.
// IMPORTANT: Uses dynamic imports so one broken module can't kill the whole admin.

import { downloadJson, loadCards } from "./state.js";
import { Dom } from "./dom.js";

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
  Dom.navSingleBtn?.addEventListener("click", () => showSection("single"));
  Dom.navBulkBtn?.addEventListener("click", () => showSection("bulk"));
  Dom.navPreconsBtn?.addEventListener("click", () => showSection("precons"));
  Dom.navHelpBtn?.addEventListener("click", () => showSection("help"));
}

/************************************************************
 * Modal (shared)
 ************************************************************/
function initModal() {
  Dom.modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === Dom.modalBackdrop) {
      Dom.modalBackdrop.classList.remove("active");
    }
  });
}

/************************************************************
 * Global Download Buttons
 ************************************************************/
function initExportButtons(getCardsForExport) {
  // Cards export (top + single)
  Dom.downloadCardsJsonBtn?.addEventListener("click", () => {
    downloadJson(getCardsForExport(), "drive-card.json");
  });
  Dom.downloadCardsJsonBtn_single?.addEventListener("click", () => {
    downloadJson(getCardsForExport(), "drive-card.json");
  });

  // Precon export is wired in precons.js; keep this noop-safe if button exists
  Dom.downloadPreconsJsonBtn?.addEventListener("click", () => {
    console.warn(
      "[admin] Precon export clicked. If nothing happens, wire it in precons.js/state.js."
    );
  });
}

/************************************************************
 * Safe dynamic import helper
 ************************************************************/
async function safeImport(path, label) {
  try {
    return await import(path);
  } catch (err) {
    console.error(`[admin] Failed to import ${label} (${path}):`, err);
    return null;
  }
}

/************************************************************
 * Kick everything off (DOM-safe)
 ************************************************************/
async function boot() {
  // Quick sanity check: if these are null, you're not loading the HTML you think you are
  console.log("[admin] DOM check:", {
    navSingleBtn: !!Dom.navSingleBtn,
    singleSection: !!Dom.singleSection,
    bulkFileInput: !!Dom.bulkFileInput,
    bulkStatus: !!Dom.bulkStatus
  });

  // UI wiring first
  initNav();
  initModal();

  // Load core data early
  try {
    await loadCards();
  } catch (err) {
    console.error("[admin] loadCards failed:", err);
  }

  // Import modules independently so one failure doesn't break the rest
  const singleMod = await safeImport("./single.js", "single");
  const bulkMod = await safeImport("./bulk.js", "bulk");
  const preconsMod = await safeImport("./precons.js", "precons");
  const helpMod = await safeImport("./help.js", "help");

  // Init modules (each guarded)
  try { singleMod?.initSingle?.(); } catch (e) { console.error("[admin] initSingle failed:", e); }
  try { bulkMod?.initBulk?.(); } catch (e) { console.error("[admin] initBulk failed:", e); }
  try { preconsMod?.initPrecons?.(); } catch (e) { console.error("[admin] initPrecons failed:", e); }
  try { helpMod?.initHelp?.(); } catch (e) { console.error("[admin] initHelp failed:", e); }

  // Exports need getCardsForExport — provide a safe fallback if single.js is broken
  const getCardsForExport =
    singleMod?.getCardsForExport ||
    (() => {
      console.warn(
        "[admin] getCardsForExport unavailable (single.js failed). Export may not work."
      );
      return [];
    });

  initExportButtons(getCardsForExport);

  // Refresh UI safely
  try { singleMod?.refreshSingleUi?.(); } catch (e) { console.error("[admin] refreshSingleUi failed:", e); }

  // Load precons safely
  try { await preconsMod?.loadPrecons?.(); } catch (e) { console.error("[admin] loadPrecons failed:", e); }

  // Default view
  showSection("single");
}

// Ensure DOM exists before anything touches Dom.* elements
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
