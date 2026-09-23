// logistics/fulfillment.js
// Phase 6 extraction (see modularization plan §5): the delivery/pickup
// status machine — moved out of main.js unchanged. Fulfillment lives on the
// order itself (fulfillment_type / fulfillment_status), not a parallel
// table — same approach restaurant mode uses for kitchen_status.
//
// NOTE on the ./ui.js import below (renderLogistics): this is a harmless
// circular import — ui.js imports this file for the status machine, and
// this file imports ui.js back for its render function. Neither call
// happens at module-evaluation time, only later from a click handler
// (advanceFulfillmentOrder), by which point both modules have finished
// loading. Same pattern products/render.js documents for its own siblings;
// keeps Rule 2 intact (everything still loads statically, nothing lazy).
import { STORAGE_KEYS } from '../constants.js';
import { config, orders, products, currentStaff } from '../state.js';
import { saveJSON } from '../storage/json.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { isWarehouseEnabled, isStockTracked, applyStockChange } from '../warehouse/inventory.js';
import { hasPermission } from '../auth/permissions.js';
import { t } from '../ui/i18n.js';
import { renderLogistics } from './ui.js';

// 'pickup' | 'delivery' | null, chosen on the Order tab.
// Phase 4 export (see modularization plan §5): orders/checkout.js's
// saveOrder() reads this directly and resets it via the setter once an
// order is saved — that bridge now points here instead of main.js.
export let selectedFulfillmentType = null;
export function setSelectedFulfillmentType(next) { selectedFulfillmentType = next; }

export function isLogisticsEnabled() {
  return !!config.logisticsEnabled;
}

// Delivery: pending -> out_for_delivery -> delivered
// Pickup:   pending -> ready_for_pickup -> picked_up
export function nextFulfillmentStatus(order) {
  if (order.fulfillment_type === 'delivery') {
    if (order.fulfillment_status === 'pending') return 'out_for_delivery';
    if (order.fulfillment_status === 'out_for_delivery') return 'delivered';
  } else if (order.fulfillment_type === 'pickup') {
    if (order.fulfillment_status === 'pending') return 'ready_for_pickup';
    if (order.fulfillment_status === 'ready_for_pickup') return 'picked_up';
  }
  return null;
}
export function isFulfillmentFinal(status) {
  return status === 'delivered' || status === 'picked_up';
}
export function fulfillmentStatusLabel(status) {
  return t('whFulfill_' + status) || status;
}

// Advances an order to its next fulfillment status. The moment an order reaches
// a *final* status (delivered / picked up) is when stock actually leaves the
// building, so — if Warehouse is also enabled — this is where we decrement it,
// via the same applyStockChange() the Warehouse tab itself uses (full audit trail,
// no separate code path to keep in sync). Guarded by stock_deducted so tapping
// the button twice, or a re-render, can never double-deduct.
function fulfillmentSaleEventId(orderId, productId) {
  return `fulfillment_sale:${String(orderId)}:${String(productId)}`;
}

function canDeductOrderStock(order) {
  if (!isWarehouseEnabled() || order.stock_deducted) return false;
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit')) return false;
  for (const item of order.items || []) {
    if (!item.id) continue; // older orders saved before item ids were tracked
    const product = products.find(p => p.id === item.id);
    if (!product) return false;
    if (isStockTracked(product) && (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0)) return false;
    if (isStockTracked(product) && Number(product.stock) < Number(item.qty)) return false;
  }
  return true;
}

function deductOrderStock(order) {
  if (!canDeductOrderStock(order)) return false;
  const trackedItems = (order.items || []).filter(item => {
    if (!item.id) return false;
    const product = products.find(p => p.id === item.id);
    return product && isStockTracked(product);
  });
  for (const item of trackedItems) {
    const tx = applyStockChange(item.id, -Number(item.qty), 'sold', {
      reference: order.id,
      referenceType: 'order',
      referenceId: order.id,
      eventId: fulfillmentSaleEventId(order.id, item.id),
      reason: 'physical_fulfillment_final',
    });
    if (!tx) return false;
  }
  order.stock_deducted = true;
  return true;
}

export function advanceFulfillmentOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const next = nextFulfillmentStatus(order);
  if (!next) return;
  if (isFulfillmentFinal(next) && !order.stock_deducted && isWarehouseEnabled()) {
    if (!deductOrderStock(order)) return;
  }
  order.fulfillment_status = next;
  saveJSON(STORAGE_KEYS.orders, orders);
  renderLogistics();
}
