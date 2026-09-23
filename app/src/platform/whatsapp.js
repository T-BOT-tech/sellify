// platform/whatsapp.js
// Phase 9 extraction (see modularization plan §5): stub adapter for a
// future WhatsApp integration. isActive() always returns false — nothing in
// the app should ever pick this adapter today, since there's no runtime
// behind it yet.
export const whatsapp = {
  id: 'whatsapp',

  // No real runtime behind this yet (isActive() is always false), so
  // 'interactive' is just the honest default until it's wired up — revisit
  // once the actual WhatsApp launch mechanism is chosen (a signed embed
  // param would make this 'silent'; phone-number verification would keep
  // it 'interactive'). See platform/telegram.js's authMode note.
  authMode: 'interactive',

  isActive() { return false; },
  init() {},
  getCustomerProfile() { return null; },
  getInitData() { return ''; },
  getStartParam() { return ''; },

  submitOrder(payload) {
    // TODO: once WhatsApp is wired up, this is where either a
    // `wa.me/<number>?text=<encoded order summary>` deep link gets opened,
    // or a WhatsApp Business Cloud API call gets made with `payload`. Until
    // then, returning null falls through to the local-queue save, same as
    // web.js's default.
    return null;
  },

  showPrimaryAction() {},
  hidePrimaryAction() {}
};
