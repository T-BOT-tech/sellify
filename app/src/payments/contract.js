// Canonical frontend payment contract. UI state is a projection of Payment Core.
export const PAYMENT_STATES = Object.freeze(['UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','DUPLICATE','MISMATCH','EXPIRED','PARTIAL','REFUNDED','FAILED','CANCELLED','REVERSED']);
export const PAYMENT_ERROR_STATUSES = Object.freeze([400,401,403,404,409,422,500,502,503,504]);

export function normalizePaymentListQuery(input = {}) {
  return Object.freeze({ state: String(input.state || 'all'), orderId: String(input.orderId || input.order_id || ''), limit: Math.min(100, Math.max(1, Number(input.limit) || 100)) });
}
export function normalizePaymentMutation(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Payment request body must be an object');
  return { ...body };
}
export function normalizePaymentResponse(data) {
  if (!data || typeof data !== 'object') throw new TypeError('Invalid payment response');
  return data.payment && typeof data.payment === 'object' ? data.payment : data;
}
export function normalizePaymentError(status, data = {}) {
  const numericStatus = Number(status);
  return Object.freeze({ status: numericStatus, code: String(data?.error?.code || data?.code || ('HTTP_' + numericStatus)), message: String(data?.error?.message || data?.message || ('Payment request failed (' + numericStatus + ')')), retryable: [409,500,502,503,504].includes(numericStatus) });
}
export function buildPaymentPath(chatId, suffix = '') {
  const tenant = encodeURIComponent(String(chatId || '').trim());
  if (!tenant) throw new TypeError('Tenant chatId is required');
  return '/tenants/' + tenant + '/payments' + suffix;
}
export function buildPaymentIdempotencyKey(scope, identifier) {
  const left = String(scope || '').trim(), right = String(identifier || '').trim();
  if (!left || !right) throw new TypeError('Idempotency scope and identifier are required');
  return 'payment:' + left + ':' + right;
}
