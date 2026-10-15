import { listPayments, resolvePaymentRouting, createPayment, queryPaymentStatus, getOrderPaymentSummary, paymentCommandKey } from './client.js';
import { setPayments, getPayments, setPaymentError, upsertPayment } from './state.js';

let projectionRefreshSequence = 0;
const paymentStatusSequences = new Map();

export async function refreshPaymentProjection() {
  const sequence = ++projectionRefreshSequence;
  try {
    const payments = await listPayments({ limit: 500 });
    if (sequence !== projectionRefreshSequence) return getPayments();
    // Linkage-only shells establish identity, not a financial payment.
    // Keep them out of the operational payment projection and payment UI.
    setPayments(payments.filter(payment => !isCanonicalLinkageOnlyPayment(payment)));
    setPaymentError(null);
    return getPayments();
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

const paymentEnsureInFlight = new Map();

export async function ensurePaymentForSyncedOrder(order, options = {}) {
  const serverOrderId = String(order?.server_order_id || order?.serverOrderId || '').trim();
  if (!serverOrderId) return { status: 'SKIPPED', reason: 'ORDER_NOT_SYNCED' };

  const statusQueryKey = String(options.statusQueryKey || '').trim();
  // An explicit key represents a caller-owned Payment Core operation and is
  // never coalesced with another command. Ordinary order-sync retries, however,
  // share one in-flight ensure/query per canonical order within this client.
  if (statusQueryKey) return ensurePaymentForSyncedOrderOnce(order, { statusQueryKey });

  const inFlight = paymentEnsureInFlight.get(serverOrderId);
  if (inFlight) return inFlight;

  const task = ensurePaymentForSyncedOrderOnce(order, options);
  paymentEnsureInFlight.set(serverOrderId, task);
  try {
    return await task;
  } finally {
    if (paymentEnsureInFlight.get(serverOrderId) === task) {
      paymentEnsureInFlight.delete(serverOrderId);
    }
  }
}

export function isCanonicalLinkageOnlyPayment(payment) {
  let metadata = payment?.metadata ?? payment?.metadata_json ?? null;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = null; }
  }
  return metadata?.canonicalLinkageOnly === true
    || metadata?.canonicalLinkageOnly === 1
    || metadata?.canonical_linkage_only === true
    || metadata?.canonical_linkage_only === 1;
}

async function ensurePaymentForSyncedOrderOnce(order, { statusQueryKey = null } = {}) {
  const serverOrderId = String(order?.server_order_id || order?.serverOrderId || '').trim();
  if (!serverOrderId) return { status: 'SKIPPED', reason: 'ORDER_NOT_SYNCED' };

  // Order sync may create a canonical identity shell before a financial
  // payment is routed. Keep it available for identity linkage, but never
  // treat it as a financial payment or query its provider status.
  const cachedForOrder = getPayments().filter(item =>
    String(item?.orderId || item?.order_id || '') === serverOrderId);
  const cachedUsablePayment = cachedForOrder.find(item => item?.id && !isCanonicalLinkageOnlyPayment(item)) || null;
  // If cache has only a linkage shell (or nothing), read Payment Core again:
  // a routed payment may have been created since the last projection refresh.
  const listedForOrder = cachedUsablePayment
    ? cachedForOrder
    : await listPayments({ orderId: serverOrderId, limit: 10 });
  let payment = cachedUsablePayment
    || listedForOrder.find(item => item?.id && !isCanonicalLinkageOnlyPayment(item))
    || null;
  const linkageOnlyPayment = listedForOrder.find(item => item?.id && isCanonicalLinkageOnlyPayment(item))
    || cachedForOrder.find(item => item?.id && isCanonicalLinkageOnlyPayment(item))
    || null;
  let creationStatus = 'EXISTS';

  if (!payment) {
    const route = await resolvePaymentRouting({
      channel: 'manual',
      locationId: order?.location_id || order?.locationId || null,
      requireAccount: true,
    });
    if (route.status !== 'ROUTED' || !route.providerId || !route.paymentAccountId) {
      // Preserve canonical identity linkage for recovery, without querying
      // the shell or presenting it as a usable financial payment.
      return {
        status: linkageOnlyPayment ? 'LINKED_ONLY' : 'DEFERRED',
        reason: 'NO_ELIGIBLE_PAYMENT_ROUTE',
        ...(linkageOnlyPayment ? { payment: linkageOnlyPayment, statusQueried: false } : {}),
      };
    }

    const result = await createPayment({
      orderId: serverOrderId,
      amountMinor: Number(order?.total),
      providerId: route.providerId,
      paymentAccountId: route.paymentAccountId,
      channel: route.channel || 'manual',
      methodId: order?.payment_method_id || null,
      methodName: order?.payment_method_name || null,
      // Idempotency is keyed by canonical server order identity. Do not
      // include a device-local order ID here: another device may retry the
      // same canonical create command with a different local identifier.
      metadata: {
        source: 'SELLIFY_FRONTEND_ORDER_SYNC',
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
  return getPayments().find(payment =>
    String(payment?.orderId || payment?.order_id || '') === id
      && !isCanonicalLinkageOnlyPayment(payment),
  ) || null;
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
