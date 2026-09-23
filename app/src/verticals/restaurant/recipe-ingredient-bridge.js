// Phase 13.8.4 — Restaurant Recipe → Core Product/Inventory bridge.
// Contract-only integration: Restaurant owns Recipe/Preparation semantics;
// Core Commerce owns products and Core Inventory remains the stock authority.
// This phase does NOT consume stock; that belongs to Phase 13.8.5.

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

function findCoreProduct(productId, coreProducts) {
  const id = text(productId, 'ingredient_product_id');
  const product = (coreProducts || []).find(p => String(p.id) === id);
  if (!product) throw new TypeError(`Core Commerce product ${id} does not exist`);
  return product;
}

export function normalizeRecipe(recipe, { organizationId, coreProducts = [] } = {}) {
  if (!recipe || typeof recipe !== 'object') throw new TypeError('Restaurant recipe is required');
  const recipeId = text(recipe.id, 'recipe_id');
  const organization_id = text(organizationId, 'organization_id');
  const name = text(recipe.name, 'recipe_name');
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new TypeError(`Restaurant recipe ${recipeId} must contain ingredients`);
  }

  const seen = new Set();
  const ingredients = recipe.ingredients.map((line, index) => {
    if (!line || typeof line !== 'object') throw new TypeError(`Recipe ingredient ${index + 1} is invalid`);
    const product = findCoreProduct(line.product_id ?? line.productId, coreProducts);
    const productOrg = product.organization_id ?? product.organizationId;
    if (productOrg !== undefined && String(productOrg) !== organization_id) {
      throw new TypeError(`Core product ${product.id} belongs to a different organization`);
    }
    const productId = String(product.id);
    if (seen.has(productId)) throw new TypeError(`Recipe contains duplicate ingredient product ${productId}`);
    seen.add(productId);
    const quantity = positive(line.quantity ?? line.qty, `ingredient ${productId} quantity`);
    const unit = text(line.unit ?? product.unit ?? '', `ingredient ${productId} unit`);
    return Object.freeze({
      product_id: productId,
      product_name: String(product.name ?? ''),
      quantity,
      unit,
    });
  });

  return Object.freeze({
    recipe_id: recipeId,
    organization_id,
    name,
    yield_quantity: recipe.yield_quantity == null ? null : positive(recipe.yield_quantity, 'yield_quantity'),
    yield_unit: recipe.yield_unit == null ? null : text(recipe.yield_unit, 'yield_unit'),
    ingredients: Object.freeze(ingredients),
    inventory_authority: 'inventory',
    product_authority: 'commerce',
    stock_mutation: 'deferred-to-phase-13.8.5',
  });
}

export function isRecipeIngredientBridge(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.recipe_id === 'string' &&
    typeof value.organization_id === 'string' &&
    Array.isArray(value.ingredients) &&
    value.product_authority === 'commerce' &&
    value.inventory_authority === 'inventory' &&
    value.stock_mutation === 'deferred-to-phase-13.8.5');
}

export function recipeIngredientContract() {
  return Object.freeze({
    recipe_authority: 'restaurant',
    ingredient_identity: 'commerce.product',
    ingredient_stock_authority: 'inventory',
    inventory_mutation: 'app/src/warehouse/inventory.js',
    movement_ledger: 'app/src/warehouse/ledger.js',
    duplicate_authority: false,
    stock_consumption_phase: '13.8.5',
  });
}
