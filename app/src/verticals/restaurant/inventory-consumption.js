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
      event_id: `restaurant:organization:${organization_id}:preparation:${preparationId}:ingredient:${productId}`,
    });
  });

  return Object.freeze({
    preparation_id: preparationId,
    recipe_id: recipeId,
    organization_id,
    location_id,
    lines: Object.freeze(lines),
    movement_type: 'SALE',
    mutation_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovementBatch',
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
    value.mutation_authority === 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovementBatch' &&
    value.ledger_authority === 'app/src/warehouse/ledger.js' &&
    value.idempotency === 'event_id');
}

// Execute the complete preparation as one canonical Inventory batch event.
// Inventory owns the transaction, persistence, audit evidence and replay.
export async function consumeThroughCoreInventory(plan, {
  products = [],
  inventoryMovements = [],
  getInventoryBalance,
  recordCanonicalInventoryMovementBatch,
} = {}) {
  if (!isConsumptionPlan(plan)) throw new TypeError('Valid Restaurant inventory consumption plan is required');
  if (typeof recordCanonicalInventoryMovementBatch !== 'function') {
    throw new TypeError('Canonical Inventory batch mutation authority is required');
  }

  const byId = new Map(products.map(product => [String(product.id), product]));
  const confirmedByEventId = new Map(
    inventoryMovements
      .filter(movement => movement?.syncStatus === 'synced')
      .map(movement => [String(movement.eventId || ''), movement]),
  );
  let confirmedCount = 0;
  for (const line of plan.lines) {
    const existing = confirmedByEventId.get(line.event_id);
    if (!existing) continue;
    // A confirmed local projection may suppress a repeat only when it proves
    // the exact same movement. Reusing an event identity for changed intent is
    // a conflict, never a successful replay.
    if (
      String(existing.productId) !== line.product_id
      || Number(existing.quantity) !== -line.quantity
      || String(existing.movementType || '').toUpperCase() !== 'SALE'
      || String(existing.locationId || '') !== plan.location_id
      || String(existing.organizationId || '') !== plan.organization_id
    ) {
      throw Object.assign(new Error(`Inventory movement identity ${line.event_id} is already confirmed with different intent.`), {
        code: 'INVENTORY_MOVEMENT_IDEMPOTENCY_CONFLICT',
      });
    }
    confirmedCount += 1;
  }

  // A multi-ingredient preparation is one atomic batch. Never send only the
  // locally "missing" lines: a partial local projection may simply be stale,
  // and a subset would reuse the batch command ID with a different payload.
  // Short-circuit only when every line is confirmed; otherwise replay the
  // complete deterministic batch and let Inventory resolve event idempotency.
  const pending = confirmedCount === plan.lines.length ? [] : [...plan.lines];

  // Local preflight provides immediate feedback. The canonical batch command
  // remains the sole mutation boundary and commits all lines or none.
  for (const line of pending) {
    const product = byId.get(line.product_id);
    if (!product) throw new TypeError(`Core Commerce product ${line.product_id} does not exist`);
    // Only a canonical balance projection may be used for local preflight.
    // Legacy product.stock is not authoritative in an authenticated tenant and
    // may be stale; the server remains the final stock validator.
    const observedBalance = typeof getInventoryBalance === 'function'
      ? getInventoryBalance(line.product_id, plan.location_id)
      : null;
    const stock = observedBalance === null || observedBalance === undefined
      ? null
      : Number(observedBalance);
    if (Number.isFinite(stock) && stock < line.quantity) {
      throw new RangeError(`Insufficient canonical stock for product ${line.product_id}: required ${line.quantity}, available ${stock}`);
    }
  }

  if (pending.length === 0) {
    return Object.freeze({
      preparation_id: plan.preparation_id,
      applied_count: 0,
      skipped_idempotent_count: plan.lines.length,
      queued: false,
      sync_status: 'confirmed',
      transactions: Object.freeze([]),
    });
  }

  const result = await recordCanonicalInventoryMovementBatch({
    commandId: `restaurant:preparation:${plan.preparation_id}:inventory-batch`,
    organizationId: plan.organization_id,
    locationId: plan.location_id,
    referenceType: 'restaurant_preparation',
    referenceId: plan.preparation_id,
    reason: `Restaurant preparation ${plan.preparation_id} / recipe ${plan.recipe_id}`,
    lines: pending.map(line => ({
      lineId: line.product_id,
      eventId: line.event_id,
      productId: line.product_id,
      quantity: -line.quantity,
      movementType: 'SALE',
      metadata: { unit: line.unit, recipeId: plan.recipe_id },
    })),
  });

  return Object.freeze({
    preparation_id: plan.preparation_id,
    applied_count: result?.queued || result?.duplicate ? 0 : pending.length,
    replayed_count: result?.duplicate ? pending.length : 0,
    queued_count: result?.queued ? pending.length : 0,
    skipped_idempotent_count: plan.lines.length - pending.length,
    queued: Boolean(result?.queued),
    sync_status: result?.queued ? 'pending' : 'confirmed',
    transactions: Object.freeze(result?.movements || []),
  });
}

export function inventoryConsumptionContract() {
  return Object.freeze({
    recipe_authority: 'restaurant',
    preparation_authority: 'restaurant',
    product_authority: 'commerce',
    stock_authority: 'inventory',
    mutation_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovementBatch',
    ledger_authority: 'app/src/warehouse/ledger.js',
    movement_type: 'SALE',
    duplicate_authority: false,
    idempotency_key: 'restaurant:organization:<organizationId>:preparation:<preparationId>:ingredient:<productId>',
    batch_command_id: 'restaurant:preparation:<preparationId>:inventory-batch',
    atomic_multi_ingredient_execution: true,
    partial_consumption_preflight: true,
    offline_semantics: 'one durable atomic batch event; pending until canonical acknowledgement',
  });
}
