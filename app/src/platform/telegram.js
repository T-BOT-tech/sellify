// platform/telegram.js
// Phase 9 extraction (see modularization plan §5): the REAL platform
// adapter — the only one with an actual runtime behind it today. Every raw
// `window.Telegram.WebApp` check that used to be scattered across main.js
// (TWA lifecycle bootstrap, initDataUnsafe.user, initDataUnsafe.start_param),
// theme/branding.js (ingestTelegramParams's caller), orders/checkout.js
// (checkoutTelegramWebApp's sendData call), and orders/cart.js (MainButton
// show/hide/label/onClick) now lives here instead, reshaped to the
// platform-adapter interface (see modularization plan §5, Phase 9) so those
// files ask `getActivePlatform()` instead of reaching for `window.Telegram`
// themselves. Nothing below changes what happens when running inside
// Telegram — it's the same code that used to run inline, just organized
// behind `id: 'telegram'`.
//
// Scoping note: theme/branding.js's Theme.apply() still reads
// `window.Telegram.WebApp.colorScheme` directly (for 'auto' mode
// resolution) and syncBrowserChrome() still calls
// `window.Telegram.WebApp.setBackgroundColor()` — those are synchronous,
// repeatedly-polled internal queries the Theme controller makes of whatever
// runtime is present, not a one-time push from the platform layer, and the
// Phase 9 interface doesn't define a query method for them. Moving them
// would mean inventing new adapter methods beyond what this phase's
// interface specifies, so they were left as-is; see the Phase 9 README
// entry for the same note.
import { Theme } from '../theme/branding.js';

// Local module state — the extracted Telegram buyer profile, if any. Not
// exported directly (getCustomerProfile() is the public read), following
// the same "own it, expose it through a function" shape as the rest of the
// interface below.
let twaUser = null;
let twaCustomerName = '';

function twa() {
  return window.Telegram && window.Telegram.WebApp;
}

export const telegram = {
  id: 'telegram',

  // Capability flag main.js's boot sequence asks for instead of matching
  // `id === 'telegram'` — see modularization plan §5, Phase 9 addendum.
  // 'silent': this platform can authenticate on load with no user action
  // (bootstrapTenantAuth() exchanges getInitData() for a session/wizard
  // state via POST /auth/telegram). Telegram is the only adapter with a
  // real silent-auth backend endpoint today; see the note on
  // bootstrapTenantAuth in auth/tenant.js for what a second 'silent'
  // adapter would still need to add.
  authMode: 'silent',

  isActive() {
    return !!twa();
  },

  // Moved from main.js's TWA lifecycle block, verbatim (see modularization
  // plan §5, Phase 9) — same outer try/catch, same inner ready()/expand()
  // try/catch, same buyer-profile extraction and custName auto-fill.
  init() {
    try {
      const app = twa();
      if (!app) return;
      try {
        app.ready();
        app.expand();
      } catch (e) {}

      this.ingestTheme();

      const user = app.initDataUnsafe && app.initDataUnsafe.user;
      if (user) {
        twaUser = user;
        twaCustomerName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '';
        // Legacy globals — orders/checkout.js and marketplace/checkout.js
        // now read the buyer profile through getCustomerProfile() instead,
        // but these are kept in case anything outside src/ still expects
        // them (see modularization plan §5, Phase 9).
        window.TWA_USER = twaUser;
        window.TWA_CUSTOMER_NAME = twaCustomerName;
        const custInput = document.getElementById('custName');
        if (custInput && !custInput.value) {
          custInput.value = twaCustomerName;
        }
      }
    } catch (e) {
      console.warn('TWA initialization notice:', e);
    }
  },

  getCustomerProfile() {
    const app = twa();
    const user = twaUser || (app && app.initDataUnsafe && app.initDataUnsafe.user);
    if (!user) return null;
    return {
      name: twaCustomerName || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
      phone: null, // Telegram's initDataUnsafe.user never includes a phone number
      id: user.id != null ? user.id : null
    };
  },

  // Moved from main.js's URL-param block, verbatim (see modularization
  // plan §5, Phase 9).
  getInitData() {
    const app = twa();
    return (app && app.initData) || '';
  },

  getStartParam() {
    const app = twa();
    return (app && app.initDataUnsafe && app.initDataUnsafe.start_param) || '';
  },

  // Moved from orders/checkout.js's checkoutTelegramWebApp() and
  // marketplace/checkout.js's submitMarketplaceOrder() (see modularization
  // plan §5, Phase 9) — same sendData call, same try/catch, same fallback
  // signal (null → caller falls through to its local-queue save).
  submitOrder(payload) {
    const app = twa();
    if (app && typeof app.sendData === 'function') {
      try {
        app.sendData(JSON.stringify(payload));
        return { ok: true };
      } catch (e) {
        console.warn('Telegram.WebApp.sendData failed, saving to local queue:', e);
        return null;
      }
    }
    return null;
  },

  // Moved from main.js's TWA lifecycle block (see modularization plan §5,
  // Phase 9) — theme/branding.js's Theme controller no longer calls
  // ingestTelegramParams itself or listens for themeChanged; this pushes
  // both into it instead.
  ingestTheme() {
    const app = twa();
    if (!app) return;
    if (app.themeParams) Theme.ingestTelegramParams(app.themeParams);
    try {
      app.onEvent('themeChanged', () => {
        Theme.ingestTelegramParams(app.themeParams || null);
      });
    } catch (e) {}
  },

  // Moved from orders/cart.js's updateOrderSummary() (see modularization
  // plan §5, Phase 9) — same setText/show/onClick calls, same try/catch.
  showPrimaryAction({ label, onClick }) {
    const app = twa();
    if (!(app && app.MainButton)) return;
    try {
      app.MainButton.setText(label);
      app.MainButton.show();
      app.MainButton.onClick(onClick);
    } catch (e) {}
  },

  hidePrimaryAction() {
    const app = twa();
    if (app && app.MainButton) {
      try { app.MainButton.hide(); } catch (e) {}
    }
  }
};
