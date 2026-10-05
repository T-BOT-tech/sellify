import { listPayments, resolvePaymentRouting, createPayment, queryPaymentStatus, getOrderPaymentSummary, paymentCommandKey } from './client.js';
import { setPayments, getPayments, setPaymentError, upsertPayment } from './state.js';

let projectionRefreshSequence = 0;
const paymentStatusSequences = new Map();

export async function refreshPaymentProjection() {
  const sequence = ++projectionRefreshSequence;
  try {
    const payments = await listPayments({ limit: 500 });
    if (sequence !== projectionRefreshSequence) return getPayments();
    setPayments(payments);
    setPaymentError(null);
    return payments;
  } catch (error) {
    if (sequence !== projectionRefreshSequence) return getPayments();
    setPaymentError(error);
    return getPayments();
  }
}

function notifyCanonicalPaymentUpdated(payment) {
  if (typeof window === 'undefined') return;
  const orderId = String(payment?.orderId || payment?.order_id || '').trim();
  if (!orderId) return;
  window.dispatchEvent(new CustomEvent('sellify:payment-canonical-updated', {
    detail: Object.freeze({ orderId }),
  }));
}

export async function ensurePaymentForSyncedOrder(order, { statusQueryKey = null } = {}) {
  const serverOrderId = String(order?.server_order_id || order?.serverOrderId || '').trim();
  if (!serverOrderId) return { status: 'SKIPPED', reason: 'ORDER_NOT_SYNCED' };

  let payment = getPaymentForOrder(serverOrderId) || (await listPayments({ orderId: serverOrderId, limit: 10 }))[0] || null;
  let creationStatus = 'EXISTS';

  if (!payment) {
    const route = await resolvePaymentRouting({
      channel: 'manual',
      locationId: order?.location_id || order?.locationId || null,
      requireAccount: true,
    });
    if (route.status !== 'ROUTED' || !route.providerId || !route.paymentAccountId) {
      return { status: 'DEFERRED', reason: 'NO_ELIGIBLE_PAYMENT_ROUTE' };
    }

    const result = await createPayment({
      orderId: serverOrderId,
      amountMinor: Number(order?.total),
      providerId: route.providerId,
      paymentAccountId: route.paymentAccountId,
      channel: route.channel || 'manual',
      methodId: order?.payment_method_id || null,
      methodName: order?.payment_method_name || null,
      metadata: {
        source: 'SELLIFY_FRONTEND_ORDER_SYNC',
        localOrderId: order?.id || null,
      },
    }, { idempotencyKey: paymentCommandKey('create-order', serverOrderId) });

    payment = result?.payment || result || null;
    creationStatus = 'CREATED';
  }

  if (!payment?.id) {
    return { status: 'DEFERRED', reason: 'CANONICAL_PAYMENT_UNAVAILABLE' };
  }

  upsertPayment(payment);

  // PF-1K: provider status is queried only after the canonical Payment
  // exists. The status endpoint is a PaymentCore command, not a local
  // projection read, so its result is the only source allowed to advance
  // canonical financial state. A fresh operation key is used for each sync
  // cycle; reusing one forever would replay an old provider observation.
  const queryKey = String(statusQueryKey || '').trim() || paymentCommandKey(
    'status',
    `${payment.id}:${Date.now()}`,
  );
  const refreshed = await refreshCanonicalPaymentStatus(payment.id, {}, { idempotencyKey: queryKey });
  notifyCanonicalPaymentUpdated(refreshed || payment);
  return {
    status: creationStatus,
    payment: refreshed || payment,
    statusQueried: true,
  };
}

export async function refreshCanonicalOrderPaymentSummary(orderId) {
  const id = String(orderId || '').trim();
  if (!id) throw Object.assign(new Error('orderId is required'), { code: 'ORDER_REQUIRED', status: 400 });
  // Order-level financial status must come from Payment Core aggregation,
  // including successful refunds and reversal semantics. Never derive PAID
  // or outstanding amounts by summing the frontend payment array.
  return getOrderPaymentSummary(id);
}

export function getPaymentForOrder(orderId) {
  const id = String(orderId || '');
  if (!id) return null;
  return getPayments().find(payment => String(payment?.orderId || payment?.order_id || '') === id) || null;
}


export async function refreshCanonicalPaymentStatus(paymentId, body = {}, { idempotencyKey = null } = {}) {
  const id = String(paymentId || '').trim();
  if (!id) throw Object.assign(new Error('paymentId is required'), { code: 'PAYMENT_REQUIRED', status: 400 });
  const queryKey = String(idempotencyKey || '').trim() || paymentCommandKey('status', `${id}:${Date.now()}`);
  const sequence = (paymentStatusSequences.get(id) || 0) + 1;
  paymentStatusSequences.set(id, sequence);
  const data = await queryPaymentStatus(id, body, { idempotencyKey: queryKey });
  const payment = data?.payment || data;
  const isLatest = sequence === paymentStatusSequences.get(id);
  if (isLatest &&
      payment && typeof payment === 'object' &&
      (payment.id || payment.paymentId || payment.payment_id)) {
    return upsertPayment(payment);
  }
  // A superseded status response must never escape to its caller. Returning
  // that response could make UI code render a stale VERIFIED/PAID projection
  // immediately after a newer REFUNDED/REVERSED response won the race.
  return getPayments().find(item => String(item?.id) === id) || null;
}
