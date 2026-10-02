// Presentation helpers only. This module never decides financial outcomes.
import { getPaymentState } from './state.js';
export const PAYMENT_STATE_LABELS = Object.freeze({ UNPAID:'Unpaid', CLAIMED:'Claimed', RECEIVED:'Received', VERIFIED:'Verified', RECONCILED:'Reconciled', REJECTED:'Rejected', DUPLICATE:'Duplicate', MISMATCH:'Mismatch', EXPIRED:'Expired', PARTIAL:'Partial', REFUNDED:'Refunded' });
export function paymentStateLabel(payment) { const state = getPaymentState(payment); return PAYMENT_STATE_LABELS[state] || 'Unknown'; }
export function paymentSummary(payment) { return Object.freeze({ id:payment?.id||null, state:getPaymentState(payment), stateLabel:paymentStateLabel(payment), amountMinor:payment?.amount_minor??null, currency:payment?.currency||null, orderId:payment?.order_id||null, providerId:payment?.provider_id||null, externalReference:payment?.external_reference||null }); }
export function paymentErrorPresentation(error) { return Object.freeze({ status:Number(error?.status)||0, code:error?.code||'PAYMENT_ERROR', message:error?.message||'Payment request failed.', retryable:Boolean(error?.retryable) }); }
