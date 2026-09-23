// Phase 13.11.5 — Restaurant ↔ Commerce / Inventory integration contract.
// This is a persistence-neutral composition boundary over existing Restaurant
// bridges. Restaurant owns table/kitchen/recipe/preparation semantics; Core
// Commerce owns Order/Product identity; Core Inventory owns stock mutation and
// movement ledger. No RestaurantOrder or RestaurantInventory is introduced.

import {
  normalizeRestaurantOrder,
  buildRestaurantPaymentIntent,
} from './order-payment-compatibility.js';
import {
  buildConsumptionPlan,
  consumeThroughCoreInventory,
} from './inventory-consumption.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

export function buildRestaurantCommerceHandoff(order, { organizationId, locationId } = {}) {
  const normalized = normalizeRestaurantOrder(order, { organizationId, locationId });
  return Object.freeze({
    context: 'restaurant',
    operation: 'order-context',
    order_id: normalized.order_id,
    organization_id: normalized.organization_id,
    location_id: normalized.location_id,
    items: normalized.items,
    total_minor: normalized.total_minor,
    currency: normalized.currency,
    customer_id: normalized.customer_id,
    table_id: normalized.table_id,
    order_authority: 'commerce',
    product_authority: 'commerce',
    payment_authority: 'payments',
    persistence: 'existing Core Commerce order',
    duplicate_order_authority: false,
  });
}

export function buildRestaurantInventoryHandoff(preparation, { organizationId, locationId, coreProducts = [] } = {}) {
  const plan = buildConsumptionPlan(preparation, { organizationId, locationId, coreProducts });
  return Object.freeze({
    context: 'restaurant',
    operation: 'preparation-consumption',
    preparation_id: plan.preparation_id,
    recipe_id: plan.recipe_id,
    organization_id: plan.organization_id,
    location_id: plan.location_id,
    lines: plan.lines,
    movement_type: plan.movement_type,
    stock_authority: 'inventory',
    mutation_authority: plan.mutation_authority,
    ledger_authority: plan.ledger_authority,
    idempotency: plan.idempotency,
    duplicate_inventory_authority: false,
    persistence: 'existing Core inventory movement',
  });
}

export function buildRestaurantCommerceInventoryContext(order, preparation, {
  organizationId,
  locationId,
  coreProducts = [],
  paymentMethod,
} = {}) {
  const commerce = buildRestaurantCommerceHandoff(order, { organizationId, locationId });
  const inventory = buildRestaurantInventoryHandoff(preparation, { organizationId, locationId, coreProducts });
  const payment = buildRestaurantPaymentIntent(order, { organizationId, locationId, paymentMethod });
  if (payment.order_id !== commerce.order_id || payment.organization_id !== commerce.organization_id) {
    throw new TypeError('Restaurant payment context must reference the same Core Commerce order and organization');
  }
  if (inventory.organization_id !== commerce.organization_id || inventory.location_id !== commerce.location_id) {
    throw new TypeError('Restaurant Commerce and Inventory contexts must share organization and location');
  }
  return Object.freeze({ commerce, inventory, payment });
}

export function isRestaurantCommerceInventoryContext(value) {
  return Boolean(value && typeof value === 'object' &&
    value.commerce?.context === 'restaurant' &&
    value.commerce?.order_authority === 'commerce' &&
    value.commerce?.product_authority === 'commerce' &&
    value.commerce?.duplicate_order_authority === false &&
    value.inventory?.context === 'restaurant' &&
    value.inventory?.organization_id === value.commerce?.organization_id &&
    value.inventory?.location_id === value.commerce?.location_id &&
    value.inventory?.stock_authority === 'inventory' &&
    value.inventory?.duplicate_inventory_authority === false &&
    value.payment?.payment_authority === 'payments');
}

export function executeRestaurantInventoryHandoff(handoff, options = {}) {
  if (!handoff || typeof handoff !== 'object' || handoff.stock_authority !== 'inventory') {
    throw new TypeError('Valid Restaurant Inventory handoff is required');
  }
  const plan = {
    preparation_id: text(handoff.preparation_id, 'preparation_id'),
    recipe_id: text(handoff.recipe_id, 'recipe_id'),
    organization_id: text(handoff.organization_id, 'organization_id'),
    location_id: text(handoff.location_id, 'location_id'),
    lines: handoff.lines,
    movement_type: handoff.movement_type,
    mutation_authority: handoff.mutation_authority,
    ledger_authority: handoff.ledger_authority,
    idempotency: handoff.idempotency,
  };
  return consumeThroughCoreInventory(plan, options);
}

export function restaurantCommerceInventoryContract() {
  return Object.freeze({
    restaurant_semantic_authority: ['Table', 'KitchenTicket', 'Recipe', 'Preparation'],
    order_authority: 'commerce',
    product_authority: 'commerce',
    payment_authority: 'payments',
    stock_authority: 'inventory',
    mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    fulfillment_authority: 'fulfillment',
    order_persistence: 'existing Core Commerce order',
    inventory_persistence: 'existing Core inventory movement',
    inventory_idempotency: 'event_id',
    organization_scope: 'required',
    location_scope: 'required',
    duplicate_order_authority: false,
    duplicate_inventory_authority: false,
    duplicate_payment_authority: false,
    direct_stock_mutation_by_restaurant: false,
    persistence_added: false,
  });
}
