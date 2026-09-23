// TG-4 — Telegram buyer storefront experience boundary.
// Presentation/distribution only: Commerce, Inventory, Payment, Fulfillment,
// Orders and Events remain owned by their existing authorities.

export const TELEGRAM_BUYER_CAPABILITIES = Object.freeze([
  'browse', 'search', 'product', 'cart', 'checkout', 'order_status',
  'tracking', 'proof_of_delivery', 'returns'
]);

export function isTelegramWebApp() {
  return !!(window.Telegram && window.Telegram.WebApp);
}

export function telegramWebApp() {
  return isTelegramWebApp() ? window.Telegram.WebApp : null;
}

export function getTelegramInitData() {
  return telegramWebApp()?.initData || '';
}

export function getTelegramBuyerProfile() {
  const app = telegramWebApp();
  const user = app?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    id: user.id != null ? String(user.id) : null,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
    username: user.username || null,
  };
}

export function applyTelegramBuyerChrome() {
  const app = telegramWebApp();
  if (!app) return;
  try { app.ready(); app.expand(); } catch {}
}

export function hasTelegramCapability(storefront, capability) {
  if (!storefront || storefront.channelType !== 'telegram') return false;
  return Array.isArray(storefront.enabledCapabilities) && storefront.enabledCapabilities.includes(capability);
}
