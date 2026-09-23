// FUX-30 — Multi-channel adversarial isolation contract.
// Deterministic, side-effect-free gate. It does not execute business actions.
export const MULTI_CHANNEL_ADVERSARIAL_CASES = Object.freeze([
  'CROSS_TENANT_STORE_ACCESS',
  'CROSS_CHANNEL_CONFIGURATION_MUTATION',
  'BOT_TO_WRONG_STORE_BINDING',
  'UNPUBLISHED_CHANNEL_TRANSACTION',
  'STALE_INVENTORY_CONFIRMATION',
  'DUPLICATE_CHECKOUT',
  'DISABLED_CHANNEL_ACCESS',
  'AUTHORIZATION_BYPASS',
  'CANONICAL_AUTHORITY_BYPASS',
  'CREDENTIAL_EXPOSURE',
  'CHANNEL_FAILURE_CORE_INTEGRITY',
  'RETURN_RESTOCK_AUTHORITY_BYPASS',
]);

export const MULTI_CHANNEL_NON_AUTHORITIES = Object.freeze([
  'orders', 'inventory', 'payments', 'payment_ledger', 'fulfillment',
  'logistics', 'identity', 'customers', 'events', 'analytics', 'synchronization',
]);

export function evaluateMultiChannelAdversarialGate(input = {}) {
  const results = MULTI_CHANNEL_ADVERSARIAL_CASES.map(id => ({
    id,
    pass: input[id] === true,
  }));
  const forbiddenAuthorities = Array.isArray(input.declaredAuthorities)
    ? input.declaredAuthorities.map(String).map(x => x.toLowerCase())
        .filter(x => MULTI_CHANNEL_NON_AUTHORITIES.includes(x))
    : [];
  results.push({ id: 'NO_DUPLICATE_CHANNEL_AUTHORITY', pass: forbiddenAuthorities.length === 0 });
  return {
    status: results.every(x => x.pass) ? 'PASS' : 'FAIL',
    results,
    failedCases: results.filter(x => !x.pass).map(x => x.id),
    forbiddenAuthorities: [...new Set(forbiddenAuthorities)],
    ownsTransactionEngine: false,
    ownsSynchronizationEngine: false,
    failClosed: true,
  };
}
