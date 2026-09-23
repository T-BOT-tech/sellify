// Phase 13.8.6 — Restaurant Order / Payment compatibility bridge.
// Restaurant does not own Order or Payment. This module normalizes the existing
// Restaurant checkout fields into the established Core Commerce + Payment
// contracts without creating a parallel order/payment record.

const PAYMENT_STATES = Object.freeze([
  'UNPAID', 'CLAIMED', 'RECEIVED', 'VERIFIED', 'RECONCILED',
  'REJECTED', 'DUPLICATE', 'MISMATCH', 'EXPIRED', 'PARTIAL', 'REFUNDED',
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

function minor(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new TypeError(`Restaurant ${field} must be a non-negative integer`);
  return n;
}

function requireItems(order) {
  if (!Array.isArray(order?.items) || order.items.length === 0) {
    throw new TypeError('Restaurant order must contain items');
  }
  return order.items.map((item, index) => Object.freeze({
    id: text(item?.id, `item_${index + 1}_id`),
    qty: (() => {
      const n = Number(item?.qty);
      if (!Number.isFinite(n) || n <= 0) throw new TypeError(`Restaurant item ${index + 1} quantity must be positive`);
      return n;
    })(),
    price: minor(item?.price, `item_${index + 1}_price`),
  }));
}

export function normalizeRestaurantOrder(order, { organizationId, locationId } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Restaurant order is required');
  const orderId = text(order.id, 'order_id');
  const organization_id = text(organizationId, 'organization_id');
  const location_id = text(locationId ?? order.location_id, 'location_id');
  const items = requireItems(order);
  const total = minor(order.total, 'order_total');
  const calculated = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  if (calculated !== total) throw new TypeError(`Restaurant order ${orderId} total does not match line items`);

  return Object.freeze({
    order_id: orderId,
    organization_id,
    location_id,
    items,
    total_minor: total,
    currency: text(order.currency || 'ETB', 'currency').toUpperCase(),
    customer_id: order.customer_id == null ? null : String(order.customer_id),
    table_id: order.table_id == null ? null : String(order.table_id),
    table_number: order.table_number == null ? null : Number(order.table_number),
    kitchen_status: order.kitchen_status || 'pending',
    priority: order.priority || 'normal',
    course: order.course == null ? null : String(order.course),
    order_authority: 'commerce',
    payment_authority: 'payments',
    restaurant_context: 'restaurant',
  });
}

export function buildRestaurantPaymentIntent(order, { organizationId, locationId, paymentMethod } = {}) {
  const normalized = normalizeRestaurantOrder(order, { organizationId, locationId });
  const method = paymentMethod || {};
  const methodId = text(method.id ?? order.payment_method_id ?? 'cash', 'payment_method_id');
  const methodName = text(method.name ?? order.payment_method_name ?? 'Cash', 'payment_method_name');
  const tendered = order.cash_tendered == null ? null : minor(order.cash_tendered, 'cash_tendered');
  const proofAttached = Boolean(order.payment_proof);

  let amountMinor = 0;
  let state = 'UNPAID';
  if (tendered != null && tendered > 0) {
    amountMinor = Math.min(tendered, normalized.total_minor);
    state = tendered >= normalized.total_minor ? 'RECEIVED' : 'PARTIAL';
  } else if (proofAttached) {
    amountMinor = normalized.total_minor;
    state = 'CLAIMED';
  }

  return Object.freeze({
    order_id: normalized.order_id,
    organization_id: normalized.organization_id,
    location_id: normalized.location_id,
    amount_minor: amountMinor,
    currency: normalized.currency,
    method_id: methodId,
    method_name: methodName,
    state,
    customer_id: normalized.customer_id,
    provider_id: method.provider_id || 'manual',
    channel: method.channel || 'manual',
    metadata: Object.freeze({
      compatibility: 'restaurant-order-payment',
      restaurant_context: true,
      payment_proof_attached: proofAttached,
    }),
    payment_authority: 'payments',
    order_authority: 'commerce',
  });
}

export function assertRestaurantPaymentState(state) {
  const normalized = text(state, 'payment_state').toUpperCase();
  if (!PAYMENT_STATES.includes(normalized)) throw new TypeError(`Invalid Core Payment state: ${normalized}`);
  return normalized;
}

export function restaurantOrderPaymentContract() {
  return Object.freeze({
    order_authority: 'commerce',
    payment_authority: 'payments',
    restaurant_order_is_projection: true,
    restaurant_payment_is_projection: true,
    canonical_order_api: 'existing Core Commerce order',
    canonical_payment_api: 'existing Core Payment service',
    payment_states: PAYMENT_STATES,
    duplicate_order_authority: false,
    duplicate_payment_authority: false,
    proof_compatibility: 'existing order.payment_proof',
    currency_unit: 'minor',
  });
}
