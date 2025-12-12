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
  cardSetNameInput: document.getElementById("cardSetNameInput"), // hidden (derived)
  cardNumberInput: document.getElementById("cardNumberInput"),   // hidden (derived)
  cardRarityInput: document.getElementById("cardRarityInput"),
  cardVehicleTypesInput: document.getElementById("cardVehicleTypesInput"),
  cardTagsInput: document.getElementById("cardTagsInput"),
  cardImageUrlInput: document.getElementById("cardImageUrlInput"),
  cardNotesInput: document.getElementById("cardNotesInput"),

  modBasePartInput: document.getElementById("modBasePartInput"),
  modL1Input: document.getElementById("modL1Input"),
  modL2Input: document.getElementById("modL2Input"),
  modL3Input: document.getElementById("modL3Input"),
  modL4Input: document.getElementById("modL4Input"),

  vehicleHpConInput: document.getElementById("vehicleHpConInput"),
  vehiclePitCostInput: document.getElementById("vehiclePitCostInput"),

  // Prints
  printSetSelect: document.getElementById("printSetSelect"),
  printCustomSetInput: document.getElementById("printCustomSetInput"),
  printCardNumberInput: document.getElementById("printCardNumberInput"),
  printAddBtn: document.getElementById("printAddBtn"),
  printUpdateBtn: document.getElementById("printUpdateBtn"),
  printCancelEditBtn: document.getElementById("printCancelEditBtn"),
  printSetPrimaryBtn: document.getElementById("printSetPrimaryBtn"),
  printClearAllBtn: document.getElementById("printClearAllBtn"),
  printsList: document.getElementById("printsList"),

  // Single actions
  singleSaveBtn: document.getElementById("singleSaveBtn"),
  singleNewBtn: document.getElementById("singleNewBtn"),
  singleDeleteBtn: document.getElementById("singleDeleteBtn"),
  singleStatus: document.getElementById("singleStatus"),

  // Preview & Library
  singlePreview: document.getElementById("singlePreview"),
  cardLibrarySearchInput: document.getElementById("cardLibrarySearchInput"),
  cardLibraryList: document.getElementById("cardLibraryList"),
  libraryCount: document.getElementById("libraryCount"),

  // Export buttons
  downloadCardsJsonBtn: document.getElementById("downloadCardsJsonBtn"),
  downloadCardsJsonBtn_single: document.getElementById("downloadCardsJsonBtn_single"),
  downloadPreconsJsonBtn: document.getElementById("downloadPreconsJsonBtn"),

  // Precons
  preconGrid: document.getElementById("preconGrid"),
  preconsStatus: document.getElementById("preconsStatus"),

  // Modal
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn")
};
