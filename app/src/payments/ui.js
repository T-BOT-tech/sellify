// Presentation helpers only. This module never decides financial outcomes.
import { getPaymentState } from './state.js';

export const PAYMENT_STATE_LABELS = Object.freeze({
  UNPAID:'Unpaid', CLAIMED:'Claimed', RECEIVED:'Received', VERIFIED:'Verified',
  RECONCILED:'Reconciled', REJECTED:'Rejected', DUPLICATE:'Duplicate',
  MISMATCH:'Mismatch', EXPIRED:'Expired', PARTIAL:'Partial', REFUNDED:'Refunded',
  FAILED:'Failed', CANCELLED:'Cancelled', REVERSED:'Reversed',
});

export const ORDER_PAYMENT_STATUS_LABELS = Object.freeze({
  UNPAID:'Unpaid', PARTIAL:'Partially paid', PAID:'Paid', OVERPAID:'Overpaid',
  REFUNDED:'Refunded', REVERSED:'Reversed', UNKNOWN:'Payment status unavailable',
});

export function paymentStateLabel(payment) {
  const state = getPaymentState(payment);
  return PAYMENT_STATE_LABELS[state] || 'Unknown';
}

// Individual-payment presentation. A VERIFIED payment is deliberately not
// exposed as an order-level completion decision.
export function paymentSummary(payment) {
  return Object.freeze({
    id:payment?.id||null,
    state:getPaymentState(payment),
    stateLabel:paymentStateLabel(payment),
    amountMinor:payment?.amount_minor??null,
    currency:payment?.currency||null,
    orderId:payment?.order_id||null,
    providerId:payment?.provider_id||null,
    externalReference:payment?.external_reference||null,
  });
}

// Order-level presentation must consume the canonical Payment Core summary
// returned by getOrderPaymentSummary(). This helper intentionally accepts the
// summary as input and performs no arithmetic, payment aggregation, or state
// inference in the frontend.
export function orderPaymentSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return Object.freeze({
      status:'UNKNOWN', statusLabel:ORDER_PAYMENT_STATUS_LABELS.UNKNOWN,
      verifiedMinor:null, outstandingMinor:null, refundableMinor:null,
      orderId:null, currency:null,
    });
  }
  const rawStatus = String(summary.status || summary.payment_status || '').toUpperCase();
  const status = Object.prototype.hasOwnProperty.call(ORDER_PAYMENT_STATUS_LABELS, rawStatus)
    ? rawStatus : 'UNKNOWN';
  return Object.freeze({
    orderId:summary.orderId ?? summary.order_id ?? null,
    status,
    statusLabel:ORDER_PAYMENT_STATUS_LABELS[status],
    verifiedMinor:summary.verifiedMinor ?? summary.verified_minor ?? null,
    outstandingMinor:summary.outstandingMinor ?? summary.outstanding_minor ?? null,
    refundableMinor:summary.refundableMinor ?? summary.refundable_minor ?? null,
    currency:summary.currency || null,
  });
}

export function paymentErrorPresentation(error) {
  return Object.freeze({
    status:Number(error?.status)||0,
    code:error?.code||'PAYMENT_ERROR',
    message:error?.message||'Payment request failed.',
    retryable:Boolean(error?.retryable),
  });
}
