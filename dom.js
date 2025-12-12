// dom.js
// Lazy DOM getters – safe with dynamic sections & imports

function el(id) {
  return document.getElementById(id);
}

export const Dom = {
  // Nav
  get navSingleBtn() { return el("navSingleBtn"); }
  get navBulkBtn() { return el("navBulkBtn"); }
  get navPreconsBtn() { return el("navPreconsBtn"); }
  get navHelpBtn() { return el("navHelpBtn"); }

  // Sections
  get singleSection() { return el("singleSection"); }
  get bulkSection() { return el("bulkSection"); }
  get preconsSection() { return el("preconsSection"); }
  get helpSection() { return el("helpSection"); }

  // Bulk
  get bulkFileInput() { return el("bulkFileInput"); }
  get bulkLoadBtn() { return el("bulkLoadBtn"); }
  get bulkStatus() { return el("bulkStatus"); }

  get bulkTypeFilter() { return el("bulkTypeFilter"); }
  get bulkSetFilter() { return el("bulkSetFilter"); }
  get bulkFilterInput() { return el("bulkFilterInput"); }
  get bulkSelectionList() { return el("bulkSelectionList"); }
  get bulkSelectedPreview() { return el("bulkSelectedPreview"); }

  get bulkSelectAllViewedBtn() { return el("bulkSelectAllViewedBtn"); }
  get bulkDeselectAllViewedBtn() { return el("bulkDeselectAllViewedBtn"); }
  get bulkImportSelectedBtn() { return el("bulkImportSelectedBtn"); }
  get bulkClearSessionBtn() { return el("bulkClearSessionBtn"); }

  // Modal
  get modalBackdrop() { return el("modalBackdrop"); }
  get modalTitle() { return el("modalTitle"); }
  get modalBody() { return el("modalBody"); }
  get modalCancelBtn() { return el("modalCancelBtn"); }
  get modalConfirmBtn() { return el("modalConfirmBtn"); }

  // Exports
  get downloadCardsJsonBtn() { return el("downloadCardsJsonBtn"); }
  get downloadCardsJsonBtn_single() { return el("downloadCardsJsonBtn_single"); }
  get downloadPreconsJsonBtn() { return el("downloadPreconsJsonBtn"); }
};
