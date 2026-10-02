import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { buildPaymentPath, buildPaymentIdempotencyKey, normalizePaymentError, normalizePaymentListQuery, normalizePaymentMutation, normalizePaymentResponse } from './contract.js';

function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
async function request(path, options = {}) {
  const headers = { ...authHeaders(), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(baseUrl() + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw normalizePaymentError(response.status, data);
  return data;
}
export async function listPaymentProviders() { return request(buildPaymentPath(config.chatId, '/providers')); }
export async function listPaymentAccounts(status = 'active') {
  const query = new URLSearchParams({ status: String(status || 'active') });
  return request(buildPaymentPath(config.chatId, '/accounts?' + query));
}
export async function listPayments(input = {}) {
  const query = normalizePaymentListQuery(input);
  const params = new URLSearchParams({ state: query.state, order_id: query.orderId, limit: String(query.limit) });
  const data = await request(buildPaymentPath(config.chatId, '?' + params));
  return Array.isArray(data.payments) ? data.payments : [];
}
export async function getPayment(paymentId) {
  const data = await request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId)));
  return normalizePaymentResponse(data);
}
export async function createPayment(body, { idempotencyKey } = {}) {
  const headers = idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey) } : {};
  const data = await request(buildPaymentPath(config.chatId), { method: 'POST', headers, body: JSON.stringify(normalizePaymentMutation(body)) });
  return normalizePaymentResponse(data);
}
export async function transitionPayment(paymentId, body, { idempotencyKey } = {}) {
  const headers = idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey) } : {};
  const data = await request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId)), { method: 'PATCH', headers, body: JSON.stringify(normalizePaymentMutation(body)) });
  return normalizePaymentResponse(data);
}
export async function getPaymentLedger(paymentId) {
  const data = await request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId) + '/ledger')); return data.ledger || [];
}
export async function queryPaymentStatus(paymentId, body = {}) {
  return request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId) + '/status'), { method: 'POST', body: JSON.stringify(normalizePaymentMutation(body)) });
}
export async function reconcilePayment(paymentId, body = {}) {
  return request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId) + '/reconciliation'), { method: 'POST', body: JSON.stringify(normalizePaymentMutation(body)) });
}
export async function getPaymentReconciliationHistory(paymentId) {
  const data = await request(buildPaymentPath(config.chatId, '/' + encodeURIComponent(paymentId) + '/reconciliation')); return data.reconciliations || [];
}
export function paymentCommandKey(command, identifier) { return buildPaymentIdempotencyKey(command, identifier); }
