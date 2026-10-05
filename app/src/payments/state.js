// In-memory frontend projection only. Never persist this as a financial ledger.
import { PAYMENT_STATES } from './contract.js';
let payments = [], selectedPaymentId = null, loading = false, error = null;

function canonicalUpdatedAt(payment) {
  const value = payment?.updatedAt ?? payment?.updated_at ?? payment?.modifiedAt ?? payment?.modified_at;
  const timestamp = value ? Date.parse(String(value)) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function preferIncomingPayment(current, incoming) {
  if (!current) return true;
  const currentAt = canonicalUpdatedAt(current);
  const incomingAt = canonicalUpdatedAt(incoming);
  if (currentAt !== null && incomingAt !== null) return incomingAt >= currentAt;
  if (currentAt !== null && incomingAt === null) return false;
  return true;
}

export function getPayments() { return payments; }
export function getSelectedPayment() { return payments.find(payment => String(payment?.id) === String(selectedPaymentId)) || null; }
export function setSelectedPayment(paymentId) { selectedPaymentId = paymentId ? String(paymentId) : null; }

export function setPayments(next) {
  if (!Array.isArray(next)) return payments;
  const incomingById = new Map(next.filter(payment => payment?.id).map(payment => [String(payment.id), { ...payment }]));
  const existingById = new Map(payments.filter(payment => payment?.id).map(payment => [String(payment.id), payment]));
  // A successful canonical list response is a tenant-scoped snapshot. Never
  // retain records missing from that snapshot: doing so can leak stale
  // payments across tenant switches or resurrect payments removed/archived
  // from the canonical projection.
  payments = Array.from(incomingById.entries()).map(([id, incoming]) =>
    preferIncomingPayment(existingById.get(id), incoming) ? incoming : existingById.get(id),
  );
  return payments;
}

export function upsertPayment(payment) {
  if (!payment?.id) return null;
  const id = String(payment.id), index = payments.findIndex(item => String(item?.id) === id);
  const current = index === -1 ? null : payments[index];
  if (!preferIncomingPayment(current, payment)) return current;
  const next = { ...payment };
  payments = index === -1 ? [next, ...payments] : payments.map((item, i) => i === index ? next : item);
  return next;
}
export function getPaymentState(payment) { const state = String(payment?.state || '').toUpperCase(); return PAYMENT_STATES.includes(state) ? state : null; }
export function setPaymentLoading(value) { loading = Boolean(value); }
export function isPaymentLoading() { return loading; }
export function setPaymentError(value) { error = value || null; }
export function getPaymentError() { return error; }
export function clearPaymentState() { payments = []; selectedPaymentId = null; loading = false; error = null; }
