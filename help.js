// help.js
// Minimal Help tab module. Reserved for future interactive behaviour.

import { Dom } from "./dom.js";

/**
 * Initialize Help tab behaviour.
 * Right now the Help tab is mostly static text in admin.html.
 * This function is kept for future interactive features.
 */
export function initHelp() {
  // If we ever add interactive controls (e.g. an "auto-load" button),
  // wire them up here.

  // Example: if an auto-load button exists, show a small info message.
  if (Dom.autoLoadBtn) {
    Dom.autoLoadBtn.addEventListener("click", () => {
      alert(
        "Auto-load: When this admin opens, it tries to load drive-card.json " +
        "and drive-precons.json. If those are unavailable, it falls back to " +
        "localStorage backups if they exist."
      );
    });
  }

  // No other logic needed for now.
}
