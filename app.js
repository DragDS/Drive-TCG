// app.js
// Thin orchestrator: loads state, sets up nav, modal, exports, and initializes modules.

import { AppState, loadCards, loadPrecons } from "./state.js";
import { initSingle, refreshLibraryList } from "./single.js";
import { initBulk } from "./bulk.js";
import { initPrecons } from "./precons.js";
import { initHelp } from "./help.js";

function initNav() {
  const navSingleBtn = document.getElementById("navSingleBtn");
  const navBulkBtn = document.getElementById("navBulkBtn");
  const navPreconsBtn = document.getElementById("navPreconsBtn");
  const navHelpBtn = document.getElementById("navHelpBtn");

  if (navSingleBtn) {
    navSingleBtn.addEventListener("click", () => showSection("single"));
  }
  if (navBulkBtn) {
    navBulkBtn.addEventListener("click", () => showSection("bulk"));
  }
  if (navPreconsBtn) {
    navPreconsBtn.addEventListener("click", () => showSection("precons"));
  }
  if (navHelpBtn) {
    navHelpBtn.addEventListener("click", () => showSection("help"));
  }
}

function showSection(section) {
  const sections = {
    single: document.getElementById("singleSection"),
    bulk: document.getElementById("bulkSection"),
    precons: document.getElementById("preconsSection"),
    help: document.getElementById("helpSection")
  };

  Object.entries(sections).forEach(([key, el]) => {
    if (!el) return;
    el.classList.toggle("active", key === section);
  });

  const tabMap = {
    single: document.getElementById("navSingleBtn"),
    bulk: document.getElementById("navBulkBtn"),
    precons: document.getElementById("navPreconsBtn"),
    help: document.getElementById("navHelpBtn")
  };

  Object.entries(tabMap).forEach(([key, btn]) => {
    if (!btn) return;
    btn.classList.toggle("active", key === section);
  });
}

function initModal() {
  const backdrop = document.getElementById("modalBackdrop");
  const titleEl = document.getElementById("modalTitle");
  const bodyEl = document.getElementById("modalBody");
  const cancelBtn = document.getElementById("modalCancelBtn");
  const confirmBtn = document.getElementById("modalConfirmBtn");

  let currentOnConfirm = null;

  function close() {
    if (!backdrop) return;
    backdrop.classList.remove("active");
    currentOnConfirm = null;
  }

  function open({ title, body, confirmLabel, onConfirm }) {
    if (!backdrop) {
      // fallback to native confirm if modal DOM is missing
      if (window.confirm(body || "Are you sure?")) {
        onConfirm && onConfirm();
      }
      return;
    }

    if (titleEl) titleEl.textContent = title || "Confirm";
    if (bodyEl) bodyEl.textContent = body || "Are you sure?";
    if (confirmBtn && confirmLabel) confirmBtn.textContent = confirmLabel;

    currentOnConfirm = typeof onConfirm === "function" ? onConfirm : null;
    backdrop.classList.add("active");
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => close());
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      const fn = currentOnConfirm;
      close();
      if (fn) fn();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        close();
      }
    });
  }

  // Expose a tiny global so feature modules can use the modal without circular imports.
  window.DriveAdminModal = {
    confirm: open
  };
}

function initExportButtons() {
  const cardsBtns = [
    document.getElementById("downloadCardsJsonBtn"),
    document.getElementById("downloadCardsJsonBtn_single")
  ];
  const preconsBtn = document.getElementById("downloadPreconsJsonBtn");

  cardsBtns.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => downloadJson(AppState.cards || [], "drive-card.json"));
  });

  if (preconsBtn) {
    preconsBtn.addEventListener("click", () =>
      downloadJson(AppState.precons || [], "drive-precons.json")
    );
  }
}

function downloadJson(data, filename) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to export JSON:", err);
  }
}

(async function init() {
  // Load base JSON / localStorage
  try {
    await loadCards();
  } catch (err) {
    console.error("Error loading cards:", err);
  }

  try {
    await loadPrecons();
  } catch (err) {
    console.error("Error loading precons:", err);
  }

  initNav();
  initModal();
  initExportButtons();

  initSingle();
  initBulk();
  initPrecons();
  initHelp();

  // Now that cards are loaded and single editor is wired, render the library.
  refreshLibraryList();

  showSection("single");
})();
