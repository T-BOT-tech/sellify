import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESTAURANT_PACK, RESTAURANT_BOUNDARY, isRestaurantPack } from '../app/src/verticals/restaurant/pack.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(RESTAURANT_PACK.pack_id, 'restaurant');
assert.equal(RESTAURANT_PACK.name, 'Restaurant');
assert(RESTAURANT_PACK.domain_entities.includes('Table'));
assert(RESTAURANT_PACK.domain_entities.includes('KitchenTicket'));
assert(RESTAURANT_PACK.domain_entities.includes('Recipe'));
assert(RESTAURANT_PACK.domain_entities.includes('Preparation'));
assert(RESTAURANT_PACK.core_dependencies.includes('commerce'));
assert(RESTAURANT_PACK.core_dependencies.includes('inventory'));
assert(RESTAURANT_PACK.core_dependencies.includes('payments'));
assert(RESTAURANT_PACK.ui_entry_points.includes('tables'));
assert(RESTAURANT_PACK.ui_entry_points.includes('kitchen'));
assert.equal(isRestaurantPack(), true);

for (const forbidden of RESTAURANT_BOUNDARY.forbidden_parallel_authorities) {
  assert(!RESTAURANT_PACK.domain_entities.includes(forbidden), `parallel authority declared: ${forbidden}`);
}

assert.equal(RESTAURANT_BOUNDARY.existing_modules.tables, 'app/src/restaurant/tables.js');
assert.equal(RESTAURANT_BOUNDARY.existing_modules.kitchen, 'app/src/restaurant/kitchen.js');
assert(fs.existsSync(path.join(root, RESTAURANT_BOUNDARY.existing_modules.tables)));
assert(fs.existsSync(path.join(root, RESTAURANT_BOUNDARY.existing_modules.kitchen)));

const tablesSource = fs.readFileSync(path.join(root, RESTAURANT_BOUNDARY.existing_modules.tables), 'utf8');
const kitchenSource = fs.readFileSync(path.join(root, RESTAURANT_BOUNDARY.existing_modules.kitchen), 'utf8');
assert.match(tablesSource, /export function saveTables/);
assert.match(tablesSource, /export function cycleTableStatus/);
assert.match(tablesSource, /export function confirmTransfer/);
assert.match(kitchenSource, /export function renderKitchen/);
assert.match(kitchenSource, /export function setKitchenStatus/);
assert.match(kitchenSource, /export function setKitchenPriority/);

assert.equal(RESTAURANT_BOUNDARY.bridges_to_core.order, 'commerce');
assert.equal(RESTAURANT_BOUNDARY.bridges_to_core.ingredient_stock, 'inventory');
assert.equal(RESTAURANT_BOUNDARY.bridges_to_core.payment, 'payments');
assert.equal(RESTAURANT_BOUNDARY.bridges_to_core.customer, 'customers');
assert.equal(RESTAURANT_BOUNDARY.bridges_to_core.restaurant_location, 'locations');

console.log('Phase 13.8.1 Restaurant Pack Boundary Regression: PASS');
