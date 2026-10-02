import { listPayments } from './client.js';
import { setPayments, getPayments, setPaymentError } from './state.js';

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

export function getPaymentForOrder(orderId) {
  const id = String(orderId || '');
  if (!id) return null;
  return getPayments().find(payment => String(payment?.orderId || payment?.order_id || '') === id) || null;
}
