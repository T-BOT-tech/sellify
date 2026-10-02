import assert from 'node:assert/strict';
import { defineVerticalPack } from '../app/src/verticals/contract.js';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';
import { VERTICAL_PACK_MANIFESTS } from '../shared/vertical-pack-manifests.js';

assert.equal(LOGISTICS_PACK.pack_id, 'logistics');
assert.deepEqual(LOGISTICS_PACK.roles, [
  'logistics_manager',
  'logistics_dispatcher',
  'logistics_courier',
  'logistics_viewer',
]);
assert.deepEqual(LOGISTICS_PACK.navigation_contributions, ['logistics']);
assert.deepEqual(LOGISTICS_PACK.device_requirements, []);
assert.deepEqual(LOGISTICS_PACK.offline_requirements, [
  'canonical-command-outbox',
  'reconciliation',
]);
assert.deepEqual(LOGISTICS_PACK.localization_resources, ['logistics']);
assert.deepEqual(LOGISTICS_PACK.optional_capabilities, []);

const manifest = VERTICAL_PACK_MANIFESTS.logistics;
assert.deepEqual(manifest.roles, LOGISTICS_PACK.roles);
assert.deepEqual(manifest.navigation_contributions, ['logistics']);
assert.equal(manifest.configuration.niche_switch, 'config.logisticsEnabled=true');

// The manifest remains declarative: adding product metadata must not create
// persistence, activation mutation, or a second authorization authority.
assert.equal(LOGISTICS_PACK.routes.length, 0);
assert.equal(LOGISTICS_PACK.permissions.length, 0);
assert.ok(LOGISTICS_PACK.core_dependencies.includes('fulfillment'));
assert.ok(LOGISTICS_PACK.core_dependencies.includes('inventory'));
assert.ok(LOGISTICS_PACK.domain_entities.includes('Shipment'));

const legacyCompatible = defineVerticalPack({
  pack_id: 'legacy-pack',
  name: 'Legacy',
  version: '1.0.0',
  capabilities: ['example'],
  domain_entities: ['Example'],
  core_dependencies: ['commerce'],
});
assert.deepEqual(legacyCompatible.roles, []);
assert.deepEqual(legacyCompatible.optional_capabilities, []);
assert.deepEqual(legacyCompatible.navigation_contributions, []);
assert.deepEqual(legacyCompatible.device_requirements, []);
assert.deepEqual(legacyCompatible.offline_requirements, []);
assert.deepEqual(legacyCompatible.localization_resources, []);

console.log('Phase 13.10.17 Logistics Pack Productization Regression: PASS');
