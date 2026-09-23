// platform/sms.js
// Phase 9 extraction (see modularization plan §5): stub adapter for a
// future SMS-based ordering flow. isActive() always returns false — nothing
// in the app should ever pick this adapter today, since there's no runtime
// behind it yet.
export const sms = {
  id: 'sms',

  // No real runtime behind this yet (isActive() is always false).
  // 'interactive' by default — an SMS-based flow has no page-load moment
  // to silently authenticate against, so this is likely to stay
  // 'interactive' even once implemented, unlike whatsapp/native. See
  // platform/telegram.js's authMode note.
  authMode: 'interactive',

  isActive() { return false; },
  init() {},
  getCustomerProfile() { return null; },
  getInitData() { return ''; },
  getStartParam() { return ''; },

  submitOrder(payload) {
    // TODO: once SMS ordering is wired up, this is where either an
    // `sms:<number>?body=<encoded order summary>` URI gets opened, or a
    // carrier/aggregator gateway (Twilio, Africa's Talking, etc.) gets
    // called with `payload`. Until then, returning null falls through to
    // the local-queue save, same as web.js's default.
    return null;
  },

  showPrimaryAction() {},
  hidePrimaryAction() {}
};
