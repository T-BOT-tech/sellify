import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LOGISTICS_AUTHORITY_MAP, logisticsAuthorityContract } from '../app/src/verticals/logistics/authority-map.js';
import { logisticsConfigurationContract } from '../app/src/verticals/logistics/config-contract.js';
import { logisticsFulfillmentBoundaryContract } from '../app/src/verticals/logistics/fulfillment-boundary.js';
import { logisticsProofReturnContract } from '../app/src/verticals/logistics/proof-return-contract.js';

const manifest = 'phase0/PHASE13.10.8-BASELINE-SOURCE-HASHES.sha256';
const result = execFileSync('sha256sum', ['-c', manifest], { encoding: 'utf8' });
assert.match(result, /OK/);

const lines = readFileSync(manifest, 'utf8').trim().split('\n').filter(Boolean);
assert.equal(lines.length, 19);
const packageJson = readFileSync('package.json', 'utf8');
assert.match(packageJson, /test:phase13\.10\.8/);
assert.equal(LOGISTICS_AUTHORITY_MAP.core.order, 'commerce');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.stock, 'inventory');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.payment, 'payments');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.fulfillment_lifecycle, 'app/src/logistics/fulfillment.js');

const authority = logisticsAuthorityContract();
assert.equal(authority.duplicate_authority, false);
assert.equal(authority.persistence, 'existing_order_and_core_state_only');
assert.deepEqual(authority.logistics_owned, ['Courier', 'Route', 'Shipment', 'Delivery', 'Proof', 'Return']);
assert.equal(logisticsConfigurationContract().duplicate_configuration_authority, false);
assert.equal(logisticsFulfillmentBoundaryContract().duplicate_fulfillment_authority, false);
assert.equal(logisticsProofReturnContract().duplicate_inventory_authority, false);

console.log('Phase 13.10.8 Baseline Re-Lock Regression: PASS');
console.log(`Verified runtime: ${process.version}`);
console.log('Supported release runtime remains Node >=24; Node 22 is not release certification.');
