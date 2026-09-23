// TG-6 — Telegram checkout/payment boundary.
// Telegram is an experience channel. Commerce creates the canonical order;
// Payment Core remains authoritative for payment records and state.

export const TELEGRAM_PAYMENT_STATES = Object.freeze([
  'NOT_REQUESTED',
  'PENDING_SELLER_HANDLING',
  'RECORDED_BY_PAYMENT_CORE',
]);

export const TELEGRAM_CHECKOUT_CONSTITUTION = Object.freeze({
  orderAuthority: 'existing_commerce_marketplace',
  paymentAuthority: 'existing_payment_core',
  telegramPaymentLedger: false,
  telegramPaymentExecution: false,
  checkoutMutatesInventoryDirectly: false,
  paymentConfirmationByTelegramClient: false,
  idempotencyAuthority: 'existing_checkout_idempotency',
  orderStatusAuthority: 'existing_marketplace_tracking',
});

export function normalizeTelegramCheckoutContext(input = {}) {
  const enabled = new Set(Array.isArray(input.enabledCapabilities) ? input.enabledCapabilities.map(String) : []);
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {};
  const payment = metadata.payment && typeof metadata.payment === 'object' && !Array.isArray(metadata.payment) ? metadata.payment : {};
  const mode = ['seller_managed', 'payment_core'].includes(String(payment.mode || '').toLowerCase())
    ? String(payment.mode).toLowerCase()
    : 'seller_managed';
  return {
    checkoutEnabled: enabled.has('checkout'),
    orderStatusEnabled: enabled.has('order_status'),
    payment: {
      mode,
      executionInTelegram: false,
      authority: 'existing_payment_core',
      stateAfterOrder: 'PENDING_SELLER_HANDLING',
    },
  };
}

export function buildTelegramPaymentBoundary({ order = null } = {}) {
  return {
    state: 'PENDING_SELLER_HANDLING',
    authority: 'existing_payment_core',
    telegramExecutesPayment: false,
    orderId: order?.marketplace_order_id || null,
  };
}
