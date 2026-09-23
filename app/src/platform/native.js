// platform/native.js
// Phase 9 extraction (see modularization plan §5): stub adapter for a
// future Capacitor-wrapped native shell. isActive() checks for the
// Capacitor bridge, but returns false until Capacitor is actually added to
// the project — `window.Capacitor` never exists today, so this never wins
// over web.js.
export const native = {
  id: 'native',

  // No real runtime behind this yet (window.Capacitor never exists today).
  // 'interactive' as the honest current default — revisit to 'silent' once
  // Capacitor is added if a stored device credential / biometric unlock
  // ends up backing a real silent-auth flow. See platform/telegram.js's
  // authMode note.
  authMode: 'interactive',

  isActive() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  },
  init() {},
  getCustomerProfile() { return null; },
  getInitData() { return ''; },
  getStartParam() { return ''; },

  submitOrder(payload) {
    // TODO: once Capacitor is added, this is where a native share sheet, a
    // push-notification hand-off, or a bundled native HTTP client call
    // would go with `payload`. Until then, returning null falls through to
    // the local-queue save, same as web.js's default.
    return null;
  },

  showPrimaryAction() {},
  hidePrimaryAction() {}
};
