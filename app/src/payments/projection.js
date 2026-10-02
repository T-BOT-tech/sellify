import { listPayments, resolvePaymentRouting, createPayment, paymentCommandKey } from './client.js';
import { setPayments, getPayments, setPaymentError, upsertPayment } from './state.js';

export async function refreshPaymentProjection() {
  try {
    const payments = await listPayments({ limit: 500 });
    setPayments(payments);
    setPaymentError(null);
    return payments;
  } catch (error) {
    setPaymentError(error);
    return getPayments();
  }
}

export async function ensurePaymentForSyncedOrder(order) {
  const serverOrderId = String(order?.server_order_id || order?.serverOrderId || '').trim();
  if (!serverOrderId) return { status: 'SKIPPED', reason: 'ORDER_NOT_SYNCED' };
  const existing = getPaymentForOrder(serverOrderId) || (await listPayments({ orderId: serverOrderId, limit: 10 }))[0] || null;
  if (existing) { upsertPayment(existing); return { status: 'EXISTS', payment: existing }; }
  const route = await resolvePaymentRouting({ channel: 'manual', locationId: order?.location_id || order?.locationId || null, requireAccount: true });
  if (route.status !== 'ROUTED' || !route.providerId || !route.paymentAccountId) return { status: 'DEFERRED', reason: 'NO_ELIGIBLE_PAYMENT_ROUTE' };
  const result = await createPayment({ orderId: serverOrderId, amountMinor: Number(order?.total), providerId: route.providerId, paymentAccountId: route.paymentAccountId, channel: route.channel || 'manual', methodId: order?.payment_method_id || null, methodName: order?.payment_method_name || null, metadata: { source: 'SELLIFY_FRONTEND_ORDER_SYNC', localOrderId: order?.id || null } }, { idempotencyKey: paymentCommandKey('create-order', serverOrderId) });
  const created = result?.payment || result; if (created) upsertPayment(created); return { status: 'CREATED', payment: created };
}

export function getPaymentForOrder(orderId) {
  const id = String(orderId || '');
  if (!id) return null;
  return getPayments().find(payment => String(payment?.orderId || payment?.order_id || '') === id) || null;
}
