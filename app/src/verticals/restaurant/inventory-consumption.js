// Phase 13.8.5 — Restaurant Preparation → Core Inventory consumption bridge.
// Restaurant owns Recipe/Preparation semantics; Core Inventory remains the
// only stock mutation authority. This module is intentionally dependency-light
// so its contract can be regression-tested without browser globals.

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

function positive(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`Restaurant ${field} must be a positive number`);
  return n;
}

function integer(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new TypeError(`Restaurant ${field} must be a positive integer`);
  return n;
}

export function buildConsumptionPlan(preparation, { organizationId, locationId, coreProducts = [] } = {}) {
  if (!preparation || typeof preparation !== 'object') throw new TypeError('Restaurant preparation is required');
  const preparationId = text(preparation.id ?? preparation.preparation_id, 'preparation_id');
  const recipeId = text(preparation.recipe_id, 'recipe_id');
  const organization_id = text(organizationId, 'organization_id');
  const location_id = text(locationId, 'location_id');
  const yieldQuantity = integer(preparation.quantity ?? preparation.yield_quantity ?? 1, 'preparation quantity');
  if (!Array.isArray(preparation.ingredients) || preparation.ingredients.length === 0) {
    throw new TypeError(`Restaurant preparation ${preparationId} must contain ingredients`);
  }

  const seen = new Set();
  const lines = preparation.ingredients.map((line, index) => {
    if (!line || typeof line !== 'object') throw new TypeError(`Preparation ingredient ${index + 1} is invalid`);
    const productId = text(line.product_id ?? line.productId, 'ingredient_product_id');
    if (seen.has(productId)) throw new TypeError(`Preparation contains duplicate ingredient product ${productId}`);
    seen.add(productId);
    const product = coreProducts.find(p => String(p.id) === productId);
    if (!product) throw new TypeError(`Core Commerce product ${productId} does not exist`);
    const productOrg = product.organization_id ?? product.organizationId;
    if (productOrg !== undefined && String(productOrg) !== organization_id) {
      throw new TypeError(`Core product ${productId} belongs to a different organization`);
    }
    const perYield = positive(line.quantity ?? line.qty, `ingredient ${productId} quantity`);
    return Object.freeze({
      product_id: productId,
      product_name: String(product.name ?? ''),
      quantity: perYield * yieldQuantity,
      unit: text(line.unit ?? product.unit ?? '', `ingredient ${productId} unit`),
      event_id: `restaurant:preparation:${preparationId}:ingredient:${productId}`,
    });
  });

  return Object.freeze({
    preparation_id: preparationId,
    recipe_id: recipeId,
    organization_id,
    location_id,
    lines: Object.freeze(lines),
    movement_type: 'sold',
    mutation_authority: 'app/src/warehouse/inventory.js',
    ledger_authority: 'app/src/warehouse/ledger.js',
    idempotency: 'event_id',
  });
}

export function isConsumptionPlan(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.preparation_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.location_id === 'string' &&
    Array.isArray(value.lines) &&
    value.mutation_authority === 'app/src/warehouse/inventory.js' &&
    value.ledger_authority === 'app/src/warehouse/ledger.js' &&
    value.idempotency === 'event_id');
}

// Execute only after the complete plan has been validated. The caller injects
// the existing Core applyStockChange authority and current movement ledger;
// no Restaurant inventory implementation is introduced here.
export function consumeThroughCoreInventory(plan, { products = [], inventoryMovements = [], applyStockChange } = {}) {
  if (!isConsumptionPlan(plan)) throw new TypeError('Valid Restaurant inventory consumption plan is required');
  if (typeof applyStockChange !== 'function') throw new TypeError('Core inventory applyStockChange authority is required');

  const byId = new Map(products.map(p => [String(p.id), p]));
  const existing = new Set(inventoryMovements.map(m => String(m.eventId || '')));
  const pending = plan.lines.filter(line => !existing.has(line.event_id));

  // Preflight all stock before mutating anything. This avoids partial recipe
  // consumption when a single ingredient is unavailable.
  for (const line of pending) {
    const product = byId.get(line.product_id);
    if (!product) throw new TypeError(`Core Commerce product ${line.product_id} does not exist`);
    const stock = typeof product.stock === 'number' ? product.stock : 0;
    if (stock < line.quantity) {
      throw new RangeError(`Insufficient stock for product ${line.product_id}: required ${line.quantity}, available ${stock}`);
    }
  }

  const applied = [];
  for (const line of pending) {
    const tx = applyStockChange(line.product_id, -line.quantity, 'sold', {
      referenceType: 'restaurant_preparation',
      referenceId: plan.preparation_id,
      eventId: line.event_id,
      locationId: plan.location_id,
      reason: `Restaurant preparation ${plan.preparation_id} / recipe ${plan.recipe_id}`,
      notes: 'Restaurant recipe ingredient consumption',
    });
    if (!tx) throw new Error(`Core inventory rejected consumption for product ${line.product_id}`);
    applied.push(tx);
  }
  return Object.freeze({
    preparation_id: plan.preparation_id,
    applied_count: applied.length,
    skipped_idempotent_count: plan.lines.length - pending.length,
    transactions: Object.freeze(applied),
  });
}

export function inventoryConsumptionContract() {
  return Object.freeze({
    recipe_authority: 'restaurant',
    preparation_authority: 'restaurant',
    product_authority: 'commerce',
    stock_authority: 'inventory',
    mutation_authority: 'app/src/warehouse/inventory.js',
    movement_ledger: 'app/src/warehouse/ledger.js',
    movement_type: 'sold',
    duplicate_authority: false,
    idempotency_key: 'restaurant:preparation:<preparationId>:ingredient:<productId>',
    partial_consumption_preflight: true,
  });
}
