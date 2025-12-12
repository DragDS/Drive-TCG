// dom.js
// Centralized DOM element lookups for DRIVE admin.

export const Dom = {
  // Nav
  navSingleBtn: document.getElementById("navSingleBtn"),
  navBulkBtn: document.getElementById("navBulkBtn"),
  navPreconsBtn: document.getElementById("navPreconsBtn"),
  navHelpBtn: document.getElementById("navHelpBtn"),

  // Sections
  singleSection: document.getElementById("singleSection"),
  bulkSection: document.getElementById("bulkSection"),
  preconsSection: document.getElementById("preconsSection"),
  helpSection: document.getElementById("helpSection"),

  // Bulk (patched)
  bulkMasterFileInput: document.getElementById("bulkMasterFileInput"),
  bulkStatus: document.getElementById("bulkStatus"),

  bulkTypeFilterSelect: document.getElementById("bulkTypeFilterSelect"),
  bulkSetFilterSelect: document.getElementById("bulkSetFilterSelect"),
  bulkSelectAllViewedBtn: document.getElementById("bulkSelectAllViewedBtn"),
  bulkDeselectAllViewedBtn: document.getElementById("bulkDeselectAllViewedBtn"),
  bulkCardsList: document.getElementById("bulkCardsList"),
  bulkSelectedPreview: document.getElementById("bulkSelectedPreview"),
  bulkImportBtn: document.getElementById("bulkImportBtn"),
  bulkClearBtn: document.getElementById("bulkClearBtn"),

  // Precons
  preconGrid: document.getElementById("preconGrid"),
  preconsStatus: document.getElementById("preconsStatus"),

  // Global export buttons
  downloadCardsJsonBtn: document.getElementById("downloadCardsJsonBtn"),
  downloadCardsJsonBtn_single: document.getElementById("downloadCardsJsonBtn_single"),
  downloadPreconsJsonBtn: document.getElementById("downloadPreconsJsonBtn"),

  // Modal
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn")
};
