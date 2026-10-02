// In-memory frontend projection only. Never persist this as a financial ledger.
import { PAYMENT_STATES } from './contract.js';
let payments = [], selectedPaymentId = null, loading = false, error = null;
export function getPayments() { return payments; }
export function getSelectedPayment() { return payments.find(payment => String(payment?.id) === String(selectedPaymentId)) || null; }
export function setSelectedPayment(paymentId) { selectedPaymentId = paymentId ? String(paymentId) : null; }
export function setPayments(next) { payments = Array.isArray(next) ? next.map(payment => ({ ...payment })) : []; return payments; }
export function upsertPayment(payment) {
  if (!payment?.id) return null;
  const id = String(payment.id), next = { ...payment }, index = payments.findIndex(item => String(item?.id) === id);
  payments = index === -1 ? [next, ...payments] : payments.map((item, i) => i === index ? next : item); return next;
}
export function getPaymentState(payment) { const state = String(payment?.state || '').toUpperCase(); return PAYMENT_STATES.includes(state) ? state : null; }
export function setPaymentLoading(value) { loading = Boolean(value); }
export function isPaymentLoading() { return loading; }
export function setPaymentError(value) { error = value || null; }
export function getPaymentError() { return error; }
export function clearPaymentState() { payments = []; selectedPaymentId = null; loading = false; error = null; }
