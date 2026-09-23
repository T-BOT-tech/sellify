// platform/web.js
// Phase 9 extraction (see modularization plan §5): the fallback adapter —
// isActive() is always true, so registry.js picks this whenever nothing
// more specific matched. submitOrder() returning null is today's implicit
// non-Telegram default: the caller falls through to the existing
// local-queue save (orders/checkout.js's saveOrder()), unchanged from
// before Phase 9 — this file just gives that default a name.
export const web = {
  id: 'web',

  // Fallback adapter — no identity mechanism of its own, so it's always
  // 'interactive': main.js's boot sequence falls to showPairing() rather
  // than attempting a silent bootstrap. See platform/telegram.js's
  // authMode note for what this flag means.
  authMode: 'interactive',

  isActive() { return true; },
  init() {},
  getCustomerProfile() { return null; },
  getInitData() { return ''; },
  getStartParam() { return ''; },
  submitOrder() { return null; },
  showPrimaryAction() {},
  hidePrimaryAction() {}
};
