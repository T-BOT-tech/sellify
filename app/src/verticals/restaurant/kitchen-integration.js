// Phase 13.8.3 — Restaurant Kitchen → Core Commerce integration.
// Compatibility bridge only: restaurant/kitchen.js remains the operational
// kitchen authority. Core Commerce remains the order authority. A KitchenTicket
// is a normalized restaurant view of an existing Core Order; it is not a second
// order record or payment/inventory authority.

const KITCHEN_STATUSES = Object.freeze(['pending', 'preparing', 'ready', 'served']);
const KITCHEN_PRIORITIES = Object.freeze(['low', 'normal', 'urgent']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

function finitePositive(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`Restaurant ${field} must be a positive number`);
  return n;
}

function requireCoreOrder(order) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Commerce order is required');
  const orderId = text(order.id, 'order_id');
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new TypeError(`Core Commerce order ${orderId} must contain items`);
  }
  return orderId;
}

export function createKitchenTicketFromOrder(order, { organizationId, locationId } = {}) {
  const orderId = requireCoreOrder(order);
  const organization_id = text(organizationId, 'organization_id');
  const location_id = text(locationId, 'location_id');
  const status = order.kitchen_status || 'pending';
  const priority = order.priority || 'normal';
  if (!KITCHEN_STATUSES.includes(status)) throw new TypeError(`Invalid kitchen status: ${status}`);
  if (!KITCHEN_PRIORITIES.includes(priority)) throw new TypeError(`Invalid kitchen priority: ${priority}`);

  return Object.freeze({
    ticket_id: `kitchen:${orderId}`,
    order_id: orderId,
    organization_id,
    location_id,
    table_id: order.table_id ? String(order.table_id) : null,
    table_number: order.table_number == null ? null : Number(order.table_number),
    items: Object.freeze(order.items.map(item => Object.freeze({
      id: text(item?.id, 'item_id'),
      name: text(item?.name, 'item_name'),
      qty: finitePositive(item?.qty, 'item_qty'),
    }))),
    status,
    priority,
    course: order.course ? String(order.course) : null,
    created_at: Number(order.created_at) || Date.now(),
    kitchen_started_at: order.kitchen_started_at == null ? null : Number(order.kitchen_started_at),
  });
}

export function isKitchenTicket(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.ticket_id === 'string' && value.ticket_id.startsWith('kitchen:') &&
    typeof value.order_id === 'string' && typeof value.organization_id === 'string' &&
    typeof value.location_id === 'string' && KITCHEN_STATUSES.includes(value.status) &&
    KITCHEN_PRIORITIES.includes(value.priority));
}

export function kitchenStatusContract() {
  return Object.freeze({
    ticket_authority: 'app/src/restaurant/kitchen.js',
    order_authority: 'commerce',
    payment_authority: 'payments',
    inventory_authority: 'inventory',
    customer_authority: 'customers',
    location_authority: 'locations',
    fulfillment_authority: 'fulfillment',
    status_values: KITCHEN_STATUSES,
    priority_values: KITCHEN_PRIORITIES,
    persistence: 'existing Core Order record',
    duplicate_order_authority: false,
  });
}

export function assertKitchenOrderContext(order, { organizationId, locationId } = {}) {
  const ticket = createKitchenTicketFromOrder(order, { organizationId, locationId });
  if (ticket.order_id !== String(order.id)) throw new TypeError('Kitchen ticket must reference the Core order');
  return ticket;
}
