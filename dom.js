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

  // Single card form
  cardIdInput: document.getElementById("cardIdInput"),
  cardNameInput: document.getElementById("cardNameInput"),
  cardTypeInput: document.getElementById("cardTypeInput"),
  cardSetNameInput: document.getElementById("cardSetNameInput"),
  cardNumberInput: document.getElementById("cardNumberInput"),
  cardRarityInput: document.getElementById("cardRarityInput"),
  cardVehicleTypesInput: document.getElementById("cardVehicleTypesInput"),
  cardTagsInput: document.getElementById("cardTagsInput"),
  cardImageUrlInput: document.getElementById("cardImageUrlInput"),

  modBasePartInput: document.getElementById("modBasePartInput"),
  modL1Input: document.getElementById("modL1Input"),
  modL2Input: document.getElementById("modL2Input"),
  modL3Input: document.getElementById("modL3Input"),
  modL4Input: document.getElementById("modL4Input"),

  vehicleHpConInput: document.getElementById("vehicleHpConInput"),
  vehiclePitCostInput: document.getElementById("vehiclePitCostInput"),

  cardNotesInput: document.getElementById("cardNotesInput"),

  printSetSelect: document.getElementById("printSetSelect"),
  printCustomSetInput: document.getElementById("printCustomSetInput"),
  printCardNumberInput: document.getElementById("printCardNumberInput"),
  printSetPrimaryBtn: document.getElementById("printSetPrimaryBtn"),
  printClearAllBtn: document.getElementById("printClearAllBtn"),
  printsList: document.getElementById("printsList"),

  singleSaveBtn: document.getElementById("singleSaveBtn"),
  singleNewBtn: document.getElementById("singleNewBtn"),
  singleDeleteBtn: document.getElementById("singleDeleteBtn"),
  singleStatus: document.getElementById("singleStatus"),

  singlePreview: document.getElementById("singlePreview"),
  cardLibrarySearchInput: document.getElementById("cardLibrarySearchInput"),
  cardLibraryList: document.getElementById("cardLibraryList"),
  libraryCount: document.getElementById("libraryCount"),

  // Bulk import (new workflow)
  bulkFileInput: document.getElementById("bulkFileInput"),
  bulkLoadBtn: document.getElementById("bulkLoadBtn"),
  bulkStatus: document.getElementById("bulkStatus"),

  bulkTypeFilter: document.getElementById("bulkTypeFilter"),
  bulkSetFilter: document.getElementById("bulkSetFilter"),
  bulkSelectAllViewedBtn: document.getElementById("bulkSelectAllViewedBtn"),
  bulkDeselectAllViewedBtn: document.getElementById("bulkDeselectAllViewedBtn"),
  bulkFilterInput: document.getElementById("bulkFilterInput"),
  bulkSelectionList: document.getElementById("bulkSelectionList"),

  bulkSelectedPreview: document.getElementById("bulkSelectedPreview"),
  bulkImportSelectedBtn: document.getElementById("bulkImportSelectedBtn"),
  bulkClearSessionBtn: document.getElementById("bulkClearSessionBtn"),

  // Legacy bulk elements kept hidden (so older code doesn’t explode)
  bulkInput: document.getElementById("bulkInput"),
  bulkDelimiterSelect: document.getElementById("bulkDelimiterSelect"),
  bulkHasHeaderCheckbox: document.getElementById("bulkHasHeaderCheckbox"),
  bulkParseBtn: document.getElementById("bulkParseBtn"),
  bulkImportBtn: document.getElementById("bulkImportBtn"),
  bulkPreview: document.getElementById("bulkPreview"),

  // Precons
  preconGrid: document.getElementById("preconGrid"),
  preconsStatus: document.getElementById("preconsStatus"),

  // Global export buttons
  downloadCardsJsonBtn: document.getElementById("downloadCardsJsonBtn"),
  downloadCardsJsonBtn_single: document.getElementById("downloadCardsJsonBtn_single"),
  downloadPreconsJsonBtn: document.getElementById("downloadPreconsJsonBtn"),

  // Modal (kept for single.js)
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn")
};
