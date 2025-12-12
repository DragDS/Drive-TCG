// dom.js
// Lazy DOM getters – safe with dynamic sections & imports

function el(id) {
  return document.getElementById(id);
}

export const Dom = {
  // Nav
  get navSingleBtn() { return el("navSingleBtn"); },
  get navBulkBtn() { return el("navBulkBtn"); },
  get navPreconsBtn() { return el("navPreconsBtn"); },
  get navHelpBtn() { return el("navHelpBtn"); },

  // Sections
  get singleSection() { return el("singleSection"); },
  get bulkSection() { return el("bulkSection"); },
  get preconsSection() { return el("preconsSection"); },
  get helpSection() { return el("helpSection"); },

  // Single card form
  get cardIdInput() { return el("cardIdInput"); },
  get cardNameInput() { return el("cardNameInput"); },
  get cardTypeInput() { return el("cardTypeInput"); },
  get cardSetNameInput() { return el("cardSetNameInput"); },
  get cardNumberInput() { return el("cardNumberInput"); },
  get cardRarityInput() { return el("cardRarityInput"); },
  get cardVehicleTypesInput() { return el("cardVehicleTypesInput"); },
  get cardTagsInput() { return el("cardTagsInput"); },
  get cardImageUrlInput() { return el("cardImageUrlInput"); },

  get modBasePartInput() { return el("modBasePartInput"); },
  get modL1Input() { return el("modL1Input"); },
  get modL2Input() { return el("modL2Input"); },
  get modL3Input() { return el("modL3Input"); },
  get modL4Input() { return el("modL4Input"); },

  get vehicleHpConInput() { return el("vehicleHpConInput"); },
  get vehiclePitCostInput() { return el("vehiclePitCostInput"); },

  get cardNotesInput() { return el("cardNotesInput"); },

  get printSetSelect() { return el("printSetSelect"); },
  get printCustomSetInput() { return el("printCustomSetInput"); },
  get printCardNumberInput() { return el("printCardNumberInput"); },
  get printSetPrimaryBtn() { return el("printSetPrimaryBtn"); },
  get printClearAllBtn() { return el("printClearAllBtn"); },
  get printsList() { return el("printsList"); },

  get singleSaveBtn() { return el("singleSaveBtn"); },
  get singleNewBtn() { return el("singleNewBtn"); },
  get singleDeleteBtn() { return el("singleDeleteBtn"); },
  get singleStatus() { return el("singleStatus"); },

  get singlePreview() { return el("singlePreview"); },
  get cardLibrarySearchInput() { return el("cardLibrarySearchInput"); },
  get cardLibraryList() { return el("cardLibraryList"); },
  get libraryCount() { return el("libraryCount"); },

  // Bulk import
  get bulkFileInput() { return el("bulkFileInput"); },
  get bulkLoadBtn() { return el("bulkLoadBtn"); },
  get bulkStatus() { return el("bulkStatus"); },

  get bulkTypeFilter() { return el("bulkTypeFilter"); },
  get bulkSetFilter() { return el("bulkSetFilter"); },
  get bulkSelectAllViewedBtn() { return el("bulkSelectAllViewedBtn"); },
  get bulkDeselectAllViewedBtn() { return el("bulkDeselectAllViewedBtn"); },
  get bulkFilterInput() { return el("bulkFilterInput"); },
  get bulkSelectionList() { return el("bulkSelectionList"); },

  get bulkSelectedPreview() { return el("bulkSelectedPreview"); },
  get bulkImportSelectedBtn() { return el("bulkImportSelectedBtn"); },
  get bulkClearSessionBtn() { return el("bulkClearSessionBtn"); },

  // Legacy bulk elements
  get bulkInput() { return el("bulkInput"); },
  get bulkDelimiterSelect() { return el("bulkDelimiterSelect"); },
  get bulkHasHeaderCheckbox() { return el("bulkHasHeaderCheckbox"); },
  get bulkParseBtn() { return el("bulkParseBtn"); },
  get bulkImportBtn() { return el("bulkImportBtn"); },
  get bulkPreview() { return el("bulkPreview"); },

  // Precons
  get preconGrid() { return el("preconGrid"); },
  get preconsStatus() { return el("preconsStatus"); },

  // Global export buttons
  get downloadCardsJsonBtn() { return el("downloadCardsJsonBtn"); },
  get downloadCardsJsonBtn_single() { return el("downloadCardsJsonBtn_single"); },
  get downloadPreconsJsonBtn() { return el("downloadPreconsJsonBtn"); },

  // Modal
  get modalBackdrop() { return el("modalBackdrop"); },
  get modalTitle() { return el("modalTitle"); },
  get modalBody() { return el("modalBody"); },
  get modalCancelBtn() { return el("modalCancelBtn"); },
  get modalConfirmBtn() { return el("modalConfirmBtn"); }
};
