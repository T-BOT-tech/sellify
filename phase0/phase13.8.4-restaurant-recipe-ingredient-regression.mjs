import assert from 'node:assert/strict';
import { normalizeRecipe, isRecipeIngredientBridge, recipeIngredientContract } from '../app/src/verticals/restaurant/recipe-ingredient-bridge.js';

const products = [
  { id: 'p1', name: 'Tomato', unit: 'kg', organization_id: 'org-1' },
  { id: 'p2', name: 'Flour', unit: 'kg', organization_id: 'org-1' },
  { id: 'pX', name: 'Other Org', unit: 'kg', organization_id: 'org-2' },
];

const recipe = normalizeRecipe({
  id: 'r1', name: 'Tomato Pasta', yield_quantity: 4, yield_unit: 'portion',
  ingredients: [{ product_id: 'p1', quantity: 0.5, unit: 'kg' }, { product_id: 'p2', quantity: 0.25, unit: 'kg' }],
}, { organizationId: 'org-1', coreProducts: products });
assert.equal(recipe.recipe_id, 'r1');
assert.equal(recipe.ingredients.length, 2);
assert.equal(recipe.ingredients[0].product_id, 'p1');
assert.equal(recipe.product_authority, 'commerce');
assert.equal(recipe.inventory_authority, 'inventory');
assert.equal(recipe.stock_mutation, 'deferred-to-phase-13.8.5');
assert.ok(isRecipeIngredientBridge(recipe));
assert.equal(Object.isFrozen(recipe), true);

assert.throws(() => normalizeRecipe({ id: 'r2', name: 'Bad', ingredients: [{ product_id: 'missing', quantity: 1, unit: 'kg' }] }, { organizationId: 'org-1', coreProducts: products }), /does not exist/);
assert.throws(() => normalizeRecipe({ id: 'r3', name: 'Bad', ingredients: [{ product_id: 'pX', quantity: 1, unit: 'kg' }] }, { organizationId: 'org-1', coreProducts: products }), /different organization/);
assert.throws(() => normalizeRecipe({ id: 'r4', name: 'Bad', ingredients: [{ product_id: 'p1', quantity: 1, unit: 'kg' }, { product_id: 'p1', quantity: 2, unit: 'kg' }] }, { organizationId: 'org-1', coreProducts: products }), /duplicate/);
assert.throws(() => normalizeRecipe({ id: 'r5', name: 'Bad', ingredients: [{ product_id: 'p1', quantity: 0, unit: 'kg' }] }, { organizationId: 'org-1', coreProducts: products }), /positive/);
assert.equal(recipeIngredientContract().stock_consumption_phase, '13.8.5');

console.log('Phase 13.8.4 Restaurant Recipe / Ingredient Regression: PASS');
